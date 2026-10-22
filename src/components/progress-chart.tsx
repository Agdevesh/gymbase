// Tiny dependency-free line chart for a member's weight (or any metric) over time.
export function ProgressChart({ points, unit }: { points: { at: Date; value: number }[]; unit: string }) {
  if (points.length < 2) return <p className="text-xs text-slate-500">Record two or more readings to see a trend.</p>;
  const W = 320, H = 120, P = 24;
  const xs = points.map((p) => p.at.getTime()), ys = points.map((p) => p.value);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const sx = (x: number) => (x1 === x0 ? W / 2 : P + ((x - x0) / (x1 - x0)) * (W - 2 * P));
  const sy = (y: number) => (y1 === y0 ? H / 2 : H - P - ((y - y0) / (y1 - y0)) * (H - 2 * P));
  const d = points.map((p, i) => `${i ? "L" : "M"}${sx(p.at.getTime()).toFixed(1)},${sy(p.value).toFixed(1)}`).join(" ");
  const fmt = (t: number) => new Date(t).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-sm" role="img" aria-label={`Trend from ${ys[0]} to ${ys[ys.length - 1]} ${unit}`}>
      <path d={d} fill="none" stroke="#16a34a" strokeWidth={2} />
      {points.map((p, i) => <circle key={i} cx={sx(p.at.getTime())} cy={sy(p.value)} r={3} fill="#16a34a" />)}
      <text x={P} y={H - 4} fontSize={10} fill="#737373">{fmt(x0)}</text>
      <text x={W - P} y={H - 4} fontSize={10} fill="#737373" textAnchor="end">{fmt(x1)}</text>
      <text x={4} y={sy(y1) + 4} fontSize={10} fill="#737373">{y1}</text>
      <text x={4} y={sy(y0) + 4} fontSize={10} fill="#737373">{y0}</text>
    </svg>
  );
}
