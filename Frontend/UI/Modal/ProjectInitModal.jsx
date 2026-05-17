import React, { useState, useEffect, useRef, useMemo } from 'react';
import { PackageOpen, User, Type, FolderPlus, Globe } from 'lucide-react';
import Modal from '@Core/Modal/ModalCore';
import ButtonCore from '@Core/Buttons/ButtonCore';
import Field from '@UI/Modal/ModalField';
import LanguageDropdown from '@UI/Language/LanguageDropdown';
import { useLocale } from '@Locales/LocaleProvider';
import { useAuth } from '@Core/Services/AuthService';
import {
  DEFAULT_TARGET_LANGUAGE,
  getLanguageSuffix,
  normalizeLanguageCode,
} from '@Config/languages.constants';

// ─── ProjectInitModal ──────────────────────────────────────────────────────
// Shown when a new mod file is opened. Collects the translation's mod name,
// author, and target language (drives the `Localization/<Language>` folder
// inside the resulting .pak as well as the smart-translate destination).
//
// The mod-name field is auto-populated with the source mod's name plus the
// suffix derived from the chosen language (e.g. `MyMod_RU`, `MyMod_DE`). If
// the user hasn't manually edited the field, switching the language updates
// the suggestion live; once they type their own value, the suggestion is
// no longer overwritten.

/**
 * @param {{
 *   isOpen: boolean,
 *   defaultModName: string,
 *   defaultTargetLanguage?: string,
 *   existingProjectNames?: string[],
 *   onConfirm: (values: { modName: string, author: string, targetLanguage: string }) => void,
 *   onCancel: () => void,
 * }} props
 */
export function ProjectInitModal({
  isOpen,
  defaultModName,
  defaultTargetLanguage = DEFAULT_TARGET_LANGUAGE,
  existingProjectNames = [],
  onConfirm,
  onCancel,
}) {
  const t = useLocale();
  const { localName } = useAuth();
  const [modName, setModName] = useState('');
  const [author, setAuthor] = useState('');
  const [targetLanguage, setTargetLanguage] = useState(DEFAULT_TARGET_LANGUAGE);
  const [modNameError, setModNameError] = useState('');
  const [authorError, setAuthorError] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const nameInputRef = useRef(null);
  // Once the user types their own mod name we stop auto-substituting the
  // language suffix in the suggestion. Reset on each modal open.
  const userTouchedNameRef = useRef(false);

  // Strip whatever language suffix the parent baked into `defaultModName`
  // so we can re-attach the suffix matching the currently selected language.
  // The base name is derived once per modal-open and stored implicitly via
  // closure inside the effects below.
  const defaultBaseName = useMemo(() => {
    if (!defaultModName) return '';
    return defaultModName.replace(/_(?:RU|EN|DE|FR|ES|IT|PL|PT|JA|KO|ZH|UK|TR)$/i, '');
  }, [defaultModName]);

  // Reset state whenever the modal opens with a new defaultModName
  useEffect(() => {
    if (isOpen) {
      const initialLang = normalizeLanguageCode(defaultTargetLanguage);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTargetLanguage(initialLang);
      setModName(defaultBaseName ? `${defaultBaseName}${getLanguageSuffix(initialLang)}` : '');
      setAuthor(localName || t.projects.defaultAuthor);
      setModNameError('');
      setAuthorError('');
      setSubmitted(false);
      userTouchedNameRef.current = false;
      // Focus name field after animation
      setTimeout(() => nameInputRef.current?.focus(), 120);
    }
  }, [isOpen, defaultBaseName, defaultTargetLanguage, localName, t.projects.defaultAuthor]);

  // Live-update the mod name suggestion when the user changes the language —
  // but only if they haven't already typed something themselves.
  useEffect(() => {
    if (!isOpen) return;
    if (userTouchedNameRef.current) return;
    if (!defaultBaseName) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setModName(`${defaultBaseName}${getLanguageSuffix(targetLanguage)}`);
  }, [targetLanguage, defaultBaseName, isOpen]);

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
    onConfirm({
      modName: modName.trim(),
      author: author.trim(),
      targetLanguage,
    });
  };

  const handleModNameChange = (v) => {
    const filtered = v.replace(/[\u0400-\u04FF]/g, '');
    userTouchedNameRef.current = true;
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
          <p className="text-[11px] text-zinc-500 leading-relaxed">
            {t.projects.targetLanguageHint}
          </p>
        </div>

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
