import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-brand-navy p-8 text-ink">
        <p>Clerk not configured. Continue to dashboard in demo mode.</p>
      </div>
    );
  }
  return (
    <div className="flex min-h-screen items-center justify-center bg-brand-navy">
      <SignUp />
    </div>
  );
}
