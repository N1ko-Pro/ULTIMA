import React from 'react';
import { HelpCircle } from 'lucide-react';
import DropdownCore from '@Core/Dropdown/DropdownCore';
import { useLocale } from '@Locales/LocaleProvider';
import { useTooltip } from '@Shared/hooks/useTooltip';
import {
  AUTO_TRANSLATION_METHODS_BY_MODEL,
  AUTO_TRANSLATION_MODELS,
  getModelByMethod,
} from '@Config/autoTranslation.config';

// ─── AtpSmartSettings ───────────────────────────────────────────────────────
// Settings body shown under the auto-translate panel when the user picks
// "Smart" mode. Two dropdowns (model + method) plus a dictionary toggle.
// The tooltip is wired through `useTooltip` from Shared — no local
// portal/position state.

const TOOLTIP_CLASS =
  'pointer-events-none fixed z-50 w-56 rounded-xl border border-white/[0.1] bg-surface-1/[0.95] backdrop-blur-2xl text-orange-200/80 text-[12px] p-3 shadow-[0_12px_40px_rgba(0,0,0,0.6)] text-center leading-relaxed whitespace-normal break-words';

/**
 * @param {{
 *   translationSettings: any,
 *   useDictionary: boolean,
 *   onUpdateSettings: (patch: any) => void,
 *   onToggleUseDictionary: (next: boolean) => void,
 * }} props
 */
export default function AtpSmartSettings({
  translationSettings,
  useDictionary,
  onUpdateSettings,
  onToggleUseDictionary,
}) {
  const t = useLocale();
  const { anchorRef, show, hide, renderTooltip } = useTooltip();

  const currentMethod = translationSettings?.method || 'single';
  const currentModel  = getModelByMethod(currentMethod);

  const modelOptions = AUTO_TRANSLATION_MODELS.map((m) => ({
    id: m.id, title: m.title, subtitle: m.subtitle,
  }));
  const methodOptions = (AUTO_TRANSLATION_METHODS_BY_MODEL[currentModel] || []).map((m) => ({
    id: m.id,
    title: m.id === 'compatibility' ? t.settings.methodCompatName : m.name,
    subtitle: m.badge,
  }));

  const handleModelChange = (modelId) => {
    const methods = AUTO_TRANSLATION_METHODS_BY_MODEL[modelId] || [];
    if (methods.length > 0) onUpdateSettings({ method: methods[0].id });
  };

  const handleMethodChange = (methodId) => onUpdateSettings({ method: methodId });

  return (
    <div className="w-full">
      <div className="flex items-end gap-0">
        <div className="flex-1 min-w-0">
          <label className="text-[10px] font-semibold text-zinc-400 mb-0.5 block">{t.atp.modelLabel}</label>
          <DropdownCore value={currentModel} options={modelOptions} onChange={handleModelChange} />
        </div>
        <div className="w-px h-7 bg-white/[0.06] mx-2 shrink-0" />
        <div className="flex-1 min-w-0">
          <label className="text-[10px] font-semibold text-zinc-400 mb-0.5 block">{t.atp.methodLabel}</label>
          <DropdownCore value={currentMethod} options={methodOptions} onChange={handleMethodChange} />
        </div>
      </div>

      <div className="mt-1.5 rounded-xl border border-white/[0.08] bg-surface-2/70 py-1.5 px-3">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-[12px] font-semibold text-zinc-200">{t.atp.dictionaryToggle}</span>
              <div className="relative inline-flex">
                <div ref={anchorRef} onMouseEnter={show} onMouseLeave={hide} className="flex items-center">
                  <HelpCircle className="w-3.5 h-3.5 text-zinc-500 hover:text-zinc-300 transition-colors duration-200" aria-hidden="true" />
                </div>
                {renderTooltip(t.atp.dictionaryTooltip, TOOLTIP_CLASS)}
              </div>
            </div>
          </div>

          <button
            type="button"
            aria-pressed={useDictionary}
            onClick={() => onToggleUseDictionary(!useDictionary)}
            className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200 ${
              useDictionary ? 'bg-emerald-400/80' : 'bg-white/[0.08]'
            }`}
          >
            <span className={`inline-block h-5 w-5 rounded-full bg-white shadow-sm transform transition-transform duration-200 ${
              useDictionary ? 'translate-x-5' : 'translate-x-0'
            }`} />
          </button>
        </div>
      </div>
    </div>
  );
}
