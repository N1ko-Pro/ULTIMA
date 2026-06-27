# MSC — интеграция с игрой (установка патчера/перевода прямо в игру)

Цель: убрать дублирование патчера в каждом артефакте. Патчер ставится ОДИН раз
в игру; перевод в patch-режиме может писаться прямо в игру. Движок (патчер) и
данные (таблица) разделены.

## Бэкенд (ВЫПОЛНЕНО, протестировано)
- `dll_utils/gamePath.js` — детект пути к MSC через Steam: `findSteamRoots`
  (реестр `reg query` HKCU/HKLM + ProgramFiles fallback) → `libraryfolders.vdf`
  (`parseSteamLibraries`, чистая/тестируемая) → ищет
  `steamapps/common/My Summer Car/mysummercar.exe`. `detectGamePath()`,
  `isValidGamePath()`, path-хелперы `getModsFolder/getReferencesFolder/getConfigFolder`.
  Проверено вживую: находит `D:\SteamLibrary\...\My Summer Car`.
- `gameIntegration.js` — стор пути (`<userData>/Tools/MSC/integration.json`),
  `setGamePath/detectAndStore/getGamePath`, `installPatcher()` (копирует
  скачанный UltimaLocPatcher.dll в `<game>/Mods/`), `installTable(modId, json)`
  (пишет `<game>/Mods/Config/UltimaLoc/<modId>.json`), `getStatus()`.
  ВАЖНО: патчер ставится в `Mods/`, НЕ в `Mods/References/` — MSCLoader
  запускает Mod-лайфхук (OnMenuLoad) только для `Mods/` (проверено по исходникам
  LoadReferences — референсы грузятся как библиотеки без инстанцирования Mod).
  Константа `PATCHER_INSTALL_SUBDIR='Mods'` — легко поменять, если патчер
  переделать в self-init reference.
- `packManager.buildPatchArtifact` теперь по `input.target`:
  - `'game'` → проверяет gamePath + патчер в игре, пишет таблицу через
    installTable, без zip. Ошибки: `GAME_PATH_MISSING`, `PATCHER_MISSING_GAME`.
  - `'zip'` (или не задан) → прежний самодостаточный архив (патчер+таблица+readme),
    ошибка `PATCHER_MISSING` если патчер не скачан.
  replace-режим без изменений (zip с DLL).
- MSC `index.js` контракт расширен: `getGameIntegration/detectGamePath/
  setGamePath/installPatcherToGame(onProgress)`. `gameIntegration.configure(toolDir)`
  в initialize.
- IPC: `gameIntegrationHandlers.js` (generic-роутер по gameId) + каналы
  GAME_GET_INTEGRATION/DETECT_PATH/SET_PATH/PICK_PATH/INSTALL_PATCHER.
  preload: gameGetIntegration/gameDetectPath/gameSetPath/gamePickPath/
  gameInstallPatcher. `Frontend/API/gameIntegration.js`.
- repack payload получил `target`; pak.js repack + repackHandlers прокинуты.
- Тест `mscGamePath.test.js` (парсер vdf). В npm test. Всё зелёное.

## Фронтенд (ВЫПОЛНЕНО)
- `AppStateService.js` — состояние `gameIntegration {supported,status}` + действия
  `refreshGameIntegration/detectGamePath/pickGamePath/installPatcherToGame`
  (прогресс установки патчера идёт по каналу deps `onInstallProgress`).
- `App.jsx` — в entry-effect помимо `checkDeps` вызывает `refreshGameIntegration`;
  пробрасывает в StartPage `gameIntegration` + onDetectGamePath/onPickGamePath/
  onInstallPatcher/onRefreshIntegration.
- НОВЫЙ `Windows/Start/components/MscIntegrationPanel.jsx` — панель в правом
  верхнем углу рабочего пространства MSC (squircle как ToolStatusWidget, иконка
  Gamepad2). Три секции: «Папка игры» (найдена/не найдена + детект/выбор),
  «Патчер перевода» (установлен/установить в игру + прогресс), «Инструменты»
  (MscLocTool; патчер ИСКЛЮЧЁН из списка — фильтр по id `msc-patcher`).
  Glyph-цвет агрегируется ТОЛЬКО по обязательным build-инструментам.
- `StartPage.jsx` — для `selectedGame==='mysummercar'` рендерит
  MscIntegrationPanel, иначе прежний ToolStatusWidget (BG3 без изменений).
- `UI/Modal/PackModal.jsx` — ПЕРЕРАБОТАН: крупнее (max-w-lg), карточки выбора.
  Для MSC: селектор режима (patch/replace), для patch — тумблер доставки
  «Прямо в игру (target='game') / Собрать архив (target='zip')». При выборе
  «в игру» показывает блок готовности (папка игры + патчер) с кнопками
  детект/выбор/установка; кнопка «Установить в игру» заблокирована пока не
  gameFound && patcherInstalled. Модалка сама дёргает `@API/gameIntegration`.
  onPack(mode, target).
- `TopBar.jsx` — `confirmPack(mode, target) → onSavePak(mode, target)`.
- `ProjectService.handleSavePak(mode, target)` — прокидывает target; обработка
  кодов: PATCHER_MISSING→onDependencyMissing, GAME_PATH_MISSING/
  PATCHER_MISSING_GAME→notify.error, успех target==='game'→notify
  «установлено в игру» с result.installedTo вместо filePath.
- Локали: добавлена секция `integration.*` (ru/en) + pack.delivery/setup/
  confirmToGame/installedToGame*/errGamePath*/errPatcherGame* (ключи синхронны).

## Доработки панели (раунд 2, ВЫПОЛНЕНО)
- Бэкенд: версия патчера ТЕПЕРЬ пишется сайдкаром `<game>/Mods/UltimaLocPatcher.version`
  при установке. `gameIntegration.getStatus()` возвращает `patcherName`,
  `patcherVersion` (целевая), `patcherInstalledVersion` (из сайдкара),
  `patcherUpToDate`. Добавлены `uninstallPatcher()` и `getInstalledPatcherVersion()`.
  `index.installPatcherToGame` теперь перекачивает патчер, если кэш устарел
  (служит и кнопкой «обновить»); добавлен `uninstallPatcherFromGame()`.
  Новый IPC-канал `GAME_UNINSTALL_PATCHER` + handler + preload `gameUninstallPatcher`
  + API `uninstallPatcher`. AppState: действие `uninstallPatcherFromGame`.
- Панель: glyph-иконка/кружок ОРАНЖЕВЫЕ при незавершённой настройке (нет пути,
  патчер не установлен или устарел), красные только если отсутствует обязательный
  build-инструмент, зелёные когда всё готово. Секция патчера показывает ИМЯ
  (UltimaLocPatcher), версию (`v1.0.2` или `v1.0.1 → v1.0.2`), пилюлю «Актуально»
  как у инструмента, кнопку обновления при устаревании и кнопку удаления (Trash2).
  Карточка установленного MscLocTool получила зелёную подсветку (как остальные блоки).

## Перекомпоновка UI рабочего пространства (раунд 3, ВЫПОЛНЕНО)
- Панель интеграции переехала из правого верхнего угла в ВЕРХНИЙ ЦЕНТР. Триггер —
  squircle 48px (иконка `Blocks`, т.к. Gamepad2 занят кнопкой «сменить игру»),
  по клику выезжает широкая панель сверху (grid-rows `0fr↔1fr` + clip-path reveal,
  как у `AutoTranslatePanel`), 3 колонки: Папка игры | Патчер | Инструменты,
  шапка с заголовком/статусом + язычок-сворачивание снизу. Esc/клик-вне закрывают.
- Иконка настроек вынесена из rail в правый верхний угол (`top-5 right-6`).
- Новый общий компонент `Windows/Start/components/StartIconButton.jsx` — единый
  squircle 48px/глиф 22px. `StartLauncherRail` переписан на вертикальный стек
  StartIconButton (смена игры + о приложении), без LauncherDock (Home не затронут).
- StartPage: верх-центр = MscIntegrationPanel (MSC) / ToolStatusWidget (иначе),
  верх-право = настройки. Текст туториала stepButtons обновлён (ru/en).
- Локали: добавлены `integration.collapse/remove/toolsEmpty` (ru/en).

Проверено: `npx eslint` чисто, `npm run build` ок, `npm test` зелёные.