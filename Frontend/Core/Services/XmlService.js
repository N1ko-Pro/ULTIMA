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
 * }} deps
 */
export default function useXmlService({ originalStrings, setTranslations, modInfo }) {
  const t = useLocale();

  const handleExportXml = useCallback(async () => {
    if (!isAvailable() || !originalStrings) return;
    const dictionary = toIdValueDictionary(originalStrings, 'original');
    const result = await xmlApi.exportFile(dictionary, modInfo);

    if (result?.success) {
      notify.success(t.xml.success, t.xml.exportSuccessDesc);
    } else if (result?.error) {
      notify.error(t.xml.exportError, result.error);
    }
  }, [originalStrings, modInfo, t.xml]);

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

  return { handleExportXml, handleImportXml };
}
