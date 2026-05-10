import {
  Layers,
  Cog,
  Sword,
  Shield,
  Sparkles,
  Skull,
  Users,
  Gem,
  MapPin,
  MousePointer2,
  GraduationCap,
} from 'lucide-react';

// ─── Dictionary Categories ──────────────────────────────────────────────────
// Static catalog of glossary categories. The first entry ("Всё") is a virtual
// "show-all" filter and never matches against real entries.

/**
 * @typedef {Object} DictionaryCategory
 * @property {string} id           Stable identifier used by the dictionary store.
 * @property {string} label        Russian display name.
 * @property {Function} icon       Lucide icon component.
 * @property {string} color        Tailwind text class for the icon.
 * @property {string} activeBg     Tailwind class applied when the category is selected.
 * @property {string} hoverBg      Tailwind hover class.
 * @property {string} accent       Tailwind background class for the side accent dot.
 */

/** @type {DictionaryCategory[]} */
export const CATEGORIES = [
  { id: 'all',       label: 'Всё',        icon: Layers,        color: 'text-zinc-400',    activeBg: 'bg-white/[0.12]',       hoverBg: 'hover:bg-white/[0.06]',       accent: 'bg-zinc-400' },
  { id: 'mechanics', label: 'Механики',   icon: Cog,           color: 'text-blue-400',    activeBg: 'bg-blue-500/[0.16]',    hoverBg: 'hover:bg-blue-500/[0.08]',    accent: 'bg-blue-400' },
  { id: 'actions',   label: 'Действия',   icon: MousePointer2, color: 'text-rose-400',    activeBg: 'bg-rose-500/[0.16]',    hoverBg: 'hover:bg-rose-500/[0.08]',    accent: 'bg-rose-400' },
  { id: 'skills',    label: 'Навыки',     icon: GraduationCap, color: 'text-emerald-400', activeBg: 'bg-emerald-500/[0.16]', hoverBg: 'hover:bg-emerald-500/[0.08]', accent: 'bg-emerald-400' },
  { id: 'weapons',   label: 'Оружие',     icon: Sword,         color: 'text-red-400',     activeBg: 'bg-red-500/[0.16]',     hoverBg: 'hover:bg-red-500/[0.08]',     accent: 'bg-red-400' },
  { id: 'armor',     label: 'Броня',      icon: Shield,        color: 'text-orange-300',  activeBg: 'bg-orange-400/[0.16]',  hoverBg: 'hover:bg-orange-400/[0.08]',  accent: 'bg-orange-300' },
  { id: 'spells',    label: 'Заклинания', icon: Sparkles,      color: 'text-violet-400',  activeBg: 'bg-violet-500/[0.16]',  hoverBg: 'hover:bg-violet-500/[0.08]',  accent: 'bg-violet-400' },
  { id: 'creatures', label: 'Существа',   icon: Skull,         color: 'text-cyan-400',    activeBg: 'bg-cyan-500/[0.16]',    hoverBg: 'hover:bg-cyan-500/[0.08]',    accent: 'bg-cyan-400' },
  { id: 'classes',   label: 'Классы',     icon: Users,         color: 'text-amber-400',   activeBg: 'bg-amber-500/[0.16]',   hoverBg: 'hover:bg-amber-500/[0.08]',   accent: 'bg-amber-400' },
  { id: 'items',     label: 'Предметы',   icon: Gem,           color: 'text-pink-400',    activeBg: 'bg-pink-500/[0.16]',    hoverBg: 'hover:bg-pink-500/[0.08]',    accent: 'bg-pink-400' },
  { id: 'locations', label: 'Локации',    icon: MapPin,        color: 'text-lime-400',    activeBg: 'bg-lime-500/[0.16]',    hoverBg: 'hover:bg-lime-500/[0.08]',    accent: 'bg-lime-400' },
];

/**
 * Lookup helper. Falls back to "mechanics" (index 1) when no match is found,
 * so callers always receive a renderable category descriptor.
 * @param {string} id
 * @returns {DictionaryCategory}
 */
export const getCategoryById = (id) => CATEGORIES.find((c) => c.id === id) || CATEGORIES[1];
