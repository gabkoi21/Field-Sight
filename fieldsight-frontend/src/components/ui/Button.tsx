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
      ? "border border-[#dfe4e8] bg-white text-[#455467] hover:bg-brand-hover"
      : "border-0 bg-brand text-white hover:bg-brand-hover";

  return (
    <button
      type={type}
      className={`inline-flex min-h-[38px] cursor-pointer items-center gap-[5px] rounded-[7px] px-[14px] py-[9px] text-[13px] font-semibold shadow-none transition-colors ${tone} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
