const BANDS = ["bg-amber-400", "bg-orange-500", "bg-red-600", "bg-red-800", "bg-red-950"];

export default function Stripe({ className = "" }: { className?: string }) {
  return (
    <div className={className} aria-hidden>
      {BANDS.map((c) => (
        <div key={c} className={`h-1 sm:h-1.5 ${c}`} />
      ))}
    </div>
  );
}
