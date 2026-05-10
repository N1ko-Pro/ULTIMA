import React, { useState } from 'react';
import { CheckCircle2, ChevronDown, Download, HardDrive, Loader2, Trash2, X } from 'lucide-react';
import ButtonCore from '@Core/Buttons/ButtonCore';
import ButtonIcon from '@Core/Buttons/helpers/ButtonIcon';
import { useLocale } from '@Locales/LocaleProvider';
import { useAnimate } from '@Core/Animations/helpers/useAnimate';
import { getModelTierStyle } from '@Config/modelTiers.config';
import { AiTagPill } from './AiTagPill';

// ─── AI model card ──────────────────────────────────────────────────────────
// Large row representing one available Ollama model. Visual state depends on
// `isInstalled` / `isSelected` / `isPulling` / `isDeleting`. Handles:
//   • click-to-select (installed only)
//   • shake animation when clicking a not-yet-installed card
//   • inline download progress + cancel
//   • expandable description

export function AiModelCard({
  model,
  isSelected,
  isInstalled,
  isPulling,
  isCancellingPull,
  isDeleting,
  pullProgress,
  pullStatus,
  pullSpeedMbs,
  onSelect,
  onPull,
  onCancelPull,
  onDelete,
}) {
  const t = useLocale();
  const style = getModelTierStyle(model.tier);
  const [expanded, setExpanded] = useState(false);

  const { ref: cardRef,        play: playCardShake }    = useAnimate();
  const { ref: downloadBtnRef, play: playDownloadGlow } = useAnimate();

  const handleClick = () => {
    if (isPulling || isDeleting) return;
    if (!isInstalled) {
      // Subtle visual reminder that the user must download the model first.
      playCardShake('shakeStrong');
      playDownloadGlow('downloadHighlight');
      return;
    }
    onSelect(model.id);
  };

  const containerClass = isSelected
    ? `${style.cardSel} ${style.glow} cursor-pointer`
    : isInstalled && !isPulling && !isDeleting
      ? `${style.card} hover:border-white/[0.12] hover:bg-white/[0.03] cursor-pointer`
      : `${style.card} cursor-default`;

  const containerStyle = isDeleting
    ? { opacity: 0.5, filter: 'grayscale(0.5) blur(1px)', pointerEvents: 'none', transform: 'scale(0.98)' }
    : undefined;

  return (
    <div
      ref={cardRef}
      onClick={handleClick}
      style={containerStyle}
      className={`group relative rounded-2xl border p-4 transition-all duration-300 overflow-hidden ${containerClass}`}
    >
      {isSelected && (
        <div className={`absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent ${style.edge} to-transparent`} />
      )}

      <div className="flex items-stretch gap-3">
        {/* Radio indicator */}
        <div className="shrink-0 flex items-start pt-1">
          {isSelected ? (
            <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${style.dotText} border-current`}>
              <div className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
            </div>
          ) : (
            <div className={`w-4 h-4 rounded-full border-2 ${isInstalled ? 'border-zinc-600 group-hover:border-zinc-400' : 'border-zinc-700/60'} transition-colors`} />
          )}
        </div>

        {/* Info block */}
        <div className="flex-1 min-w-0 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-[13px] font-semibold leading-tight ${isSelected ? 'text-white' : 'text-zinc-100'}`}>
                {model.title}
              </span>
              <span className={`rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${style.badge}`}>
                {model.badge}
              </span>
            </div>

            {model.tags?.length > 0 && (
              <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                {model.tags.map((tag) => <AiTagPill key={tag} label={tag} tier={model.tier} />)}
              </div>
            )}

            <div className="flex items-center gap-1 mt-1.5">
              <HardDrive className="w-3 h-3 text-zinc-500 shrink-0" />
              <span className="text-[11px] text-zinc-300 font-mono font-medium">{model.size}</span>
              {model.vram && (
                <>
                  <span className="text-zinc-600 text-[11px] mx-0.5">|</span>
                  <span className="text-[11px] text-zinc-500 font-mono">{model.vram}</span>
                </>
              )}
            </div>
          </div>

          {isPulling && (
            <PullProgress
              pullProgress={pullProgress}
              pullStatus={pullStatus}
              pullSpeedMbs={pullSpeedMbs}
              isCancellingPull={isCancellingPull}
              onCancelPull={() => onCancelPull?.(model.id)}
            />
          )}
        </div>

        {/* Actions */}
        <div className="shrink-0 flex flex-col justify-center items-end gap-2" onClick={(e) => e.stopPropagation()}>
          {isDeleting ? (
            <StatusChip color="red" icon={Loader2} iconSpin label={t.ollama.deleting} />
          ) : isInstalled && !isPulling ? (
            <StatusChip color="emerald" icon={CheckCircle2} label={t.ollama.installedModel} />
          ) : null}

          {!isInstalled && !isPulling && !isDeleting && (
            <ButtonCore
              ref={downloadBtnRef}
              variant="indigo"
              size="sm"
              icon={Download}
              onClick={() => onPull(model.id)}
            >
              {t.ollama.download}
            </ButtonCore>
          )}

          {isInstalled && !isPulling && !isDeleting && (
            <ButtonIcon icon={Trash2} label={t.ollama.deleteModel} variant="danger" size="md" onClick={() => onDelete(model.id)} />
          )}
        </div>
      </div>

      {/* Expandable description */}
      {model.description && (
        <>
          <div
            style={{
              display: 'grid',
              gridTemplateRows: expanded ? '1fr' : '0fr',
              transition: 'grid-template-rows 320ms cubic-bezier(0.4, 0, 0.2, 1)',
            }}
          >
            <div className="overflow-hidden">
              <p className="pt-2.5 mt-3 text-[11px] text-zinc-400 leading-relaxed border-t border-white/[0.06]">
                {model.description}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setExpanded((v) => !v); }}
            className="w-full flex justify-center items-center pt-2.5 -mb-0.5 text-zinc-600 hover:text-zinc-400 transition-colors duration-200"
            aria-label={expanded ? t.ollama.collapseDesc : t.ollama.expandDesc}
          >
            <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-300 ${expanded ? 'rotate-180' : ''}`} />
          </button>
        </>
      )}
    </div>
  );
}

/** Small progress strip + cancel button shown under the model card while pulling. */
function PullProgress({ pullProgress, pullStatus, pullSpeedMbs, isCancellingPull, onCancelPull }) {
  const t = useLocale();
  const speedLabel = pullSpeedMbs < 1
    ? t.ollama.speedKbs(Math.round(pullSpeedMbs * 1024))
    : t.ollama.speedMbs(pullSpeedMbs.toFixed(1));
  const summary = [pullStatus || t.ollama.preparing, pullProgress > 0 && pullSpeedMbs > 0 ? speedLabel : null]
    .filter(Boolean)
    .join(' · ');

  return (
    <div className="mt-3 space-y-1.5" onClick={(e) => e.stopPropagation()}>
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-fuchsia-500 transition-all duration-300 shadow-[0_0_8px_rgba(99,102,241,0.4)]"
            style={{ width: `${Math.max(2, pullProgress)}%` }}
          />
        </div>
        <div className="shrink-0 flex items-center gap-2">
          {pullProgress > 0 && (
            <span className="text-[10px] font-bold font-mono text-zinc-100 tabular-nums">{pullProgress}%</span>
          )}
          <ButtonCore variant="danger" size="sm" disabled={isCancellingPull} loading={isCancellingPull} onClick={onCancelPull}>
            {isCancellingPull ? t.ollama.cancelling : t.ollama.cancelAction}
          </ButtonCore>
        </div>
      </div>
      <p className="text-[10px] text-zinc-500">{summary}</p>
    </div>
  );
}

/** Uniform pill used for "Загружена" / "Удаление..." status. */
function StatusChip({ color, icon: Icon, iconSpin, label }) {
  const style = color === 'red'
    ? 'bg-red-500/5 border-red-500/10 text-red-400'
    : 'bg-emerald-500/5 border-emerald-500/10 text-emerald-400';
  return (
    <div className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border ${style}`}>
      <Icon className={`w-3.5 h-3.5 ${iconSpin ? 'animate-spin' : ''}`} />
      <span className="text-[10px] font-bold uppercase tracking-tight">{label}</span>
    </div>
  );
}
