export default function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-mono text-xs font-bold uppercase tracking-[0.2em] text-red-600">
      — {children}
    </p>
  );
}
