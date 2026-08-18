import { getSession } from "@/app/actions/auth";
import type { SessionPayload } from "@/lib/auth";

// Shared requireRole/requireSession, previously duplicated near-verbatim
// across db.ts, academic-core.ts, admission-documents.ts,
// attendance-devices.ts, staff-attendance.ts, substitutions.ts,
// student-documents.ts. One place to add new roles (OWNER/PRINCIPAL) going
// forward instead of seven.
export type Role = SessionPayload['role'];

export async function requireRole(...roles: Role[]): Promise<{ session: SessionPayload } | { error: string }> {
  const session = await getSession();
  if (!session) return { error: 'Not authenticated.' };
  // PRINCIPAL = "Admin, branch-scoped" — wherever ADMIN is allowed to act,
  // so is PRINCIPAL; the branch restriction is enforced separately by
  // scopeBranch() in each query, not by narrowing which actions they can
  // call. This lets every existing requireRole('ADMIN') call site work for
  // Principals unmodified instead of needing PRINCIPAL added at each of the
  // ~100+ call sites individually.
  const effectiveRoles = roles.includes('ADMIN') ? [...roles, 'PRINCIPAL' as Role] : roles;
  if (!effectiveRoles.includes(session.role)) return { error: 'You are not authorized to perform this action.' };
  return { session };
}

export async function requireSession(): Promise<{ session: SessionPayload } | { error: string }> {
  const session = await getSession();
  if (!session) return { error: 'Not authenticated.' };
  return { session };
}

// Multi-branch data scoping. Returns null for OWNER (and for legacy
// sessions with no branchId) — meaning "no filter, see everything" — or the
// caller's own branchId otherwise, to be AND-ed into a query's WHERE clause.
// OWNER is the one exception: getSession() (src/app/actions/auth.ts) stamps
// session.branchId from the sc_owner_view_branch cookie when the Owner has
// picked a branch to "view as" from the global header selector — so an
// active selection scopes OWNER just like any other role, everywhere, with
// zero changes needed at any of this function's ~40 call sites.
export function scopeBranch(session: SessionPayload): string | null {
  if (session.role === 'OWNER') return session.branchId ?? null;
  return session.branchId;
}
