# MSCLoc API (рантайм-переводчик модов MSC) + общий движок

Путь: `tools/MSC/MSCLoc-API/` (трекается, CI `ci/build-loc-patcher.yml` публикует DLL).
net35, Harmony **1.2** (`Harmony`/`HarmonyInstance`, не HarmonyX). Сборка:
`dotnet build "tools/MSC/MSCLoc-API/MSCLocAPI.csproj" -c Release` → `bin/Release/MSCLocAPI.dll`.
Тесты (net8): `dotnet run --project "tools/MSC/MSCLoc-API/tests/MSCLocAPI.Tests.csproj"`.
Релиз-клон ULTIMA_TOOLS теперь в `.ultima_tools_clone/` (gitignored, пересоздаётся
release-скриптом); прежний `tools_src/` УДАЛЁН. Структура tools/ см. `mem:tools/layout`.

## Назначение
MSCLoader-мод (ID `MSCLocAPI`, `Setup.OnMenuLoad`), переводит строки ДРУГИХ модов
из таблиц `<game>/Mods/Config/MSCLocAPI/*.json` (ставит приложение ULTIMA в
patch-режиме). Оригинальные .dll не заменяет.

## !!! ГЛАВНОЕ РЕШЕНИЕ: перевод ТОЛЬКО дисплейный, транспайлер ОТКЛЮЧЁН !!!
`LocPatch.ApplyToLoadedTargets` (ldstr-транспайлер) БОЛЬШЕ НЕ ВЫЗЫВАЕТСЯ ни в
MSCLocAPI, ни в MSCLoaderRU. Файл `LocPatch.cs` оставлен как dead-code/история.
Почему отключили (реальные краши при новой игре): транспайлер переписывал ЛЮБОЙ
совпавший строковый литерал в коде мода, а по содержимому строки нельзя отличить
UI-текст от ИДЕНТИФИКАТОРА. Моды используют литералы как имена GameObject
(`GameObject.Find("Saturday")` → искал «Суббота»), имена FSM/состояний/событий
PlayMaker (`GetState`/`InitializeFSM`/`Linq.First<FsmState>`), ключи Resources/
PlayerPrefs и т.п. Перевод таких литералов ломал моды (объект/состояние «не
найдено», NullReference, моды авто-отключались за спам ошибок: BetterMSC, HTAP,
AchievementCore).
ВЫВОД: переводим только то, что РЕАЛЬНО отображается, через `UI.Text` — это
безопасно (меняем .text, а не литералы кода). Транспайлер по чужим сборкам НЕ
включать. (`LocFormat`/хук String.Format тоже удалён — он менял шаблон до
подстановки, рискованно и избыточно.)

## Конвейер сейчас (Mod_OnMenuLoad)
LoadFromDirectory → LocSettings.TranslateLoadedSettings + Install →
LocLayout.Install → LocText.Install. (LocPatch и LocFormat НЕ вызываются.)
Минус подхода: текст, рисуемый НЕ через UnityEngine.UI.Text (IMGUI/OnGUI), не
переводится. Безопасное расширение на будущее — хук на GUI.Label/GUIContent
(аргумент — это и есть отображаемый текст, переводить его безопасно).

## Движок (src/, переиспользуется MSCLoaderRU через линковку)
- `LocId.cs` — id `'u'+first16hex(sha256(utf8(text)))`, совпадает с Node
  `dll_utils/stringId.js makeStringId` и MscLocTool. SHA через `[ThreadStatic]`.
- `LocStore.cs` — `Map id→перевод`, `Targets` (сейчас не используется без
  транспайлера). `TryTranslate` (точное + UPPER/lower + CRLF). `TryTranslateBlock`
  (целое → блок по строкам/2+ пробелам → обратный матчинг шаблонов) + кэш (cap 8192).
  Шаблоны: `AddTemplate`/`TryTranslateTemplate` — ловят отформатированную строку с
  экрана («77 achievements remaining.») и подставляют захваты в перевод; гард:
  литерал-часть ≥3 симв. `AddBySource(src,tr)` — перевод по исходнику (сам считает
  id + UPPER/lower + шаблон), для секции `"strings"`.
- `LocStore.Io.cs` — `LoadFromDirectory(dir)` + `LoadFromJson(text)`. Секции:
  `entries`(id→tr), `templates`(src→tr), `strings`(src→tr через AddBySource).
- `LocPatch.cs` — транспайлер (ОТКЛЮЧЁН, см. выше). Имеет дешёвый IL-предскан
  (только методы с переводимым ldstr) — была оптимизация загрузки, пока он был включён.
- `LocText.cs` — БЕЗОПАСНЫЙ дисплейный перевод `UnityEngine.UI.Text` (sweep +
  OnEnable postfix + set_text prefix), через него же работают шаблоны.
- `LocSettings.cs`/`LocLayout.cs` — перевод/подгонка текста MSCLoader-Settings.
- `MiniJson.cs` — JSON без Newtonsoft. `MSCLocAPI.cs` — точка входа (в MSCLoaderRU не линкуется).

## Node-сторона (приложение): `Backend/games/mysummercar/dll_utils/`
`stringId.js`(=LocId), `translationTable.js` (`buildTranslationTable`: `entries`+
case-варианты+`templates`), `assemblyName.js`(`resolveTargetAssembly`).

ВАЖНО про остаточный риск дисплейного подхода: если мод сам ЧИТАЕТ обратно
`UI.Text.text` и использует как идентификатор (`GameObject.Find(text.text)`) —
перевод может его задеть. Редко; следить, если всплывёт.

См. также `mem:tools/mscloader-ru`.
