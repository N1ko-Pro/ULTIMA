// ─────────────────────────────────────────────────────────────────────────────
//  games/gameRegistry — canonical id/metadata list for the games ULTIMA works
//  with. `folder` is the short, filesystem-safe segment used to physically
//  separate per-game data on disk (projects/<folder>/…, workspace/<folder>/…).
//  Keep the ids in sync with Frontend/Games/registry.js.
// ─────────────────────────────────────────────────────────────────────────────

const GAMES = [
  { id: 'bg3', name: "Baldur's Gate 3", folder: 'BG3' },
  { id: 'mysummercar', name: 'My Summer Car', folder: 'MSC' },
];

const GAME_IDS = GAMES.map((game) => game.id);

const DEFAULT_GAME_ID = 'bg3';

function isValidGameId(id) {
  return typeof id === 'string' && GAME_IDS.includes(id);
}

// Resolve a game id to its on-disk folder segment. Unknown/legacy ids fall back
// to the default game's folder so old records always land somewhere valid.
function getGameFolder(id) {
  const match = GAMES.find((game) => game.id === id);
  if (match) return match.folder;
  return GAMES.find((game) => game.id === DEFAULT_GAME_ID).folder;
}

module.exports = { GAMES, GAME_IDS, DEFAULT_GAME_ID, isValidGameId, getGameFolder };
