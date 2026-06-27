// ─────────────────────────────────────────────────────────────────────────────
//  repackHandlers.js — game-agnostic MOD_REPACK router.
//
//  The renderer's "pack" button sends MOD_REPACK with the active `gameId`. This
//  handler resolves the matching game module and delegates the actual build to
//  its `pack(input, ctx)` contract method. It contains NO game-specific logic:
//  BG3 builds a localization .pak, MSC builds a patch/replace artifact, etc.,
//  each entirely inside its own module (games/<id>/).
//
//  `updatedData` is forwarded untouched — meta-key handling is each game's
//  responsibility on its own injection step (BG3 needs name/author/uuid for
//  meta.lsx; MSC strips meta keys when building its translation table).
// ─────────────────────────────────────────────────────────────────────────────

const { ipcMain, dialog } = require('electron');
const CH = require('../ipcChannels');
const { wrapHandler } = require('./handlerUtils');

function registerRepackHandlers(mainWindow, { games }) {
  ipcMain.handle(CH.MOD_REPACK, wrapHandler(async (_event, payload) => {
    const { gameId, updatedData, modName, targetLanguage, mode, target, originalPakPath } = payload || {};

    const game = games.getGameModule(gameId);
    if (!game) {
      return { success: false, error: `Неизвестная игра: "${gameId}".` };
    }
    if (typeof game.pack !== 'function') {
      return { success: false, error: 'Упаковка не поддерживается для этой игры.' };
    }

    // Build context handed to the game module: a save-dialog helper and a
    // progress emitter. The game stays UI-free and just calls these.
    const ctx = {
      // Show a save dialog and return the chosen path, or null if cancelled.
      async promptOutputPath(defaultName, filters) {
        const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
          title: 'Сохранить переведённый мод',
          defaultPath: defaultName,
          filters: filters || [{ name: 'Archive', extensions: ['zip'] }],
        });
        return canceled || !filePath ? null : filePath;
      },
      // Forward a 0..100 progress value to the renderer.
      onProgress(percent) {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send(CH.MOD_REPACK_PROGRESS, { gameId, percent });
        }
      },
    };

    const input = { updatedData, modName, targetLanguage, mode, target, originalPakPath };
    return game.pack(input, ctx);
  }));
}

module.exports = { registerRepackHandlers };
