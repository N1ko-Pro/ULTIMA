import React from 'react';
import { User, Hash, Info, Type, ScrollText, RefreshCw, HelpCircle } from 'lucide-react';
import { useAuth } from '@Core/Services/AuthService';
import { TIER_COLORS } from '@Config/tiers.constants';
import { useLocale } from '@Locales/LocaleProvider';
import { useTooltip } from '@Shared/hooks/useTooltip';
import { notify } from '@Shared/notifications/notifyCore';
import InputField from './InputField';
import DescriptionField from './DescriptionField';
import logoSrc from '@Assets/logo.png';

// ─── Editor sidebar ─────────────────────────────────────────────────────────
// Left column of the editor view. Holds the brand header + profile trigger,
// then mod-data fields (name, author, UUID) and a description editor.
// `isCompact` shrinks the sidebar to 0px while keeping its children mounted
// so animations remain smooth.

function SideBar({
  disabled,
  modData,
  translations,
  setTranslations,
  packValidation,
  packValidationAttempt = 0,
  isCompact = false,
  onToggleProfile,
  packAttemptWithOriginalUuid,
  onDismissPackAttempt,
}) {
  const { uuid = '', author = '', name = '', description = '' } = modData || {};
  const auth = useAuth();
  const t = useLocale();
  const { anchorRef: tooltipAnchorRef, show: showTooltip, hide: hideTooltip, renderTooltip } = useTooltip();

  const handleTranslate = (key, value) => {
    setTranslations((prev) => ({ ...prev, [key]: value }));
  };

  const handleGenerateUUID = () => {
    setTranslations((prev) => ({ ...prev, uuid: crypto.randomUUID() }));
    onDismissPackAttempt?.();
    notify.dismissByTitle(t.editor.uuidWarning);
  };

  const isOriginalUuid = !translations.uuid && Boolean(uuid);
  const missingModDataFields = packValidation?.missingModDataFields || {};
  const uuidWarningClass =
    packAttemptWithOriginalUuid && isOriginalUuid
      ? 'text-white bg-red-500/20 border-red-500/50 hover:bg-red-500/30 hover:border-red-500/70 shadow-[0_0_20px_rgba(239,68,68,0.3)] animate-pulse'
      : 'text-zinc-500 hover:text-white hover:bg-surface-3 border-white/[0.06] hover:border-white/[0.12]';

  return (
    <div
      className={`border-r border-white/[0.06] bg-surface-1/95 backdrop-blur-2xl flex flex-col h-full shrink-0 z-30 relative transition-[width] duration-[600ms] ease-[cubic-bezier(0.4,0,0.2,1)] overflow-hidden ${
        disabled ? 'opacity-40 pointer-events-none grayscale-[50%]' : ''
      }`}
      style={{ width: isCompact ? '0px' : 'min(350px, 28vw)' }}
    >
      <div className="absolute inset-0 dot-grid opacity-20 pointer-events-none" />
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: 'linear-gradient(to right, transparent 70%, rgba(9,9,11,0.9) 100%)' }}
      />

      {/* Header — logo + profile button */}
      <div className="relative h-20 shrink-0 px-6 border-b border-white/[0.06] flex items-center" data-tutorial="editor-sidebar-header">
        <div className="absolute inset-0 bg-gradient-to-r from-surface-2/60 to-surface-2/40" />
        <div className="absolute inset-x-0 bottom-0 h-[1px] bg-gradient-to-r from-transparent via-white/[0.08] to-transparent" />

        <div className="relative flex items-center gap-1 flex-1 min-w-0">
          <div className="w-16 h-16 rounded-xl overflow-hidden shrink-0">
            <img src={logoSrc} alt="BG3 Ultima" className="w-full h-full object-contain" />
          </div>
          <div className={`flex flex-col justify-center whitespace-nowrap transition-opacity duration-300 ${isCompact ? 'opacity-0' : 'opacity-100'}`}>
            <h1 className="text-[15px] font-bold text-zinc-100 leading-tight tracking-tight">BG3 Ultima</h1>
            <p className="text-[10px] text-zinc-600 font-bold tracking-widest uppercase">Translation Tool</p>
          </div>
        </div>

        {onToggleProfile && (
          <button
            type="button"
            onClick={onToggleProfile}
            title={t.auth.profile}
            style={{ transitionDelay: isCompact ? '0ms' : '430ms' }}
            className={`relative w-9 h-9 rounded-full border flex items-center justify-center shrink-0 transition-all duration-200 active:scale-[0.95] ${
              isCompact ? 'opacity-0 pointer-events-none' : 'opacity-100'
            } border-white/[0.08] bg-white/[0.03] hover:border-white/[0.16] hover:bg-white/[0.06]`}
          >
            {auth.user?.avatar ? (
              <img src={auth.user.avatar} alt="" className="w-full h-full rounded-full object-cover" />
            ) : (
              <User className={`w-4 h-4 ${auth.isLoggedIn ? 'text-zinc-400' : 'text-zinc-600'}`} />
            )}
            {auth.isLoggedIn && (
              <div className={`absolute -bottom-px -right-px w-2.5 h-2.5 rounded-full border-2 border-surface-1 ${(TIER_COLORS[auth.tier] || TIER_COLORS.guest).dot}`} />
            )}
          </button>
        )}
      </div>

      {/* Content */}
      <div
        className={`relative flex-1 overflow-y-auto overflow-x-hidden py-6 space-y-8 z-10 transition-[opacity,padding] duration-300 ${
          isCompact ? 'opacity-0 pointer-events-none px-2' : 'opacity-100 px-4'
        }`}
        style={{ transitionDelay: isCompact ? '0ms' : '100ms' }}
      >
        <div className="w-full" style={{ maxWidth: 'clamp(280px, 24vw, 380px)', minWidth: '0' }} data-tutorial="editor-sidebar-modinfo">
          <section className="min-w-0">
            <SectionHeader icon={Info} label={t.sidebar.modData} />

            <div className="flex flex-col gap-2 min-w-0">
              <FieldCard>
                <InputField
                  icon={Type}
                  label={t.sidebar.modName}
                  original={name}
                  value={translations.name !== undefined ? translations.name : `${name}_RU`}
                  onChange={(v) => handleTranslate('name', v.replace(/[\u0400-\u04FF]/g, ''))}
                  isRequiredMissing={missingModDataFields.name}
                  packValidationAttempt={packValidationAttempt}
                  isUserSet={translations.name !== undefined}
                />
              </FieldCard>

              <FieldCard>
                <InputField
                  icon={User}
                  label={t.sidebar.author}
                  original={author}
                  value={translations.author !== undefined ? translations.author : author}
                  onChange={(v) => handleTranslate('author', v)}
                  isRequiredMissing={missingModDataFields.author}
                  packValidationAttempt={packValidationAttempt}
                  isUserSet={translations.author !== undefined}
                  mirrorValue
                />
              </FieldCard>

              <FieldCard>
                <InputField
                  icon={Hash}
                  label={t.sidebar.uuid}
                  original={translations.uuid || uuid}
                  readOnly
                  isOriginalUuid={isOriginalUuid}
                  isRequiredMissing={missingModDataFields.uuid}
                  packValidationAttempt={packValidationAttempt}
                  labelEnd={
                    isOriginalUuid ? (
                      <div className="relative inline-flex">
                        <div
                          ref={tooltipAnchorRef}
                          onMouseEnter={showTooltip}
                          onMouseLeave={hideTooltip}
                          className="flex items-center justify-center"
                        >
                          <HelpCircle className="w-[13px] h-[13px] text-orange-400/80 cursor-help hover:text-orange-300 transition-colors shrink-0" aria-hidden="true" />
                        </div>
                        {renderTooltip(
                          t.sidebar.uuidTooltip,
                          'fixed w-56 bg-surface-1/[0.95] backdrop-blur-2xl border border-orange-500/30 text-orange-200/80 text-[12px] p-3 rounded-xl shadow-[0_12px_40px_rgba(0,0,0,0.6)] z-[200] text-center leading-relaxed pointer-events-none',
                        )}
                      </div>
                    ) : null
                  }
                  headerEnd={
                    <button
                      type="button"
                      onClick={handleGenerateUUID}
                      className={`text-[10px] font-bold tracking-widest uppercase flex items-center gap-1 transition-all duration-[400ms] bg-surface-2 px-1.5 py-1 rounded-md border shrink-0 ${
                        isCompact ? 'opacity-0' : 'opacity-100'
                      } ${uuidWarningClass}`}
                      style={{ transitionDelay: isCompact ? '0ms' : '430ms' }}
                      title={t.editor.generateUuid}
                    >
                      <RefreshCw className={`w-3 h-3 ${packAttemptWithOriginalUuid && isOriginalUuid ? 'animate-spin' : ''}`} />
                      <span className="hidden xl:inline">{t.editor.generateUuid}</span>
                    </button>
                  }
                />
              </FieldCard>
            </div>
          </section>

          <section className="flex-1 pb-4 mt-8" data-tutorial="editor-sidebar-desc">
            <SectionHeader icon={ScrollText} label={t.sidebar.modDesc} />

            <FieldCard>
              <DescriptionField
                original={description}
                value={translations.description || ''}
                onChange={(v) => handleTranslate('description', v)}
                isRequiredMissing={missingModDataFields.description}
                packValidationAttempt={packValidationAttempt}
                isUserSet={Boolean(translations.description)}
              />
            </FieldCard>
          </section>
        </div>
      </div>
    </div>
  );
}

function SectionHeader({ icon: Icon, label }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <div className="flex-1 h-px bg-gradient-to-r from-transparent via-white/[0.08] to-transparent" />
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface-2/80 backdrop-blur-xl border border-white/[0.07] shadow-[0_2px_12px_rgba(0,0,0,0.35)]">
        <Icon className="w-3 h-3 text-zinc-500" />
        <span className="text-[10px] font-bold tracking-[0.14em] text-zinc-400 uppercase">{label}</span>
      </div>
      <div className="flex-1 h-px bg-gradient-to-l from-transparent via-white/[0.08] to-transparent" />
    </div>
  );
}

function FieldCard({ children }) {
  return (
    <div className="glass-panel rounded-2xl p-5 glass-panel-hover transition-all duration-300 relative min-w-0 overflow-hidden">
      <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/[0.08] to-transparent rounded-t-2xl" />
      {children}
    </div>
  );
}

export default React.memo(SideBar);
