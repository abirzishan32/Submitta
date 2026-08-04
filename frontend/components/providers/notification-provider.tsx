"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";

import { apiClient } from "@/lib/api/client";
import type {
  Notification,
  NotificationEvent,
  NotificationList,
} from "@/lib/api/notification-types";

interface NotificationContextValue {
  items: Notification[];
  unreadCount: number;
  /** False while the live connection is down; the bell shows this. */
  connected: boolean;
  loading: boolean;
  refresh: () => Promise<void>;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextValue | null>(null);

/**
 * Holds the signed-in user's notifications, and keeps them current.
 *
 * Two sources feed the same state: one fetch on mount for what already exists,
 * and a server-sent-event stream for what arrives afterwards. The stream is an
 * accelerator — everything it delivers is already stored — so a dropped
 * connection costs freshness, never data.
 */
export function NotificationProvider({
  children,
  enabled,
}: {
  children: React.ReactNode;
  /** Off for signed-out visitors: there is nothing to subscribe to. */
  enabled: boolean;
}) {
  const [items, setItems] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(enabled);

  const refresh = useCallback(async () => {
    if (!enabled) return;

    try {
      const data = await apiClient.get<NotificationList>("/api/v1/notifications?take=20");
      setItems(data.items);
      setUnreadCount(data.unreadCount);
    } catch {
      // Leave whatever is on screen rather than blanking the list; the next
      // refresh or stream event will correct it.
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // --- Live connection ---------------------------------------------------

  const source = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!enabled) return;

    // EventSource reconnects on its own after a network drop, which is most of
    // why this is SSE rather than a hand-rolled socket. It does not retry a
    // non-2xx response, so an expired session is handled explicitly below.
    const stream = new EventSource("/api/notifications/stream");
    source.current = stream;

    stream.addEventListener("ready", () => setConnected(true));

    stream.addEventListener("notification", (event) => {
      try {
        const payload = JSON.parse((event as MessageEvent).data) as NotificationEvent;

        setItems((current) => {
          // The same event can arrive twice across a reconnect.
          if (current.some((n) => n.id === payload.notification.id)) return current;
          return [payload.notification, ...current].slice(0, 20);
        });

        setUnreadCount(payload.unreadCount);

        toast(payload.notification.title, {
          description: payload.notification.body,
        });
      } catch {
        // A frame we cannot read is not worth tearing the connection down for.
      }
    });

    stream.onerror = () => {
      setConnected(false);

      // EventSource retries a dropped connection itself. A closed one means the
      // response was rejected — an expired session, most likely — and retrying
      // in a loop would achieve nothing, so fall back to polling on focus.
      if (stream.readyState === EventSource.CLOSED) {
        source.current = null;
      }
    };

    return () => {
      stream.close();
      source.current = null;
      setConnected(false);
    };
  }, [enabled]);

  // Catches up whatever was missed while the tab was in the background or the
  // connection was down.
  useEffect(() => {
    if (!enabled) return;

    function onVisible() {
      if (document.visibilityState === "visible") void refresh();
    }

    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);

    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [enabled, refresh]);

  // --- Actions -----------------------------------------------------------

  const markRead = useCallback(async (id: string) => {
    // Applied locally first: marking read is not worth a spinner, and the
    // server call is one the user never needs to think about.
    setItems((current) =>
      current.map((n) => (n.id === id ? { ...n, isRead: true } : n)),
    );
    setUnreadCount((count) => Math.max(0, count - 1));

    try {
      await apiClient.post(`/api/v1/notifications/${id}/read`, {});
    } catch {
      // Put the truth back if the server disagreed.
      void refreshQuietly();
    }

    async function refreshQuietly() {
      try {
        const data = await apiClient.get<NotificationList>("/api/v1/notifications?take=20");
        setItems(data.items);
        setUnreadCount(data.unreadCount);
      } catch {
        // Nothing more to do.
      }
    }
  }, []);

  const markAllRead = useCallback(async () => {
    setItems((current) => current.map((n) => ({ ...n, isRead: true })));
    setUnreadCount(0);

    try {
      await apiClient.post("/api/v1/notifications/read-all", {});
    } catch {
      void refresh();
    }
  }, [refresh]);

  return (
    <NotificationContext.Provider
      value={{ items, unreadCount, connected, loading, refresh, markRead, markAllRead }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications(): NotificationContextValue {
  const context = useContext(NotificationContext);

  if (!context) {
    throw new Error("useNotifications must be used inside a NotificationProvider.");
  }

  return context;
}
