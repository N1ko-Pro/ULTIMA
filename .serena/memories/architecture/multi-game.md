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

## ОСТАЁТСЯ: репак (write-back в .dll)
Инструмент умеет `inject`, `mscToolCli.inject` готов, но кнопка `MOD_REPACK`
в редакторе ещё BG3-only — обобщить через контракт `pack` и подключить MSC.

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

## ВАЖНО: репак (write-back в DLL) НЕ реализован
- Сохранение ПРОЕКТА (переводы JSON) работает для MSC через generic-пайплайн.
- Сборка/репак (MOD_REPACK → bg3Manager.saveAndRepack, кнопка pack в редакторе)
  всё ещё BG3-only и НЕ обобщена. Для MSC внедрение переводов обратно в .dll
  (перезапись `#US` + токенов `ldstr` или инструмент на Mono.Cecil) — отдельный
  сложный шаг. Сейчас кнопка pack у MSC вызовет BG3-логику и упадёт с ошибкой —
  надо обобщить MOD_REPACK через контракт (`pack`) и реализовать MSC-репак.

### Следующие фазы (НЕ сделаны)
- Обобщить MOD_REPACK через контракт `pack`; реализовать запись строк в .dll
  для MSC (правка `#US`-кучи + `ldstr`-токенов, либо .NET-инструмент Cecil).
- Фаза 2: выделить `Backend/core/`.
- Frontend: per-game компоненты воркспейса при необходимости.

## TODO (по мере запросов пользователя)
- Per-game рабочее пространство (StartPage/MainPage сейчас BG3-специфичны:
  .pak, Divine, bg3Manager и т.д.). Ветвление по `selectedGame` ещё не сделано.
- Бэкенд-менеджеры для My Summer Car (пока нет).
