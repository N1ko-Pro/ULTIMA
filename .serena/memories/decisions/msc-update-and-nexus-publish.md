# MSCLoc API — обновление в игре + публикация на Nexus

## Игровое уведомление об обновлении (Вариант A — нативная метадата MSCLoader)

Решено использовать **штатную систему метаданных MSCLoader** (Metadata V3), а НЕ
собственный чекер (`LocUpdate.cs` был удалён в Task 7). Кода менять не нужно —
«This feature doesn't need any code changes». Наш `modID = MSCLocAPI`.

Требования: MSCLoader 1.3+ (команды `metadata`), 1.2.2+ для заливки файла.
В игре должна стоять именно та версия мода, которую публикуем.

Флоу (операция в игре, делает только автор — ANICKON):
1. Авторизация (один раз): сайт `http://my-summer-car.ovh/manage/` → войти через
   Steam → скопировать показанную команду авторизации → вставить в консоль
   MSCLoader (главное меню, клавиша `~`; при необходимости включить DevMode).
2. Регистрация (один раз): в консоли `metadata create MSCLocAPI`. После этого на
   сайте задать ссылку для скачивания → страница Nexus MSC, mod **7588751**
   (хотя бы одна ссылка обязательна).
3. Каждый релиз: `metadata update MSCLocAPI` → меню:
   - **Upload Updated Mod** — заливает текущую версию как self-update (скачивание
     прямо в игре; рекомендуемый вариант).
   - **Update Mod version only** — обновляет только номер версии (отметка во
     вкладке Updates, скачивание по ссылке).

Источник: вики piotrulos/MSCModLoader «Uploading and creating Self update feature
for your mod or reference».

Важно: публикация на Nexus сама по себе НЕ включает игровое уведомление — баннер
берётся из метадата-сервера MSCLoader (`my-summer-car.ovh`), а не из Nexus.

## Авто-публикация на Nexus — обход антивирус-проверки

Проблема: Nexus отбраковывает «голый» `.exe` на антивирус-проверке. Ручная
загрузка в `.zip` проходит.

Решение (`.github/workflows/publish-nexus.yml`): добавлен шаг `zip` — установщик
`.exe` пакуется во flat-zip (`zip -j ./dist-nexus/ULTIMA-<version>.zip <exe>`),
и обе загрузки (BG3 + MSC) шлют на Nexus именно zip (`filename: steps.zip.outputs.file`).

Патчер (`tools/MSC-Patcher/ci/build-loc-patcher.yml`) грузит `.dll` — он проходил
AV-проверку без архива, поэтому НЕ трогали.

Nexus IDs:
- Приложение ULTIMA: BG3 file_id var `NEXUSMODS_FILE_ID`=7410002; MSC file_id var
  `NEXUSMODS_FILE_ID_MSC`=7588916.
- Патчер MSCLoc API: file_id var `NEXUSMODS_FILE_ID`=7588751 (в репо ULTIMA_TOOLS).
- Секрет `NEXUSMODS_API_KEY` в обоих репо. Описание файла на Nexus:
  «Пожалуйста, ознакомьтесь с описанием, чтобы узнать больше деталей.»
