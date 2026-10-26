"use client";

import { useTheme } from "next-themes";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function SettingsPage() {
  const { resolvedTheme: theme, setTheme } = useTheme();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold text-ink">Settings</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-ink">Appearance</CardTitle>
          <CardDescription>Dark mode uses deep navy brand backgrounds</CardDescription>
        </CardHeader>
        <div className="flex gap-2 px-6 pb-6">
          <Button
            variant={theme === "dark" ? "default" : "outline"}
            onClick={() => setTheme("dark")}
          >
            Dark
          </Button>
          <Button
            variant={theme === "light" ? "default" : "outline"}
            onClick={() => setTheme("light")}
          >
            Light
          </Button>
        </div>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-ink">API configuration</CardTitle>
          <CardDescription>
            Set NEXT_PUBLIC_API_URL, Clerk keys, Supabase, OpenAI, and Google Vision in .env
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
