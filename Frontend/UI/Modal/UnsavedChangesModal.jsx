import React, { useState } from 'react';
import { AlertTriangle, Save, Trash } from 'lucide-react';
import Modal from '@Core/Modal/ModalCore';
import ButtonCore from '@Core/Buttons/ButtonCore';
import { useLocale } from '@Locales/LocaleProvider';

export default function UnsavedChangesModal({ isOpen, type, onClose, onDiscardAndClose, onSaveAndClose }) {
  const t = useLocale();
  const [isSaving, setIsSaving] = useState(false);

  const handleSaveAndClose = async () => {
    setIsSaving(true);
    try {
      if (onSaveAndClose) {
        await onSaveAndClose(type);
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t.unsaved.title}
      subtitle={type === 'app' ? t.unsaved.subtitleApp : t.unsaved.subtitleProject}
      icon={AlertTriangle}
      iconColorClass="text-red-400"
      iconBgClass="bg-red-500/[0.1]"
      iconBorderClass="border-red-500/20"
      closeOnOverlayClick={true}
      footer={
        <div className="flex items-center justify-between w-full gap-3">
          <ButtonCore variant="danger" icon={Trash} onClick={() => onDiscardAndClose(type)} disabled={isSaving}>
            {t.unsaved.discard}
          </ButtonCore>
          <ButtonCore variant="primary" icon={Save} onClick={handleSaveAndClose} disabled={isSaving} loading={isSaving}>
            {type === 'app' ? t.unsaved.saveAndExit : t.unsaved.saveAndClose}
          </ButtonCore>
        </div>
      }
      showCloseIcon
    >
      <p className="text-zinc-300 text-sm leading-relaxed">
        {t.unsaved.body}
        <br />
        {t.unsaved.saveHint} <strong>{t.common.save.toLowerCase()}</strong> {type === 'app' ? t.unsaved.closeApp : t.unsaved.closeProject}.
      </p>
    </Modal>
  );
}
