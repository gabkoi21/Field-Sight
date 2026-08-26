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
      ? "border border-[#dfe4e8] bg-white text-[#384a65] hover:border-[#0b51b7] hover:text-[#0b51b7]"
      : "border border-[#0b51b7] bg-[#0b51b7] text-white hover:bg-[#084394]";

  return (
    <button
      type={type}
      className={`inline-flex min-h-[34px] cursor-pointer items-center gap-[6px] rounded-[3px] px-[12px] py-[7px] text-[12px] font-semibold shadow-none transition-colors ${tone} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
