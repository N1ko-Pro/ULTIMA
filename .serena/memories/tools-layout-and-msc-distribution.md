# Раскладка tools/ и дистрибуция MscLocTool

## Структура tools/
- `tools/BG3/` — бинарники инструментов BG3 (Divine.exe, LSLib и т.д.).
  КОММИТЯТСЯ и БАНДЛЯТСЯ в установщик. Раньше лежали в `tools/` (корень).
- `tools/MSC/` — рабочая папка инструмента MscLocTool:
  - ИСХОДНИК (трекается): `MscLocTool.csproj`, `Program.cs`, `README.md` — лежат
    в КОРНЕ `tools/MSC/` (раньше были ошибочно вложены в `obj/` — перенесены).
  - АРТЕФАКТЫ сборки (игнорируются): `obj/`, `bin/`, `publish/`, `win-x64/`.
- `tools_src/` — удалён (старое место), в .gitignore.

## Рабочий процесс инструмента MscLocTool (ВАЖНО)
- Правки/обновления инструмента ведём ЗДЕСЬ, в `tools/MSC/` (исходник трекается
  в этом репо для удобства работы).
- РЕЛИЗИМ инструмент в ОТДЕЛЬНЫЙ репозиторий **N1ko-Pro/ULTIMA_TOOLS**: там
  собирается и публикуется `MscLocTool.exe` ассетом релиза (теги
  `msc-tools-v<версия>`). Приложение скачивает exe ОТТУДА.
- `Backend/games/mysummercar/toolConfig.js`: DOWNLOAD_URL -> ULTIMA_TOOLS,
  TOOL_VERSION='1.1.0', VERSION_FILE='MscLocTool.version' (sidecar для детекта
  устаревшей версии). Скачивается в рантайме в `%APPDATA%/ULTIMA/Tools/MSC`
  (конвенция: `<userData>/Tools/<GAME>` для любых скачиваемых per-game
  инструментов). РЕШЕНО держать в userData, НЕ в `resources/tools/...`:
  установщик `perMachine:true` (Program Files) -> resources не доступна на
  запись обычному пользователю, скачивание туда падало бы. userData всегда
  writable. MSC initialize: `path.join(userDataPath, 'Tools', 'MSC')`.
- Воркфлоу `build-msc-tool.yml` в app-репо УДАЛЁН (его место — в ULTIMA_TOOLS).

## Политика .gitignore (актуальная)
- `build/` (ресурсы установщика electron-builder, buildResources): через
  `build/*` + негейты ТРЕКАЮТСЯ `nsis/`, `icon.ico`, `installer.nsh`,
  `license_en_US.txt`, `license_ru_RU.txt`. ИГНОРИРУЮТСЯ `release-notes.md`
  (генерится release.js) и `.gitkeep`.
- `tools/MSC/`: `tools/MSC/*` + негейты `!*.cs`, `!*.csproj`, `!README.md` —
  трекаем исходник, игнорируем все build-папки.
- Проверено `git check-ignore`: ресурсы build и исходник MSC трекаются;
  release-notes, obj/win-x64/publish — игнорируются.

## Что чинилось после переноса tools -> tools/BG3
1. `Backend/games/bg3/manager/bg3Manager.js`: путь к Divine `tools/` ->
   `tools/BG3` (конструктор + initialize: `path.join(unpackedPath,'tools','BG3')`).
2. `package.json` build: `files` и `asarUnpack` `tools/**/*` -> `tools/BG3/**/*`
   (иначе установщик тащил бы ~200МБ артефактов tools/MSC; electron-builder
   копирует с диска независимо от .gitignore).
3. `divineCliUtils` берёт toolsDir из переданного пути — править не нужно.

## Serena MCP (запуск)
Установлена как ПОСТОЯННЫЙ uv-tool (не uvx-эфемерно):
`C:\Users\anick\.local\bin\serena.exe`. В `.kiro/settings/mcp.json` зовётся
напрямую (`start-mcp-server --context claude-code --project ...`) — мгновенный
старт, Kiro поднимает сам. Обновление: `uv tool upgrade serena-agent`.
Прежние падения (-32000 Connection closed) были из-за uvx, пересобиравшего
serena из git HEAD при каждом старте -> таймаут.

## Git-состояние
Перенос tools (старые `tools/*` deleted, новые `tools/BG3/*`, исходник
`tools/MSC/*`) и правки .gitignore ещё НЕ закоммичены — жду явной просьбы.
Удалён неиспользуемый `Backend/VS Projects.code-workspace`.
