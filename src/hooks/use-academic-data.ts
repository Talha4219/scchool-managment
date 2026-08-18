"use client";

// Shared SWR-cached reads for reference data that nearly every dashboard page
// fetches independently on mount (academic years, classes, sections). Without
// this, navigating between e.g. Fees -> Timetable -> Students re-fetches the
// exact same class/section lists from Postgres on every single page mount.
// SWR keys these by (name, args) and dedupes/caches per browser session, so a
// page revisited within the cache window renders from memory instantly and
// only revalidates in the background.
import useSWR from "swr";
import { fetchAcademicYearsDB, fetchClassesDB, fetchSectionsByClassDB } from "@/app/actions/academic-core";
import type { AcademicYear, ClassItem, SectionItem } from "@/lib/types";

const sharedConfig = {
  revalidateOnFocus: false,
  dedupingInterval: 30_000,
} as const;

export function useAcademicYears() {
  const { data, isLoading, mutate } = useSWR<AcademicYear[]>("academic-years", () => fetchAcademicYearsDB(), sharedConfig);
  return { academicYears: data ?? [], loading: isLoading, refresh: mutate };
}

export function useActiveAcademicYearId() {
  const { academicYears, loading } = useAcademicYears();
  const active = academicYears.find(y => y.isActive) || academicYears[0];
  return { activeYearId: active?.id ?? "", loading };
}

export function useClasses(academicYearId?: string) {
  const { data, isLoading, mutate } = useSWR<ClassItem[]>(
    academicYearId ? ["classes", academicYearId] : null,
    () => fetchClassesDB(academicYearId),
    sharedConfig
  );
  return { classes: data ?? [], loading: isLoading, refresh: mutate };
}

export function useSections(classId?: string) {
  const { data, isLoading, mutate } = useSWR<SectionItem[]>(
    classId ? ["sections", classId] : null,
    () => fetchSectionsByClassDB(classId as string),
    sharedConfig
  );
  return { sections: data ?? [], loading: isLoading, refresh: mutate };
}
