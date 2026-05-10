import React from 'react';
import { getModelTierStyle } from '@Config/modelTiers.config';

// ─── AI tag pill ────────────────────────────────────────────────────────────
// Small colored label attached to a model card, coloured to match the
// model's tier (lite / recommended / heavy / newest / rose).

export function AiTagPill({ label, tier }) {
  const style = getModelTierStyle(tier);
  return (
    <span className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[9.5px] font-medium tracking-wide ${style.tag}`}>
      {label}
    </span>
  );
}
