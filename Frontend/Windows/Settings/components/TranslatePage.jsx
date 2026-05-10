import React from 'react';
import { Bot, Zap } from 'lucide-react';
import {
  AUTO_TRANSLATION_METHODS_BY_MODEL,
  AUTO_TRANSLATION_MODELS,
  AUTO_TRANSLATION_MODELS_IDS,
  getModelByMethod,
} from '@Config/autoTranslation.config';
import { useLocale } from '@Locales/LocaleProvider';

// ─── TranslatePage ──────────────────────────────────────────────────────────
// "Smart" tab of the Settings dialog. Lets the user pick between cloud
// translation models and their methods (single / batch / compatibility).

export default function TranslatePage({ method, onMethodChange }) {
  const t = useLocale();
  const activeModel = getModelByMethod(method);
  const visibleMethods =
    AUTO_TRANSLATION_METHODS_BY_MODEL[activeModel] ||
    AUTO_TRANSLATION_METHODS_BY_MODEL[AUTO_TRANSLATION_MODELS_IDS.X];

  const METHOD_LOCALE = {
    single:        t.settings.methodSingle,
    standard:      t.settings.methodStandard,
    compatibility: t.settings.methodCompat,
  };

  const changeModel = (modelId) => {
    const modelMethods = AUTO_TRANSLATION_METHODS_BY_MODEL[modelId] || [];
    if (modelMethods.length > 0) onMethodChange(modelMethods[0].id);
  };

  return (
    <div className="flex flex-col min-h-full animate-[fadeIn_220ms_ease-out]">
      <div className="space-y-5">
        <section>
          <SectionHeader icon={Zap} label={t.settings.workMode} />

          <div className="relative rounded-2xl border border-white/[0.07] bg-surface-2/40 backdrop-blur-xl p-1 flex gap-1">
            {AUTO_TRANSLATION_MODELS.map((model) => {
              const Icon = model.icon;
              const isActive = activeModel === model.id;
              const tileClass = isActive
                ? 'bg-white/[0.08] border border-white/[0.12] shadow-[0_2px_12px_rgba(0,0,0,0.2)]'
                : 'border border-transparent hover:bg-white/[0.04]';
              const iconWrap = isActive
                ? 'bg-white/[0.10] text-white'
                : 'bg-white/[0.04] text-zinc-500';

              return (
                <button
                  key={model.id}
                  type="button"
                  onClick={() => changeModel(model.id)}
                  className={`relative flex-1 flex items-center justify-center gap-2.5 rounded-xl py-2.5 px-3 transition-all duration-200 ${tileClass}`}
                >
                  {isActive && (
                    <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/[0.14] to-transparent rounded-t-xl" />
                  )}
                  <div className={`w-6 h-6 rounded-lg flex items-center justify-center transition-colors duration-200 ${iconWrap}`}>
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                  <div className="text-left min-w-0">
                    <p className={`text-[12px] font-bold leading-tight ${isActive ? 'text-white' : 'text-zinc-300'}`}>
                      {model.title}
                    </p>
                    <p className="text-[11px] text-zinc-500 truncate">{model.subtitle}</p>
                  </div>
                  {isActive && (
                    <span className="absolute top-2 right-2.5 w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]" />
                  )}
                </button>
              );
            })}
          </div>
        </section>

        <section>
          <SectionHeader icon={Bot} label={t.settings.modelMode} />

          <div className="space-y-2">
            {visibleMethods.map((item) => {
              const Icon = item.icon;
              const isActive = method === item.id;
              const rowClass = isActive
                ? 'border-white/[0.14] bg-surface-2/90 backdrop-blur-xl shadow-[0_2px_16px_rgba(0,0,0,0.25)]'
                : 'border-white/[0.07] bg-surface-2/40 backdrop-blur-xl hover:border-white/[0.11] hover:bg-surface-2/60';
              const iconWrap = isActive ? `${item.bg} ${item.color}` : 'bg-white/[0.04] text-zinc-500';
              const badgeClass = isActive
                ? 'border-white/[0.18] bg-white/[0.08] text-zinc-200'
                : 'border-white/[0.08] bg-white/[0.04] text-zinc-500';

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onMethodChange(item.id)}
                  className={`relative w-full rounded-2xl border p-4 text-left transition-all duration-200 overflow-hidden flex items-start gap-3.5 ${rowClass}`}
                >
                  {isActive && (
                    <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/[0.14] to-transparent" />
                  )}
                  <div className={`mt-0.5 w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-colors duration-200 ${iconWrap}`}>
                    <Icon className="w-4 h-4" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className={`text-sm font-semibold ${isActive ? 'text-white' : 'text-zinc-200'}`}>
                        {item.id === 'compatibility' ? t.settings.methodCompatName : item.name}
                      </span>
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider border ${badgeClass}`}>
                        {METHOD_LOCALE[item.id]?.badge || item.badge}
                      </span>
                      {isActive && (
                        <span className="ml-auto w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
                      )}
                    </div>
                    <p className={`text-[12px] leading-relaxed ${isActive ? 'text-zinc-400' : 'text-zinc-500'}`}>
                      {METHOD_LOCALE[item.id]?.desc || item.description}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}

function SectionHeader({ icon: Icon, label }) {
  return (
    <div className="flex items-center gap-2 mb-3 px-0.5">
      <Icon className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
      <span className="text-[12px] font-bold tracking-widest text-zinc-500 uppercase">{label}</span>
    </div>
  );
}
