# Backend — обзор нескольких скриптов (тестовая заметка)

Электрон-приложение (main/preload + менеджеры). Ниже — разбор трёх backend-файлов.

## Backend/ipcChannels.js
Единый источник истины для всех имён IPC-каналов. Используется `preload.js`
(мост в renderer) и `handlers/*.js` (main-процесс). Экспортирует строковые
константы, сгруппированные по доменам:
- Window: `WIN_MIN`, `WIN_MAX`, `WIN_CLOSE`, `WIN_OS_CLOSE`, `WIN_OPEN_EXTERNAL`
- Mod/BG3: select/unpack/repack PAK и архивов, открытие папки мода
- Translation: `TRANSLATE_STRINGS`, `TRANSLATE_ABORT`, `TRANSLATE_ITEM_PROGRESS`
- Projects: save/load/delete/load-all
- XML: `XML_EXPORT`, `XML_IMPORT`
- Auth: get-state/login/logout/refresh/save-local-name
- Dictionary/Glossary: get-all/add/update/delete/export/import/reset
- Settings: способ перевода, настройки, прокси-пул/конфиг, get
- Onboarding: get/update
- .NET: check/install/install-progress
- Updater: get-state/check/download/install/finalize/event
- Ollama: статус, pull/cancel/delete модели, install/uninstall, start/stop server,
  reset-context, ensure-running + события прогресса/статуса

## Backend/manager/dictionaryManager.js
Singleton-менеджер пользовательского глоссаря (экспортируется уже инстансом).
- Хранит записи в `glossary/<user file>`; при отсутствии — грузит из default-файла.
- Запись = `{ id, source, target, tag }` (tag по умолчанию `mechanics`).
- API: `initialize`, `getAll`, `addEntry`, `updateEntry`, `deleteEntry`,
  `resetToDefaults`, `exportToFile`, `importFromFile`, `getStoragePath/Directory`.
- Интеграция с переводом: `toGlossaryPairs`, `protectInText`, `restoreFromMap`
  (через `dictionary_utils/textProcessor`).
- `_nextId()` = max существующего id + 1; persist через `_save()` (JSON, 2 пробела).

## Backend/manager/shared_utils/textUtils.js
Набор чистых строковых утилит:
- `toSafeString`, `hasText` — безопасное приведение/проверка непустого текста.
- `normalizeLanguage(language, fallback)` — lower-case + fallback.
- `escapeRegExp` — экранирование спецсимволов regex.
- `isRateLimitError` — детект 429 по statusCode/сообщению.
- `buildGlossaryLookup` — массив пар → lookup-объект (ключи в lower-case).
- `normalizeGameMarkupSpacing` — расстановка пробелов вокруг игровой разметки
  вида `[123]`, `[#123]` и тегов `<...>` (кроме `<br>`).
