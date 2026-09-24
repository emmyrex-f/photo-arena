import { FormEvent, useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "../../admin/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../admin/components/ui/card";
import { Input } from "../../admin/components/ui/input";
import { Label } from "../../admin/components/ui/label";
import { AdminLogo } from "../../components/admin/AdminLogo";
import { firstAllowedAdminPath } from "../../admin/lib/nav";
import { api, ApiError } from "../../lib/api";
import { useAuth } from "../../lib/auth";

export function AdminLoginPage() {
  const { user, ready, login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void api<{ email: string }>("/auth/desk-email")
      .then((result) => {
        if (!cancelled) setEmail(result.email);
      })
      .catch(() => {
        if (!cancelled) setError("Could not load desk login");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (ready && user) {
    return <Navigate to={firstAllowedAdminPath(user)} replace />;
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const signedIn = await login(email, password);
      navigate(firstAllowedAdminPath(signedIn), { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not sign in");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-[hsl(var(--sidebar))] lg:block">
        <img
          src="/gallery/01-birthdays.jpg"
          alt=""
          className="absolute inset-0 h-full w-full object-cover opacity-55"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[hsl(210_15%_5%)] via-[hsl(210_15%_5%/0.75)] to-[hsl(210_14%_11%/0.4)]" />
        <div className="relative z-10 flex h-full flex-col justify-between p-card-lg text-[hsl(var(--sidebar-foreground))]">
          <div>
            <AdminLogo onDark className="h-14" />
            <p className="font-subtitle mt-2 text-xs uppercase tracking-[0.2em] opacity-70">Port Harcourt</p>
          </div>
          <div className="max-w-md space-y-3">
            <h1 className="font-display text-4xl leading-tight">Studio desk</h1>
            <p className="text-sm leading-relaxed text-[hsl(var(--sidebar-foreground))]/80">
              Manage bookings, customers, gallery and content for the walk-in portrait studio.
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-center bg-background px-admin-gutter py-footer-y">
        <Card className="w-full max-w-md border-border/80 shadow-sm">
          <CardHeader className="space-y-3 text-center">
            <AdminLogo className="mx-auto h-16" />
            <CardTitle className="font-display text-2xl">Sign in</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="space-y-admin-stack-sm" onSubmit={onSubmit}>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="username"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    required
                    minLength={6}
                    className="pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="absolute right-1 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowPassword((open) => !open)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    aria-pressed={showPassword}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              {error ? <p className="text-sm text-destructive">{error}</p> : null}
              <Button type="submit" className="w-full" loading={submitting}>
                {submitting ? "Signing in…" : "Sign in"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
