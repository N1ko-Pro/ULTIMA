import React, { useState, useEffect, useRef } from 'react';
import { Pencil, User, Type, Check, Globe } from 'lucide-react';
import Modal from '@Core/Modal/ModalCore';
import ButtonCore from '@Core/Buttons/ButtonCore';
import Field from '@UI/Modal/ModalField';
import LanguageDropdown from '@UI/Language/LanguageDropdown';
import { useLocale } from '@Locales/LocaleProvider';
import {
  DEFAULT_TARGET_LANGUAGE,
  normalizeLanguageCode,
} from '@Config/languages.constants';

// ─── ProjectEditModal ──────────────────────────────────────────────────────
// Edit metadata of an existing project: mod name, author, and target
// language. Changing the language re-targets `Localization/<Language>` and
// the smart-translate destination on next pack/run; existing translations
// in the project are preserved.

/**
 * @param {{
 *   isOpen: boolean,
 *   project: any,
 *   existingProjectNames?: string[],
 *   onConfirm: (values: { modName: string, author: string, targetLanguage: string }) => void,
 *   onCancel: () => void,
 * }} props
 */
export function ProjectEditModal({ isOpen, project, existingProjectNames = [], onConfirm, onCancel }) {
  const t = useLocale();
  const [modName, setModName] = useState('');
  const [author, setAuthor] = useState('');
  const [targetLanguage, setTargetLanguage] = useState(DEFAULT_TARGET_LANGUAGE);
  const [modNameError, setModNameError] = useState('');
  const [authorError, setAuthorError] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const nameInputRef = useRef(null);

  useEffect(() => {
    if (isOpen && project) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setModName(project.name || '');
      setAuthor(project.author || '');
      setTargetLanguage(normalizeLanguageCode(project.targetLanguage));
      setModNameError('');
      setAuthorError('');
      setSubmitted(false);
      setTimeout(() => nameInputRef.current?.focus(), 120);
    }
  }, [isOpen, project]);

  const validateModName = (value) => {
    if (!value.trim()) return t.projects.editNameRequired;
    // Allow the same name as current project
    const others = existingProjectNames.filter((n) => n !== project?.name);
    if (others.includes(value.trim())) {
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
    onConfirm({
      modName: modName.trim(),
      author: author.trim(),
      targetLanguage,
    });
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
      title={t.projects.editTitle}
      subtitle={t.projects.editSubtitle}
      icon={Pencil}
      iconColorClass="text-zinc-300"
      iconBgClass="bg-surface-3"
      iconBorderClass="border-white/[0.1]"
      closeOnOverlayClick={true}
      showCloseIcon
      maxWidthClass="max-w-[440px]"
      footer={
        <div className="flex items-center gap-3 w-full">
          <ButtonCore variant="secondary" className="flex-1" onClick={onCancel}>
            {t.common.cancel}
          </ButtonCore>
          <ButtonCore variant="primary-white" icon={Check} className="flex-1" onClick={handleSubmit}>
            {t.common.save}
          </ButtonCore>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        {/* Target language */}
        <div className="flex flex-col gap-1.5">
          <label className="flex items-center gap-1.5 text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
            <Globe className="w-3.5 h-3.5" />
            {t.projects.targetLanguageLabel}
          </label>
          <LanguageDropdown
            value={targetLanguage}
            onChange={setTargetLanguage}
          />
        </div>

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
