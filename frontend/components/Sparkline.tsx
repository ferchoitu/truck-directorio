import type { MonthlyCount } from "@/lib/api";

export default function Sparkline({ data }: { data: MonthlyCount[] }) {
  if (data.length < 2) return null;
  const width = 280;
  const height = 48;
  const max = Math.max(...data.map((d) => d.count), 1);
  const step = width / (data.length - 1);
  const points = data
    .map((d, i) => `${(i * step).toFixed(1)},${(height - (d.count / max) * (height - 4) - 2).toFixed(1)}`)
    .join(" ");
  const first = data[0];
  const last = data[data.length - 1];

  return (
    <div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-12 w-full max-w-xs"
        role="img"
        aria-label="Monthly inspections trend"
      >
        <polyline points={points} fill="none" stroke="#1d4ed8" strokeWidth="2" />
      </svg>
      <div className="flex max-w-xs justify-between text-xs text-slate-400">
        <span>{first?.month}</span>
        <span>{last?.month}</span>
      </div>
    </div>
  );
}
