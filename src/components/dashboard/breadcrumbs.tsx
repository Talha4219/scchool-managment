"use client";

// Derives a breadcrumb trail from the same navItems config that drives the
// sidebar, so there's one source of truth for route labels instead of a
// second hand-maintained map. Falls back to humanizing raw path segments for
// routes navItems doesn't know about (dynamic detail pages like
// /students/[id], /owner/branches/[id]).
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, Home } from "lucide-react";
import { navItems, type NavItem } from "@/components/dashboard/app-sidebar";
import { cn } from "@/lib/utils";

type Crumb = { label: string; href?: string };

function humanizeSegment(segment: string): string {
  if (/^[a-z0-9]{8,}$/i.test(segment) || /^\d+$/.test(segment)) return "Details";
  return segment
    .split("-")
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function buildCrumbs(pathname: string): Crumb[] {
  if (!pathname || pathname === "/dashboard") return [];

  let bestParent: NavItem | null = null;
  let bestChild: { label: string; href: string } | null = null;
  let bestMatchLen = -1;

  for (const item of navItems) {
    if (pathname === item.href || pathname.startsWith(item.href + "/")) {
      if (item.href.length > bestMatchLen) {
        bestMatchLen = item.href.length;
        bestParent = item;
        bestChild = null;
      }
    }
    for (const child of item.children ?? []) {
      const childBase = child.href.split("?")[0];
      if (pathname === childBase || pathname.startsWith(childBase + "/")) {
        if (childBase.length > bestMatchLen) {
          bestMatchLen = childBase.length;
          bestParent = item;
          bestChild = child;
        }
      }
    }
  }

  const crumbs: Crumb[] = [];
  if (!bestParent) {
    // Unknown route (e.g. /profile, /messages sub-pages) — humanize segments.
    const segments = pathname.split("/").filter(Boolean);
    let acc = "";
    for (const seg of segments) {
      acc += `/${seg}`;
      crumbs.push({ label: humanizeSegment(seg), href: acc });
    }
    return crumbs;
  }

  const matchedHref = (bestChild?.href.split("?")[0] ?? bestParent.href);
  crumbs.push({ label: bestParent.label, href: bestChild ? bestParent.href : undefined });
  if (bestChild) crumbs.push({ label: bestChild.label, href: undefined });

  // Extra dynamic segments beyond the matched nav href, e.g. /students/[id]
  // under the Students item, or /owner/branches/[id] under Branches.
  const remainder = pathname.slice(matchedHref.length).split("/").filter(Boolean);
  let acc = matchedHref;
  remainder.forEach((seg, i) => {
    acc += `/${seg}`;
    // The label of the last crumb we already pushed shouldn't get an href
    // (it's the current page); give it one only if more segments follow.
    if (i === 0 && crumbs.length && !crumbs[crumbs.length - 1].href && matchedHref !== pathname) {
      crumbs[crumbs.length - 1] = { ...crumbs[crumbs.length - 1], href: matchedHref };
    }
    crumbs.push({ label: humanizeSegment(seg), href: i < remainder.length - 1 ? acc : undefined });
  });

  return crumbs;
}

export function Breadcrumbs() {
  const pathname = usePathname();
  const crumbs = buildCrumbs(pathname);

  if (crumbs.length === 0) return null;

  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-muted-foreground mb-3 min-w-0">
      <Link href="/dashboard" className="flex items-center hover:text-foreground transition-colors shrink-0">
        <Home className="h-3.5 w-3.5" />
      </Link>
      {crumbs.map((c, i) => (
        <span key={i} className="flex items-center gap-1.5 min-w-0">
          <ChevronRight className="h-3 w-3 shrink-0 opacity-50" />
          {c.href ? (
            <Link href={c.href} className="hover:text-foreground transition-colors truncate">{c.label}</Link>
          ) : (
            <span className={cn("truncate", i === crumbs.length - 1 && "text-foreground font-semibold")}>{c.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
