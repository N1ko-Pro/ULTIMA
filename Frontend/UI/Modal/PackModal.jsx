import React, { useState, useEffect, useCallback } from 'react';
import {
  Archive, AlertTriangle, CheckCircle2, Layers, RefreshCcw,
  Gamepad2, FolderArchive, FolderSearch, Download, Loader2, Puzzle, MapPin,
} from 'lucide-react';
import ModalCore from '@Core/Modal/ModalCore';
import ButtonCore from '@Core/Buttons/ButtonCore';
import { useLocale } from '@Locales/LocaleProvider';
import * as gameIntegrationApi from '@API/gameIntegration';
import * as depsApi from '@API/deps';

// My Summer Car offers two build modes; other games have a single output.
const MSC_GAME_ID = 'mysummercar';

// Selection accents. Patch = emerald (recommended), Replace = sky (neutral-cool,
// deliberately NOT green so the two modes read distinctly).
const ACCENTS = {
  emerald: { ring: 'border-emerald-500/40 bg-emerald-500/[0.07]', icon: 'text-emerald-300' },
  sky:     { ring: 'border-sky-500/40 bg-sky-500/[0.07]',         icon: 'text-sky-300' },
};

export default function PackModal({ isOpen, onClose, onPack, warnings, gameId }) {
  const t = useLocale();

  const supportsModes = gameId === MSC_GAME_ID;
  const [mode, setMode]   = useState('patch');
  // Patch delivery: true → straight into the game, false → shareable zip.
  // Replace always outputs a zip, so toGame is irrelevant there.
  const [toGame, setToGame] = useState(true);

  // ── Game integration (MSC patch → game) ───────────────────────────────────
  const [integration, setIntegration] = useState(null);
  const [busy, setBusy]       = useState(null);   // 'detect' | 'pick' | 'patcher' | null
  const [progress, setProgress] = useState(0);
  const [intError, setIntError] = useState(null);

  const refreshIntegration = useCallback(async () => {
    if (!supportsModes) return;
    try {
      const res = await gameIntegrationApi.getStatus(gameId);
      setIntegration(res?.success && res.supported ? (res.status || null) : null);
    } catch {
      setIntegration(null);
    }
  }, [supportsModes, gameId]);

  useEffect(() => {
    if (isOpen) refreshIntegration();
  }, [isOpen, refreshIntegration]);

  const reset = () => { setMode('patch'); setToGame(true); setBusy(null); setProgress(0); setIntError(null); };
  const handleClose = () => { reset(); onClose(); };

  const resolveTarget = () => {
    if (!supportsModes || mode !== 'patch') return undefined;
    return toGame ? 'game' : 'zip';
  };

  const handlePack = () => { onPack(supportsModes ? mode : undefined, resolveTarget()); reset(); };

  const gameFound = !!integration?.valid;
  const patcherInstalled = !!integration?.patcherInstalled;
  const isBusy = busy !== null;

  const runDetect = async () => {
    setBusy('detect'); setIntError(null);
    try {
      const res = await gameIntegrationApi.detectPath(gameId);
      if (res?.success && res.status?.valid) setIntegration(res.status);
      else setIntError(t.integration.detectFailed);
    } catch (e) { setIntError(e?.message || t.integration.detectFailed); }
    finally { setBusy(null); }
  };

  const runPick = async () => {
    setBusy('pick'); setIntError(null);
    try {
      const res = await gameIntegrationApi.pickPath(gameId);
      if (res?.success && res.status?.valid) setIntegration(res.status);
      else if (res && !res.canceled) setIntError(res.error === 'NOT_A_GAME_FOLDER' ? t.integration.notAGameFolder : (res.error || t.integration.detectFailed));
    } catch (e) { setIntError(e?.message || t.integration.detectFailed); }
    finally { setBusy(null); }
  };

  const runInstallPatcher = async () => {
    setBusy('patcher'); setProgress(0); setIntError(null);
    const unsubscribe = depsApi.onInstallProgress((p) => setProgress(p));
    try {
      const res = await gameIntegrationApi.installPatcher(gameId);
      if (res?.success && res.status) setIntegration(res.status);
      else setIntError(res?.error === 'GAME_PATH_MISSING' ? t.integration.needGameFirst : (res?.error || t.deps.errorDesc));
    } catch (e) { setIntError(e?.message || t.deps.errorDesc); }
    finally { unsubscribe(); setBusy(null); }
  };

  const hasWarnings = !!(
    warnings?.missingSections?.mainTable ||
    warnings?.missingSections?.description ||
    warnings?.missingModDataFields?.name ||
    warnings?.missingModDataFields?.author
  );

  const needsGameSetup = supportsModes && mode === 'patch' && toGame;
  const gameReady = gameFound && patcherInstalled;
  const blockPack = needsGameSetup && !gameReady;

  const confirmLabel = needsGameSetup
    ? t.pack.confirmToGame
    : hasWarnings ? t.pack.confirmAnyway : t.pack.confirm;

  const checks = <Group label={t.pack.checkLabel}><ValidationRows t={t} warnings={warnings} hasWarnings={hasWarnings} /></Group>;

  return (
    <ModalCore
      isOpen={isOpen}
      onClose={handleClose}
      title={t.pack.title}
      subtitle={hasWarnings ? t.pack.subtitleWarn : t.pack.subtitleOk}
      icon={Archive}
      iconColorClass={hasWarnings ? 'text-amber-300' : 'text-emerald-300'}
      iconBgClass="bg-surface-3"
      iconBorderClass={hasWarnings ? 'border-amber-500/25' : 'border-emerald-500/25'}
      showCloseIcon
      closeOnOverlayClick
      maxWidthClass={supportsModes ? 'max-w-3xl' : 'max-w-sm'}
      footer={
        <div className="flex gap-2.5 w-full">
          <ButtonCore variant="secondary" className="flex-1" onClick={handleClose}>
            {t.common.cancel}
          </ButtonCore>
          <ButtonCore
            variant={blockPack ? 'secondary' : hasWarnings ? 'warning' : 'sky'}
            icon={needsGameSetup ? Gamepad2 : Archive}
            className="flex-[2]"
            disabled={blockPack || isBusy}
            onClick={handlePack}
          >
            {confirmLabel}
          </ButtonCore>
        </div>
      }
    >
      {supportsModes ? (
        <div className="space-y-6">
          {/* Top row: build method (left) + delivery / output (right) */}
          <div className="grid grid-cols-2">
            <div className="pr-5">
              <Group label={t.pack.modes.title}>
                <div className="space-y-2">
                  <ModeCard
                    icon={Layers}
                    active={mode === 'patch'}
                    onClick={() => setMode('patch')}
                    name={t.pack.modes.patchName}
                    desc={t.pack.modes.patchDesc}
                    badge={t.pack.modes.recommended}
                    accent="emerald"
                  />
                  <ModeCard
                    icon={RefreshCcw}
                    active={mode === 'replace'}
                    onClick={() => setMode('replace')}
                    name={t.pack.modes.replaceName}
                    desc={t.pack.modes.replaceDesc}
                    accent="sky"
                  />
                </div>
              </Group>
            </div>

            <div className="pl-5 border-l border-white/[0.06]">
              {mode === 'patch' ? (
                <Group label={t.pack.delivery.title} accent="emerald" bracket>
                  <div className="space-y-2">
                    <DeliveryCard
                      icon={Gamepad2}
                      active={toGame}
                      onClick={() => setToGame(true)}
                      name={t.pack.delivery.gameName}
                      desc={t.pack.delivery.gameDesc}
                    />
                    <DeliveryCard
                      icon={FolderArchive}
                      active={!toGame}
                      onClick={() => setToGame(false)}
                      name={t.pack.delivery.zipName}
                      desc={t.pack.delivery.zipDesc}
                    />
                  </div>
                </Group>
              ) : (
                // Replace builds a single zip — show it as the sole, pre-selected output.
                <Group label={t.pack.delivery.replaceTitle}>
                  <DeliveryCard
                    isStatic
                    icon={FolderArchive}
                    active
                    name={t.pack.delivery.zipName}
                    desc={t.pack.delivery.zipDesc}
                  />
                </Group>
              )}
            </div>
          </div>

          {/* Bottom: readiness (left, patch→game) + checks (right) — same row */}
          <div className="grid grid-cols-2">
            <div className="pr-5">
              {needsGameSetup && (
                <Group label={t.pack.setup.title} accent="emerald" bracket>
                  <GameSetupRows
                    t={t}
                    gameFound={gameFound}
                    patcherInstalled={patcherInstalled}
                    patcherName={integration?.patcherName}
                    gamePath={integration?.gamePath}
                    patcherVersion={integration?.patcherVersion}
                    busy={busy}
                    progress={progress}
                    isBusy={isBusy}
                    error={intError}
                    onDetect={runDetect}
                    onPick={runPick}
                    onInstallPatcher={runInstallPatcher}
                  />
                </Group>
              )}
            </div>
            <div className="pl-5 border-l border-white/[0.06]">{checks}</div>
          </div>
        </div>
      ) : (
        // Single-output games (e.g. BG3): just the validation summary.
        checks
      )}
    </ModalCore>
  );
}

// ─── Section wrapper: label + hairline rule, optional emerald bracket ─────────
// `bracket` draws a left accent line so a section visually belongs to the patch
// mode (its delivery target + readiness are patch sub-config).
function Group({ label, accent, bracket, children }) {
  const labelColor = accent === 'emerald' ? 'text-emerald-400/80' : 'text-zinc-400';
  return (
    <div className={bracket ? 'pl-3.5 border-l-2 border-emerald-500/25' : ''}>
      <div className="flex items-center gap-2.5 mb-2.5">
        <span className={`text-[10px] font-bold tracking-widest uppercase whitespace-nowrap ${labelColor}`}>{label}</span>
        <span className="h-px flex-1 bg-white/[0.07]" />
      </div>
      {children}
    </div>
  );
}

// ─── Mode card (patch / replace) ──────────────────────────────────────────────
function ModeCard({ icon: Icon, active, onClick, name, desc, badge, accent }) {
  const cfg = ACCENTS[accent] || ACCENTS.emerald;
  const ring = active ? cfg.ring : 'border-white/[0.06] bg-white/[0.02] hover:border-white/[0.12]';
  const iconColor = active ? cfg.icon : 'text-zinc-400';

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left rounded-xl border px-3.5 py-3 transition-all duration-200 active:scale-[0.99] ${ring}`}
    >
      <div className="flex items-center gap-2">
        <Icon className={`w-4 h-4 shrink-0 ${iconColor}`} />
        <p className="text-[13px] font-semibold text-zinc-100">{name}</p>
        {badge && (
          <span className="ml-auto shrink-0 text-[8.5px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full text-emerald-300 bg-emerald-500/[0.12] border border-emerald-500/20">
            {badge}
          </span>
        )}
      </div>
      <p className="text-[11.5px] text-zinc-400 leading-relaxed mt-1.5">{desc}</p>
    </button>
  );
}

// ─── Delivery card (game / zip). `isStatic` renders a non-interactive, selected
// card used to show the single forced output for replace mode. ────────────────
function DeliveryCard({ icon: Icon, active, onClick, name, desc, isStatic }) {
  const ring = active ? ACCENTS.sky.ring : 'border-white/[0.06] bg-white/[0.02] hover:border-white/[0.12]';
  const iconColor = active ? ACCENTS.sky.icon : 'text-zinc-400';
  const cls = `w-full text-left rounded-xl border px-3.5 py-3 transition-all duration-200 ${ring} ${isStatic ? '' : 'active:scale-[0.99]'}`;

  const inner = (
    <>
      <div className="flex items-center gap-2">
        <Icon className={`w-4 h-4 shrink-0 ${iconColor}`} />
        <p className="text-[13px] font-semibold text-zinc-100">{name}</p>
      </div>
      <p className="text-[11.5px] text-zinc-400 leading-relaxed mt-1.5">{desc}</p>
    </>
  );

  if (isStatic) return <div className={cls}>{inner}</div>;
  return <button type="button" onClick={onClick} className={cls}>{inner}</button>;
}

// ─── Patch → game readiness rows (game folder + patcher) ──────────────────────
function GameSetupRows({
  t, gameFound, patcherInstalled, patcherName, gamePath, patcherVersion,
  busy, progress, isBusy, error, onDetect, onPick, onInstallPatcher,
}) {
  const name = patcherName || 'MSCLoc API';
  return (
    <div className="space-y-2">
      {/* Game folder */}
      {gameFound ? (
        <div className="flex items-center gap-2.5 rounded-xl border border-emerald-500/15 bg-emerald-500/[0.04] px-3.5 py-3">
          <MapPin className="w-4 h-4 shrink-0 text-emerald-400" />
          <div className="min-w-0 flex-1">
            <p className="text-[12px] font-medium text-emerald-300">{t.integration.gameFound}</p>
            <p className="text-[10.5px] text-zinc-400 truncate" title={gamePath}>{gamePath}</p>
          </div>
          <button
            type="button" disabled={isBusy} onClick={onPick} title={t.integration.change}
            className="shrink-0 inline-flex items-center justify-center w-7 h-7 rounded-md border border-white/[0.1] text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.05] transition-all active:scale-[0.94] disabled:opacity-40"
          >
            {busy === 'pick' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FolderSearch className="w-3.5 h-3.5" />}
          </button>
        </div>
      ) : (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.05] px-3.5 py-3">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
            <p className="text-[12px] font-medium text-zinc-100">{t.integration.gameNotFound}</p>
          </div>
          <div className="flex gap-2">
            <button
              type="button" disabled={isBusy} onClick={onDetect}
              className="flex-1 inline-flex items-center justify-center gap-1.5 h-8 rounded-lg border border-sky-500/25 bg-sky-500/[0.08] text-sky-300 text-[11.5px] font-medium hover:bg-sky-500/[0.14] transition-all active:scale-[0.98] disabled:opacity-40"
            >
              {busy === 'detect' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FolderSearch className="w-3.5 h-3.5" />}
              {busy === 'detect' ? t.integration.detecting : t.integration.detect}
            </button>
            <button
              type="button" disabled={isBusy} onClick={onPick}
              className="inline-flex items-center justify-center gap-1.5 h-8 px-3 rounded-lg border border-white/[0.1] text-zinc-300 text-[11.5px] font-medium hover:bg-white/[0.05] transition-all active:scale-[0.98] disabled:opacity-40"
            >
              {busy === 'pick' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : t.integration.choose}
            </button>
          </div>
        </div>
      )}

      {/* Patcher — title is the patcher's name so it's clear what is installed */}
      <div className={`rounded-xl border px-3.5 py-3 ${patcherInstalled ? 'border-emerald-500/15 bg-emerald-500/[0.04]' : 'border-amber-500/20 bg-amber-500/[0.05]'}`}>
        <div className="flex items-center gap-2.5">
          {patcherInstalled ? <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" /> : <Puzzle className="w-4 h-4 shrink-0 text-amber-400" />}
          <div className="min-w-0 flex-1">
            <p className="text-[12px] font-medium text-zinc-100 truncate">{name}</p>
            <p className="text-[10.5px] text-zinc-400">
              {busy === 'patcher'
                ? `${t.integration.installingPatcher} · ${Math.round(progress)}%`
                : patcherInstalled
                  ? `${t.integration.patcherInstalled}${patcherVersion ? ` · v${patcherVersion}` : ''}`
                  : t.integration.patcherNotInstalledSub}
            </p>
          </div>
          {!patcherInstalled && (
            <button
              type="button" disabled={isBusy || !gameFound} onClick={onInstallPatcher}
              title={gameFound ? t.integration.installPatcher : t.integration.needGameFirst}
              className="shrink-0 inline-flex items-center justify-center gap-1.5 h-7 px-2.5 rounded-md border border-emerald-500/25 bg-emerald-500/[0.08] text-emerald-300 text-[11px] font-medium hover:bg-emerald-500/[0.14] transition-all active:scale-[0.94] disabled:opacity-40 disabled:hover:bg-emerald-500/[0.08]"
            >
              {busy === 'patcher' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
              {t.integration.install}
            </button>
          )}
        </div>
        {busy === 'patcher' && (
          <div className="mt-2 h-1.5 bg-surface-3/60 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-indigo-500 to-indigo-400 transition-all duration-300" style={{ width: `${progress}%` }} />
          </div>
        )}
      </div>

      {error && <p className="text-[11px] text-red-400 leading-relaxed px-0.5">{error}</p>}
    </div>
  );
}

// ─── Validation rows ──────────────────────────────────────────────────────────
function ValidationRows({ t, warnings, hasWarnings }) {
  if (!hasWarnings) return <ReadyRow label={t.pack.allGood} sub={t.pack.allGoodSub} />;
  return (
    <div className="space-y-2">
      {warnings.missingSections.mainTable && (
        <WarningRow label={t.pack.warnStrings(warnings.missingMainTableCount)} sub={t.pack.warnStringsSub} />
      )}
      {warnings.missingSections.description && (
        <WarningRow label={t.pack.warnDescription} sub={t.pack.warnDescriptionSub} />
      )}
      {(warnings.missingModDataFields.name || warnings.missingModDataFields.author) && (
        <WarningRow label={t.pack.warnModInfo} sub={t.pack.warnModInfoSub} />
      )}
    </div>
  );
}

function ReadyRow({ label, sub }) {
  return (
    <div className="relative flex items-center gap-3 rounded-xl overflow-hidden border border-emerald-500/20 px-3.5 py-3">
      <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/[0.14] via-emerald-500/[0.05] to-transparent pointer-events-none" />
      <div className="relative w-8 h-8 rounded-lg bg-emerald-500/[0.16] border border-emerald-500/25 flex items-center justify-center shrink-0">
        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
      </div>
      <div className="relative">
        <p className="text-[13px] font-semibold text-emerald-300">{label}</p>
        <p className="text-[11.5px] text-zinc-400 mt-0.5">{sub}</p>
      </div>
    </div>
  );
}

function WarningRow({ label, sub }) {
  return (
    <div className="relative flex items-center gap-3 rounded-xl overflow-hidden border border-amber-500/20 px-3.5 py-3">
      <div className="absolute inset-0 bg-gradient-to-r from-amber-500/[0.14] via-amber-500/[0.05] to-transparent pointer-events-none" />
      <div className="relative w-8 h-8 rounded-lg bg-amber-500/[0.16] border border-amber-500/20 flex items-center justify-center shrink-0">
        <AlertTriangle className="w-4 h-4 text-amber-400" />
      </div>
      <div className="relative min-w-0">
        <p className="text-[12.5px] font-semibold text-zinc-100">{label}</p>
        <p className="text-[11.5px] text-zinc-400 mt-0.5">{sub}</p>
      </div>
    </div>
  );
}
