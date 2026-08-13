"use client";

import { useState, useEffect, useCallback } from "react";
import { getSession } from "@/app/actions/auth";
import { fetchRolePermissionsDB } from "@/app/actions/features";

export function usePermission() {
  const [perms, setPerms] = useState<Record<string, boolean>>({});
  const [role, setRole] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      const session = await getSession();
      if (session?.role === "ADMIN") {
        setRole("ADMIN");
      } else if (session?.role) {
        setRole(session.role);
        const p = await fetchRolePermissionsDB(session.role);
        setPerms(p);
      }
      setLoaded(true);
    })();
  }, []);

  const can = useCallback(
    (permission: string) => {
      if (role === "ADMIN") return true;
      return perms[permission] === true;
    },
    [role, perms]
  );

  return { can, role, loaded, perms, setPerms };
}
