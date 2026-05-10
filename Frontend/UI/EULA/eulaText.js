// ─────────────────────────────────────────────────────────────────────────────
//  eulaText.js
//  End-User License Agreement body text, mirrored in the installer.
//  Rendered as structured sections so the modal can lay them out nicely.
// ─────────────────────────────────────────────────────────────────────────────

const EULA_RU = {
  title: 'Лицензионное соглашение',
  subtitle: 'BG3 ULTIMA — пользовательское соглашение',
  intro:
    'Пожалуйста, внимательно ознакомьтесь с условиями ниже. Прокрутите текст до конца, после чего станет доступен чекбокс принятия. Продолжая использование программы, вы подтверждаете своё согласие.',
  sections: [
    {
      heading: '1. Принятие условий',
      body: 'Устанавливая и используя BG3 ULTIMA («Программа»), вы соглашаетесь с условиями настоящего Соглашения. Если вы не согласны — не запускайте Программу и удалите её со своего устройства.',
    },
    {
      heading: '2. Лицензия',
      body: 'Вам предоставляется персональная, неисключительная, непередаваемая лицензия на установку и использование Программы на любом количестве принадлежащих вам устройств в личных некоммерческих целях, связанных с созданием и редактированием локализаций модов для Baldur\'s Gate 3.',
    },
    {
      heading: '3. Интеллектуальная собственность',
      body: 'Программа, её исходный код, интерфейс, словарь D&D и сопутствующие ресурсы принадлежат ANICKON и защищены законом об авторском праве. Baldur\'s Gate 3 — товарный знак Larian Studios. BG3 ULTIMA является независимым фанатским проектом и не аффилирован с Larian Studios.',
    },
    {
      heading: '4. Что можно делать',
      body: '• Использовать Программу для личной некоммерческой работы над переводами.\n• Создавать, редактировать и распространять переводы модов, полученные в Программе.\n• Делиться получившимися файлами локализации в соответствии с лицензиями исходных модов.',
    },
    {
      heading: '5. Что делать нельзя',
      body: '• Продавать, сдавать в аренду или сублицензировать саму Программу.\n• Реверсить, декомпилировать и дизассемблировать Программу, кроме случаев, разрешённых законом.\n• Удалять или изменять уведомления об авторских правах.\n• Использовать Программу для распространения вредоносного ПО или нарушения прав третьих лиц.',
    },
    {
      heading: '6. Сторонние сервисы',
      body: 'Программа может использовать сторонние сервисы: авторизацию через Discord, онлайн-сервисы перевода, локальную AI-среду Ollama, обновления через GitHub. Их использование регулируется условиями соответствующих провайдеров, разработчик Программы не несёт за них ответственности.',
    },
    {
      heading: '7. Пользовательские данные',
      body: 'Все ваши настройки, словари и проекты хранятся локально в папке %APPDATA%\\BG3 ULTIMA. Никакие персональные данные не передаются разработчику без вашего явного действия (например, входа через Discord). Резервное копирование ваших файлов — ваша ответственность.',
    },
    {
      heading: '8. Обновления',
      body: 'Программа может автоматически проверять новые версии с официального канала выпусков на GitHub. Автообновления можно отключить в настройках в любой момент.',
    },
    {
      heading: '9. Отказ от гарантий',
      body: 'ПРОГРАММА ПРЕДОСТАВЛЯЕТСЯ «КАК ЕСТЬ», БЕЗ КАКИХ-ЛИБО ГАРАНТИЙ. РАЗРАБОТЧИК НЕ НЕСЁТ ОТВЕТСТВЕННОСТИ ЗА ПОТЕРЮ ДАННЫХ, ПРИБЫЛИ ИЛИ ЛЮБЫЕ ИНЫЕ УБЫТКИ, ВОЗНИКАЮЩИЕ ИЗ ИСПОЛЬЗОВАНИЯ ПРОГРАММЫ.',
    },
    {
      heading: '10. Прекращение действия',
      body: 'Лицензия действует до её прекращения. При нарушении условий ваши права автоматически аннулируются, и вы обязаны прекратить использование Программы.',
    },
    {
      heading: '11. Контакты',
      body: 'Вопросы по Соглашению можно направлять в Discord-сообщество проекта или в репозиторий на GitHub.',
    },
  ],
  accept: 'Я прочитал(а) и принимаю условия соглашения',
  acceptHintLocked: 'Прокрутите текст до конца, чтобы активировать принятие',
  continue: 'Продолжить',
  declineHint: 'Чтобы отказаться — просто закройте приложение',
};

const EULA_EN = {
  title: 'End User License Agreement',
  subtitle: 'BG3 ULTIMA — terms of use',
  intro:
    'Please read the terms below carefully. Scroll to the bottom to enable the acceptance checkbox. By continuing to use the Software you confirm your agreement.',
  sections: [
    {
      heading: '1. Acceptance of terms',
      body: 'By installing or using BG3 ULTIMA (the "Software") you agree to these terms. If you do not agree, do not run the Software and remove it from your device.',
    },
    {
      heading: '2. License grant',
      body: 'You receive a personal, non-exclusive, non-transferable license to install and use the Software on any number of devices you own or control, solely for non-commercial work related to creating and editing Baldur\'s Gate 3 mod localizations.',
    },
    {
      heading: '3. Intellectual property',
      body: 'The Software, including its source code, user interface, D&D dictionary and associated assets, is owned by ANICKON and protected by copyright. Baldur\'s Gate 3 is a trademark of Larian Studios. BG3 ULTIMA is an independent fan project and is not affiliated with Larian Studios.',
    },
    {
      heading: '4. Permitted use',
      body: '• Use the Software for personal non-commercial translation work.\n• Create, edit and distribute translations produced with the Software.\n• Share the resulting localization files under the licenses of the original mods.',
    },
    {
      heading: '5. Restrictions',
      body: '• Do not sell, rent or sublicense the Software itself.\n• Do not reverse-engineer, decompile or disassemble it, except where allowed by law.\n• Do not remove or alter copyright notices.\n• Do not use the Software to distribute malware or violate third-party rights.',
    },
    {
      heading: '6. Third-party services',
      body: 'The Software may integrate Discord authentication, online translation services, the Ollama local AI runtime and GitHub-based updates. Use of these is subject to their own terms and policies; the Software\'s developer is not responsible for their availability or content.',
    },
    {
      heading: '7. User data',
      body: 'Your settings, glossary and projects are stored locally under %APPDATA%\\BG3 ULTIMA. No personal data is sent to the developer without your explicit action (for example signing in via Discord). Backing up your project files is your own responsibility.',
    },
    {
      heading: '8. Updates',
      body: 'The Software may check for updates from the official GitHub release channel. Automatic updates can be disabled in the settings at any time.',
    },
    {
      heading: '9. Disclaimer',
      body: 'THE SOFTWARE IS PROVIDED "AS IS", WITHOUT ANY WARRANTY. THE DEVELOPER IS NOT LIABLE FOR ANY LOSS OF DATA, PROFITS OR OTHER DAMAGES ARISING FROM USE OF THE SOFTWARE.',
    },
    {
      heading: '10. Termination',
      body: 'This license is effective until terminated. Breaching the terms automatically revokes your rights and you must cease using the Software.',
    },
    {
      heading: '11. Contact',
      body: 'Questions about this agreement can be directed to the project\'s Discord community or GitHub repository.',
    },
  ],
  accept: 'I have read and agree to the terms of this agreement',
  acceptHintLocked: 'Scroll to the bottom to enable acceptance',
  continue: 'Continue',
  declineHint: 'To decline — simply close the application',
};

export function getEulaText(lang) {
  return lang === 'en' ? EULA_EN : EULA_RU;
}
