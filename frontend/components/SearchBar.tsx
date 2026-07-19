export default function SearchBar({ defaultValue = "" }: { defaultValue?: string }) {
  return (
    <form action="/search" method="GET" className="flex w-full max-w-2xl gap-2">
      <input
        type="text"
        name="q"
        defaultValue={defaultValue}
        placeholder="Search by USDOT number, MC number, or company name…"
        className="w-full rounded-lg border border-slate-300 px-4 py-3 text-base shadow-sm focus:border-blue-500 focus:outline-none"
        required
      />
      <button
        type="submit"
        className="rounded-lg bg-blue-700 px-6 py-3 font-semibold text-white hover:bg-blue-800"
      >
        Search
      </button>
    </form>
  );
}
