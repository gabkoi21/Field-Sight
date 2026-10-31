import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from "react";

/** Native scrolling with a narrow, draggable visual thumb. */
export function SidebarScrollArea({ children }: { children: ReactNode }) {
  const viewport = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const drag = useRef<{ y: number; scroll: number } | null>(null);
  const [thumb, setThumb] = useState({ height: 0, top: 0 });

  useEffect(() => {
    const area = viewport.current!;
    const update = () => {
      const height = area.scrollHeight > area.clientHeight
        ? Math.min(area.clientHeight, Math.max(24, area.clientHeight ** 2 / area.scrollHeight)) : 0;
      const top = height ? area.scrollTop / (area.scrollHeight - area.clientHeight) * (area.clientHeight - height) : 0;
      setThumb({ height, top });
    };
    update();
    area.addEventListener("scroll", update, { passive: true });
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(update) : null;
    observer?.observe(area);
    observer?.observe(content.current!);
    return () => { area.removeEventListener("scroll", update); observer?.disconnect(); };
  }, []);

  function move(event: PointerEvent<HTMLDivElement>) {
    const area = viewport.current;
    if (!drag.current || !area || area.clientHeight <= thumb.height) return;
    area.scrollTop = drag.current.scroll + (event.clientY - drag.current.y)
      * (area.scrollHeight - area.clientHeight) / (area.clientHeight - thumb.height);
  }

  return <div className="fs-sidebar-scroll-area">
    <div ref={viewport} className="fs-sidebar-scroll-viewport">
      <div ref={content}>{children}</div>
    </div>
    {thumb.height > 0 && <div aria-hidden="true" className="fs-sidebar-scroll-thumb"
      style={{ height: thumb.height, transform: `translateY(${thumb.top}px)` }}
      onPointerDown={event => {
        if (event.button !== 0) return;
        event.preventDefault();
        drag.current = { y: event.clientY, scroll: viewport.current!.scrollTop };
        event.currentTarget.setPointerCapture(event.pointerId);
      }} onPointerMove={move} onPointerUp={() => { drag.current = null; }}
      onLostPointerCapture={() => { drag.current = null; }}
    />}
  </div>;
}
