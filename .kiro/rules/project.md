# BG3 ULTIMA — Workspace Rules

## Project Overview
Desktop toolkit for Baldur's Gate 3 mod localization and translation.
**Stack:** Electron 41 + React 19 + Vite 8 + TailwindCSS 3 + Lucide React  
**Language:** JavaScript only (no TypeScript). JSX in renderer. No `.ts`/`.tsx` files.  
**Target:** Windows x64 only. Packaged via electron-builder → NSIS installer → GitHub Releases.

---

## Module System — Critical Rule
| Layer | Location | Module format |
|-------|----------|---------------|
| Main process | `Backend/` | **CommonJS** — `require()` / `module.exports` |
| Renderer | `Frontend/` | **ESM** — `import` / `export` |

Never mix module systems. Never use `import` in `Backend/`, never use `require` in `Frontend/`.

---

## Project Structure

```
Backend/           # Main process (Electron)
  main.js          # Entry point, BrowserWindow, app lifecycle
  preload.js       # contextBridge → window.electronAPI (IPC bridge)
  handlers/        # IPC handlers, one file per domain
    authHandlers, dictionaryHandlers, dotnetHandlers, modHandlers, ollamaHandlers,
    onboardingHandlers, projectHandlers, translatorHandlers, updateHandlers, xmlHandlers,
    handlerUtils, archiveUtils, index.js
  manager/         # Business logic singletons
    aiManager.js, bg3Manager.js, dictionaryManager.js, dotnetManager.js,
    firstRunManager.js, ollamaManager.js, projectManager.js, proxyManager.js,
    smartManager.js, updateManager.js, xmlManager.js
    (each manager has a companion *_utils/ subdirectory for helpers)
  auth/            # Licensing & auth manager
  config/          # Default config files (JSON)

Frontend/          # Renderer process (React)
  App.jsx          # Root orchestrator with lazy-loaded pages (Auth, Start, Main, Settings)
  globals.css      # Global CSS (Tailwind base + custom overrides)
  main.jsx         # Renderer entry point, mounts AuthProvider from Core/Services

  API/             # IPC wrapper functions — one file per domain (wraps window.electronAPI)
    appWindow.js, auth.js, client.js, dictionary.js, dotnet.js, files.js,
    ollama.js, onboarding.js, pak.js, projects.js, settings.js,
    translations.js, updater.js, xml.js

  Assets/          # Static images/icons
    hero.png, icon.ico, logo.png

  Config/          # Flat config files (no subfolders, no index barrel)
    tiers.constants.js, autoTranslationModes.constants.js, dictionaryCategories.constants.js
    settings.constants.js, timings.constants.js, media.config.js, modelTiers.config.js
    autoTranslation.config.js, settingsTabs.config.js

  Core/            # Reusable primitives, services, and feature engines
    Animations/    # Animation utilities
      animationsEngine.js, animationsPresets.js
      helpers/{useAnimate,useTransition,useMicroInteraction,usePrefersReducedMotion}.js
    Buttons/       # Button primitives
      ButtonCore.jsx
      helpers/ButtonIcon.jsx
    Dropdown/      # Dropdown primitive
      DropdownCore.jsx
    Modal/         # Modal primitive (base overlay only)
      ModalCore.jsx
    Services/      # Core logic services (no subfolders)
      AppStateService.js, AuthService.jsx, AutoTranslateService.js, ProjectService.js,
      SettingsService.js, TranslationService.js, TutorialService.js, UpdaterService.js,
      ValidationService.js, XmlService.js
    Styles/        # Design tokens
      theme.js
    TitleBar/      # Title bar primitives
      TitleBarCore.jsx
      helpers/TitleBarButtons.jsx
    Tutorial/      # Tutorial overlay engine (mechanics only)
      TutorialCore.jsx
    Update/        # Update status UI
      UpdateStatusCard.jsx
      helpers/{InstallProgressPanel.jsx, installProgress.js}

  Locales/         # i18n (no index barrel)
    ru.js, en.js, LocaleProvider.jsx

  Optimization/    # Performance helpers
    cache.js, useDeferredMount.js

  Shared/          # Cross-window utilities (no Core/UI dependencies)
    helpers/{fingerprints.js, logger.js, ollamaModel.js, projectShape.js, strings.js, time.js}
    hooks/{useDiscordLogin.js, useTooltip.jsx}
    notifications/{notifyCore.js, notifyStore.js, notifyToastStack.jsx, notifyToastItem.jsx, notifyCenter.jsx}

  UI/              # Reusable UI components (prefix-first naming)
    Badge/BadgeTier.jsx
    EULA/{EulaModal.jsx, FlagIcons.jsx, eulaText.js}
    Highlight/{HighlightedText.jsx, highlightMarkup.js, highlightSearch.js}
    Input/{InputCore.jsx, InputTextarea.jsx}
    Loading/LoadingOverlay.jsx
    Modal/         # All modal dialogs (primitives + page-specific)
      ModalConfirm.jsx, ModalField.jsx,
      AtpAccessModal.jsx, DeleteConfirmModal.jsx, DotNetInstallModal.jsx,
      DotNetMissingModal.jsx, PackModal.jsx, ProjectEditModal.jsx,
      ProjectInitModal.jsx, UnsavedChangesModal.jsx,
      UpdateAvailableModal.jsx, UpdateInstallingModal.jsx
    Social/SocialIcons.jsx
    Tutorial/      # Scenario files only (TutorialCore lives in Core/Tutorial/)
      TutorialEditor.jsx, TutorialWelcome.jsx, TutorialStartPage.jsx,
      TutorialDictionary.jsx, TutorialAutoTranslate.jsx

  Utils/           # Bottom-layer utilities (no external Frontend dependencies)
    dom/autoResize.js
    Keyboard/{useKeyboardShortcuts.js, useEscapeBlur.js}

  Windows/         # Feature pages
    Auth/
      AuthPage.jsx, AuthPageButtons.jsx
      components/{AuthOverlay, ExpandedProfileContent, FeatureCard, ProfileBadge, ProfilePanel, UserStatusCard}.jsx
      utils/constants.js
    Main/
      MainPage.jsx, MainPageButtons.jsx
      components/{AtpLocalSettings, AtpModeCard, AtpSmartSettings, AutoTranslatePanel,
                  DescriptionField, DictionaryCategories, DictionaryPanel, DictionaryPanelButtons,
                  InputField, MainTable, SideBar, SidebarFieldWrapper, TopBar, TopBarButtons,
                  TranslationStatusBar, VirtualTableRow}.jsx
      utils/useOllamaStatus.js
    Settings/
      SettingsPage.jsx, SettingsPageButtons.jsx
      components/{AiModelCard, AiPage, AiRefreshButton, AiTagPill, AiUninstallRow,
                  GeneralPage, OllamaCancelConfirmDialog, OllamaFeatureBullet,
                  OllamaInstallProgress, OllamaPage, TranslatePage}.jsx
    Start/
      StartPage.jsx, StartPageButtons.jsx
      components/{DropZone, EmptyState, Footer, HeroSection, LoadingState,
                  PageBackground, ProfileButton, ProjectCard, ProjectsSeparator}.jsx
      utils/{formatDate.js, useDragAndDrop.js, useTiltEffect.js}

tools/             # External .NET BG3 tools (Divine, StoryCompiler, etc.) — DO NOT MODIFY
Glossary/          # Glossary data (JSON)
public/            # Static assets for Vite
```

---

## IPC Architecture
- All main↔renderer communication goes through `window.electronAPI` (exposed in `preload.js`)
- The renderer never calls `window.electronAPI` directly — always use the domain wrapper in `Frontend/API/`
- To add a new IPC channel:
  1. Add handler in `Backend/handlers/<domain>Handlers.js`
  2. Register it via `Backend/handlers/index.js`
  3. Expose it in `Backend/preload.js` via `contextBridge.exposeInMainWorld`
  4. Add a wrapper function in the matching `Frontend/API/<domain>.js`
  5. Call it from Services or Windows via the `Frontend/API/` wrapper
- Managers are initialized in `Backend/main.js` inside `app.whenReady()` and passed to handlers via the `services` object

---

## Styling Rules
- **TailwindCSS only** — no inline styles, no CSS modules, no styled-components
- **Custom surface palette** (dark backgrounds):
  - `surface-0` = `#09090b` (deepest)
  - `surface-1` = `#0f0f12`
  - `surface-2` = `#141418`
  - `surface-3` = `#1a1a1f`
  - `surface-4` = `#222228` (lightest)
- **Font:** IBM Plex Sans (already in Tailwind config as `font-sans`)
- **Icons:** Lucide React only (`lucide-react`)
- **Animations:** Use the custom Tailwind animations (`animate-slide-up`, `animate-scale-in`, `animate-modal-in`, etc.) — do not add custom CSS animations unless extending `tailwind.config.js`
- Window background is `#0f0f13` (frameless, dark)

---

## Code Style
- **No TypeScript** — `.js` and `.jsx` only
- Functional React components with hooks — no class components
- `no-unused-vars` is an ESLint error. Exception: variables/args starting with uppercase (`^[A-Z_]`)
- ESLint flat config (`eslint.config.mjs`) — do not create `.eslintrc` files
- Follow react-hooks rules (no conditional hooks)
- `react-refresh/only-export-components` is active — avoid mixing exports in component files

---

## Frontend Naming Conventions (SET — do not change without approval)
- **Config/**: `.constants.js` for value enums, `.config.js` for behavior/UI configs
- **Services**: PascalCase + `Service` suffix (`.js` or `.jsx` for Auth), live in `Core/Services/`
- **Core primitives**: PascalCase folder + `{Name}Core.jsx` root + `helpers/` subfolder for secondary pieces
  - e.g. `Core/Buttons/ButtonCore.jsx` + `helpers/ButtonIcon.jsx`
  - e.g. `Core/TitleBar/TitleBarCore.jsx` + `helpers/TitleBarButtons.jsx`
- **UI components**: prefix-first naming (BadgeTier, InputCore, LoadingOverlay, SocialIcons)
- **Pages**: `{Page}Page.jsx` + `{Page}PageButtons.jsx` + `components/` + `utils/` (no index barrel)
- **Tutorial scenarios**: per-scenario files in `UI/Tutorial/` (TutorialEditor, TutorialDictionary, etc.) — DO NOT consolidate; `TutorialCore.jsx` stays in `Core/Tutorial/`
- **API wrappers**: camelCase matching the domain name (`ollama.js`, `projects.js`, etc.)

---

## Frontend Import Rules (enforced)
- **Windows/** can import from API, Core, UI, Shared, Utils, Locales, Config, Optimization — not from other Windows pages
- **Core/Services/** can import API, Shared, Utils, Config — not Windows or Core primitives
- **Core primitives** (Buttons, Modal, Dropdown, TitleBar, Animations) can import Shared, Utils, Core/Styles, Core/Animations — not Windows or Services
- **UI/** can import Core (primitives only), Shared, Utils, Config — not Windows or Services
- **Shared/** cannot import Windows, Core, or UI
- **API/** wraps `window.electronAPI` only — no React, no services
- **Optimization/** can be imported anywhere
- **Utils/** is the bottom layer (no dependencies on other Frontend folders)

---

## Tailwind Opacity Rules
Only default opacity values are auto-generated: `0, 5, 10, 20, 25, 30, 40, 50, 60, 70, 75, 80, 90, 95, 100`
- Use `bg-surface-2/95` ✓ (default)
- Use `bg-surface-2/[0.98]` ✓ (arbitrary value with brackets)
- Do NOT use `bg-surface-2/98` ✗ (silently broken, no class generated)
- Same rule applies to `text-X/N`, `border-X/N`, `ring-X/N`, etc.

---

## Key Domain Modules (Backend/manager/)
| Manager | Responsibility |
|---------|---------------|
| `aiManager.js` | External AI translation (API-based) |
| `ollamaManager.js` | Local AI via Ollama (install, pull models, run) |
| `bg3Manager.js` | BG3 PAK unpack/repack via .NET tools |
| `projectManager.js` | Save/load translation projects |
| `dictionaryManager.js` | Glossary / custom dictionary |
| `smartManager.js` | Settings persistence |
| `updateManager.js` | Auto-update via electron-updater + GitHub |
| `proxyManager.js` | Proxy config for translation requests |
| `xmlManager.js` | XML import/export |
| `dotnetManager.js` | .NET runtime detection and installation |
| `firstRunManager.js` | First-run setup and onboarding logic |

---

## Build & Release
- **Dev:** `npm run dev` (Vite + Electron)
- **Build renderer:** `npm run build`
- **Package installer:** `npm run dist` (Vite build + electron-builder NSIS)
- **Quick dir build:** `npm run dist:dir`
- **Release (GitHub):** `npm run release` → `scripts/release.js`
- Output directory: `release/`
- Publish target: GitHub repo `ANICKON-PRO/BG3-ULTIMA`

---

## Environment / Secrets
- `.env` — local secrets (never commit). See `.env.example` for required keys.
- Sensitive tokens (GitHub, AI API keys) must only be read from `process.env` in the main process — never expose to renderer

---

## Testing
- `npm test` → `Backend/tests/markup.test.js`
- `npm run test:llm` → `Backend/tests/llm_live.js` (requires live LLM)
- Tests run in Node directly (not Jest/Vitest)

---

## Do NOT
- Add TypeScript or convert files to `.ts`/`.tsx`
- Use `require()` in `Frontend/`
- Use `import` in `Backend/`
- Modify anything in `tools/` (external .NET binaries)
- Add `nodeIntegration: true` — context isolation must remain enabled
- Hardcode secrets or tokens in source files
- Create `.eslintrc` / `.prettierrc` — project uses flat ESLint config only
