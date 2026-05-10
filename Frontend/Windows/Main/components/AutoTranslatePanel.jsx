import React, { useEffect } from 'react';
import { Bot, Zap, ChevronUp, Languages, Play } from 'lucide-react';
import { useAuth } from '@Core/Services/AuthService';
import { useLocale } from '@Locales/LocaleProvider';
import { AUTO_TRANSLATION_MODE } from '@Config/autoTranslationModes.constants';
import { useOllamaStatus } from '../utils/useOllamaStatus';
import AtpModeCard from './AtpModeCard';
import AtpSmartSettings from './AtpSmartSettings';
import AtpLocalSettings from './AtpLocalSettings';

// ─── AutoTranslatePanel ─────────────────────────────────────────────────────
// Expandable pane below the editor toolbar. Picks a translation mode
// ("Smart" cloud or "Local" Ollama AI) and exposes mode-specific settings
// + a single "Start" action. The heavy lifting is split across:
//
//   • AtpModeCard             — the two mode cards
//   • AtpSmartSettings        — dropdowns + dictionary toggle
//   • AtpLocalSettings        — Ollama status UI (loading / missing / dropdown)
//   • useOllamaStatus (hook)  — queries `@API/ollama.getStatus`

const PANEL_ANIM_MS = 400;
const PANEL_ANIM_EASE = 'cubic-bezier(0.4, 0, 0.2, 1)';

function AutoTranslatePanel({
  isExpanded,
  selectedModeId,
  errorModeId,
  canStart,
  isTranslating,
  translationSettings,
  onSelectMode,
  onStart,
  onClose,
  onUpdateSettings,
  onAuthRequired,
  onOpenSettings,
}) {
  const { canUseAI } = useAuth();
  const t = useLocale();

  const isSmartSelected = selectedModeId === AUTO_TRANSLATION_MODE.SMART;
  const isLocalSelected = selectedModeId === AUTO_TRANSLATION_MODE.LOCAL;
  const hasSmartError   = errorModeId    === AUTO_TRANSLATION_MODE.SMART;
  const hasLocalError   = errorModeId    === AUTO_TRANSLATION_MODE.LOCAL;
  const hasModeSelected = isSmartSelected || isLocalSelected;

  const useDictionarySmart = translationSettings?.smart?.useDictionary ?? false;
  // Local mode always uses the dictionary — it's the only reliable way to
  // keep domain terminology consistent in Ollama outputs.
  const useDictionary = isLocalSelected ? true : useDictionarySmart;

  // Ollama status only matters when the user is actually looking at the Local tab.
  const ollama = useOllamaStatus({
    enabled: isLocalSelected && isExpanded,
    configuredModel: translationSettings?.ollama?.model || '',
  });

  const canStartActual = isLocalSelected ? ollama.isReady : hasModeSelected;

  // ── Handlers ────────────────────────────────────────────────────────────
  const handleOllamaModelChange = (modelId) => onUpdateSettings({ ollama: { model: modelId } });

  const handleToggleUseDictionary = (value) => {
    if (isLocalSelected) onUpdateSettings({ local: { useDictionary: value } });
    else                 onUpdateSettings({ smart: { useDictionary: value } });
  };

  // Esc closes the panel (unless a translation is already running).
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape' && !isTranslating && isExpanded) onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isTranslating, isExpanded, onClose]);

  const isStartEnabled = canStart && canStartActual && !isTranslating;
  const startBtnClass = isStartEnabled
    ? 'border-emerald-500/30 bg-emerald-500/[0.08] text-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.12)] hover:bg-emerald-500/[0.14] hover:border-emerald-400/40 hover:shadow-[0_0_28px_rgba(16,185,129,0.2)] active:scale-[0.98]'
    : 'border-white/[0.06] bg-white/[0.02] text-zinc-600 cursor-not-allowed';

  return (
    <div
      className="atp-wrapper shrink-0 z-40 relative"
      style={{
        display: 'grid',
        gridTemplateRows: isExpanded ? '1fr' : '0fr',
        transition: `grid-template-rows ${PANEL_ANIM_MS}ms ${PANEL_ANIM_EASE}`,
      }}
    >
      <div className="overflow-hidden">
        <div className="pb-5">
          <div
            className="relative max-w-[620px] mx-auto border-x border-b border-white/[0.06] bg-surface-1/90 backdrop-blur-2xl rounded-b-2xl shadow-[0_12px_40px_rgba(0,0,0,0.4)]"
            style={{
              clipPath: isExpanded ? 'inset(0 0 0 0 round 0 0 1rem 1rem)' : 'inset(0 40% 100% 40% round 0 0 1rem 1rem)',
              transition: `clip-path ${PANEL_ANIM_MS}ms ${PANEL_ANIM_EASE}`,
            }}
          >
            <PanelDecor />

            <div className="relative px-5 pt-4 pb-4">
              <div className="flex gap-0">
                {/* Mode picker */}
                <div className="w-[220px] shrink-0 pr-5">
                  <GroupLabel>{t.atp.modeHeader}</GroupLabel>
                  <div className="space-y-2" data-tutorial="atp-modes">
                    <AtpModeCard
                      icon={Zap}
                      label={t.atp.smartLabel}
                      description={t.atp.smartDesc}
                      isSelected={isSmartSelected}
                      hasError={hasSmartError}
                      onClick={() => onSelectMode(AUTO_TRANSLATION_MODE.SMART)}
                    />
                    <AtpModeCard
                      icon={Bot}
                      label={t.atp.aiLabel}
                      description={canUseAI ? t.atp.aiDescEnabled : t.atp.aiDescLocked}
                      isSelected={isLocalSelected}
                      hasError={hasLocalError}
                      locked={!canUseAI}
                      onClick={() => (canUseAI ? onSelectMode(AUTO_TRANSLATION_MODE.LOCAL) : onAuthRequired?.())}
                    />
                  </div>
                </div>

                <div className="w-px self-stretch shrink-0 bg-gradient-to-b from-white/[0.02] via-white/[0.07] to-white/[0.02]" />

                {/* Mode-specific settings */}
                <div className="flex-1 min-w-0 flex flex-col pl-5">
                  {!hasModeSelected ? (
                    <EmptyModePlaceholder />
                  ) : (
                    <div className="animate-[fadeIn_200ms_ease-out] flex flex-col h-full">
                      <GroupLabel>
                        {isSmartSelected ? t.atp.smartHeader : t.atp.localHeader}
                      </GroupLabel>

                      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-2.5 py-1.5 flex flex-col justify-center h-[96px]" data-tutorial="atp-settings">
                        {isSmartSelected && (
                          <AtpSmartSettings
                            translationSettings={translationSettings}
                            useDictionary={useDictionary}
                            onUpdateSettings={onUpdateSettings}
                            onToggleUseDictionary={handleToggleUseDictionary}
                          />
                        )}
                        {isLocalSelected && (
                          <AtpLocalSettings
                            installedModelNames={ollama.installedModelNames}
                            localServerRunning={ollama.localServerRunning}
                            installedOptions={ollama.installedOptions}
                            effectiveModel={ollama.effectiveModel}
                            onChangeModel={handleOllamaModelChange}
                            onOpenSettings={onOpenSettings}
                          />
                        )}
                      </div>

                      <div className="mt-2" data-tutorial="atp-start">
                        <button
                          type="button"
                          onClick={() => onStart({ useDictionary })}
                          disabled={!isStartEnabled}
                          title={t.atp.startButton}
                          className={`group relative flex h-[34px] w-full items-center justify-center gap-2 rounded-xl border text-[12px] font-semibold transition-all duration-300 overflow-hidden ${startBtnClass}`}
                        >
                          {isStartEnabled && (
                            <span className="absolute inset-0 bg-emerald-500/[0.04] animate-[pulseGlow_2s_ease-in-out_infinite]" />
                          )}
                          <Play className="relative z-10 h-3.5 w-3.5 ml-0.5" />
                          <span className="relative z-10">{t.atp.startButton}</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Collapse pill */}
          <div className="flex justify-center relative z-10 -mt-px">
            <button
              type="button"
              onClick={onClose}
              disabled={isTranslating}
              title={t.atp.collapse}
              aria-label={t.atp.collapse}
              className="group flex items-center justify-center h-[13px] w-14 rounded-b-xl bg-surface-2/80 border border-t-0 border-white/[0.18] hover:border-white/[0.38] hover:bg-surface-3/80 transition-all duration-200 shadow-[0_4px_10px_rgba(255,255,255,0.05)] disabled:opacity-30 disabled:pointer-events-none"
            >
              <ChevronUp className="w-3 h-3 text-white/45 group-hover:text-white/80 transition-colors duration-200" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Dot-grid + radial fade decorations behind the panel body. */
function PanelDecor() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-b-2xl">
      <div
        className="absolute inset-0 opacity-[0.4]"
        style={{
          backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.18) 1px, transparent 1px)',
          backgroundSize: '18px 18px',
        }}
      />
      <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse 70% 50% at 50% 0%, rgba(9,9,11,0.6) 0%, transparent 100%)' }} />
    </div>
  );
}

/** Two-line caption with hairline borders on either side. */
function GroupLabel({ children }) {
  return (
    <div className="relative flex items-center justify-center mb-2 pointer-events-none">
      <div className="w-full h-2 border-t border-l border-white/[0.08] rounded-tl-lg" />
      <span className="text-[11px] text-zinc-500 font-bold px-2 tracking-[0.15em] leading-none bg-surface-1 uppercase whitespace-nowrap">
        {children}
      </span>
      <div className="w-full h-2 border-t border-r border-white/[0.08] rounded-tr-lg" />
    </div>
  );
}

function EmptyModePlaceholder() {
  const t = useLocale();
  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="text-center">
        <div className="w-10 h-10 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center mx-auto mb-2.5">
          <Languages className="w-4.5 h-4.5 text-zinc-600" />
        </div>
        <p className="text-zinc-400 text-[13px] font-medium leading-snug">{t.atp.selectModeTitle}</p>
        <p className="text-zinc-600 text-[12px] mt-0.5">{t.atp.selectModeSub}</p>
      </div>
    </div>
  );
}

export default React.memo(AutoTranslatePanel);
