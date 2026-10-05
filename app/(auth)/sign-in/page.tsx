"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";

export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrorMessage(null);

    if (!email || !password) {
      toast.error("Please enter both email and password");
      return;
    }

    try {
      setLoading(true);

      const res = await fetch("/api/auth/signin", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ email, password })
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        const msg = data.message || "Invalid email or password";
        setErrorMessage(msg);
        toast.error(msg);
        return;
      }

      toast.success("Signed in successfully");
      router.push("/");
      router.refresh();
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : "An unexpected network error occurred";
      setErrorMessage(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-background flex min-h-screen flex-col items-center justify-between px-4 py-8">
      {/* Brand Header */}
      <header className="flex w-full max-w-4xl items-center justify-between py-2">
        <Link href="/sign-in" className="flex items-center gap-2">
          <span className="text-foreground text-sm font-semibold tracking-tight">
            My School Branding
          </span>
        </Link>
      </header>
      {/* Main Sign In Card */}
      <main className="my-auto w-full max-w-95">
        <div className="border-border bg-card rounded-md border p-6 shadow-xs">
          <div className="mb-5 space-y-1">
            <h1 className="text-foreground text-base font-semibold tracking-tight">
              Sign in to CRM
            </h1>
            <p className="text-muted-foreground text-xs">
              Enter your credentials to access the admin portal
            </p>
          </div>

          {errorMessage && (
            <div className="border-destructive/30 bg-destructive/10 text-destructive mb-4 rounded border p-2.5 text-xs">
              {errorMessage}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email address</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@school.com"
                required
                autoComplete="email"
                disabled={loading}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                required
                autoComplete="current-password"
                disabled={loading}
              />
            </div>

            <Button
              type="submit"
              className="h-9 w-full font-medium"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                "Sign In"
              )}
            </Button>
          </form>

          <div className="border-border text-muted-foreground mt-5 border-t pt-4 text-center text-xs">
            Don&apos;t have an admin account?{" "}
            <Link
              href="/sign-up"
              className="text-primary font-medium hover:underline"
            >
              Sign up
            </Link>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="text-muted-foreground w-full max-w-4xl py-4 text-center text-xs">
        <span>
          &copy; {new Date().getFullYear()} My School Branding. All rights
          reserved.
        </span>
      </footer>
    </div>
  );
}
