# Поддержка нескольких игр (multi-game)

Добавлена промежуточная страница выбора игры между приветствием и рабочим
пространством. Сейчас 2 игры: `bg3` (Baldur's Gate 3) и `mysummercar`
(My Summer Car).

## Поток навигации (App.jsx → ActivePage)
1. `AuthPage` — приветствие (overlay, `appState.isHomeOverlayOpen`), кнопки
   «Начать» / Discord. Клик «Начать» → `handleNavigateToProjects`.
2. `HomePage` (НОВОЕ) — выбор игры. Показывается, когда
   `!selectedGame || isGameSelectOpen` и нет открытого проекта.
3. `StartPage` — рабочее пространство (список проектов). Это «workspace».
4. `MainPage` — редактор перевода.

При повторном запуске, если `selectedGame` уже сохранён, сразу открывается
`StartPage` (HomePage пропускается).

## Реестры игр (ids должны совпадать!)
- Frontend: `Frontend/Games/registry.js` — `GAMES`, `DEFAULT_GAME_ID`,
  `getGameById`, `isValidGameId`. Определения игр в
  `Frontend/Games/<id>/game.js` (декларативные: id, name, developer, icon
  (lucide), available, accent-классы). Сюда же класть будущие per-game утилиты.
- Backend: `Backend/games/gameRegistry.js` — `GAMES`, `GAME_IDS`,
  `DEFAULT_GAME_ID`, `isValidGameId`.

## Страница выбора
`Frontend/Windows/Home/HomePage.jsx` + `components/GameCard.jsx`,
`components/HomeBackground.jsx`. Стиль повторяет StartPage (PageBackground,
`start-fade-in`). Карточка недоступной игры (`available:false`) → бейдж
«Скоро», не кликается.

## Состояние (Core/Services/AppStateService.js)
- `selectedGame` (persisted), `isGameSelectOpen` (transient).
- `handleSelectGame(gameId)` — set + persist через `onboardingApi.update`.
- `handleOpenGameSelect()` — открыть выбор повторно (кнопка Gamepad2 в правом
  верхнем углу StartPage).
- Бутстрап читает `selectedGame` из onboarding.

## Persistence
`selectedGame` хранится в onboarding-конфиге (`%APPDATA%/.../onboarding.json`).
- Дефолты: `Backend/handlers/onboardingHandlers.js` (getDefaultConfig) и
  `Backend/manager/firstRunManager.js` (getDefaultOnboarding) → `selectedGame: null`.
- `ONBOARDING_UPDATE` валидирует `selectedGame` через `isValidGameId` реестра.

## Локализация
Секция `games` в `Frontend/Locales/{ru,en}.js`: title, subtitle, open, soon,
current, change, cards.<id>.desc.

## Алиасы
Добавлен `@Games` → `Frontend/Games` в `vite.config.js` и `jsconfig.json`.

## Изображения игр (drag-and-drop)
`Frontend/Games/gameImages.js` через `import.meta.glob` автоматически
подхватывает картинки из папки `Images` внутри игры (учитывается только
префикс, всё после `_` — свободная заметка):
- `Frontend/Games/<id>/Images/Title_*.{png,jpg,jpeg,webp,avif}` → баннер карточки.
- `Frontend/Games/<id>/Images/Back_*.{png,jpg,jpeg,webp,avif}` → фон рабочего
  пространства.
Реестр добавляет к каждой игре поля `cardImage` / `workspaceImage` (или null →
фолбэк на градиент+иконку). Файла нет → ошибки сборки нет.

## Карточки = баннеры
`GameCard.jsx` — вертикальный постер `aspect-[2/3]`. Сетка в HomePage:
`grid-cols-2 sm:grid-cols-3 lg:grid-cols-4`, до 4 в ряд, `max-w-[1000px]`.
Картинка `object-cover` + нижний скрим для читаемости названия. Без картинки —
градиент `accent.gradient` + иконка по центру.

## Фон рабочего пространства (рваный край)
`Frontend/Windows/Start/components/WorkspaceBackdrop.jsx` — широкая полоса
вверху StartPage. Непрозрачна у левого/правого краёв экрана, к центру уходит в
прозрачность через `mask-image: linear-gradient(to right, #000 0, transparent
34%, transparent 66%, #000 100%)`. Эффект «порванной страницы»: родитель с
`filter: url(#ws-torn-*)` (feTurbulence + feDisplacementMap) смещает уже
замаскированного потомка → рваная граница. StartPage получает `selectedGame`,
резолвит игру через `getGameById`, передаёт `workspaceImage`.

## Проекты привязаны к игре
- Поле `game` в записи проекта. Нормализатор `Backend/manager/project_utils/
  normalizer.js`: `normalizeProjectRecord` и `toProjectSummary` проставляют
  `game`; легаси-записи без поля → `DEFAULT_GAME_ID` ('bg3') через
  `isValidGameId` из `Backend/games/gameRegistry`.
- Тег при создании/сохранении: `useProjectManager({ selectedGame })`
  (ProjectService) кладёт `game: selectedGame` в projectData в `handleOpenFile`
  и `handleSaveProject`. В App.jsx: `useProjectManager({ selectedGame:
  appState.selectedGame })`.
- Фильтрация в рабочем пространстве: StartPage фильтрует список по
  `selectedGame` (`gameProjects = projects.filter(p => (p.game||DEFAULT) ===
  selectedGame)`), затем `displayProjects`. Так в MSC не видны проекты BG3.

## Форматы файлов DropZone — per-game
В описании игры поле `fileTypes` (bg3: PAK/ZIP/RAR, mysummercar: DLL/ZIP/RAR).
StartPage передаёт `formats={activeGame?.fileTypes}` в `DropZone`, который
рендерит чипы из пропа (фолбэк DEFAULT_FORMATS = PAK/ZIP/RAR).
ВНИМАНИЕ: пока изменены только ВИЗУАЛЬНЫЕ чипы. Реальная обработка .dll (пикер
файлов, unpack, drag-валидация в useDragAndDrop, handleOpenFile) НЕ реализована
— это следующий шаг.

## Реструктуризация бэкенда (Фаза 1 — выполнено)
BG3-специфика вынесена в `Backend/games/bg3/`:
- `Backend/games/bg3/manager/` — bg3Manager.js, xmlManager.js, bg3_utils/, xml_utils/
- `Backend/games/bg3/handlers/` — modHandlers.js, xmlHandlers.js, archiveUtils.js
- `Backend/games/bg3/index.js` — КОНТРАКТ игрового модуля:
  `{ id, manager, xmlManager, initialize(userDataPath, appPath),
     registerHandlers({ mainWindow, app }) }`.
- `Backend/games/index.js` — реестр backend-модулей игр
  (`getGameModule(id)`, `listGameModules()`). `gameRegistry.js` остаётся для
  id-метаданных/валидации (используется normalizer и onboarding).
- `main.js`: `const games = require('./games')`; в whenReady цикл
  `games.listGameModules().forEach(g => g.initialize(...))`; в
  `registerAllHandlers` передаётся `games`.
- `handlers/index.js`: `registerAllHandlers({...games, services})` —
  регистрирует window + per-game (`game.registerHandlers`) + generic handlers.
  bg3Manager берётся как `games.getGameModule('bg3').manager`.

Относительные пути из перемещённых файлов: до `Backend/manager/...` →
`../../../manager/...` (из manager/ или handlers/ внутри bg3),
а из `bg3_utils/` → `../../../../manager/...`. Общие (shared_utils, aiManager,
smartManager, handlerUtils, ipcChannels) НЕ переезжали — остались в Backend/.

main.js / preload.js / ipcChannels.js и имя пакета `bg3-ultima` оставлены на месте.

## Развязка проектного пайплайна (Фаза 3 — выполнено)
generic→bg3 утечки устранены. Контракт игрового модуля расширен:
`{ id, initialize, registerHandlers, loadProject(record), deleteProjectArtifacts(record) }`.
- `Backend/games/bg3/projectModule.js` — вся BG3-специфика проектов:
  `loadProject` (распаковка zip/rar + `bg3Manager.unpackAndLoadStrings`),
  `deleteProjectArtifacts` (очистка workspace-папок + кэша; сюда переехали
  `buildWorkspaceDeletionTargets`/`removeWorkspaceTargets`).
- `Backend/manager/projectManager.js` теперь ЧИСТО generic: `saveProject`,
  `loadProjectSummaries`, `getProjectById`, `deleteProjectRecord` (только JSON).
  Удалены: `initialize`, `loadProjectForEditing`, workspace-логика,
  импорт bg3 workspaceUtils.
- `Backend/handlers/projectHandlers.js` generic: PROJECT_LOAD/DELETE резолвят
  игровой модуль по `record.game` через `games.getGameModule(...)` и делегируют
  (`gameModule.loadProject` / `deleteProjectArtifacts`). Подпись:
  `registerProjectHandlers(getUserDataPath, { projectManager, games })`.
- `main.js`: убран вызов `projectManager.initialize`.
- Замечание: TRANSLATE_STRINGS/ABORT живут в `games/bg3/handlers/modHandlers.js`
  (через `bg3Manager.translateBatch`) — перевод уже внутри bg3-модуля.

## My Summer Car — извлечение строк из DLL (через dnlib-инструмент)
MSC-моды = управляемые .NET .dll; строки = операнды IL `ldstr`. РЕШЕНО
использовать dnlib (не ручной парсер — он удалён).
- `MscLocTool` — C#-CLI на dnlib (`extract`/`inject`), исходник + README +
  .csproj. ВЫНЕСЕН в отдельный репозиторий `N1ko-Pro/ULTIMA_TOOLS`
  (`MscLocTool/`), здесь, в ULTIMA, его исходников больше НЕТ. Собирается
  self-contained single-file win-x64, публикуется ассетом GitHub-релиза
  ULTIMA_TOOLS.
- id строки = `'u'+sha256(text)[:16]`; одинаковый в C# (`MakeId`) и Node
  (`dll_utils/stringId.js`) — должны совпадать.
- `dll_utils/mscToolCli.js` — обёртка над exe (configure/isPresent/extract/
  inject через execFile, JSON stdout). `dll_utils/mscToolDownloader.js` —
  скачивание exe по https с редиректами+прогрессом в `%APPDATA%/ULTIMA/tools/msc`.
- `dll_utils/archiveDll.js` — извлечение .dll из zip/rar.
- `mscManager.js` — `loadStrings(filePath, ext)` → `{ strings:{id:text},
  modInfo, workspaceDirName:null }` через `mscToolCli.extract`. Без JS-фолбэка.
- `toolConfig.js` — TOOL_VERSION, EXE_NAME, DOWNLOAD_URL (placeholder, заменить
  на реальный релиз!), SIZE_MB.
- `index.js` — контракт MSC + ЗАВИСИМОСТИ: `checkDependencies()` (есть ли exe),
  `installDependencies(onProgress)` (скачать). `ingest`/`loadProject` через
  mscManager. `initialize(userDataPath)` настраивает путь к tools/msc.

## Система зависимостей по играм (generic, выполнено)
По образцу .NET-флоу BG3, но игро-агностичная (BG3 .NET-флоу НЕ трогали).
- Контракт игры: опц. `checkDependencies()` → `{ok, missing:[{id,name,version,
  sizeMb}]}`, `installDependencies(onProgress)`.
- Каналы `DEPS_CHECK`/`DEPS_INSTALL`/`DEPS_INSTALL_PROGRESS`;
  `Backend/handlers/dependencyHandlers.js` роутит по gameId. preload:
  `depsCheck`/`depsInstall`/`onDepsInstallProgress`. API `Frontend/API/deps.js`.
- `ingestHandlers` ГЕЙТИТ импорт: перед `ingest` зовёт `checkDependencies`;
  если не ok → `{success:false, dependencyMissing:true, gameId, missing}`.
- `Frontend/UI/Modal/DependencyModal.jsx` — generic модалка (список missing,
  install+прогресс, later/retry). Локали — секция `deps` в ru/en.
- `AppStateService`: state `depsModalOpen/depsMissing/depsGameId`,
  `openDepsModal/closeDepsModal/handleInstallDeps`.
- Точки открытия модалки: (1) App.jsx useEffect на `selectedGame` (вход в игру:
  выбор + каждый запуск) → check → openDepsModal + запись уведомления
  (`action:'deps-modal'`); (2) попытка открыть мод (ProjectService.handleOpenFile
  ловит `dependencyMissing` → `onDependencyMissing` → openDepsModal); (3) центр
  уведомлений: NotifyCenter обрабатывает `deps-modal` → TitleBarCore
  `onDepsModalClick` → App `openDepsModal(selectedGame, depsMissing)`.

## Сборка MscLocTool (СОБРАН и проверен; исходники переехали в ULTIMA_TOOLS)
- Инструмент мигрирован в репозиторий `N1ko-Pro/ULTIMA_TOOLS` (`MscLocTool/`).
  Сборка теперь идёт там (CI `build-msc-tool.yml` + ручной publish).
- Команда сборки (в ULTIMA_TOOLS): `dotnet publish MscLocTool/MscLocTool.csproj
  -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true
  -p:IncludeNativeLibrariesForSelfExtract=true -o publish`.
  Результат: один `MscLocTool.exe` ~65 МБ (проверено на .NET SDK 10, таргет net8.0).
- Проверено: extract даёт строки с id `u<hex16>`; id-ы СОВПАДАЮТ с
  `stringId.makeStringId` (Node); inject возвращает `{replaced:N}` и пишет .dll.
- Для локального теста exe скопирован в `%APPDATA%/ULTIMA/tools/msc/
  MscLocTool.exe` → `checkDependencies` = ok, `ingest` извлекает строки через
  инструмент. Полный backend-путь MSC работает.

## Дистрибуция инструмента (релиз ОПУБЛИКОВАН)
- Репозиторий инструмента: `N1ko-Pro/ULTIMA_TOOLS`. DOWNLOAD_URL в
  `toolConfig.js` обновлён на
  `https://github.com/N1ko-Pro/ULTIMA_TOOLS/releases/download/msc-tools-v1.0.0/MscLocTool.exe`.
- Релиз `msc-tools-v1.0.0` уже создан в ULTIMA_TOOLS (prerelease, не latest),
  ассет `MscLocTool.exe` (~68.7 МБ) выложен и скачивается (HTTP 200).
- `build-msc-tool.yml` живёт в ULTIMA_TOOLS — по тегу `msc-tools-v*` собирает
  self-contained single-file exe и прикладывает к релизу (prerelease,
  make_latest:false). Также workflow_dispatch для ручного запуска.
- Версионирование: поднять TOOL_VERSION в `toolConfig.js` (ULTIMA) + запушить
  совпадающий тег `msc-tools-v<версия>` в ULTIMA_TOOLS.

## Репак: generic-контракт `pack` + MSC `replace` (ВЫПОЛНЕНО; патч-режим в работе)
Спека `.kiro/specs/msc-translation-patch/`. Сделано:
- `MOD_REPACK` обобщён в игро-независимый роутер `Backend/handlers/repackHandlers.js`
  (зарегистрирован в handlers/index.js): резолвит `games.getGameModule(gameId)`,
  даёт `ctx = { promptOutputPath(defaultName, filters), onProgress(percent) }`,
  делегирует в `game.pack(input, ctx)`. `input = { updatedData, modName,
  targetLanguage, mode, originalPakPath }`. Канал прогресса `MOD_REPACK_PROGRESS`
  ('repack-progress').
- BG3 `pack()` перенесён в `games/bg3/index.js` (поведение 1:1 с прежним
  хендлером, игнорирует mode/originalPakPath). `MOD_REPACK` УДАЛЁН из
  `games/bg3/handlers/modHandlers.js` (там остались TRANSLATE_*).
- ВАЖНО (изоляция игр): мета-ключи НЕ фильтруются в общем хендлере — BG3 берёт
  name/author/uuid/description из updatedData для meta.lsx. Фильтрацию делает
  КАЖДАЯ игра у себя. Нейтральный помощник `manager/shared_utils/translationData.js`
  (`stripMetaKeys`) — НЕ под bg3/.
- MSC: `Backend/games/mysummercar/packManager.js` (`pack` подключён в index.js).
  Режим `replace` РАБОТАЕТ end-to-end: переразрешает исходный .dll из
  originalPakPath (read-only; архив → temp), extract → `translationTable.js`
  buildTranslationTable (только id из extract, непустые после trim, мета
  отброшены) → `mscToolCli.inject` → zip {<translated>.dll, info.json}. Исходник
  НЕ мутируется, temp чистится в finally, `pack` не бросает (возвращает
  {success,error}).
- Frontend проброс: preload `repackMod(payload)`, `API/pak.js` repack({gameId,
  translations, modName, targetLanguage, mode, originalPakPath}),
  `ProjectService.handleSavePak` шлёт gameId+originalPakPath. mode пока undefined
  → packManager дефолтит на 'replace'. Кнопка pack у MSC теперь работает (replace).
- Тесты (в `npm test`): translationData.test.js (P1), mscTranslationTable.test.js
  (P2/P3), mscPackManager.test.js — stubbed пайплайн + guarded реальный round-trip
  на `Backend/tests/MSCQualityTweaks.dll` (P4/P6, end-to-end). Все зелёные.

### ОСТАЁТСЯ по спеке
Node-сторона патч-режима ГОТОВА:
- `dll_utils/assemblyName.js` — чистый JS-ридер CLI-метаданных (.NET), читает
  имя сборки из таблицы Assembly (проверено: MSCQualityTweaks.dll → "MSCQualityTweaks");
  `resolveTargetAssembly` с фолбэком на имя файла.
- `toolConfig.js` — два инструмента (TOOLS: MSC_TOOL + MSC_PATCHER), legacy-экспорты
  сохранены. `mscToolDownloader` обобщён (`downloadAsset`/`downloadToolById`).
  `dll_utils/patcherTool.js` — путь/наличие/версия патчера (configure в index.initialize).
- `packManager.buildPatchArtifact` — zip {Mods/UltimaLocPatcher.dll,
  Mods/Config/UltimaLoc/<modid>.json (таблица+манифест), info.txt}; patcher absent →
  {success:false, error:'PATCHER_MISSING', missingTool:'msc-patcher'} (без диалога).
- `index.checkDependencies` — оба инструмента в `tools[]`; патчер НЕ блокирует
  открытие (ok = только наличие MscLocTool), НЕ в on-entry missing.
  `installDependencies(onProgress, toolId)` ставит нужный инструмент.
- Тесты: mscAssemblyName.test.js, патч-секции в mscPackManager.test.js (вкл.
  реальный артефакт с настоящим targetAssembly), P7 в mscTranslationTable.test.js.
  Весь `npm test` зелёный; `npm run lint` чистый.

Patch-режим UI (ВЫПОЛНЕНО) и C#-патчер (ВЫПОЛНЕН исходник+сборка+тесты):
- Патчер `UltimaLocPatcher` написан в `tools/MSC-Patcher/` (src/LocId, LocStore
  +LocStore.Io, LocPatch, UltimaLocMod). Собирается реально `dotnet build -c
  Release` против MSCLoader 1.4.2 + Harmony **1.2** (namespace `Harmony`/
  `HarmonyInstance`, НЕ HarmonyX!). MSCLoader API: ModSetup()+SetupFunction(
  Setup.OnMenuLoad, ...). Транспайлер по всем методам targetAssembly меняет
  ldstr по LocId.Make (== stringId.js/Program.cs). Юнит-тесты: tools/MSC-Patcher/
  tests (net8, 5 зелёных, golden-векторы из Node). Референсы (Origin Files,
  MSCLoader, MSCModLoader-1.4.2) + bin/obj — в .gitignore (копирайт/размер),
  трекается только src/*.cs, *.csproj, README, tests/*.cs.

Релиз патчера ПОДГОТОВЛЕН (CI-собираем без игровых DLL):
- csproj патчера переведён на net35 через NuGet
  `Microsoft.NETFramework.ReferenceAssemblies.net35`; зависимости —
  редистрибутируемые `tools/MSC-Patcher/References/{MSCLoader,0Harmony,
  Newtonsoft.Json}.dll` (трекаются в git). Игровые DLL не нужны для сборки.
  Проверено: выход ссылается на mscorlib 2.0.0.0 (грузится в Unity Mono).
- Workflow `tools/MSC-Patcher/ci/build-loc-patcher.yml` (тег `loc-patcher-v*`,
  prerelease, тесты+сборка+upload ассета). Инструкция `tools/MSC-Patcher/RELEASE.md`.
- .gitignore: References/ трекается; Origin Files/MSCLoader/MSCModLoader-1.4.2/
  bin/obj — игнор.

ФИКС ПЕРЕВОДА НАСТРОЕК (v1.0.2): транспайлер переводит только «живые» строки
(геттер Name мода). Подписи настроек (Settings.Add* аргументы), элементы
DropDown/SliderInt и Description мода МАТЕРИАЛИЗУЮТСЯ при загрузке (LoadModsSettings
→ A_ModSettings.Invoke) ДО нашего OnMenuLoad — транспайлер их не достаёт.
Решение: `src/LocSettings.cs` — после загрузки рефлексией идём по
ModLoader.LoadedMods → mod.modSettingsList, переводим ModSetting.Name (через
internal UpdateName, обновляет и UI), массивы ArrayOfItems (DropDown) и TextValues
(SliderInt), Placeholder (TextBox), и mod.Description. Вызывается из
Mod_OnMenuLoad после транспайлера. Ключевые internal-члены MSCLoader берём
рефлексией (Mod.modSettingsList, ModSetting.Name/UpdateName); ModLoader.LoadedMods
и Mod.Description — публичные.

ФИКС КРАША ПАТЧЕРА (v1.0.1): в игре падало с "Could not load type
System.ComponentModel.INotifyPropertyChanging" — Newtonsoft.Json несовместим с
урезанным Unity-Mono System.dll в MSC. Решение: убрали Newtonsoft из патчера,
JSON парсится встроенным `src/MiniJson.cs` (без зависимостей). References/ теперь
только MSCLoader.dll + 0Harmony.dll. Перевыпущен тег `loc-patcher-v1.0.1`;
`toolConfig.js` MSC_PATCHER.version='1.0.1' + URL на этот тег. ВАЖНО: патчер
ОСТАЁТСЯ необязательным для открытия мода (пользователь передумал делать его
обязательным) — checkDependencies гейтит только MscLocTool.

РЕЛИЗ ОПУБЛИКОВАН (N1ko-Pro/ULTIMA_TOOLS):
- Запушены ветка `feat/loc-patcher` (исходник `UltimaLocPatcher/` +
  `.github/workflows/build-loc-patcher.yml`) и тег `loc-patcher-v1.0.0`.
- CI отработал успешно; создан prerelease с ассетом `UltimaLocPatcher.dll`
  (10 КБ). Скачивание по `MSC_PATCHER.downloadUrl` из toolConfig.js проверено
  (HTTP 200, managed-сборка: mscorlib 2.0.0.0 / MSCLoader 1.4.2 / 0Harmony 1.2.0.1).
- Патч-режим MSC теперь полностью рабочий end-to-end в приложении (тул скачается
  через систему зависимостей при первой patch-сборке).

ОСТАЁТСЯ по желанию:
- Смержить PR `feat/loc-patcher` → main в ULTIMA_TOOLS (релиз уже существует,
  не блокирует).
- Живая проверка BG3 + MSC (replace/patch) в приложении и smoke патчера в игре.

Frontend патч/replace (ВЫПОЛНЕНО):
- `PackModal` получил `gameId`; для MSC показывает выбор режима (patch
  «рекомендуется» / replace) с пояснениями; `onPack(mode)` → `confirmPack(mode)`
  → `handleSavePak(mode)`. BG3 — без выбора (один режим).
- `ProjectService.handleSavePak(mode)`: state `isPacking`/`packProgress`,
  подписка на `pakApi.onProgress`, проброс mode; `PATCHER_MISSING` → не ошибка,
  а `onDependencyMissing(selectedGame, missing)` (открывает deps-модалку патчера).
- Прогресс/состояние: канал `MOD_REPACK_PROGRESS` → preload `onRepackProgress`
  → `API/pak.onProgress`; LoadingOverlay показывает «Упаковка… NN%».
- `ToolStatusWidget` уже многоинструментальный → патчер отображается сам с
  кнопкой установки. Локали pack.modes.* и common.packing* в ru/en.
- npm test (79) зелёный, npm run lint чистый, vite build проходит.

## Generic game-routed ingest (выполнено)
Путь импорта мода обобщён (был BG3-хардкод):
- Каналы: `MOD_SELECT` ('mod-select'), `MOD_INGEST` ('mod-ingest') в ipcChannels.
- `Backend/handlers/ingestHandlers.js` — generic: диалог выбора по extensions +
  роутинг `games.getGameModule(gameId).ingest(filePath, ext)`. Зарегистрирован
  в handlers/index.js.
- Контракт игры расширен методом `ingest(filePath, ext)`. BG3 `ingest` в
  `games/bg3/projectModule.js` (распаковка + unpackAndLoadStrings).
- Удалены устаревшие BG3-каналы/хендлеры: MOD_SELECT_FILE/SELECT_PAK/UNPACK_PAK/
  UNPACK_ARCHIVE (из modHandlers + preload). modHandlers оставил
  TRANSLATE_*/REPACK/OPEN_FOLDER.
- preload: `selectModFile(extensions)`, `ingestMod({filePath,ext,gameId})`.
- Frontend `API/files.js`: `selectModFile`, `ingestMod` (старые удалены).
- `ProjectService`: handleSelectFile берёт extensions из
  `getGameById(selectedGame).fileTypes`; handleOpenFile зовёт `ingestMod(...,
  selectedGame)`.
- `useDragAndDrop({acceptedExtensions})` + DropZone передаёт расширения из
  game.fileTypes → drag принимает .dll для MSC.

## (УСТАРЕЛО) Репак — см. раздел «Репак: generic-контракт pack + MSC replace»
- Сохранение ПРОЕКТА (переводы JSON) работает для MSC через generic-пайплайн.
- Репак ОБОБЩЁН через контракт `pack`; MSC `replace` работает end-to-end.
  Патч-режим MSC (отдельный артефакт + патчер) ещё в работе по спеке
  `msc-translation-patch`.

### Следующие фазы (НЕ сделаны)
- Патч-режим MSC: artifact + C#-патчер UltimaLocPatcher (Harmony transpiler) в
  репозитории ULTIMA_TOOLS (см. спеку msc-translation-patch).
- Фаза 2: выделить `Backend/core/`.
- Frontend: per-game компоненты воркспейса при необходимости.

## TODO (по мере запросов пользователя)
- Per-game рабочее пространство (StartPage/MainPage сейчас BG3-специфичны:
  .pak, Divine, bg3Manager и т.д.). Ветвление по `selectedGame` ещё не сделано.
- Бэкенд-менеджеры для My Summer Car (пока нет).

## Физическое разделение данных по играм (на диске) — ВЫПОЛНЕНО
Раньше всё хранилось плоско. Теперь — подпапки по «короткому» имени игры.
- Реестр: `Backend/games/gameRegistry.js` — у каждой игры поле `folder`
  (`bg3`→`BG3`, `mysummercar`→`MSC`) + `getGameFolder(id)` (фолбэк на
  дефолтную игру для легаси/невалидных id).
- Проекты (JSON): `<userData>/projects/<FOLDER>/<id>.json`.
  - `project_utils/fileIO.js`: `ensureProjectsRoot`,
    `ensureProjectsDirectory(userDataPath, folder)`,
    `listProjectJsonFiles(dir)`, `buildProjectFilePath`, `readProjectFile`.
  - `manager/projectManager.js`: `saveProject` пишет в папку по
    `getGameFolder(record.game)` и удаляет старую копию, если путь изменился;
    `getProjectById`/`deleteProjectRecord` ищут файл через `findProjectFile`
    (сканируют все game-папки + легаси-корень — id это UUID, уникален);
    `loadProjectSummaries` сканирует все папки и дедупит по id;
    `migrateLegacyProjects(userDataPath)` — разовый best-effort перенос плоских
    `projects/*.json` в папку по `game` (дефолт BG3). Подписи IPC-хендлеров НЕ
    менялись → `projectHandlers.js` не трогали. Вызов миграции в `main.js`
    (whenReady, после dictionaryManager.initialize).
- Workspace-артефакты BG3: `<userData>/workspace/BG3/...`.
  `bg3Manager.initialize` ставит `workspaceDir = workspace/BG3` и зовёт
  `_migrateLegacyWorkspace` (переносит «свободные» папки из `workspace/` в
  `workspace/BG3`, пропуская зарезервированные имена game-папок, не
  перетирая существующие, best-effort). MSC: `workspace/MSC` (в основном
  пустая — MSC распаковывает во временные папки), задаётся в `index.initialize`.

## «Открыть папку» — generic, маршрутизация по игре — ВЫПОЛНЕНО
- Контракт игрового модуля расширен опц. методом `getWorkspaceFolder()`:
  - BG3 (`games/bg3/index.js`): `cachedData.modWorkspaceDir || workspaceDir`
    (папка текущего загруженного мода, иначе корень `workspace/BG3`).
  - MSC (`games/mysummercar/index.js`): возвращает `workspace/MSC`.
- Канал `MOD_OPEN_FOLDER` ('open-mod-folder') СТАЛ generic: хендлер удалён из
  `games/bg3/handlers/modHandlers.js` (там убран неиспользуемый импорт `shell`)
  и добавлен в `Backend/handlers/ingestHandlers.js` (там добавлены `shell`,
  `fs`): резолвит `games.getGameModule(gameId).getWorkspaceFolder()`, создаёт
  папку при отсутствии, `shell.openPath`, возвращает строку ошибки при сбое.
- `gameId` прокинут с фронта: preload `openModFolder(gameId)` →
  `Frontend/API/appWindow.js` `openModFolder(gameId)` → `TopBar` (проп `gameId`,
  кнопка FolderOpen) → `MainPage` (проп `gameId`) → `App.jsx`
  (`gameId={appState.selectedGame}`).


## MSC — редактор: UUID скрыт, описание из DLL — ВЫПОЛНЕНО
- UUID — это BG3-концепт (meta.lsx). `SideBar` получил проп `gameId`
  (App → MainPage → SideBar); блок UUID обёрнут в `{showUuid && ...}`,
  где `showUuid = gameId !== 'mysummercar'`. Для MSC блок не рендерится.
- Описание мода для MSC берётся из DLL: новый `Backend/games/mysummercar/
  dll_utils/assemblyInfo.js` → `readAssemblyDescription(dllPath)` — чистый JS
  парсер PE → .rsrc → RT_VERSION → VS_VERSIONINFO, возвращает
  Comments(AssemblyDescription) || FileDescription(AssemblyTitle) ||
  ProductName, '' при любой ошибке (без нативных зависимостей).
  `mscManager.buildModInfo(sourcePath, dllPath)` зовёт его; `loadStrings`
  передаёт `resolved.dllPath` (до удаления temp). Описание попадает в
  `modInfo.description` → блок «Описание мода» в SideBar.
- ВАЖНО / ограничение: это AssemblyDescription, НЕ внутриигровое
  MSCLoader `Mod.Description` (IL-строка-литерал). Чтобы взять именно
  Mod.Description (и сделать его переводимым/реинжектируемым), нужно
  расширить MscLocTool (dnlib) в репозитории ULTIMA_TOOLS, чтобы он помечал
  нужный ldstr (name/author/description). Реинжект описания для MSC всё ещё
  не реализован (как и общий MSC-репак).


## Классификатор технических строк (MSC) — Фаза 1 — ВЫПОЛНЕНО
Цель: при выдаче строк из DLL отделять переводимый текст от технического
(идентификаторы, пути, ключи, форматы). Данные НЕ удаляются — помечаются.

Бэкенд (generic, без ИИ, оффлайн, объяснимо):
- `Backend/manager/stringClassifier/rules.js` — взвешенные СТРУКТУРНЫЕ детекторы
  (path/assetExt/parenTag/snake/camel/allCaps/alnumMix/keyword/noSpace +
  негативные multiword/sentence/hasSpace). Веса подобраны; пороги
  `THRESHOLDS={technical:3, text:-2}`.
- `Backend/manager/stringClassifier/index.js` — `classifyString(text, ctx?)` и
  `classifyStrings(items)`. Три полосы: 'technical' | 'uncertain' | 'text'.
  Консервативный байас: одиночные слова (Open/Fold/Trigger/Button) → 'uncertain'
  (видимы, помечены), не прячем. Второй проход — кластеризация по префиксу
  `Prefix_`: 'uncertain' с ≥2 техническими «соседями» → 'technical' (reason
  'cluster'). API принимает необязательный `context` (зацеплено под будущий
  IL-контекст из MscLocTool — Фаза 2 — без переделки вызовов).
- Проверено на примерах пользователя: все `MSCQualityTweaks_*`, `ITEMS`,
  `car jack(itemx)`, путь, `ThisPart` → technical; `Fold/Trigger/Open/Button`
  → uncertain. Тест был временным (`_selftest.js`), удалён после прогона.
- `mscManager.loadStrings` зовёт `classifyStrings` и возвращает `stringMeta`
  ({id:{category,score,reasons}}) рядом со `strings`. Прокидывается через
  index.js (ingest/loadProject спредят `...result`).

Фронтенд:
- `projectShape.mapStringDictionaryToRows(strings, meta)` — ряд получает
  `{id, original, category, techReasons}` (дефолт category 'text' → BG3 не
  затронут). `ProjectService` передаёт `stringMeta` в обоих путях (open/load).
- `MainTable`: технические скрыты по умолчанию; тумблер «Технические скрыты/
  видны (N)» в тулбаре (только при `hasClassified`, т.е. MSC). Прогресс
  (translated/total) считается ТОЛЬКО по нетехническим. Переопределения per-row
  персистятся в `translations._techOverride` ({id:'technical'|'text'}),
  сохраняются при clearAll, как `_bookmarks`.
- `VirtualTableRow`: технические ряды приглушены (opacity), у каждого ряда
  кнопка-гаечный-ключ (Wrench) для перевода между technical/text; тултип
  показывает причины (`t.editor.techReasons[code]`). Контрол виден только при
  активной классификации (`onToggleTechnical` приходит только для MSC).
- `collectPendingTranslationRows` исключает effective-technical из
  авто-перевода (не тратим бюджет ИИ на идентификаторы). BG3 не затронут.
- Локали: `editor.techHidden/techShown/techShowTitle/techHideTitle/
  markTechnical/markTranslatable/techReasons{...}` в ru.js и en.js.

Следующие фазы (по желанию): Фаза 2 — IL-контекст из MscLocTool (ULTIMA_TOOLS),
решает спорные слова; Фаза 3 — Ollama для серой зоны; Фаза 4 — общий denylist.


## Классификатор — Фаза 2 (IL-контекст) — consumer ВЫПОЛНЕН
- `Backend/manager/stringClassifier/context.js` — база знаний «sink → вердикт».
  `scoreContext(context)` даёт большой знаковый вес (±8, доминирует над
  структурными порогами ±3): DISPLAY-sink → текст (показывается игроку),
  TECHNICAL-sink → технический. Сигналы: `sinks` (API, напр.
  `UnityEngine.GameObject::Find` → тех; `UnityEngine.GUI::Label`/`::set_text`/
  MSCLoader Settings/ModUI → дисплей), `roles` (tag/name/key/path… vs
  label/message/text…), `fields` (имена полей, токенизируются по camelCase/
  snake → 'stateName' распознаётся). Если оба сигнала — взаимозачёт, решает
  структура. reason-коды: 'ctxTechnical' (в тултипе), 'ctxDisplay' (нет).
- `index.js classifyString` прибавляет `scoreContext` к структурному score.
  Полностью обратносовместимо: нет контекста → поведение Фазы 1.
- `mscManager.loadStrings` читает `context` из литералов и кладёт в items.
  `mscToolCli.extract` JSDoc: `{ id, text, context? }` (context опционален —
  старые сборки тула без него работают как раньше).
- Проверено (временный тест, удалён): "Open"+Find→technical, "Open"+GUI.Button
  →text, "Trigger"+role tag→technical, "Fold"+field stateName→technical,
  display-sink спасает структурно-технический ярлык, без контекста → как Фаза 1.

## Фаза 2 — патч MscLocTool — ВЫПОЛНЕН
Исходники инструмента лежат в соседнем репо `c:\Project\ULTIMA_TOOLS\MscLocTool`
(доступны с этой машины). Пропатчен `Program.cs`:
- `Extract` теперь агрегирует по id (сохраняя first-seen порядок) и для каждой
  строки собирает `context` через `AnalyzeUsage`: forward-scan (до 6 инструкций)
  от `ldstr` до первого Call/Callvirt/Newobj (→ `sinks`: "Type::Method") или
  Stfld/Stsfld (→ `fields`: имя поля); останавливается на ветвлении/возврате.
  Выводит `{ id, text, context?: { sinks?[], fields?[] } }` (context опускается,
  если сигналов нет). `inject` не тронут. Добавлен класс `Entry`.
- Версия: `MscLocTool.csproj` → 1.1.0; `toolConfig.js` TOOL_VERSION → '1.1.0'.
- Сборка `dotnet build -c Release` проходит (.NET 10 SDK на машине). Проверено
  на dnlib.dll: 1541 строк, 946 с context, sinks атрибутируются корректно.
- ОСТАЛОСЬ (релиз, делает пользователь): закоммитить ULTIMA_TOOLS и запушить тег
  `msc-tools-v1.1.0` → workflow соберёт и выложит MscLocTool.exe; приложение уже
  указывает на v1.1.0. Я НЕ коммитил/пушил (git-safety).


## Авто-обновление MscLocTool у пользователя — ВЫПОЛНЕНО
Раньше `checkDependencies` проверял только наличие exe → юзер со старой версией
никогда не получал апдейт. Теперь — по версии:
- `toolConfig.js`: добавлен `VERSION_FILE = 'MscLocTool.version'` (сайдкар-файл
  с версией) + экспорт.
- `mscToolDownloader.downloadTool`: после успешной загрузки пишет
  `<toolDir>/MscLocTool.version` = TOOL_VERSION; перед rename удаляет старый exe
  (на Windows renameSync не перезаписывает) → апдейт корректно overwrite'ит.
- `mscToolCli.getInstalledVersion()` — читает сайдкар (null, если нет — напр.
  установка старым билдом без маркера).
- `index.checkDependencies()`: ok ТОЛЬКО если exe есть И версия === TOOL_VERSION.
  Иначе `{ok:false, missing:[{..., outdated:present, installedVersion}]}`.
  Триггеры уже есть: App.jsx зовёт depsApi.check при входе в игру; ingest гейтит.
  Значит юзер со старым тулом (или без маркера) автоматически получит модалку.
- UI: `DependencyModal` различает install vs update (`isUpdate = missing.some
  outdated`): заголовок/описание/кнопка → `deps.updateTitle/updateDescription/
  updateNow`; в строке инструмента показывается `v<installed>` (зачёркнуто) →
  `v<new>`. App.jsx-нотификация тоже update-aware (`deps.updateNotif*`).
- Локали: `deps.updateTitle/updateDescription/updateNow/updateNotifTitle/
  updateNotifMsg` в ru.js и en.js.
Итог: при следующем релизе тула достаточно поднять TOOL_VERSION (уже 1.1.0) —
пользователи со старым exe увидят «Доступно обновление» и перекачают.


## Обновление MscLocTool — НЕ блокирует (исправлено)
Важно: апдейт не должен мешать открыть мод со старым тулом.
- `checkDependencies` теперь: `ok = present` (наличие exe гейтит использование),
  `updateAvailable = present && версия!=TOOL_VERSION` (не блокирует), `missing`
  несёт либо install-item (нет exe), либо update-item (outdated:true) для модалки.
- `dependencyHandlers` пробрасывает `updateAvailable`.
- `ingestHandlers` гейтит по `!ok` (= только отсутствие exe) → устаревший, но
  присутствующий тул мод открывает нормально (Phase 1 без контекста).
- App.jsx (вход в игру): если `!ok` → openDepsModal (обязательная установка);
  если `updateAvailable` → НЕ открывает модалку, только `primeDepsModal`
  (ставит depsGameId/depsMissing без открытия) + info-уведомление
  `deps.updateNotif*` (action 'deps-modal' → открыть из колокольчика по желанию).
- AppStateService: добавлен `primeDepsModal(gameId, missing)` (set без open).
Итог: обновление предлагается ненавязчиво, отказ не мешает работе со старой
версией; отсутствие тула по-прежнему требует установки.
