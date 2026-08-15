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
        // A custom role narrows an ADMIN's automatic bypass too — assigning
        // one is the point at which the school wants that person restricted
        // to an explicit permission set instead of everything.
        if (session.role === "ADMIN" && !cr) {
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
      if (role === "ADMIN" && !customRoleId) return true;
      return perms[permission] === true;
    },
    [role, customRoleId, perms]
  );

  return { can, role, customRoleId, loaded, perms, setPerms };
}
