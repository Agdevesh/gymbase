import { paise } from "@/lib/payments";

// Daily collections as thin rounded columns on one baseline (HTML, so labels stay legible at any width).
// The best day is the only direct label; hovering or tapping a column shows its date and amount.
export function CollectionsChart({ series }: { series: { date: Date; total: number }[] }) {
  const max = Math.max(1, ...series.map((s) => s.total));
  const step = niceStep(max / 100);
  const top = Math.max(step, Math.ceil(max / 100 / step) * step) * 100;
  const bestIdx = series.reduce((b, s, i) => (s.total > series[b].total ? i : b), 0);
  const ticks = [top, top / 2, 0];
  const total = series.reduce((s, d) => s + d.total, 0);
  return (
    <figure>
      <p className="mb-3 text-xs text-slate-500">Total <span className="font-semibold text-slate-800">{paise(total)}</span> · best day <span className="font-semibold text-slate-800">{paise(series[bestIdx].total)}</span></p>
      <div className="flex gap-2" role="img" aria-label={`Collections per day for the last ${series.length} days, total ${paise(total)}`}>
        <div className="flex h-36 flex-col justify-between pb-0 text-right text-[10px] leading-none text-slate-400">{ticks.map((t) => <span key={t} className="-translate-y-1/2 first:translate-y-0 last:translate-y-0">{compact(t / 100)}</span>)}</div>
        <div className="flex-1">
          <div className="relative h-36 border-b border-slate-300">
            <div className="absolute inset-x-0 top-0 border-t border-slate-100" />
            <div className="absolute inset-x-0 top-1/2 border-t border-slate-100" />
            <div className="absolute inset-0 flex items-end">
              {series.map((s, i) => {
                const pct = (s.total / top) * 100, label = s.date.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
                return (
                  <div key={i} tabIndex={0} className="group relative flex h-full flex-1 items-end justify-center outline-none" aria-label={`${label}: ${paise(s.total)}`}>
                    {s.total > 0 && <div className={`w-3/5 max-w-6 rounded-t ${i === bestIdx ? "bg-brand-600" : "bg-brand-300 group-hover:bg-brand-400"}`} style={{ height: `${pct}%` }} />}
                    {i === bestIdx && s.total > 0 && <span className="pointer-events-none absolute whitespace-nowrap text-[10px] font-semibold text-slate-700" style={{ bottom: `calc(${pct}% + 2px)` }}>{compact(s.total / 100)}</span>}
                    <span className="pointer-events-none absolute bottom-full z-10 mb-1 hidden whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-[11px] text-white shadow group-hover:block group-focus:block">{label}: {paise(s.total)}</span>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="mt-1 flex text-[10px] text-slate-400">{series.map((s, i) => <span key={i} className={`flex-1 text-center ${i % 2 && i !== series.length - 1 ? "invisible sm:visible" : ""}`}>{s.date.getDate()}</span>)}</div>
        </div>
      </div>
    </figure>
  );
}

function niceStep(maxRupees: number) {
  const raw = maxRupees / 2 || 1, pow = 10 ** Math.floor(Math.log10(raw)), m = raw / pow;
  return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * pow;
}
const compact = (r: number) => (r >= 100000 ? `${+(r / 100000).toFixed(1)}L` : r >= 1000 ? `${+(r / 1000).toFixed(1)}K` : String(Math.round(r)));
