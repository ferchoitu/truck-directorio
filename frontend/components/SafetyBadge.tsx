const STYLES: Record<string, string> = {
  satisfactory: "bg-green-100 text-green-800",
  conditional: "bg-yellow-100 text-yellow-800",
  unsatisfactory: "bg-red-100 text-red-800",
};

export default function SafetyBadge({ rating }: { rating: string | null }) {
  if (!rating) {
    return (
      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
        Not Rated
      </span>
    );
  }
  const style = STYLES[rating.toLowerCase()] ?? "bg-slate-100 text-slate-600";
  return (
    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${style}`}>{rating}</span>
  );
}
