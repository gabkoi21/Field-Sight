export function LoadingState({
  label = "Loading workspace data…",
}: {
  label?: string;
}) {
  return (
    <div className="rounded-[10px] bg-white p-[60px] text-center text-[#758092]">
      {label}
    </div>
  );
}
