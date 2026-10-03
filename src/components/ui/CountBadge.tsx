// Small filled red circle with a number — unread applications, notifications.
export default function CountBadge({
  count,
  className = "",
  label,
}: {
  count: number;
  className?: string;
  label?: string;
}) {
  if (count <= 0) return null;
  return (
    <span
      aria-label={label}
      className={`inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-600 px-1 text-[11px] font-bold leading-none text-white ${className}`}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}
