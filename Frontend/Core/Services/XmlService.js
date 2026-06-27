import { useCallback } from 'react';
import { notify } from '@Shared/notifications/notifyCore';
import { useLocale } from '@Locales/LocaleProvider';
import { toIdValueDictionary } from '@Shared/helpers/projectShape';
import { isAvailable } from '@API/client';
import * as xmlApi from '@API/xml';

// ─── Xml service ────────────────────────────────────────────────────────────
// Two-way bridge between project translations and Larian XML files. Serves
// as a thin wrapper around the backend IPC, surfacing localised toasts on
// success or failure.

/**
 * @param {{
 *   originalStrings: any[] | null,
 *   setTranslations: (next: any) => void,
 *   modInfo: any,
 *   targetLanguage?: string,
 * }} deps
 */
export default function useXmlService({ originalStrings, setTranslations, modInfo, targetLanguage }) {
  const t = useLocale();

  // Export only the rows the user can currently see. `rowsOverride` is the
  // editor's visible set (after filters: technical / non-English / hidden /
  // favorites / search); falls back to the full set when not provided.
  const handleExportXml = useCallback(async (rowsOverride) => {
    const rows = Array.isArray(rowsOverride) && rowsOverride.length ? rowsOverride : originalStrings;
    if (!isAvailable() || !rows) return;
    const dictionary = toIdValueDictionary(rows, 'original');
    const result = await xmlApi.exportFile(dictionary, modInfo, targetLanguage);

    if (result?.success) {
      notify.success(t.xml.success, t.xml.exportSuccessDesc);
    } else if (result?.error) {
      notify.error(t.xml.exportError, result.error);
    }
  }, [originalStrings, modInfo, targetLanguage, t.xml]);

  const handleImportXml = useCallback(async () => {
    if (!isAvailable()) return;
    const result = await xmlApi.importFile();

    if (result?.success) {
      setTranslations((prev) => ({ ...prev, ...result.translations }));
      notify.success(t.xml.success, t.xml.importSuccessDesc);
    } else if (result?.error) {
      notify.error(t.xml.importError, result.error);
    }
  }, [setTranslations, t.xml]);

  const handleOpenXmlFolder = useCallback(async () => {
    if (!isAvailable()) return;
    const result = await xmlApi.openFolder();
    if (result?.error) notify.error(t.xml.exportError, result.error);
  }, [t.xml]);

  return { handleExportXml, handleImportXml, handleOpenXmlFolder };
}
