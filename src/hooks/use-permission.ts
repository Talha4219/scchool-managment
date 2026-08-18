"use client";

import { useState, useEffect, useCallback } from "react";
import { getSession } from "@/app/actions/auth";
import { fetchRolePermissionsDB, fetchMyCustomRoleIdDB } from "@/app/actions/features";

export function usePermission() {
  const [perms, setPerms] = useState<Record<string, boolean>>({});
  const [role, setRole] = useState<string | null>(null);
  const [customRoleId, setCustomRoleId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      const session = await getSession();
      if (session?.role) {
        setRole(session.role);
        // A custom-role assignment is looked up live (not baked into the
        // session JWT) so it applies immediately without a re-login.
        const cr = await fetchMyCustomRoleIdDB();
        setCustomRoleId(cr);
        // A custom role narrows an ADMIN's/PRINCIPAL's automatic bypass too —
        // assigning one is the point at which the school wants that person
        // restricted to an explicit permission set instead of everything.
        // PRINCIPAL = "Admin, branch-scoped": same permission bypass, data
        // scoping is enforced separately by scopeBranch() in each action.
        // OWNER gets the same bypass — no role_permissions row exists for
        // OWNER (it predates the branches feature for most schools), so
        // without this every permission-gated nav item/page silently
        // resolved to false and disappeared from the Owner's sidebar.
        if ((session.role === "ADMIN" || session.role === "PRINCIPAL" || session.role === "OWNER") && !cr) {
          setLoaded(true);
          return;
        }
        const p = await fetchRolePermissionsDB(cr || session.role);
        setPerms(p);
      }
      setLoaded(true);
    })();
  }, []);

  const can = useCallback(
    (permission: string) => {
      if ((role === "ADMIN" || role === "PRINCIPAL" || role === "OWNER") && !customRoleId) return true;
      return perms[permission] === true;
    },
    [role, customRoleId, perms]
  );

  return { can, role, customRoleId, loaded, perms, setPerms };
}
