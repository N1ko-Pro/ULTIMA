import React from 'react';
import useUpdater from '@Core/Services/UpdaterService';
import { useLocale } from '@Locales/LocaleProvider';
import { useInstallAnimation } from '@Core/Update/helpers/installProgress';
import InstallProgressPanel from '@Core/Update/helpers/InstallProgressPanel';
import ModalCore from '@Core/Modal/ModalCore';

// ─── InstallingUpdateModal ──────────────────────────────────────────────────
// Global, non-dismissable overlay that appears when the updater moves into
// the `installing` state. Simulates a progress bar (there's no real
// measurement possible — the backend just spawns NSIS) then calls
// `finalizeInstall()` which quits the app so NSIS can swap binaries and
// relaunch.
//
// Suppressed when `UpdateAvailableModal` is already on screen — it owns the
// same animation inside its "installing" branch, rendering this one would
// produce two stacked progress bars.

export default function InstallingUpdateModal({ suppressWhenModalOpen = false }) {
  const t = useLocale();
  const { state, currentVersion, finalizeInstall } = useUpdater();
  const isOpen = state.status === 'installing' && !suppressWhenModalOpen;
  const percent = useInstallAnimation(isOpen, finalizeInstall);

  return (
    <ModalCore
      isOpen={isOpen}
      closeOnOverlayClick={false}
      disableClose
      maxWidthClass="max-w-md"
      zIndex={200}
    >
      <InstallProgressPanel
        percent={percent}
        currentVersion={currentVersion}
        targetVersion={state.version}
        t={t}
      />
    </ModalCore>
  );
}
