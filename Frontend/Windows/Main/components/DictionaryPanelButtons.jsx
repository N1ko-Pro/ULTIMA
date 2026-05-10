import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Plus, Trash2, Pencil, Check, AlertCircle } from 'lucide-react';
import { getCategoryById } from '@Config/dictionaryCategories.constants';
import { autoResize } from '@Utils/dom/autoResize';
import { useLocale } from '@Locales/LocaleProvider';
import { TagPicker } from './DictionaryCategories';

// ─── Dictionary entry rows ──────────────────────────────────────────────────
// Two variants: `EntryRow` for existing entries (view + inline edit) and
// `AddRow` for creating a new entry. Both share the auto-resize and
// duplicate-detection behaviour.

export function EntryRow({ entry, onUpdate, onDelete }) {
  const t = useLocale();
  const [editing, setEditing] = useState(false);
  const [src,     setSrc]     = useState(entry.source);
  const [tgt,     setTgt]     = useState(entry.target);
  const [tag,     setTag]     = useState(entry.tag || 'mechanics');
  const srcRef = useRef(null);
  const tgtRef = useRef(null);
  const rowRef = useRef(null);

  const startEdit = () => {
    setSrc(entry.source);
    setTgt(entry.target);
    setTag(entry.tag || 'mechanics');
    setEditing(true);
    setTimeout(() => {
      srcRef.current?.focus();
      autoResize(srcRef.current);
      autoResize(tgtRef.current);
    }, 0);
  };

  const save = () => {
    if (!src.trim() || !tgt.trim()) return;
    onUpdate(entry.id, src, tgt, tag);
    setEditing(false);
  };

  const cancel = useCallback(() => {
    setSrc(entry.source);
    setTgt(entry.target);
    setTag(entry.tag || 'mechanics');
    setEditing(false);
  }, [entry]);

  useEffect(() => {
    if (!editing) return undefined;
    const handler = (e) => {
      if (rowRef.current && !rowRef.current.contains(e.target)) cancel();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [editing, cancel]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); save(); }
    if (e.key === 'Escape') cancel();
  };

  const cat = getCategoryById(entry.tag);

  if (editing) {
    return (
      <div ref={rowRef} className="px-4 py-3 rounded-xl bg-surface-3/80 border border-white/[0.12] space-y-2">
        <textarea
          ref={srcRef}
          value={src}
          onChange={(e) => { setSrc(e.target.value); autoResize(e.target); }}
          onKeyDown={handleKeyDown}
          rows={1}
          placeholder={t.dictionary.addOriginal}
          className="w-full bg-surface-4 border border-white/[0.1] rounded-lg px-2.5 py-1.5 text-[13px] text-zinc-100 outline-none focus:border-white/[0.4] transition-[border-color] duration-200 resize-none overflow-hidden leading-relaxed"
        />
        <div className="flex gap-2 items-start">
          <textarea
            ref={tgtRef}
            value={tgt}
            onChange={(e) => { setTgt(e.target.value); autoResize(e.target); }}
            onKeyDown={handleKeyDown}
            rows={1}
            placeholder={t.dictionary.addTranslation}
            className="flex-1 min-w-0 bg-surface-4 border border-white/[0.1] rounded-lg px-2.5 py-1.5 text-[13px] text-zinc-100 outline-none focus:border-white/[0.4] transition-[border-color] duration-200 resize-none overflow-hidden leading-relaxed"
          />
          <div className="flex gap-1 items-center shrink-0 pt-[3px]">
            <TagPicker value={tag} onChange={setTag} />
            <button type="button" onClick={save} className="w-7 h-7 flex items-center justify-center rounded-lg text-emerald-400 hover:bg-emerald-500/10 transition-colors">
              <Check className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  const CatIcon = cat.icon;

  return (
    <div className="group grid grid-cols-[minmax(0,2fr)_1px_minmax(0,3fr)_56px] px-4 py-2.5 rounded-xl border border-transparent hover:bg-surface-2/60 hover:border-white/[0.06] items-start transition-all duration-150">
      <div className="flex items-start gap-2 pr-3 pt-0.5">
        <CatIcon className={`w-3 h-3 shrink-0 mt-[2px] ${cat.color} opacity-50`} />
        <span className="text-[13px] text-zinc-100 font-medium break-words">{entry.source}</span>
      </div>
      <div className="w-px self-stretch bg-white/[0.06]" />
      <span className="text-[13px] text-zinc-400 pl-3 break-words">{entry.target}</span>
      <div className="flex gap-1 justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-150">
        <button type="button" onClick={startEdit} className="w-7 h-7 flex items-center justify-center rounded-lg text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.06] transition-colors">
          <Pencil className="w-3.5 h-3.5" />
        </button>
        <button type="button" onClick={() => onDelete(entry.id)} className="w-7 h-7 flex items-center justify-center rounded-lg text-zinc-600 hover:text-red-400 hover:bg-red-500/[0.08] transition-colors">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

export function AddRow({ onAdd, entries = [] }) {
  const t = useLocale();
  const [src,    setSrc]    = useState('');
  const [tgt,    setTgt]    = useState('');
  const [tag,    setTag]    = useState('mechanics');
  const [active, setActive] = useState(false);
  const srcRef = useRef(null);
  const rowRef = useRef(null);

  useEffect(() => {
    if (!active) return undefined;
    const handler = (e) => {
      if (rowRef.current && !rowRef.current.contains(e.target)) {
        setSrc('');
        setTgt('');
        setActive(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [active]);

  const isDuplicate = src.trim() && entries.some((entry) => entry.source === src.trim());

  const submit = () => {
    if (!src.trim() || !tgt.trim() || isDuplicate) return;
    onAdd(src.trim(), tgt.trim(), tag);
    setSrc('');
    setTgt('');
    setActive(false);
    setTimeout(() => srcRef.current?.focus(), 0);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') submit();
    if (e.key === 'Escape') { setSrc(''); setTgt(''); setActive(false); }
  };

  const containerClass = isDuplicate
    ? 'border-red-500/30 bg-red-500/[0.04]'
    : active
      ? 'bg-surface-3/60 border-white/[0.1]'
      : 'border-dashed border-white/[0.08] hover:border-white/[0.14]';

  const submitBtnClass = src.trim() && tgt.trim() && !isDuplicate
    ? 'text-emerald-400 bg-emerald-500/[0.12] hover:bg-emerald-500/[0.22] shadow-[0_0_8px_rgba(52,211,153,0.2)]'
    : 'text-zinc-600 hover:text-emerald-400 hover:bg-emerald-500/[0.08]';

  return (
    <div ref={rowRef}>
      <div className={`grid grid-cols-[minmax(0,2fr)_1px_minmax(0,3fr)_auto] px-4 py-2.5 rounded-xl border transition-all duration-150 gap-x-3 ${containerClass}`}>
        <input
          ref={srcRef}
          value={src}
          onChange={(e) => setSrc(e.target.value)}
          onFocus={() => setActive(true)}
          onKeyDown={handleKeyDown}
          placeholder={t.dictionary.addOriginal}
          className="w-full bg-transparent text-[13px] text-zinc-200 placeholder-zinc-600 outline-none"
        />
        <div className="w-px self-stretch bg-white/[0.06]" />
        <input
          value={tgt}
          onChange={(e) => setTgt(e.target.value)}
          onFocus={() => setActive(true)}
          onKeyDown={handleKeyDown}
          placeholder={t.dictionary.addTranslation}
          className="w-full bg-transparent text-[13px] text-zinc-200 placeholder-zinc-600 outline-none"
        />
        <div className="flex gap-1 justify-center items-center">
          {active && (
            <>
              <div className="w-px h-4 bg-white/[0.1] mx-0.5" />
              <TagPicker value={tag} onChange={setTag} />
              <div className="w-px h-4 bg-white/[0.1] mx-0.5" />
            </>
          )}
          <button
            type="button"
            onClick={submit}
            disabled={!src.trim() || !tgt.trim() || isDuplicate}
            className={`w-7 h-7 flex items-center justify-center rounded-lg transition-all duration-200 disabled:opacity-25 disabled:pointer-events-none ${submitBtnClass}`}
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      {isDuplicate && (
        <div className="flex items-center gap-1.5 mt-1.5 px-4">
          <AlertCircle className="w-3 h-3 text-red-400/70 shrink-0" />
          <span className="text-[10px] text-red-400/70">{t.dictionary.duplicate}</span>
        </div>
      )}
    </div>
  );
}
