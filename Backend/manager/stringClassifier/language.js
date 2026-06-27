// ─────────────────────────────────────────────────────────────────────────────
//  stringClassifier/language.js — non-English natural-language detector.
//
//  Some mod authors embed several languages in their DLL (e.g. an English line
//  plus its Portuguese/Spanish twin). This module FLAGS a string as a likely
//  non-English phrase (`foreign: true`). It does NOT decide to hide it — that is
//  a user-controlled toggle in the editor, because another mod might legitimately
//  have a non-English original language.
//
//  Heuristic (comparative, conservative against English):
//    • count English words (E) vs non-English evidence (F = foreign words +
//      Romance morphological suffixes like -ção / -mente / -agem / -ido);
//    • accented letters with F ≥ E → foreign (handles single words: Aleatório);
//    • otherwise foreign when the non-English evidence outweighs the English one.
//  English loanwords inside a foreign line (e.g. "save") no longer veto it,
//  because the comparison still favours the foreign evidence.
// ─────────────────────────────────────────────────────────────────────────────

// Common English words (function + frequent game/UI/domain vocabulary).
const ENGLISH = new Set([
  'the', 'and', 'you', 'your', 'yours', 'to', 'of', 'for', 'with', 'from',
  'this', 'that', 'these', 'those', 'are', 'is', 'was', 'were', 'be', 'been',
  'will', 'would', 'can', 'could', 'should', 'have', 'has', 'had', 'not', 'all',
  'each', 'about', 'first', 'into', 'out', 'only', 'also', 'more', 'less', 'off',
  'on', 'in', 'at', 'by', 'as', 'it', 'its', 'if', 'or', 'but', 'when', 'while',
  'where', 'what', 'which', 'how', 'why', 'then', 'than', 'there', 'here', 'now',
  'their', 'his', 'her', 'they', 'them', 'we', 'us', 'my', 'me', 'do', 'does',
  'press', 'hold', 'click', 'key', 'keys', 'open', 'close', 'opens', 'closed',
  'use', 'used', 'using', 'save', 'load', 'exit', 'quit', 'start', 'stop',
  'enable', 'enabled', 'disable', 'disabled', 'button', 'menu', 'settings',
  'option', 'options', 'please', 'mod', 'game', 'car', 'engine', 'oil', 'fuel',
  'speed', 'level', 'time', 'day', 'night', 'money', 'cash', 'price', 'pay',
  'payment', 'discount', 'sleep', 'bed', 'door', 'light', 'lights', 'repair',
  'part', 'parts', 'buy', 'sell', 'drive', 'gear', 'brake', 'wheel', 'window',
  'radio', 'phone', 'shop', 'store', 'home', 'house', 'water', 'food', 'beer',
  'yes', 'no', 'new', 'old', 'show', 'hide', 'add', 'remove', 'reset', 'default',
  'left', 'right', 'down', 'back', 'next', 'page', 'value', 'amount', 'total',
  'free', 'full', 'empty', 'low', 'high', 'max', 'min', 'auto', 'mode', 'tank',
  'visual', 'general', 'random', 'player', 'cloud', 'fuse', 'roadside', 'muscle',
]);

// Distinctive non-English words (PT / ES / FR / IT / DE) — function words,
// common UI verbs/nouns and weekday names. Curated to avoid collisions with the
// English set above.
const FOREIGN = new Set([
  // Portuguese — function words
  'para', 'com', 'sem', 'nao', 'não', 'voce', 'você', 'na', 'nas', 'nos',
  'da', 'das', 'dos', 'uma', 'que', 'pela', 'pelo', 'sua', 'seu', 'isso',
  'aqui', 'agora', 'está', 'esta', 'são', 'sao', 'ao', 'aos', 'pelos', 'pelas',
  'num', 'numa', 'dele', 'dela',
  // Portuguese — common content / UI
  'desconto', 'pagamento', 'dinheiro', 'aleatorio', 'aleatório', 'ligado',
  'desligado', 'ativado', 'desativado', 'ligar', 'desligar', 'ativar',
  'desativar', 'sim', 'comprar', 'vender', 'velocidade', 'combustivel',
  'combustível', 'preço', 'preco', 'opções', 'opcoes', 'configurações',
  'configuracoes', 'geral', 'adicionar', 'casa', 'banco', 'dobra', 'melhorar',
  'simular', 'vida', 'novo', 'nova', 'luz', 'liga', 'externa', 'externo',
  'namoro', 'apartamento', 'garagem', 'expandido', 'jogo', 'porta', 'carro',
  'noite', 'dia',
  // Portuguese — weekdays
  'sexta', 'terça', 'terca', 'sábado', 'sabado', 'domingo', 'segunda', 'quarta',
  'quinta',
  // Spanish
  'el', 'la', 'los', 'las', 'con', 'porque', 'pero', 'muy', 'usted', 'también',
  'tambien', 'cuando', 'desde', 'hasta', 'pago', 'dinero', 'coche', 'guardar',
  // Portuguese / Spanish — the bare preposition "de" (very common, distinctive).
  'de',
  // French
  'les', 'une', 'avec', 'sans', 'pour', 'vous', 'dans', 'votre', 'vos', 'oui',
  'être', 'avez', 'cette', 'argent', 'voiture',
  // German
  'der', 'das', 'und', 'mit', 'ohne', 'nicht', 'sie', 'ein', 'eine', 'ist',
  'wird', 'oder', 'geld',
  // Italian
  'senza', 'questo', 'della', 'soldi',
]);

// Romance (mostly Portuguese) morphological endings — strong non-English signal
// on words of reasonable length. Deliberately excludes broad verb endings like
// -ar/-er/-ir that collide with English (car, her, stir, …).
const FOREIGN_SUFFIX = /(ções|coes|ção|cao|mente|agem|inho|inha|ável|avel|idade|amento|imento|ório|orio|ário|ario|ador|edor|idor|eiro|eira|tura|ado|ada|ido|ida)$/;

const DIACRITICS = /[ãõçáéíóúâêôîûàèìòùñäöüß]/i;

const { isExceptionWord } = require('./allowlist');

/**
 * @param {string} text
 * @returns {boolean} true when the string looks like a NON-English phrase.
 */
function detectForeignLanguage(text) {
  if (typeof text !== 'string' || !text.trim()) return false;

  // Drop allowlisted proper nouns (place / character names like Peräjärvi) so
  // their diacritics and non-English shape don't trip the detector.
  const words = (text.toLowerCase().match(/[\p{L}]+/gu) || []).filter((w) => !isExceptionWord(w));
  if (words.length === 0) return false;

  let english = 0;
  let foreign = 0;
  for (const w of words) {
    // Foreign evidence first: explicit non-English words (any length) and
    // Romance suffixes on longer words.
    if (FOREIGN.has(w) || (w.length >= 5 && FOREIGN_SUFFIX.test(w))) {
      foreign += 1;
      continue;
    }
    // English evidence — but ignore ≤2-letter words: "do", "de", "na", "no",
    // "da"… are too ambiguous (they double as Romance function words) and used
    // to wrongly tip a foreign line back to English.
    if (w.length > 2 && ENGLISH.has(w)) english += 1;
  }

  // Romance accents barely ever appear in English UI text → strong signal.
  // Only count diacritics carried by non-allowlisted words. Flag foreign unless
  // the line is predominantly English (≥ half its words).
  const hasForeignDiacritics = words.some((w) => DIACRITICS.test(w));
  if (hasForeignDiacritics && english * 2 < words.length) return true;

  // Otherwise: more non-English evidence than English evidence.
  return foreign > english && foreign >= 1;
}

module.exports = { detectForeignLanguage };
