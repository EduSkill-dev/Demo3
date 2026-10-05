import { adminGhost, adminInput } from "./adminApi";

// A plain GET form: the page reads ?q=… (and whatever `keep` carries along).
export default function SearchBox({ placeholder, keep = {} }: { placeholder: string; keep?: Record<string, string | undefined> }) {
  return (
    <form className="flex gap-2">
      {Object.entries(keep).map(([name, value]) => (value ? <input key={name} type="hidden" name={name} value={value} /> : null))}
      <input type="search" name="q" placeholder={placeholder} aria-label={placeholder} className={`${adminInput} w-64`} />
      <button type="submit" className={adminGhost}>Փնտրել</button>
    </form>
  );
}
