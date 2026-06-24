// ─────────────────────────────────────────────────────────────────────────────
//  games/index.js — backend game-module registry.
//  Maps a game id to its backend module (the contract defined in
//  `games/<id>/index.js`). The app shell iterates these for initialization and
//  IPC handler registration, so adding a game is a one-line change here.
//  Id metadata / validation lives in `gameRegistry.js`; this file wires the
//  executable modules.
// ─────────────────────────────────────────────────────────────────────────────

const bg3 = require('./bg3');
const mysummercar = require('./mysummercar');

const GAME_MODULES = { [bg3.id]: bg3, [mysummercar.id]: mysummercar };

function getGameModule(id) {
  return GAME_MODULES[id] || null;
}

function listGameModules() {
  return Object.values(GAME_MODULES);
}

module.exports = { GAME_MODULES, getGameModule, listGameModules };
