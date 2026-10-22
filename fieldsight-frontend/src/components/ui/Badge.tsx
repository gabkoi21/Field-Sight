interface BadgeProps {
  value: string;
}

export function Badge({ value }: BadgeProps) {
  const tone =
    value === "Valid" || value === "Active" || value === "Completed"
      ? "bg-[#e6f7f2] text-[#158e7d]"
      : value === "Invalid"
        ? "bg-[#fde9eb] text-[#c64e57]"
        : "bg-[#fff1e4] text-[#d8792a]";

  return (
    <span className={`inline-block rounded-[20px] px-2 py-1 text-[12px] font-bold leading-[1.2] ${tone}`}>{value}</span>
  );
}
