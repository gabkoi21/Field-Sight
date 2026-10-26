import type { ButtonHTMLAttributes, ReactNode } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: "primary" | "secondary";
}

export function Button({
  children,
  className = "",
  type = "button",
  variant = "primary",
  ...props
}: ButtonProps) {
  const tone =
    variant === "secondary"
      ? "border border-[var(--fs-control-border)] bg-[var(--fs-surface)] text-[var(--fs-text)] hover:border-[var(--fs-primary)] hover:bg-blue-50 active:bg-blue-100"
      : "border border-[var(--fs-primary)] bg-[var(--fs-primary)] text-white hover:bg-[var(--fs-primary-hover)] active:bg-[#063777]";

  return (
    <button
      type={type}
      className={`inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-[14px] font-semibold shadow-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0b51b7] disabled:cursor-not-allowed disabled:opacity-50 ${tone} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
