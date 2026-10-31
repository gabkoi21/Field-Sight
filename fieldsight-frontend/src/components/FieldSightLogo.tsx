import logo from "../assets/fieldsight-logo.png";

export function FieldSightLogo({ className = "" }: { className?: string }) {
  return (
    <img
      src={logo}
      alt="FieldSight"
      width={1555}
      height={335}
      className={`block h-auto max-w-full ${className}`}
    />
  );
}
