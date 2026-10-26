import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-brand-navy p-8 text-ink">
        <p>
          Configure NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY or use demo mode via dashboard without auth.
        </p>
      </div>
    );
  }
  return (
    <div className="flex min-h-screen items-center justify-center bg-brand-navy">
      <SignIn fallbackRedirectUrl="/dashboard" />
    </div>
  );
}
