export default function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.15em] text-zinc-600">
      <span className="inline-block h-1.5 w-1.5 rounded-full bg-lime-400" aria-hidden />
      {children}
    </p>
  );
}
