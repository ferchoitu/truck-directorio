import type { ReactNode } from "react";
import SectionLabel from "@/components/SectionLabel";

interface LegalPageProps {
  label: string;
  title: string;
  updated: string;
  intro?: string;
  children: ReactNode;
}

/**
 * Shared shell for the legal pages. Tailwind's typography plugin is not
 * installed, so element styles are applied here with arbitrary child variants
 * rather than repeating classes on every heading and paragraph.
 */
export default function LegalPage({
  label,
  title,
  updated,
  intro,
  children,
}: LegalPageProps) {
  return (
    <div className="mx-auto max-w-3xl py-12">
      <SectionLabel>{label}</SectionLabel>
      <h1 className="font-heading mt-4 text-4xl font-medium leading-tight">
        {title}
      </h1>
      <p className="mt-3 font-mono text-xs uppercase tracking-widest text-zinc-500">
        Last updated {updated}
      </p>
      {intro && <p className="mt-5 text-zinc-700">{intro}</p>}

      <div
        className="
          mt-8 text-sm leading-relaxed text-zinc-700
          [&_h2]:font-heading [&_h2]:mt-10 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-zinc-900
          [&_h3]:mt-6 [&_h3]:font-semibold [&_h3]:text-zinc-900
          [&_p]:mt-3
          [&_ul]:mt-3 [&_ul]:grid [&_ul]:gap-2
          [&_li]:flex [&_li]:gap-2
          [&_li]:before:font-bold [&_li]:before:text-lime-600 [&_li]:before:content-['·']
          [&_a]:font-semibold [&_a]:text-lime-700 [&_a]:underline
          [&_strong]:font-semibold [&_strong]:text-zinc-900
        "
      >
        {children}
      </div>
    </div>
  );
}
