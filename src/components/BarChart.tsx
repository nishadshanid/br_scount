import { useState } from 'react';

export interface Bar {
  label: string;
  value: number;
  detail: string;
}

/** Single-series vertical bar chart (one hue, no legend) with a per-bar hover tooltip. */
export function BarChart({ bars, format }: { bars: Bar[]; format: (n: number) => string }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...bars.map((b) => b.value));
  const ticks = [0, 0.5, 1].map((f) => Math.round(max * f));
  const H = 180;

  return (
    <div className="relative">
      <div className="flex gap-2">
        <div className="relative w-14 shrink-0 text-right text-[11px] text-slate-400" style={{ height: H }}>
          {ticks.map((t) => (
            <div key={t} className="absolute right-0 -translate-y-1/2 tabular-nums" style={{ top: H - (t / max) * H }}>
              {format(t)}
            </div>
          ))}
        </div>
        <div className="relative flex-1">
          {ticks.map((t) => (
            <div
              key={t}
              className="absolute inset-x-0 border-t border-slate-200 dark:border-slate-800"
              style={{ top: H - (t / max) * H }}
            />
          ))}
          <div className="relative flex items-end gap-[2px]" style={{ height: H }}>
            {bars.map((b, i) => (
              <div
                key={b.label}
                className="group relative flex h-full flex-1 items-end justify-center"
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
              >
                <div
                  className={`w-full max-w-12 rounded-t ${hover === i ? 'bg-brand-700 dark:bg-brand-500' : 'bg-brand-600 dark:bg-brand-500/80'}`}
                  style={{ height: `${(b.value / max) * 100}%`, minHeight: b.value ? 2 : 0 }}
                />
                {hover === i && (
                  <div className="pointer-events-none absolute bottom-full z-10 mb-1 whitespace-nowrap rounded-md bg-slate-900 px-2.5 py-1.5 text-xs text-white shadow-lg dark:bg-slate-100 dark:text-slate-900">
                    <div className="font-semibold">{b.label}</div>
                    <div className="tabular-nums">{format(b.value)}</div>
                    <div className="opacity-70">{b.detail}</div>
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="mt-1 flex gap-[2px]">
            {bars.map((b) => (
              <div key={b.label} className="flex-1 truncate text-center text-[11px] text-slate-500">
                {b.label}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
