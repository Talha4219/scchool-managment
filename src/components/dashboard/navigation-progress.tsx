"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

// Thin top progress bar that appears the moment a client-side navigation
// starts and eases out shortly after. The dashboard pages are "use client"
// components that fetch data in useEffect, so Next's route-level loading.tsx
// only covers the code-loading gap — this bar covers the gap between clicking
// a link and the destination page's own skeleton mounting.
export function NavigationProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [visible, setVisible] = useState(false);
  const [progress, setProgress] = useState(0);
  const firstRender = useRef(true);

  useEffect(() => {
    // Skip the bar on initial page load — the layout's own DB-loading
    // skeleton already covers that window.
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }

    setVisible(true);
    setProgress(0);
    const start = Date.now();
    const tick = setInterval(() => {
      // Ease toward 90% over ~1.2s; the page's own skeleton takes over after.
      setProgress(Math.min(90, ((Date.now() - start) / 1200) * 90));
    }, 50);

    const done = setTimeout(() => {
      clearInterval(tick);
      setProgress(100);
      setTimeout(() => {
        setVisible(false);
        setProgress(0);
      }, 300);
    }, 1350);

    return () => {
      clearInterval(tick);
      clearTimeout(done);
    };
  }, [pathname, searchParams]);

  if (!visible) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-0.5 overflow-hidden">
      <div
        className="h-full bg-gradient-to-r from-primary via-indigo-500 to-primary transition-[width] duration-100 ease-linear"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}