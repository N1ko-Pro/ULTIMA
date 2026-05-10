import React from 'react';
import { Trash2 } from 'lucide-react';
import Modal from '@Core/Modal/ModalCore';
import ButtonCore from '@Core/Buttons/ButtonCore';
import { useLocale } from '@Locales/LocaleProvider';

export function DeleteConfirmModal({ project, onConfirm, onCancel }) {
  const t = useLocale();
  return (
    <Modal
      isOpen={!!project}
      onClose={onCancel}
      title={t.projects.deleteTitle}
      subtitle={t.projects.deleteSubtitle}
      icon={Trash2}
      iconColorClass="text-red-400"
      iconBgClass="bg-red-500/[0.1]"
      iconBorderClass="border-red-500/20"
      closeOnOverlayClick={true}
      showCloseIcon
      footer={
        <div className="flex items-center gap-3 w-full">
          <ButtonCore variant="secondary" className="flex-1" onClick={onCancel}>
            {t.common.cancel}
          </ButtonCore>
          <ButtonCore variant="danger" icon={Trash2} className="flex-1" onClick={onConfirm}>
            {t.common.delete}
          </ButtonCore>
        </div>
      }
    >
      <p className="text-zinc-300 text-sm leading-relaxed">
        {t.projects.deleteBody(project?.name)}
      </p>
    </Modal>
  );
}
