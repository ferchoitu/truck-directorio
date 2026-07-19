export default function SearchBar({
  defaultValue = "",
  dark = false,
}: {
  defaultValue?: string;
  dark?: boolean;
}) {
  return (
    <form action="/search" method="GET" className="flex w-full max-w-2xl gap-2">
      <input
        type="text"
        name="q"
        defaultValue={defaultValue}
        placeholder="Search by USDOT number, MC number, or company name…"
        className={`w-full rounded-sm border px-4 py-3 text-base focus:outline-none ${
          dark
            ? "border-zinc-700 bg-white text-zinc-900 focus:border-orange-500"
            : "border-zinc-300 bg-white shadow-sm focus:border-red-600"
        }`}
        required
      />
      <button
        type="submit"
        className={`rounded-sm px-6 py-3 font-semibold text-white transition ${
          dark ? "bg-orange-600 hover:bg-orange-500" : "bg-zinc-900 hover:bg-zinc-700"
        }`}
      >
        Search
      </button>
    </form>
  );
}
