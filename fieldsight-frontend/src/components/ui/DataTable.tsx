import type { ReactNode } from "react";
import { ChevronDown, Search, SlidersHorizontal } from "lucide-react";

interface DataTableProps {
  headers: string[];
  children: ReactNode;
  searchPlaceholder?: string;
}

export function DataTable({
  headers,
  children,
  searchPlaceholder = "Search records...",
}: DataTableProps) {
  const control =
    "flex items-center gap-1.5 rounded-[7px] border border-[#dfe4e8] bg-white px-[11px] py-[9px] text-[14px] font-medium text-[#728093]";
  return (
    <section className="mt-[18px] overflow-hidden rounded-lg border border-[#e7e9ed] bg-white">
      <div className="flex gap-2.5 border-b border-[#e7e9ed] p-[18px_20px] max-[560px]:flex-wrap">
        <label className={`${control} w-[250px] max-[560px]:w-full`}>
          <Search size={16} />
          {searchPlaceholder}
        </label>
        <button className={`${control} ml-auto max-[560px]:ml-0`}>
          All projects <ChevronDown size={15} />
        </button>
        <button className={control}>
          <SlidersHorizontal size={15} />
          Filters
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="fs-data-table">
          <thead>
            <tr>
              {headers.map((header) => (
                <th key={header}>{header}</th>
              ))}
            </tr>
          </thead>
          <tbody>{children}</tbody>
        </table>
      </div>
      <footer className="flex flex-wrap justify-between gap-3 px-5 py-3.5 text-[12px] text-[#778493]">
        Showing selected records{" "}
        <span>
          ‹ <b className="rounded bg-brand px-2 py-[5px] text-white">1</b> 2 3 ›
        </span>
      </footer>
    </section>
  );
}
