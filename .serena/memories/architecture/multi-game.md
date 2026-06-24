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

## TODO (по мере запросов пользователя)
- Per-game рабочее пространство (StartPage/MainPage сейчас BG3-специфичны:
  .pak, Divine, bg3Manager и т.д.). Ветвление по `selectedGame` ещё не сделано.
- Бэкенд-менеджеры для My Summer Car (пока нет).
