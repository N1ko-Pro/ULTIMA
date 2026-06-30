# Раскладка tools/ (актуальная, после реорганизации)

Всё инструментальное живёт ТОЛЬКО в `tools/`. Всё трекается и пушится в ЭТОМ репо
(никаких отдельных gitignore-ограничений на структуру). MSC C#-инструменты ДОПОЛНИТЕЛЬНО
релизятся в N1ko-Pro/ULTIMA_TOOLS через `scripts/release-tool.js`.

```
tools/
  BG3/
    Divine/            — бинарники Divine/LSLib (49 файлов). Бандлятся в установщик.
  MSC/
    MSCLoc-API/        — рантайм-патчер модов (бывш. tools/MSC-Patcher). src/, References/,
                         tests/, ci/build-loc-patcher.yml, MSCLocAPI.csproj, README, RELEASE.
    MSCLoader-RU/      — мод-русификатор интерфейса MSCLoader (бывш. tools/MSCLoader-RU).
                         src/, data/mscloader-ru.json, MSCLoaderRU.csproj.
    MSCLoc-Tool/       — dnlib extract/inject (бывш. tools/MSC). Program.cs, MscLocTool.csproj, README.
    MOP-Revival/       — пока пустая (.gitkeep).
  reference/           — ИССЛЕДОВАТЕЛЬСКОЕ (не для сборки): MSCLoader/, MSCModLoader-1.4.2/,
                         Origin Files/. Сюда складывать всё research.
```

## Переименования (без пробелов!) и переезды
- `tools/MSC-Patcher` → `tools/MSC/MSCLoc-API`
- `tools/MSCLoader-RU` → `tools/MSC/MSCLoader-RU`
- `tools/MSC` (исходник MscLocTool) → `tools/MSC/MSCLoc-Tool`
- `tools/BG3/*` → `tools/BG3/Divine/*`
- research из MSC-Patcher → `tools/reference/`
- УДАЛЕНО: `tools/_diag/`, `tools_src/`, все build-выхлопы.
Имена без пробелов — иначе ломались `release-tool.js` (spawnSync shell:true) и dotnet/CI.

## Что обновлено под новые пути (если снова двигать — править здесь же)
- `Backend/games/bg3/manager/bg3Manager.js` — `toolsDir` → `tools/BG3/Divine` (конструктор
  + ветка packaged `app.asar.unpacked/tools/BG3/Divine`). divine.exe берётся оттуда.
- `package.json` — `files`/`asarUnpack` остались `tools/BG3/**/*` (покрывают `Divine/`), правка не нужна.
- `scripts/release-tool.js` — appDir/csproj/csVersionFile/workflow.src/build для обоих
  MSC-инструментов; `CLONE_DIR` теперь `.ultima_tools_clone/` (бывш. `tools_src/ULTIMA_TOOLS`).
- `tools/MSC/MSCLoader-RU/MSCLoaderRU.csproj` — линки движка `..\MSCLoc-API\src\...` + References.
- `.gitignore` — единый блок tools: игнор только `tools/**/{bin,obj,publish,win-x64}/` +
  `.ultima_tools_clone/`; остальное (вкл. `tools/reference/`) трекается.
- CI `build-loc-patcher.yml` НЕ трогали: он собирает СИНХРОнизированную копию в ULTIMA_TOOLS
  (`PROJECT_DIR: MSCLocAPI`, плоско), путь этого репо ему не важен.

Проверено: все 3 csproj собираются, тесты MSCLoc-API 22/22, ресурс MSCLoader-RU вшит,
`node --check scripts/release-tool.js` OK.

Старая память `tools-layout-and-msc-distribution` — УСТАРЕЛА (описывала прежние tools/MSC и
tools/BG3 без подпапок). См. также `mem:tools/msc-patcher-engine`, `mem:tools/mscloader-ru`.
