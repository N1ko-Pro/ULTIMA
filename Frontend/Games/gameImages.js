// ─── Game images ─────────────────────────────────────────────────────────────
// Auto-discovers per-game artwork so adding visuals is drag-and-drop: just put
// the images into the game's `Images` folder and they're picked up at build
// time. Only the leading token matters — anything after the underscore is a
// free-form note for yourself.
//
//   Frontend/Games/<id>/Images/Title_*.{png|jpg|jpeg|webp|avif}  → selection banner
//   Frontend/Games/<id>/Images/Back_*.{png|jpg|jpeg|webp|avif}   → workspace backdrop
//
// Missing files are simply absent from the maps (no build error), and the UI
// falls back to a gradient + icon.

const cardModules = import.meta.glob('./*/Images/Title_*.{png,jpg,jpeg,webp,avif}', {
  eager: true,
  query: '?url',
  import: 'default',
});

const workspaceModules = import.meta.glob('./*/Images/Back_*.{png,jpg,jpeg,webp,avif}', {
  eager: true,
  query: '?url',
  import: 'default',
});

function indexByGameId(modules) {
  const out = {};
  for (const [filePath, url] of Object.entries(modules)) {
    const match = filePath.match(/^\.\/([^/]+)\//);
    if (match && !out[match[1]]) out[match[1]] = url;
  }
  return out;
}

export const CARD_IMAGES = indexByGameId(cardModules);
export const WORKSPACE_IMAGES = indexByGameId(workspaceModules);
