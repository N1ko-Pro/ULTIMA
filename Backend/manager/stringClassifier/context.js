// ─────────────────────────────────────────────────────────────────────────────
//  stringClassifier/context.js — Phase 2: IL-usage knowledge base.
//
//  The structural rules (rules.js) judge a string by its *shape*. This module
//  judges it by *how the code uses it* — which is the only reliable way to
//  resolve ambiguous words like "Open", "Trigger", "Fold". The signal comes
//  from the MscLocTool (dnlib): for each literal it can record the API it flows
//  into, the role it plays, and the field it's stored in.
//
//  Expected (optional) per-string context shape — all fields optional:
//    {
//      sinks:  string[]   // e.g. "UnityEngine.GameObject::Find"
//      roles:  string[]   // "tag" | "name" | "key" | "path" | "label" | "message" | …
//      fields: string[]   // names of fields/properties the string is stored into
//    }
//  Singular aliases (sink/role/field/member) are also accepted.
//
//  A DISPLAY sink means the string is shown to the player → keep it (text).
//  A TECHNICAL sink means it's an identifier/key/lookup → hide it (technical).
//  Context weights are large so they dominate the structural score; when a
//  string is BOTH displayed and used technically the signals cancel and we fall
//  back to structure.
// ─────────────────────────────────────────────────────────────────────────────

// Strings flowing into these APIs are identifiers / keys / lookups, never UI.
const TECHNICAL_SINKS = [
  /GameObject::Find/i,
  /GameObject::FindGameObjects?WithTag/i,
  /Transform::Find/i,
  /::GetComponent/i,
  /::SendMessage/i,
  /Resources::Load/i,
  /PlayerPrefs::/i,
  /PlayMaker|HutongGames/i,
  /Animator::(Play|CrossFade|Set(Trigger|Bool|Float|Integer)|Get(Bool|Float|Integer))/i,
  /LayerMask::NameToLayer/i,
  /::set_tag$/i,
  /::set_name$/i,
  /Dictionary`?\d*::|Hashtable::/i,
  /::(ContainsKey|TryGetValue|get_Item|set_Item)/i,
  /Debug::Log/i,
  /Application::LoadLevel|SceneManager::/i,
  /AssetBundle::/i,
  /Type::GetType|Activator::CreateInstance/i,
];

// Strings flowing into these APIs are rendered to the player → translatable.
const DISPLAY_SINKS = [
  /GUI(Layout)?::(Label|Button|Box|Toggle|TextField|TextArea|Window|Tooltip)/i,
  /GUIContent::\.ctor/i,
  /UI\.Text::set_text/i,
  /TMP_?Text::set_text|TextMeshPro\w*::set_text/i,
  /TextMesh::set_text/i,
  /::set_text$/i,
  /Settings::(AddText|AddHeader|Add(CheckBox|Button|Slider|Toggle|TextBox))/i,
  /ModUI::(ShowMessage|CreateMessageBox|ShowYesNoMessage|ShowGuiMessage)/i,
  /Keybind::/i,
];

const TECHNICAL_ROLES = new Set(['tag', 'name', 'key', 'path', 'id', 'guid', 'fsm', 'layer', 'scene', 'asset', 'prefab']);
const DISPLAY_ROLES = new Set(['label', 'message', 'text', 'tooltip', 'title', 'description', 'caption']);

// Field/property names are matched per camelCase / snake_case token so
// "stateName", "fsm_state" or "TooltipText" are recognised.
const TECHNICAL_FIELD_WORDS = new Set(['name', 'id', 'tag', 'path', 'key', 'guid', 'fsm', 'layer', 'scene', 'asset', 'prefab', 'state', 'hash', 'index', 'type']);
const DISPLAY_FIELD_WORDS = new Set(['label', 'title', 'desc', 'description', 'message', 'text', 'caption', 'tooltip', 'hint']);

function fieldTokens(name) {
  return String(name)
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((token) => token.toLowerCase());
}

function fieldMatches(fields, wordSet) {
  return fields.some((f) => fieldTokens(f).some((token) => wordSet.has(token)));
}

function toArray(value, singular) {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (typeof singular === 'string' && singular) return [singular];
  if (typeof value === 'string' && value) return [value];
  return [];
}

const anyMatch = (values, patterns) => values.some((v) => patterns.some((re) => re.test(v)));

/**
 * Score an optional IL-usage context. Returns a signed weight (positive →
 * technical, negative → display/text) and reason codes.
 * @param {object} [context]
 * @returns {{ weight: number, reasons: string[] }}
 */
function scoreContext(context) {
  if (!context || typeof context !== 'object') return { weight: 0, reasons: [] };

  const sinks = toArray(context.sinks, context.sink);
  const roles = toArray(context.roles, context.role).map((r) => String(r).toLowerCase());
  const fields = toArray(context.fields, context.field || context.member);

  const technical =
    anyMatch(sinks, TECHNICAL_SINKS) ||
    roles.some((r) => TECHNICAL_ROLES.has(r)) ||
    fieldMatches(fields, TECHNICAL_FIELD_WORDS);

  const display =
    anyMatch(sinks, DISPLAY_SINKS) ||
    roles.some((r) => DISPLAY_ROLES.has(r)) ||
    fieldMatches(fields, DISPLAY_FIELD_WORDS);

  let weight = 0;
  const reasons = [];
  // Decisive weights (≫ structural thresholds of ±3). If both fire they cancel
  // and the structural score decides.
  if (display) { weight -= 8; reasons.push('ctxDisplay'); }
  if (technical) { weight += 8; reasons.push('ctxTechnical'); }

  return { weight, reasons };
}

module.exports = { scoreContext };
