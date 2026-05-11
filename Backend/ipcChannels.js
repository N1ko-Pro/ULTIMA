// ─────────────────────────────────────────────────────────────────────────────
//  ipcChannels.js — single source of truth for all IPC channel name strings.
//  Used by preload.js (renderer bridge) and handlers/*.js (main process).
// ─────────────────────────────────────────────────────────────────────────────

// ── Window ──────────────────────────────────────────────────────────────────
const WIN_MIN              = 'window-min';
const WIN_MAX              = 'window-max';
const WIN_CLOSE            = 'window-close';
const WIN_OS_CLOSE         = 'os-window-close';
const WIN_OPEN_EXTERNAL    = 'open-external';

// ── Mod / BG3 workflow ───────────────────────────────────────────────────────
const MOD_SELECT_FILE      = 'select-file';
const MOD_SELECT_PAK       = 'select-pak-file';
const MOD_UNPACK_PAK       = 'unpack-pak-file';
const MOD_UNPACK_ARCHIVE   = 'unpack-archive-file';
const MOD_REPACK           = 'repack-mod';
const MOD_OPEN_FOLDER      = 'open-mod-folder';

// ── Translation ──────────────────────────────────────────────────────────────
const TRANSLATE_STRINGS         = 'translate-strings';
const TRANSLATE_ABORT           = 'abort-translate-strings';
const TRANSLATE_ITEM_PROGRESS   = 'translation-item-progress';

// ── Projects ─────────────────────────────────────────────────────────────────
const PROJECT_SAVE         = 'save-project';
const PROJECT_LOAD_ALL     = 'load-projects';
const PROJECT_DELETE       = 'delete-project';
const PROJECT_LOAD         = 'load-project';

// ── XML ──────────────────────────────────────────────────────────────────────
const XML_EXPORT           = 'export-xml';
const XML_IMPORT           = 'import-xml';

// ── Auth ─────────────────────────────────────────────────────────────────────
const AUTH_GET_STATE       = 'auth-get-state';
const AUTH_LOGIN           = 'auth-login';
const AUTH_LOGOUT          = 'auth-logout';
const AUTH_REFRESH         = 'auth-refresh';
const AUTH_SAVE_LOCAL_NAME = 'auth-save-local-name';

// ── Dictionary / Glossary ────────────────────────────────────────────────────
const DICT_GET_ALL         = 'dictionary-get-all';
const DICT_ADD             = 'dictionary-add';
const DICT_UPDATE          = 'dictionary-update';
const DICT_DELETE          = 'dictionary-delete';
const DICT_EXPORT          = 'dictionary-export';
const DICT_IMPORT          = 'dictionary-import';
const DICT_RESET           = 'dictionary-reset';

// ── Settings ─────────────────────────────────────────────────────────────────
const SETTINGS_SET_METHOD        = 'set-translation-method';
const SETTINGS_SET_SETTINGS      = 'set-translation-settings';
const SETTINGS_SET_PROXY_POOL    = 'set-translation-proxy-pool';
const SETTINGS_SET_PROXY_CONFIG  = 'set-translation-proxy-config';
const SETTINGS_CLEAR_PROXY_POOL  = 'clear-translation-proxy-pool';
const SETTINGS_GET               = 'get-translation-settings';

// ── Onboarding ───────────────────────────────────────────────────────────────
const ONBOARDING_GET       = 'onboarding-get';
const ONBOARDING_UPDATE    = 'onboarding-update';

// ── .NET ─────────────────────────────────────────────────────────────────────
const DOTNET_CHECK             = 'dotnet-check';
const DOTNET_INSTALL           = 'dotnet-install';
const DOTNET_INSTALL_PROGRESS  = 'dotnet-install-progress';

// ── Updater ──────────────────────────────────────────────────────────────────
const UPDATER_GET_STATE        = 'updater-get-state';
const UPDATER_CHECK            = 'updater-check';
const UPDATER_DOWNLOAD         = 'updater-download';
const UPDATER_INSTALL          = 'updater-install';
const UPDATER_FINALIZE_INSTALL = 'updater-finalize-install';
const UPDATER_EVENT            = 'updater-event';

// ── Ollama ───────────────────────────────────────────────────────────────────
const OLLAMA_GET_STATUS        = 'ollama-get-status';
const OLLAMA_PULL_MODEL        = 'ollama-pull-model';
const OLLAMA_CANCEL_PULL       = 'ollama-cancel-pull-model';
const OLLAMA_DELETE_MODEL      = 'ollama-delete-model';
const OLLAMA_INSTALL           = 'ollama-install';
const OLLAMA_CANCEL_INSTALL    = 'ollama-cancel-install';
const OLLAMA_START_SERVER      = 'ollama-start-server';
const OLLAMA_STOP_SERVER       = 'ollama-stop-server';
const OLLAMA_UNINSTALL         = 'ollama-uninstall';
const OLLAMA_RESET_CONTEXT     = 'ollama-reset-context';
const OLLAMA_ENSURE_RUNNING    = 'ollama-ensure-running';
const OLLAMA_PULL_PROGRESS     = 'ollama-pull-progress';
const OLLAMA_INSTALL_PROGRESS  = 'ollama-install-progress';
const OLLAMA_STATUS_CHANGED    = 'ollama-status-changed';

module.exports = {
  WIN_MIN, WIN_MAX, WIN_CLOSE, WIN_OS_CLOSE, WIN_OPEN_EXTERNAL,
  MOD_SELECT_FILE, MOD_SELECT_PAK, MOD_UNPACK_PAK, MOD_UNPACK_ARCHIVE, MOD_REPACK, MOD_OPEN_FOLDER,
  TRANSLATE_STRINGS, TRANSLATE_ABORT, TRANSLATE_ITEM_PROGRESS,
  PROJECT_SAVE, PROJECT_LOAD_ALL, PROJECT_DELETE, PROJECT_LOAD,
  XML_EXPORT, XML_IMPORT,
  AUTH_GET_STATE, AUTH_LOGIN, AUTH_LOGOUT, AUTH_REFRESH, AUTH_SAVE_LOCAL_NAME,
  DICT_GET_ALL, DICT_ADD, DICT_UPDATE, DICT_DELETE, DICT_EXPORT, DICT_IMPORT, DICT_RESET,
  SETTINGS_SET_METHOD, SETTINGS_SET_SETTINGS, SETTINGS_SET_PROXY_POOL,
  SETTINGS_SET_PROXY_CONFIG, SETTINGS_CLEAR_PROXY_POOL, SETTINGS_GET,
  ONBOARDING_GET, ONBOARDING_UPDATE,
  DOTNET_CHECK, DOTNET_INSTALL, DOTNET_INSTALL_PROGRESS,
  UPDATER_GET_STATE, UPDATER_CHECK, UPDATER_DOWNLOAD, UPDATER_INSTALL,
  UPDATER_FINALIZE_INSTALL, UPDATER_EVENT,
  OLLAMA_GET_STATUS, OLLAMA_PULL_MODEL, OLLAMA_CANCEL_PULL, OLLAMA_DELETE_MODEL,
  OLLAMA_INSTALL, OLLAMA_CANCEL_INSTALL, OLLAMA_START_SERVER, OLLAMA_STOP_SERVER,
  OLLAMA_UNINSTALL, OLLAMA_RESET_CONTEXT, OLLAMA_ENSURE_RUNNING,
  OLLAMA_PULL_PROGRESS, OLLAMA_INSTALL_PROGRESS, OLLAMA_STATUS_CHANGED,
};
