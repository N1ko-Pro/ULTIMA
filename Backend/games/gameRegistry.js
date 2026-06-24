// ─────────────────────────────────────────────────────────────────────────────
//  gameRegistry.js — canonical list of supported games for the main process.
//  Mirrors the ids declared on the renderer side in Frontend/Games/registry.js.
//  Keep the ids in sync between both registries.
// ─────────────────────────────────────────────────────────────────────────────

const GAMES = [
  { id: 'bg3', name: "Baldur's Gate 3" },
  { id: 'mysummercar', name: 'My Summer Car' },
];

const GAME_IDS = GAMES.map((game) => game.id);

const DEFAULT_GAME_ID = 'bg3';

function isValidGameId(id) {
  return typeof id === 'string' && GAME_IDS.includes(id);
}

module.exports = { GAMES, GAME_IDS, DEFAULT_GAME_ID, isValidGameId };
