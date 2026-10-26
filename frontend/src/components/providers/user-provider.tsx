"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { createGuestSession, setAuthTokenGetter } from "@/lib/api";

/** Empty string until the signed-in user is known; pages wait for it before calling the API. */
const UserContext = createContext<string>("");

const GUEST_TOKEN_KEY = "faa-guest-session";

export function UserProvider({ children }: { children: React.ReactNode }) {
  if (process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) return <ClerkUserProvider>{children}</ClerkUserProvider>;
  if (process.env.NEXT_PUBLIC_GUEST_MODE === "true") return <GuestUserProvider>{children}</GuestUserProvider>;
  // Local development without Clerk: the backend runs in single-user mode.
  return <UserContext.Provider value="local-dev-user">{children}</UserContext.Provider>;
}

function ClerkUserProvider({ children }: { children: React.ReactNode }) {
  const { userId, isLoaded, getToken } = useAuth();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!isLoaded) return;
    setAuthTokenGetter(() => getToken());
    setReady(true);
  }, [isLoaded, getToken]);

  return <UserContext.Provider value={ready && userId ? userId : ""}>{children}</UserContext.Provider>;
}

/**
 * Public demo: each browser gets its own signed guest session (kept in this browser only),
 * so visitors never see each other's documents.
 */
function GuestUserProvider({ children }: { children: React.ReactNode }) {
  const [userId, setUserId] = useState("");

  useEffect(() => {
    let cancelled = false;
    const start = async () => {
      let session: { token: string; userId: string } | null = null;
      try {
        const saved = localStorage.getItem(GUEST_TOKEN_KEY);
        if (saved) session = JSON.parse(saved);
      } catch {
        // Storage unavailable (private mode): a new session is used for this visit.
      }
      if (!session) {
        session = await createGuestSession();
        try {
          localStorage.setItem(GUEST_TOKEN_KEY, JSON.stringify(session));
        } catch {
          // ignore
        }
      }
      if (cancelled) return;
      const token = session.token;
      setAuthTokenGetter(async () => token);
      setUserId(session.userId);
    };
    start().catch(() => {
      // Start over with a fresh session next time.
      try {
        localStorage.removeItem(GUEST_TOKEN_KEY);
      } catch {
        // ignore
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return <UserContext.Provider value={userId}>{children}</UserContext.Provider>;
}

export function useUserId(): string {
  return useContext(UserContext);
}
