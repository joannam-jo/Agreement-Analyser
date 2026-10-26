"use client";

import { SignedIn, UserButton } from "@clerk/nextjs";

/** Account menu with sign out. Rendered only when Clerk is configured (see the navbar). */
export function AuthControls() {
  return (
    <SignedIn>
      <UserButton afterSignOutUrl="/" />
    </SignedIn>
  );
}
