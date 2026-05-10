import React from 'react';
import { Archive, AlertTriangle, CheckCircle2 } from 'lucide-react';
import ModalCore from '@Core/Modal/ModalCore';
import ButtonCore from '@Core/Buttons/ButtonCore';
import { useLocale } from '@Locales/LocaleProvider';

export default function PackModal({ isOpen, onClose, onPack, warnings }) {
  const t = useLocale();

  const hasWarnings = !!(
    warnings?.missingSections?.mainTable ||
    warnings?.missingSections?.description ||
    warnings?.missingModDataFields?.name ||
    warnings?.missingModDataFields?.author
  );

  return (
    <ModalCore
      isOpen={isOpen}
      onClose={onClose}
      title={t.pack.title}
      subtitle={hasWarnings ? t.pack.subtitleWarn : t.pack.subtitleOk}
      icon={Archive}
      iconColorClass={hasWarnings ? 'text-amber-300' : 'text-emerald-300'}
      iconBgClass="bg-surface-3"
      iconBorderClass={hasWarnings ? 'border-amber-500/25' : 'border-emerald-500/25'}
      showCloseIcon
      closeOnOverlayClick
      maxWidthClass="max-w-sm"
      footer={
        <div className="flex gap-2.5 w-full">
          <ButtonCore variant="secondary" className="flex-1" onClick={onClose}>
            {t.common.cancel}
          </ButtonCore>
          <ButtonCore variant={hasWarnings ? 'warning' : 'sky'} icon={Archive} className="flex-[2]" onClick={onPack}>
            {hasWarnings ? t.pack.confirmAnyway : t.pack.confirm}
          </ButtonCore>
        </div>
      }
    >
      <div className="space-y-2">
        {!hasWarnings ? (
          <ReadyRow label={t.pack.allGood} sub={t.pack.allGoodSub} />
        ) : (
          <>
            {warnings.missingSections.mainTable && (
              <WarningRow
                label={t.pack.warnStrings(warnings.missingMainTableCount)}
                sub={t.pack.warnStringsSub}
              />
            )}
            {warnings.missingSections.description && (
              <WarningRow
                label={t.pack.warnDescription}
                sub={t.pack.warnDescriptionSub}
              />
            )}
            {(warnings.missingModDataFields.name || warnings.missingModDataFields.author) && (
              <WarningRow
                label={t.pack.warnModInfo}
                sub={t.pack.warnModInfoSub}
              />
            )}
          </>
        )}
      </div>
    </ModalCore>
  );
}

function ReadyRow({ label, sub }) {
  return (
    <div className="relative flex items-center gap-3.5 rounded-xl overflow-hidden border border-emerald-500/20 px-4 py-4">
      <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/[0.16] via-emerald-500/[0.06] to-transparent pointer-events-none" />
      <div className="relative w-9 h-9 rounded-xl bg-emerald-500/[0.16] border border-emerald-500/25 flex items-center justify-center shrink-0">
        <CheckCircle2 className="w-[18px] h-[18px] text-emerald-400" />
      </div>
      <div className="relative">
        <p className="text-[14px] font-semibold text-emerald-300">{label}</p>
        <p className="text-[12px] text-zinc-500 mt-0.5">{sub}</p>
      </div>
    </div>
  );
}

function WarningRow({ label, sub }) {
  return (
    <div className="relative flex items-center gap-3.5 rounded-xl overflow-hidden border border-amber-500/20 px-4 py-3.5">
      <div className="absolute inset-0 bg-gradient-to-r from-amber-500/[0.16] via-amber-500/[0.06] to-transparent pointer-events-none" />
      <div className="relative w-9 h-9 rounded-xl bg-amber-500/[0.16] border border-amber-500/20 flex items-center justify-center shrink-0">
        <AlertTriangle className="w-4 h-4 text-amber-400" />
      </div>
      <div className="relative min-w-0">
        <p className="text-[13px] font-semibold text-zinc-100">{label}</p>
        <p className="text-[12px] text-zinc-500 mt-0.5">{sub}</p>
      </div>
    </div>
  );
}
