import { PageSkeleton } from "@/components/ui/page-skeleton";

// Route-segment Suspense fallback — paints immediately on navigation, before
// the destination page's own client bundle even mounts. This only covers
// the code-loading gap (these are all "use client" pages fetching data via
// useEffect, not server-streamed data), so each page's own internal loading
// state — now PageSkeleton in the pages we've touched — still matters for
// the data-fetch window itself.
export default function DashboardLoading() {
  return <PageSkeleton />;
}
