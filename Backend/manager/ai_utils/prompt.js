// ─── Glossary ──────────────────────────────────────────────────────────────────

/**
 * Build glossary as in-context translation memory.
 * Research (Moslem et al., EAMT 2023) shows that feeding glossary as
 * source→target pairs in the prompt dramatically improves terminology adherence.
 * We group by category for better model comprehension and limit to 60 pairs.
 */
function buildGlossaryBlock(pairs) {
  if (!Array.isArray(pairs) || pairs.length === 0) return "";
  const limited = pairs.slice(0, 60);
  return limited.map(([src, tgt]) => `  ${src} = ${tgt}`).join("\n");
}

// ─── System Prompt ─────────────────────────────────────────────────────────────

/**
 * System prompt based on best-practice translation prompting:
 * - Role assignment with domain expertise (game localization)
 * - Explicit target language and domain context
 * - Structured rules with priority ordering
 * - Glossary as translation memory
 * - Negative instructions (what NOT to do) to prevent common errors
 */
function buildBg3AiSystemPrompt(glossaryPairs, targetLang = "Russian") {
  const glossaryBlock = buildGlossaryBlock(
    Array.isArray(glossaryPairs) ? glossaryPairs : []
  );

  const parts = [
    `Ты — переводчик-локализатор Baldur's Gate 3 (D&D 5e). Язык: ${targetLang}.`,
    ``,
    `ФОРМАТ: Выводи ТОЛЬКО перевод. Без кавычек, markdown, пояснений.`,
    ``,
    `ПРАВИЛА:`,
    `1. Токены [1], [2], [#1], {0}, {1} — копируй как есть. Они УЖЕ содержат числа с единицами. УДАЛЯЙ слова "damage", "ft", "feet" рядом с ними: "[1] damage" → "[1]", "within [3]" → "в пределах [3]", "in a [1] radius" → "в радиусе [1]". НЕЛЬЗЯ дописывать "урон", "урона", "футов" после токена.`,
    `2. Теги <br>, <b>, </b>, <i>, </i> — сохраняй на месте.`,
    `3. Теги <LSTag ...>текст</LSTag> — переведи текст внутри, обёртку НЕ трогай. Атрибуты тега копируй один-в-один.`,
    `4. Маркеры [Tn:слово] (например [T1:преимущество], [T2:бросок атаки]) — ВСЕГДА сохраняй квадратные скобки и номер. Слово внутри ОБЯЗАТЕЛЬНО склоняй/спрягай по контексту: меняй падеж, число, форму (прилагательное→глагол и т.д.). Примеры: "gives you [T1:преимущество]" → "даёт вам [T1:преимущество]", "on [T2:бросок атаки]" → "при [T2:броске атаки]", "make the attacker [T3:ослеплённый]" → "чтобы [T3:ослепить] атакующего". НЕЛЬЗЯ убирать скобки.`,
    `5. Кол-во строк на входе = на выходе.`,
    ``,
    `СТИЛЬ:`,
    `- Естественный литературный русский, как в официальных RPG-локализациях.`,
    `- D&D терминология из словаря ниже.`,
    `- "you/your" = "вы/ваш", "on a hit" = "при попадании", "creature" = "существо".`,
    `- "melee" = "ближнего боя" (НЕ "рукопашный"): "melee attacks" = "атаки ближнего боя", "melee weapon" = "оружие ближнего боя".`,
    `- "you can take a [Reaction] to [Verb]" = "можете использовать [Реакцию], чтобы [Глагол]".`,
    ``,
    `ЗАПРЕЩЕНО: пояснения, "Перевод:", кавычки, markdown, лишний текст.`,
  ];

  if (glossaryBlock) {
    parts.push(``, `СЛОВАРЬ:`, glossaryBlock);
  }

  return parts.join("\n");
}

// ─── Few-Shot Examples ─────────────────────────────────────────────────────────

/**
 * Few-shot demonstration using real BG3 patterns after marker substitution.
 * Each example shows actual AI input: glossary terms → [Tn:русское] markers,
 * rare non-glossary terms → raw <LSTag>, plus [1]/[2] placeholders and <br>.
 */
function buildFewShotMessages() {
  return [
    // Example 1: Multiple markers + inflection — shows EVERY marker preserved
    {
      role: "user",
      content: "Переведи с English на Russian:\nDoing so gives you [T1:преимущество] on melee weapon [T2:бросок атаки] using [T3:сила] during this turn, but [T4:бросок атаки] against you have [T5:преимущество] until your next turn.",
    },
    {
      role: "assistant",
      content: "Это даёт вам [T1:преимущество] при [T2:бросках атаки] оружием ближнего боя с использованием [T3:силы] в этот ход, но [T4:броски атаки] против вас совершаются с [T5:преимуществом] до вашего следующего хода.",
    },
    // Example 2: Markers + [1] placeholder + <br> + <b> (complex BG3 ability)
    {
      role: "user",
      content: "Переведи с English на Russian:\nDeals an additional [1] with melee and improvised weapons.<br><br>Has resistance to physical damage, and [T1:преимущество] on Strength [T2:проверка характеристики] and [T3:спасбросок].<br><br>Cannot cast or concentrate on spells.<br><br><b>Ancestral Protectors:</b> Causes creatures to have [T4:помеха] and reduced damage on their attacks.",
    },
    {
      role: "assistant",
      content: "Наносит дополнительно [1] оружием ближнего боя и импровизированным оружием.<br><br>Имеет сопротивление к физическому урону и [T1:преимущество] при [T2:проверках характеристики] Силы и [T3:спасбросках].<br><br>Не может колдовать или поддерживать концентрацию.<br><br><b>Защитники предков:</b> Вызывает у существ [T4:помеху] и снижение урона от их атак.",
    },
    // Example 3: Non-glossary <LSTag> (spell name) + markers + placeholders
    {
      role: "user",
      content: "Переведи с English на Russian:\nWithin reach of <LSTag Type=\"Spell\" Tooltip=\"FountofMoonlight\">Fount of Moonlight</LSTag>. You can use a [T1:бонусное действие] to hurl a mote of light at a creature within [1], dealing [2] on a hit.",
    },
    {
      role: "assistant",
      content: "В пределах досягаемости <LSTag Type=\"Spell\" Tooltip=\"FountofMoonlight\">Источника Лунного Света</LSTag>. Вы можете [T1:бонусным действием] метнуть сгусток света в существо в пределах [1], нанося [2] при попадании.",
    },
    // Example 4: Reaction + status pattern — standardize "take a Reaction to"
    {
      role: "user",
      content: "Переведи с English на Russian:\nWhen you take damage from a creature you can see within [1], you can take a [T1:реакция] to make the attacker [T2:ослеплённый] for 1 turn.",
    },
    {
      role: "assistant",
      content: "Когда вы получаете урон от видимого вам существа в пределах [1], вы можете использовать [T1:реакцию], чтобы [T2:ослепить] атакующего на 1 ход.",
    },
  ];
}

// ─── User Prompts ──────────────────────────────────────────────────────────────

function buildSingleUserPrompt({ sourceLang, targetLang, text }) {
  return `Переведи с ${sourceLang || "English"} на ${targetLang || "Russian"}:\n${text}`;
}

module.exports = {
  buildBg3AiSystemPrompt,
  buildFewShotMessages,
  buildSingleUserPrompt,
};