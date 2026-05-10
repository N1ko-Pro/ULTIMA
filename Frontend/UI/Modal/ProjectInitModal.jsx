import React, { useState, useEffect, useRef } from 'react';
import { PackageOpen, User, Type, FolderPlus } from 'lucide-react';
import Modal from '@Core/Modal/ModalCore';
import ButtonCore from '@Core/Buttons/ButtonCore';
import Field from '@UI/Modal/ModalField';
import { useLocale } from '@Locales/LocaleProvider';
import { useAuth } from '@Core/Services/AuthService';

/**
 * Shown when a new mod file is opened.
 * Collects mod name (pre-filled with _RU) and translation author.
 * Validates uniqueness of the mod name against existingProjectNames.
 */
export function ProjectInitModal({ isOpen, defaultModName, existingProjectNames = [], onConfirm, onCancel }) {
  const t = useLocale();
  const { localName } = useAuth();
  const [modName, setModName] = useState('');
  const [author, setAuthor] = useState('');
  const [modNameError, setModNameError] = useState('');
  const [authorError, setAuthorError] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const nameInputRef = useRef(null);

  // Reset state whenever the modal opens with a new defaultModName
  useEffect(() => {
    if (isOpen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setModName(defaultModName || '');
      setAuthor(localName || t.projects.defaultAuthor);
      setModNameError('');
      setAuthorError('');
      setSubmitted(false);
      // Focus name field after animation
      setTimeout(() => nameInputRef.current?.focus(), 120);
    }
  }, [isOpen, defaultModName, localName, t.projects.defaultAuthor]);

  const validateModName = (value) => {
    if (!value.trim()) return t.projects.editNameRequired;
    if (existingProjectNames.includes(value.trim())) {
      return t.projects.editNameDuplicate;
    }
    return '';
  };

  const validateAuthor = (value) => {
    if (!value.trim()) return t.projects.editAuthorRequired;
    return '';
  };

  const handleSubmit = () => {
    setSubmitted(true);
    const nameErr = validateModName(modName);
    const authErr = validateAuthor(author);
    setModNameError(nameErr);
    setAuthorError(authErr);
    if (nameErr || authErr) return;
    onConfirm({ modName: modName.trim(), author: author.trim() });
  };

  const handleModNameChange = (v) => {
    const filtered = v.replace(/[\u0400-\u04FF]/g, '');
    setModName(filtered);
    if (submitted) setModNameError(validateModName(filtered));
  };

  const handleAuthorChange = (v) => {
    setAuthor(v);
    if (submitted) setAuthorError(validateAuthor(v));
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onCancel}
      title={t.projects.newTitle}
      subtitle={t.projects.newSubtitle}
      icon={PackageOpen}
      iconColorClass="text-zinc-300"
      iconBgClass="bg-surface-3"
      iconBorderClass="border-white/[0.1]"
      closeOnOverlayClick={true}
      disableClose={false}
      showCloseIcon
      maxWidthClass="max-w-[440px]"
      footer={
        <div className="flex items-center gap-3 w-full">
          <ButtonCore variant="ghost" onClick={onCancel}>
            {t.common.cancel}
          </ButtonCore>
          <ButtonCore variant="primary-white" icon={FolderPlus} className="flex-1" onClick={handleSubmit}>
            {t.projects.createButton}
          </ButtonCore>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        {/* Mod name */}
        <Field
          ref={nameInputRef}
          icon={Type}
          label={t.projects.editModNameLabel}
          value={modName}
          onChange={handleModNameChange}
          error={modNameError}
          onEnter={handleSubmit}
          placeholder={t.projects.editModNamePlaceholder}
        />

        {/* Author */}
        <Field
          icon={User}
          label={t.projects.editAuthorLabel}
          value={author}
          onChange={handleAuthorChange}
          error={authorError}
          onEnter={handleSubmit}
          placeholder={t.projects.editAuthorPlaceholder}
        />
      </div>
    </Modal>
  );
}
