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
    `Ты — переводчик Baldur's Gate 3 (D&D 5e). Язык: ${targetLang}.`,
    ``,
    `ФОРМАТ: ТОЛЬКО перевод. Без кавычек, markdown, пояснений.`,
    ``,
    `ПРАВИЛА:`,
    `1. Токены [1], [2], {0}, {1} — копируй без изменений. УДАЛЯЙ "damage", "ft", "feet" рядом: "[1] damage" → "[1]". НЕЛЬЗЯ дописывать "урон", "футов" после токена.`,
    `2. Дайс-нотации (1d4, 2d6, 1d8+2, 3d10) — копируй КАК ЕСТЬ, не разбивай на части. "1d4 damage" → "1d4 урона", НЕ "1 урон (1d4)".`,
    `3. Теги <br>, <b>, </b>, <i>, </i> — сохраняй.`,
    `4. Маркеры [Tn:слово] — СОХРАНЯЙ скобки, номер и формат. Слово внутри склоняй по контексту (падеж, число). НЕ удаляй маркеры. НЕ меняй номера. НЕ объединяй маркеры.`,
    `5. Кол-во маркеров [Tn:...] на входе = на выходе. Каждый маркер должен присутствовать в переводе.`,
    ``,
    `СТИЛЬ: Литературный русский. "you" = "вы", "creature" = "существо", "melee" = "ближнего боя".`,
  ];

  if (glossaryBlock) {
    parts.push(``, `СЛОВАРЬ:`, glossaryBlock);
  }

  return parts.join("\n");
}

// ─── Few-Shot Examples ─────────────────────────────────────────────────────────

/**
 * Few-shot demonstration using real BG3 patterns after marker substitution.
 * All LSTags become [Tn:word] markers — glossary terms get Russian words,
 * non-glossary terms keep English words. Plus [1]/[2] placeholders and <br>.
 */
function buildFewShotMessages() {
  return [
    // Example 1: Multiple markers + inflection — shows EVERY marker preserved with correct declension
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
    // Example 3: Non-glossary marker (spell name) + glossary markers + placeholders
    {
      role: "user",
      content: "Переведи с English на Russian:\nWithin reach of [T1:fount of moonlight]. You can use a [T2:бонусное действие] to hurl a mote of light at a creature within [1], dealing [2] on a hit.",
    },
    {
      role: "assistant",
      content: "В пределах досягаемости [T1:источника лунного света]. Вы можете [T2:бонусным действием] метнуть сгусток света в существо в пределах [1], нанося [2] при попадании.",
    },
    // Example 4: Reaction + status markers — shows inflection without radical transformation
    {
      role: "user",
      content: "Переведи с English на Russian:\nWhen you take damage from a creature you can see within [1], you can take a [T1:реакция] to make the attacker [T2:ослеплённый] for 1 turn.",
    },
    {
      role: "assistant",
      content: "Когда вы получаете урон от видимого вам существа в пределах [1], вы можете использовать [T1:реакцию], чтобы сделать атакующего [T2:ослеплённым] на 1 ход.",
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