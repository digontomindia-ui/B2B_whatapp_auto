"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";

export default function SignUpPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrorMessage(null);

    if (!name || !email || !password || !confirmPassword) {
      toast.error("Please fill in all required fields");
      return;
    }

    if (password.length < 6) {
      const msg = "Password must be at least 6 characters long";
      setErrorMessage(msg);
      toast.error(msg);
      return;
    }

    if (password !== confirmPassword) {
      const msg = "Passwords do not match";
      setErrorMessage(msg);
      toast.error(msg);
      return;
    }

    try {
      setLoading(true);

      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ name, email, password })
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        const msg = data.message || "Failed to create account";
        setErrorMessage(msg);
        toast.error(msg);
        return;
      }

      toast.success("Account created successfully");
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

      {/* Main Sign Up Card */}
      <main className="my-auto w-full max-w-100">
        <div className="border-border bg-card rounded-md border p-6 shadow-xs">
          <div className="mb-5 space-y-1">
            <h1 className="text-foreground text-base font-semibold tracking-tight">
              Create Admin Account
            </h1>
            <p className="text-muted-foreground text-xs">
              Register a new administrator for the CRM system
            </p>
          </div>

          {errorMessage && (
            <div className="border-destructive/30 bg-destructive/10 text-destructive mb-4 rounded border p-2.5 text-xs">
              {errorMessage}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="name">Full name</Label>
              <Input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Alex Morgan"
                required
                autoComplete="name"
                disabled={loading}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="email">Work email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@school.com"
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
                placeholder="Minimum 6 characters"
                required
                autoComplete="new-password"
                disabled={loading}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="confirmPassword">Confirm password</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter password"
                required
                autoComplete="new-password"
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
                  Creating account...
                </>
              ) : (
                "Create Account"
              )}
            </Button>
          </form>

          <div className="border-border text-muted-foreground mt-5 border-t pt-4 text-center text-xs">
            Already have an account?{" "}
            <Link
              href="/sign-in"
              className="text-primary font-medium hover:underline"
            >
              Sign in
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
