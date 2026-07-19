export default function SearchBar({
  defaultValue = "",
  dark = false,
}: {
  defaultValue?: string;
  dark?: boolean;
}) {
  return (
    <form
      action="/search"
      method="GET"
      className={`flex w-full max-w-2xl items-center gap-1.5 rounded-full p-1.5 ${
        dark ? "bg-white/95" : "border border-zinc-200 bg-white shadow-sm"
      }`}
    >
      <input
        type="text"
        name="q"
        defaultValue={defaultValue}
        placeholder="Search by USDOT, MC number, or company name…"
        className="w-full rounded-full bg-transparent px-4 py-2.5 text-base text-zinc-900 placeholder:text-zinc-400 focus:outline-none"
        required
      />
      <button
        type="submit"
        className="shrink-0 rounded-full bg-lime-300 px-6 py-2.5 font-semibold text-zinc-950 transition hover:bg-lime-200"
      >
        Search
      </button>
    </form>
  );
}
