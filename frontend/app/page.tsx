import SearchBar from "@/components/SearchBar";

export default function HomePage() {
  return (
    <div className="flex flex-col items-center py-16 text-center">
      <h1 className="max-w-3xl text-4xl font-bold tracking-tight sm:text-5xl">
        Look up any US trucking company&apos;s safety record
      </h1>
      <p className="mt-4 max-w-2xl text-lg text-slate-600">
        Search 700,000+ FMCSA-registered motor carriers by USDOT number, MC number, or
        company name. Safety ratings, BASIC scores, inspections, and violations — all from
        public federal data.
      </p>
      <div className="mt-8 w-full max-w-2xl">
        <SearchBar />
      </div>
      <dl className="mt-16 grid grid-cols-1 gap-8 sm:grid-cols-3">
        {[
          ["700,000+", "Registered carriers"],
          ["Updated weekly", "Fresh FMCSA data"],
          ["100% free", "Carrier lookups"],
        ].map(([stat, label]) => (
          <div key={label}>
            <dt className="text-2xl font-bold text-blue-700">{stat}</dt>
            <dd className="text-sm text-slate-500">{label}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
