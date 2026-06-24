import bg3 from './bg3/game';
import mysummercar from './mysummercar/game';
import { CARD_IMAGES, WORKSPACE_IMAGES } from './gameImages';

// ─── Game registry ───────────────────────────────────────────────────────────
// Single source of truth for the games ULTIMA can work with. Adding a new game
// is a matter of dropping a folder under `Frontend/Games/<id>/` and registering
// its definition here. The backend keeps a matching id list in
// `Backend/games/gameRegistry.js` — keep the ids in sync.
//
// Artwork (card banner + workspace backdrop) is resolved automatically from the
// game's folder by `gameImages.js`; see that file for the expected filenames.

const withAssets = (game) => ({
  ...game,
  cardImage: CARD_IMAGES[game.id] || null,
  workspaceImage: WORKSPACE_IMAGES[game.id] || null,
});

export const GAMES = [bg3, mysummercar].map(withAssets);

export const DEFAULT_GAME_ID = bg3.id;

export function getGameById(id) {
  return GAMES.find((game) => game.id === id) || null;
}

export function isValidGameId(id) {
  return GAMES.some((game) => game.id === id);
}
