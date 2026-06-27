# Design Document

## Overview

Документ описывает техническую архитектуру «патч-сборки» перевода для My Summer Car (MSC) и
обобщение пайплайна упаковки под произвольную игру.

Ключевые решения:

1. **Единый контракт упаковки.** Обработчик `MOD_REPACK` перестаёт быть BG3-специфичным и
   делегирует сборку методу `pack(...)` игрового модуля. BG3 переносит текущую
   `saveAndRepack` под этот метод без изменения поведения. Новые игры подключаются только
   реализацией `pack(...)`.

2. **Патч-режим MSC через runtime IL-rewrite (Harmony Transpiler).** Захардкоженные `ldstr`
   литералы оригинального мода нельзя перехватить «снаружи» обычным Harmony-префиксом, но
   **транспайлер** умеет править IL метода в памяти при первом джиттинге. Универсальный
   патчер-мод (MSCLoader) при загрузке находит сборку оригинального мода и применяет ко всем
   её методам один транспайлер, который заменяет операнды `ldstr` по `id` из таблицы
   переводов. Оригинальный `.dll` на диске **не изменяется** → перевод сосуществует с
   оригиналом.

3. **Универсальный патчер + таблица переводов на проект.** Патчер — один переиспользуемый
   `.dll` (поставляется как downloadable-ассет из ULTIMA_TOOLS, как `MscLocTool`). Перевод —
   это JSON-таблица `id → текст` + манифест (имя целевой сборки, метаданные). Под каждый
   оригинал отдельный патчер НЕ генерируется.

4. **Замена DLL — управляемый fallback.** Режим `replace` через существующий `MscLocTool
   inject` остаётся доступным, когда патч неприменим/не выбран.

## Architecture

```mermaid
flowchart TD
  subgraph Renderer
    PB[Кнопка «Упаковать» / PackModal MSC] -->|mode: patch|replace| RM[repackMod IPC]
  end
  RM --> H[MOD_REPACK handler<br/>games.getGameModule.pack]
  H -->|bg3| BG[bg3 module.pack → saveAndRepack]
  H -->|mysummercar| MSC[msc module.pack]
  MSC -->|mode=patch| PT[buildPatchArtifact]
  MSC -->|mode=replace| RP[MscLocTool inject → .dll]
  PT --> TBL[translations.json id→text]
  PT --> MAN[manifest.json target assembly + meta]
  PT --> PD[UltimaLocPatcher.dll downloadable]
  TBL & MAN & PD --> ZIP[zip артефакт]

  subgraph Game[В игре MSCLoader]
    PD2[UltimaLocPatcher] -->|on load| FIND[найти сборку оригинала по имени]
    FIND --> TRANS[Harmony transpiler на все методы]
    TRANS --> SWAP[ldstr: id=MakeId → text из таблицы]
  end
```

## Components and Interfaces

### 1. Игровой контракт упаковки

Расширяем контракт игрового модуля (`Backend/games/<id>/index.js`) методом:

```text
pack(input, ctx) -> Promise<{ success, filePath?, mode?, error? }>

input = {
  updatedData,        // переводы { id|uid -> текст } (UI-объект, с мета-ключами)
  modName,            // имя для результата
  targetLanguage,     // код языка
  mode,               // 'patch' | 'replace' (игра решает, что поддерживает)
  originalPakPath,    // путь к исходному файлу мода (для MSC — .dll/.zip/.rar)
}
ctx = {
  promptOutputPath(defaultName, filters) -> Promise<string|null>,  // диалог сохранения
  onProgress(percent),                                             // прогресс (0..100)
}
```

- `MOD_REPACK` handler (в `bg3/handlers/modHandlers.js` → переносится в общий слой) делает:
  `const game = games.getGameModule(gameId); if (!game.pack) return {success:false,error}`.
- BG3: `pack()` вызывает существующую `bg3Manager.saveAndRepack` (поведение 1:1). BG3
  игнорирует `mode` (всегда патч-`.pak`).
- Метакей-фильтрация (`_bookmarks`, `_techOverride`, `_hidden`, `name`, `author`, `uuid`,
  `description`) реализована как нейтральный помощник `shared_utils/translationData.js`
  (`stripMetaKeys`), но применяется **внутри каждой игры на её шаге внедрения строк**, а НЕ
  в общем хендлере. Причина: BG3 намеренно использует `name`/`author`/`uuid`/`description`
  из `updatedData` для построения `meta.lsx` (`buildTranslationMetaLsx`), а строки в мод
  внедряет только по `contentuid` — мета-ключи в набор внедряемых строк не попадают и так.
  Слепая фильтрация до передачи в BG3 сломала бы meta.lsx (регрессия). Поэтому общий
  хендлер передаёт `updatedData` без изменений, а `stripMetaKeys` вызывает MSC при
  построении таблицы переводов (см. §2/§5). Это соблюдает изоляцию игр: каждая игра решает,
  как обращаться с мета-ключами на своём пайплайне.

> Замечание: сейчас `MOD_REPACK` регистрирует BG3-модуль и держит `cachedData`. В дизайне
> обработчик становится игро-независимым и принимает `gameId` (renderer уже знает активную
> игру). BG3-состояние остаётся внутри BG3-модуля.

### 2. MSC pack-менеджер

Файл `Backend/games/mysummercar/packManager.js` (новый). Отвечает за оба режима.

- **Кэш исходника.** Архивы при ingest распаковываются во временную папку и удаляются,
  поэтому при упаковке оригинальный `.dll` **переразрешается** из `originalPakPath`
  (`resolveDll` повторно; для `.dll` — напрямую, для архива — повторная распаковка во temp).
- **mode = 'replace'.** `mscToolCli.inject(dllPath, table, outDll)` → переведённый `.dll`,
  упаковывается в zip с `info.json` (метаданные), либо отдаётся как `.dll` (решим на этапе
  задач). Предупреждение о перезаписи — на стороне UI.
- **mode = 'patch'.** Формирует артефакт (см. §4): таблица переводов + манифест + копия
  патчер-`.dll`, упакованные в zip. Исходный `.dll` не модифицируется.
- **Имя целевой сборки.** Нужно патчеру, чтобы найти оригинал в рантайме. Расширяем
  `assemblyInfo.js`: помимо описания читаем `AssemblyName` (`module.Assembly.Name`) из DLL.

### 3. Универсальный патчер (ULTIMA_TOOLS → `UltimaLocPatcher`)

Новый MSCLoader-мод, собирается и публикуется в репозитории `ULTIMA_TOOLS` (как `MscLocTool`),
скачивается приложением в `Tools/MSC/`.

Поведение в игре:
1. На загрузке читает все таблицы переводов из известной папки (напр.
   `Mods/Config/UltimaLoc/*.json`) и их манифесты (имя целевой сборки). JSON
   парсится встроенным dependency-free ридером (`MiniJson`), а НЕ Newtonsoft.Json:
   Json.NET ссылается на типы, отсутствующие в урезанном Unity-`System.dll` MSC
   (`INotifyPropertyChanging`), и падает при загрузке (проверено — фикс в v1.0.1).
2. Для каждой записи находит загруженную сборку оригинала по `AssemblyName`.
3. Применяет Harmony-**транспайлер** ко всем методам типов этой сборки. Транспайлер для
   каждого `ldstr` вычисляет `id = MakeId(operand)` и, если `id` есть в таблице с непустым
   значением, подменяет операнд на перевод.
4. `MakeId` идентичен `tools/MSC/Program.cs` и `dll_utils/stringId.js` (sha256, первые 16 hex,
   префикс `u`) — единый контракт идентификаторов между extract / inject / patcher.

Ограничения (фиксируем явно):
- Подменяются только литералы, присутствующие как `ldstr` (как и у `inject`). Строки,
  собранные конкатенацией/форматированием в рантайме, не покрываются.
- Транспайлинг всех методов сборки — единовременная стоимость на загрузку; приемлемо для
  типичных размеров MSC-модов.
- Требуется Harmony, доступный в среде MSCLoader. ВАЖНО: MSCLoader 1.4.2 несёт
  Harmony **1.2** (namespace `Harmony`, `HarmonyInstance`), НЕ HarmonyX —
  патчер использует именно этот API (`HarmonyInstance.Create` + `Patch(original,
  null, null, transpiler)`).

### 4. Формат артефакта (патч-режим)

Zip со структурой, готовой к установке (точные пути уточним под реальные конвенции MSCLoader
на этапе задач):

```text
<ModName>_<lang>_ULTIMA.zip
├── Mods/
│   ├── UltimaLocPatcher.dll              # универсальный патчер (downloadable-ассет)
│   └── Config/UltimaLoc/<modid>.json     # таблица + манифест
└── info.txt                              # человекочитаемая инструкция/метаданные
```

`<modid>.json`:

```json
{
  "schema": 1,
  "targetAssembly": "SomeMscMod",
  "originalModName": "Some MSC Mod",
  "language": "ru",
  "translator": "Имя",
  "appVersion": "1.1.0",
  "entries": { "u0a1b2c3d4e5f6a7b": "Переведённый текст", "…": "…" }
}
```

### 5. Frontend

- **Гейтинг и запуск.** `TopBar` Pack-кнопка уже получает `gameId`; `onSavePak` →
  `ProjectService.handleSavePak` → `pakApi.repack(...)`. Расширяем `repack` параметрами
  `gameId`, `mode`, `originalPakPath`.
- **Выбор режима.** Для MSC перед сборкой показываем выбор «Патч (рядом с оригиналом)» /
  «Замена DLL» с пояснением последствий (Требование 3.2, 5.3). Для BG3 поведение неизменно
  (один режим). Реализация — расширение `PackModal` или отдельная MSC-ветка.
- **Прогресс/итог.** Переиспользуем существующий паттерн прогресса и нотификаций
  (`packed`/`packError`).
- BG3-специфика (UUID, словарь) уже гейтится — без регрессий.

### 6. Зависимости

- Патчер — второй per-game инструмент MSC. Расширяем `toolConfig.js` и
  `checkDependencies()`/`tools[]`, чтобы статус-виджет показывал и `MscLocTool`, и
  `UltimaLocPatcher` (оба нужны: extract/inject + патчер для сборки).
- Упаковка в патч-режиме блокируется, если патчер отсутствует, и направляет в существующий
  поток установки зависимостей (виджет/модалка).
- `.NET` проверка переиспользуется (инструменты — .NET).

## Data Models

```text
PackInput        { updatedData, modName, targetLanguage, mode, originalPakPath }
PackResult       { success, filePath?, mode?, error? }
TranslationTable { schema, targetAssembly, originalModName, language, translator,
                   appVersion, entries: Record<idHash, string> }
ToolStatus(MSC)  tools: [ MscLocTool(status…), UltimaLocPatcher(status…) ]
```

## Correctness Properties

Свойства, проверяемые property-based тестами на Node-стороне (id-контракт, фильтрация,
формирование таблицы) и юнит/интеграционно для C#-инструментов.

### Property 1: Метаключи не утекают в вывод
Для любого `updatedData` итоговая таблица/набор строк НЕ содержит ключей `_bookmarks`,
`_techOverride`, `_hidden`, `name`, `author`, `uuid`, `description`.
**Validates: Requirements 1.4, 8.3**

### Property 2: Валидность таблицы переводов
Все ключи таблицы — это `id`, присутствующие в extract оригинала; все значения непустые
после trim.
**Validates: Requirements 2.3, 4.2**

### Property 3: Детерминизм идентификаторов
`MakeId(s)` стабилен и совпадает между `stringId.js`, `Program.cs` и патчером для любых
входных строк.
**Validates: Requirements 2.2, 5.1**

### Property 4: Round-trip режима замены
После `inject` каждый `ldstr`, чей `id` есть в таблице с непустым значением, равен переводу;
прочие `ldstr` не изменены.
**Validates: Requirements 3.3, 2.3**

### Property 5: Сохранение оригинала при промахе
Патчер переводит литерал тогда и только тогда, когда `id` есть в таблице; отсутствующие `id`
оставляют оригинальный текст (не пустой).
**Validates: Requirements 2.2, 2.3, 5.2**

### Property 6: Неизменность исходника
Хэш исходного файла мода до и после любой упаковки совпадает (упаковка не мутирует вход).
**Validates: Requirements 2.1, 8.1**

### Property 7: Устойчивость к обновлению оригинала
При изменении части строк оригинала переводы с совпавшими `id` продолжают применяться;
несовпавшие — игнорируются без ошибок.
**Validates: Requirements 5.1, 5.2**

## Error Handling

- Нет реализации `pack` у модуля → `{ success:false, error }`, UI показывает понятную ошибку.
- Отсутствует патчер/`MscLocTool`/.NET → блокировка сборки + редирект в поток зависимостей.
- Исходный файл недоступен по `originalPakPath` → внятная ошибка, проект не повреждён.
- Сбой на любом шаге → очистка временных файлов (temp-распаковка, частичный zip), исходник не
  тронут (P6).
- Патчер в игре: целевая сборка не найдена/Harmony недоступен → лог, мод не падает, строки
  остаются оригинальными.

## Testing Strategy

- **PBT (Node):** P1–P3, P7 на чистых функциях (фильтрация метаключей, построение таблицы,
  `MakeId`). Использовать существующий стиль тестов (`Backend/tests/*`).
- **Интеграция (Node↔C#):** на тестовой малой `.dll` — extract → build table → inject (P4),
  и неизменность входа (P6).
- **C# (патчер):** юнит на `MakeId` и транспайлер-логику подмены (P5) на синтетических методах;
  ручная проверка в MSCLoader на реальном моде (smoke).
- **Регрессия BG3:** существующий `saveAndRepack` через новый контракт даёт прежний `.pak`
  (структура Mods/Localization + зависимость).

## Resolved Design Decisions

- **Механизм подмены:** Harmony **transpiler** по всем методам целевой сборки (а не префикс/
  постфикс) — единственный способ затронуть конкретные `ldstr` в памяти, не трогая диск.
- **Универсальность патчера:** один переиспользуемый `UltimaLocPatcher.dll` + таблица на
  проект; пер-мод генерация не требуется.
- **Доставка патчера:** downloadable-ассет из `ULTIMA_TOOLS` (как `MscLocTool`), через
  существующую систему зависимостей.

## Open Risks (валидируем на этапе реализации)

- Реальные конвенции путей MSCLoader для размещения мода и конфигов (структура §4 —
  предварительная).
- Доступность/версия Harmony: РЕШЕНО — MSCLoader 1.4.2 несёт Harmony 1.2
  (0Harmony 1.2.0.1), патчер собран против него.
- Производительность транспайлинга на крупных модах.
