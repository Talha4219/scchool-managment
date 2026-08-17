"use client";

// Split out of state-context.tsx as the first step of breaking up that file's
// single "god context". Notifications are uniquely high-churn — nearly every
// mutator in StateProvider (addStudent, saveAttendance, payFeeVoucher, etc.)
// calls addNotification, so when notifications lived in the same context as
// everything else, ANY action anywhere in the app forced every consumer of
// useAppState() to re-render, even ones that only read e.g. `subjects`.
// Isolating it here means a new notification only re-renders components that
// actually read notifications state (the bell icon, the notifications page) —
// not the fees page, the library page, etc.

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";
import { addNotificationDB, markNotificationReadDB } from "../app/actions/db";
import type { NotificationRecord, UserRole } from "./types";
import { defaultNotifications } from "./default-data";

interface NotificationsContextType {
  notifications: NotificationRecord[];
  addNotification: (title: string, message: string, recipientRole: UserRole, recipientEmail?: string) => void;
  markNotificationRead: (id: string) => void;
  setNotificationsFromDB: (notifications: NotificationRecord[]) => void;
}

const NotificationsContext = createContext<NotificationsContextType | undefined>(undefined);

const syncDB = (fn: () => Promise<unknown>) => {
  fn().catch(e => console.error(e));
};

export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<NotificationRecord[]>(defaultNotifications);

  const addNotification = useCallback((title: string, message: string, recipientRole: UserRole, recipientEmail?: string) => {
    const notif: NotificationRecord = {
      id: `n_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      title, message,
      date: new Date().toISOString().split("T")[0],
      recipientRole,
      recipientEmail,
      read: false,
    };
    setNotifications(prev => [notif, ...prev]);
    syncDB(() => addNotificationDB(notif));
  }, []);

  const markNotificationRead = useCallback((id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    syncDB(() => markNotificationReadDB(id));
  }, []);

  // StateProvider's initial DB load fetches notifications alongside everything
  // else in one round trip — this lets it hand the fetched rows to this
  // context instead of each context doing its own separate fetch.
  const setNotificationsFromDB = useCallback((rows: NotificationRecord[]) => {
    setNotifications(rows);
  }, []);

  // Local-storage fallback, scoped to just this slice.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = localStorage.getItem("sc_notifications");
    if (stored) {
      try { setNotifications(JSON.parse(stored)); } catch { /* ignore malformed cache */ }
    }
  }, []);

  const saveTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      localStorage.setItem("sc_notifications", JSON.stringify(notifications));
    }, 400);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [notifications]);

  const value = useMemo<NotificationsContextType>(() => ({
    notifications, addNotification, markNotificationRead, setNotificationsFromDB,
  }), [notifications, addNotification, markNotificationRead, setNotificationsFromDB]);

  return (
    <NotificationsContext.Provider value={value}>
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error("useNotifications must be used within a NotificationsProvider");
  return ctx;
}
