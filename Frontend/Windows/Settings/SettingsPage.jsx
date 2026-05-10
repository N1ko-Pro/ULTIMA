import React, { useMemo, useState, useEffect } from 'react';
import { Settings } from 'lucide-react';
import { useAuth } from '@Core/Services/AuthService';
import { DEFAULT_SETTINGS } from '@Config/settings.constants';
import { SETTINGS_TABS, SETTINGS_TAB_IDS, SETTINGS_TABS_LIST } from '@Config/settingsTabs.config';
import { useLocale } from '@Locales/LocaleProvider';
import { notify } from '@Shared/notifications/notifyCore';
import ModalCore from '@Core/Modal/ModalCore';
import { TabButton, SaveButton } from './SettingsPageButtons';
import GeneralPage from './components/GeneralPage';
import TranslatePage from './components/TranslatePage';
import AiPage from './components/AiPage';

// ─── SettingsPage ───────────────────────────────────────────────────────────
// Top-level settings dialog. Hosts three tabs (General / Smart / AI) and
// owns the draft-vs-saved state comparison. Tabs the user can't afford are
// marked locked and show a warning toast explaining what they'd need.

const TAB_LOCALE_KEY = {
  [SETTINGS_TAB_IDS.GENERAL]:          'general',
  [SETTINGS_TAB_IDS.AUTO_TRANSLATION]: 'smart',
  [SETTINGS_TAB_IDS.OLLAMA]:           'ai',
};

function normalizeSettings(settings) {
  return {
    general: {
      appLanguage:       settings?.general?.appLanguage       || DEFAULT_SETTINGS.general.appLanguage,
      autoUpdateEnabled: settings?.general?.autoUpdateEnabled ?? DEFAULT_SETTINGS.updates.autoUpdateEnabled,
    },
    method: settings?.method || DEFAULT_SETTINGS.method,
    ollama: { model: settings?.ollama?.model || DEFAULT_SETTINGS.ollama.model },
  };
}

function hasDraftChanges(draft, current) {
  return (
    draft.method                     !== current.method ||
    draft.ollama.model               !== current.ollama.model ||
    draft.general.appLanguage        !== current.general.appLanguage ||
    draft.general.autoUpdateEnabled  !== current.general.autoUpdateEnabled
  );
}

function resolveTabId(tab) {
  return Object.values(SETTINGS_TABS).some(({ id }) => id === tab) ? tab : SETTINGS_TABS.GENERAL.id;
}

/**
 * @param {{
 *   isOpen: boolean,
 *   onClose: () => void,
 *   currentSettings: any,
 *   onSaveSettings: (patch: any) => Promise<boolean>,
 *   onResetTutorial?: () => void,
 *   defaultTab?: string | null,
 * }} props
 */
export default function SettingsPage({
  isOpen,
  onClose,
  currentSettings,
  onSaveSettings,
  onResetTutorial,
  defaultTab = null,
}) {
  const t = useLocale();
  const { canUseAutoTranslate, canUseAI, isLoggedIn } = useAuth();

  const normalizedCurrent = useMemo(() => normalizeSettings(currentSettings), [currentSettings]);

  const [activeTab, setActiveTab] = useState(resolveTabId(defaultTab));
  const [draft,     setDraft]     = useState(normalizedCurrent);

  // Sync draft when incoming settings change (e.g. backend confirmed save).
  useEffect(() => {
    setDraft(normalizedCurrent);
  }, [normalizedCurrent]);

  // Jump to the requested tab each time the dialog reopens.
  useEffect(() => {
    if (isOpen) setActiveTab(resolveTabId(defaultTab));
  }, [isOpen, defaultTab]);

  const lockedTabs = useMemo(() => {
    const locked = new Set();
    if (!canUseAutoTranslate) locked.add(SETTINGS_TABS.AUTO_TRANSLATION.id);
    if (!canUseAI)            locked.add(SETTINGS_TABS.OLLAMA.id);
    return locked;
  }, [canUseAutoTranslate, canUseAI]);

  const hasChanges = hasDraftChanges(draft, normalizedCurrent);

  const handleSave = async () => {
    if (!hasChanges) return;
    const success = await onSaveSettings({
      general: {
        appLanguage:       draft.general.appLanguage,
        autoUpdateEnabled: draft.general.autoUpdateEnabled,
      },
      method: draft.method,
      ollama: { model: draft.ollama.model },
    });
    if (success) notify.success(t.settings.saved, t.settings.savedDesc);
    else         notify.error(t.settings.saveError, t.settings.saveErrorDesc);
  };

  const handleTabClick = (tab) => {
    if (!lockedTabs.has(tab.id)) {
      setActiveTab(tab.id);
      return;
    }
    if (!isLoggedIn) {
      notify.warning(t.settings.requiresAuth, t.settings.requiresAuthDesc);
      return;
    }
    if (tab.id === SETTINGS_TABS.OLLAMA.id) {
      notify.warningAction(t.settings.requiresUltra, t.settings.requiresUltraDesc, 'atp-modal');
      return;
    }
    notify.warningAction(t.settings.requiresPremium, t.settings.requiresPremiumDesc, 'atp-modal');
  };

  return (
    <ModalCore
      isOpen={isOpen}
      onClose={onClose}
      title={t.settings.appTitle}
      icon={Settings}
      footer={<SaveButton hasChanges={hasChanges} onSave={handleSave} />}
      closeOnOverlayClick
      showCloseIcon
      maxWidthClass="max-w-xl"
      bodyClassName="h-[60vh] overflow-y-auto"
      titleClassName="text-[22px]"
      headerClassName="backdrop-blur-[90px] bg-black/[0.60] border border-white/10 rounded-t-2xl"
    >
      <div className="space-y-6">
        <div className="rounded-xl border border-white/10 bg-surface-2 p-1">
          <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${SETTINGS_TABS_LIST.length}, minmax(0, 1fr))` }}>
            {SETTINGS_TABS_LIST.map((tab) => (
              <TabButton
                key={tab.id}
                label={t.settings.tabs[TAB_LOCALE_KEY[tab.id]] || tab.label}
                icon={tab.icon}
                isActive={activeTab === tab.id}
                isLocked={lockedTabs.has(tab.id)}
                onClick={() => handleTabClick(tab)}
              />
            ))}
          </div>
        </div>

        <TabDescription tab={activeTab} t={t} />

        {activeTab === SETTINGS_TABS.GENERAL.id && (
          <GeneralPage
            appLanguage={draft.general.appLanguage}
            autoUpdateEnabled={draft.general.autoUpdateEnabled}
            onAppLanguageChange={(value) => setDraft((prev) => ({
              ...prev,
              general: { ...prev.general, appLanguage: value },
            }))}
            onAutoUpdateToggle={(value) => setDraft((prev) => ({
              ...prev,
              general: { ...prev.general, autoUpdateEnabled: value },
            }))}
            onResetTutorial={onResetTutorial}
          />
        )}

        {activeTab === SETTINGS_TABS.AUTO_TRANSLATION.id && (
          <TranslatePage
            method={draft.method}
            onMethodChange={(method) => setDraft((prev) => ({ ...prev, method }))}
          />
        )}

        {activeTab === SETTINGS_TABS.OLLAMA.id && (
          <AiPage
            ollamaModel={draft.ollama.model}
            onOllamaModelChange={(model) => setDraft((prev) => ({
              ...prev,
              ollama: { ...prev.ollama, model },
            }))}
            onModelAutoSelected={async (model) => {
              setDraft((prev) => ({ ...prev, ollama: { ...prev.ollama, model } }));
              await onSaveSettings({
                general: draft.general,
                method: draft.method,
                ollama: { model },
              });
            }}
          />
        )}
      </div>
    </ModalCore>
  );
}

const TAB_DESCRIPTION_META = {
  [SETTINGS_TAB_IDS.GENERAL]:          { icon: SETTINGS_TABS.GENERAL.icon,          accent: 'indigo',  localeKey: 'descGeneral' },
  [SETTINGS_TAB_IDS.AUTO_TRANSLATION]: { icon: SETTINGS_TABS.AUTO_TRANSLATION.icon, accent: 'violet',  localeKey: 'descSmart' },
  [SETTINGS_TAB_IDS.OLLAMA]:           { icon: SETTINGS_TABS.OLLAMA.icon,           accent: 'fuchsia', localeKey: 'descAi' },
};

const ACCENT_CLASS = {
  indigo:  'border-indigo-500/[0.08] bg-indigo-500/[0.03]  text-indigo-300/50',
  violet:  'border-violet-500/[0.08] bg-violet-500/[0.03]  text-violet-300/50',
  fuchsia: 'border-fuchsia-500/[0.08] bg-fuchsia-500/[0.03] text-fuchsia-300/50',
};

function TabDescription({ tab, t }) {
  const meta = TAB_DESCRIPTION_META[tab];
  if (!meta) return null;
  const Icon = meta.icon;
  const classes = ACCENT_CLASS[meta.accent];
  return (
    <div>
      <div className={`rounded-xl border p-3.5 flex items-start gap-2.5 ${classes}`}>
        <Icon className="w-4 h-4 mt-0.5 shrink-0" />
        <p className="text-[12px] text-zinc-400 leading-relaxed">{t.settings[meta.localeKey]}</p>
      </div>
      <div className="mt-4 border-t border-white/[0.06]" />
    </div>
  );
}
