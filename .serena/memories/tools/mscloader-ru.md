# MSCLoader RU — отдельный мод-русификатор интерфейса MSCLoader

Путь: `tools/MSC/MSCLoader-RU/`. Отдельный самодостаточный MSCLoader-мод (ID
`MSCLoaderRU`, класс `MSCLoaderRU : Mod`, `Setup.OnMenuLoad`), который русифицирует
интерфейс САМОГО MSCLoader. Конечный пользователь ставит один DLL в `<game>/Mods/`,
приложение ULTIMA не нужно.

## Перевод КОНСОЛИ (LocConsole)
Дисплейный текст-проход (`LocText`) НЕ может перевести консоль: это один растущий
буфер scrollback, строки в нём конкатенируются → полный `.text` никогда не равен
одной исходной записи. Решение: хук на ЕДИНСТВЕННУЮ точку, через которую проходит
весь вывод — `MSCLoader.ConsoleController.AppendLogLine(string line)` (internal-тип,
резолвится через `typeof(Mod).Assembly.GetType("MSCLoader.ConsoleController")`).
`ModConsole.Print/Error/Warning` все зовут её.

`tools/MSC/MSCLoc-API/src/LocConsole.cs`, `Install(HarmonyInstance)` ставит Harmony-
ПРЕФИКС `BeforeAppend(ref string line)` И делает разовый SWEEP уже накопленного
буфера. Sweep нужен, т.к. часть строк (баннер версии, «Loaded N mods!», «Loading
Asset…», emulator-проверки) печатается на старте загрузчика ДО того, как мод
вызовет `Install` в `OnMenuLoad` — префикс их уже не увидит. Sweep рефлексией берёт
`MSCLoader.ModConsole.console` (internal static ConsoleView) → `.controller` →
`scrollback` (Queue<string>), переводит каждую строку, переписывает очередь и
обновляет `ConsoleView.logTextArea.text` (UnityEngine.UI.Text). Будущие строки
ловит префикс. Общий метод перевода строки — `TryTranslateLine` (используется и
префиксом, и sweep):
1. `LocStore.TryTranslateBlock(line)` — покрывает все `Print(...)` (передаются как
   есть; ключи — полная строка с точными rich-text тегами).
2. Если не совпало — разбор обёртки Error/Warning. `Error/Warning` НЕ передают текст
   напрямую: оборачивают в `<color=red|yellow><b>{asm}Error|Warning: </b>{msg}</color>`
   (`{asm}` = "" для самого загрузчика либо "ИмяМода "). Регексом снимаем обёртку,
   переводим слово (`Error`→`Ошибка`, `Warning`→`Предупреждение` через таблицу) и
   `{msg}` отдельно через `TryTranslateBlock`, собираем обратно (префикс-имя мода и
   теги сохраняем).
БЕЗОПАСНО (в отличие от транспайлера): аргумент — всегда готовый ДИСПЛЕЙНЫЙ текст,
не идентификатор/URL-параметр. Подключение: `<Compile Include=..\MSCLoc-API\src\LocConsole.cs>`
в `MSCLoaderRU.csproj` + `LocConsole.Install(harmony)` в `Mod_OnMenuLoad`.

Источник точных форматных строк — `tools/MSC/References/MSCModLoader-1.4.2/.../`
(`ModConsole.cs`, `ModLoader*.cs`, `ConsoleController.cs`). Интерполяция C# `$"{var}"`
в таблице записывается позиционно как `{0}`,`{1}` (движок строит reverse-шаблон).
Сохранять опечатки разработчика (`Rememeber`, `colsone`, `anyting`, `completly`).

## Сборка
`dotnet build "tools/MSC/MSCLoader-RU/MSCLoaderRU.csproj" -c Release` → `bin/Release/MSCLoaderRU.dll`.
net35, Harmony 1.2.

### Расположение References (ВАЖНО, переезжала)
DLL движка лежат в `tools/MSC/MSCLoc-API/References/` (`MSCLoader.dll`, `0Harmony.dll`).
HintPath'ы:
- `MSCLocAPI.csproj` → `References\MSCLoader.dll` (та же папка).
- `MSCLoaderRU.csproj` → `..\MSCLoc-API\References\MSCLoader.dll` (кросс-папка!).
`release-tool.js` для `msc-loc-api` синкает `References` (относительно appDir) — ОК.
Если когда-нибудь заведём релиз-энтри для MSCLoader-RU — кросс-папочная ссылка
`..\MSCLoc-API\References\` сломается в изолированном клоне (нужно будет копировать
DLL и в MSCLoader-RU). Полные исходники MSCLoader (121 .cs) и Origin Files (game
DLLs) — в `tools/MSC/References/` (НЕ путать с папкой движка выше).

## Архитектура
- **Переиспользует движок** из `tools/MSC/MSCLoc-API/src` через `<Compile Include=..\MSCLoc-API\src\... Link=...>`
  (НЕ копия): LocStore(.Io), LocId, LocText, LocLayout, LocSettings, MiniJson.
  `MSCLocAPI.cs` (точка входа патчера) и `LocPatch.cs` (транспайлер) НЕ линкуются.
  У двух DLL свои копии типов `UltimaLoc.*` и раздельное статическое состояние —
  уживаются вместе (хуки идемпотентны).
- **Встроенная таблица** `data/mscloader-ru.json` (EmbeddedResource), грузится
  через `LocStore.LoadFromJson(встроенный_ресурс)`. Авторится РУКАМИ как пары
  `"strings": { "English source": "Перевод" }` (секция `strings` → `AddBySource`,
  движок сам считает id, UPPER/lower варианты и шаблоны для строк с `{n}`).
- Точка входа читает ресурс по суффиксу имени (`EndsWith("mscloader-ru.json")`).

## КЛЮЧЕВОЕ РЕШЕНИЕ: НЕ транспайлить сборку MSCLoader
В Mod_OnMenuLoad вызываются ТОЛЬКО дисплейные хуки:
`LocSettings.TranslateLoadedSettings()` + `LocSettings.Install` + `LocLayout.Install`
+ `LocText.Install`. **`LocPatch.ApplyToLoadedTargets` НЕ вызывается.**

Почему (грабли, уже наступали): таблица — словарные слова («Mods», «References»,
«Updates», «Version», «Key», «No»…), а `AddBySource` добавляет и нижний регистр.
ldstr-транспайлер не отличает UI от логики и переписывал литералы вроде `"mods"`/
`"references"` в КОДЕ MSCLoader, которым строится запрос проверки обновлений →
сервер отвечал «Invalid request» (ошибки «Не удалось проверить обновления модов/
библиотек»). Дисплейные хуки (`LocText` и т.д.) трогают только `UI.Text.text`, на
логику/сеть не влияют. Меню MSCLoader — uGUI, поэтому текст-проход покрывает его.
=> Транспайлер по сборке самого загрузчика НЕ применять. `LocFormat` (хук
String.Format) тоже не использовать (удалён глобально).

## Грабли сборки
Имя файла-ресурса НЕ должно содержать culture-инфикс через точку: `mscloader.ru.json`
MSBuild принял `ru` за культуру и вынес ресурс в сателлит `ru/MSCLoaderRU.resources.dll`
(в основном DLL `resources=0`). Исправлено: имя `mscloader-ru.json` + на
`<EmbeddedResource>` стоит `WithCulture="false"`. Проверка вшивания: загрузить DLL
и `GetManifestResourceNames().Count == 1`.

## Контент
Таблица покрывает строки настроек/меню/диалогов И консоли (~190 пар, включая
`{n}`-шаблоны для версии загрузчика, ошибок модов, прогресса загрузки/обновлений,
команд консоли). Расширять: брать точные литералы из исходников MSCLoader в
`tools/MSC/References/MSCModLoader-1.4.2/`, добавлять пары в `strings`, пересобрать.

ОБНОВЛЕНИЕ: тот же дисплейный подход теперь и в патчере модов `MSCLocAPI` —
ldstr-транспайлер (`LocPatch`) отключён ВЕЗДЕ, т.к. ломал моды (перевод литералов-
идентификаторов: GameObject.Find("Saturday")→«Суббота», имена FSM/состояний
PlayMaker и т.п.). Перевод только через `UI.Text` (LocText/LocSettings/LocLayout +
шаблоны). Подробности и причина — в `mem:tools/msc-patcher-engine`.

См. также `mem:tools/msc-patcher-engine` — патчер модов и общий движок.
