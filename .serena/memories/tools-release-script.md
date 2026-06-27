# Релиз инструментов: scripts/release-tool.js

Единый скрипт релиза внешних C#-инструментов (зеркало `npm run release` для
приложения, но инструменты собирает GitHub Actions в репо ULTIMA_TOOLS, а не
electron-builder локально).

## Запуск
- `npm run release:tool` (интерактив) или
- `node scripts/release-tool.js <msc-loc-api|msc-tool> <patch|minor|major|none> [--skip-build]`
  (ПЕРЕИМЕНОВАНО: бывший `loc-patcher` теперь `msc-loc-api`, тег `MSCLoc-API-v<ver>`.)
- Подтверждение релиза читается со stdin (можно `"y`n" | node ...`).
- Нужен `GH_TOKEN`/`GITHUB_TOKEN` в `.env` (scope `repo`). Пуш в ULTIMA_TOOLS
  идёт по URL `https://x-access-token:<token>@github.com/N1ko-Pro/ULTIMA_TOOLS.git`
  (токен маскируется в логах), теги — force-push.

## Что делает (по шагам)
1. Читает текущую версию из `<Version>` нужного .csproj.
2. Бампит версию во всех местах:
   - patcher: `tools/MSC-Patcher/UltimaLocPatcher.csproj <Version>` +
     `tools/MSC-Patcher/src/UltimaLocMod.cs` (`Version => "x.y.z"`) +
     `toolConfig.js` блок `MSC_PATCHER` (version + тег в downloadUrl).
   - msc-tool: `tools/MSC/MscLocTool.csproj <Version>` + `toolConfig.js`
     блок `MSC_TOOL`. (.cs-версии нет.)
   - bump=none → пере-релиз текущей версии без правок версии.
3. Локальная проверка сборки (`dotnet build`, для patcher + `dotnet run` тестов).
   Пропуск: `--skip-build`.
4. Клон `tools_src/ULTIMA_TOOLS` (если нет — клонирует): fetch + checkout main +
   `reset --hard origin/main`, затем зеркалит исходник инструмента в подпапку
   (`UltimaLocPatcher/` или `MscLocTool/`). Директории зеркалятся (старые файлы
   удаляются), затем `git add -A` + commit + push в main.
5. Удаляет существующий релиз/тег этой версии через GitHub API (чистый старт CI).
6. Создаёт и (force) пушит тег `loc-patcher-v<ver>` / `msc-tools-v<ver>` →
   запускает CI-воркфлоу в ULTIMA_TOOLS.
7. Поллит GitHub API пока CI не опубликует ассет (до ~8 мин).
8. Бампит-коммит версии в репо приложения — ТОЛЬКО при didBump=true и только
   нужные файлы (csproj, .cs, toolConfig.js).

## Маппинг исходников app-репо → ULTIMA_TOOLS
- loc-patcher: `tools/MSC-Patcher/` → `UltimaLocPatcher/`
  (sync: src/, References/, tests/, UltimaLocPatcher.csproj, README.md, RELEASE.md)
- msc-tool: `tools/MSC/` → `MscLocTool/`
  (sync: Program.cs, MscLocTool.csproj, README.md)

## CI в ULTIMA_TOOLS
- `.github/workflows/build-loc-patcher.yml` — триггер тег `loc-patcher-v*`,
  собирает net35, тесты net8, аттачит `UltimaLocPatcher.dll` (prerelease,
  make_latest:false).
- `build-msc-tool.yml` — тег `msc-tools-v*` → `MscLocTool.exe` (self-contained
  single-file win-x64, prerelease).

## Обновление (rename + Latest)
- 28.06.2026: тег патчера переименован `loc-patcher-v*` → `MSCLoc-API-v*`,
  CLI-id `loc-patcher` → `msc-loc-api`. Все старые `loc-patcher-*` релизы/теги
  удалены, выпущен `MSCLoc-API-v1.1.0`. CI теперь `prerelease:false, make_latest:true`
  (свежий тег = Latest на GitHub).
- Приложение определяет версию патчера ДИНАМИЧЕСКИ с GitHub
  (`Backend/games/mysummercar/dll_utils/patcherRelease.js`): max semver среди
  `MSCLoc-API-v*` с ассетом `MSCLocAPI.dll`, фолбэк/пол — закреплённая
  `MSC_PATCHER.version` в toolConfig.js.

## История
- Патчер `loc-patcher-v1.0.3` выпущен этим скриптом (фикс перевода кейбиндов
  в `tools/MSC-Patcher/src/LocSettings.cs`). Ассет подтверждён опубликованным.
- ВАЖНО: `tools/MSC-Patcher/` в app-репо пока UNTRACKED (?? в git status) —
  исходник патчера живёт здесь как рабочая копия, релизится в ULTIMA_TOOLS.
