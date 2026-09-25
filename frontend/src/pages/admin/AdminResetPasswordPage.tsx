import { useEffect, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CheckCircle2, Eye, EyeOff, KeyRound, ShieldAlert } from "lucide-react";
import { Button } from "../../admin/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../admin/components/ui/card";
import { Input } from "../../admin/components/ui/input";
import { Label } from "../../admin/components/ui/label";
import { Skeleton } from "../../admin/components/ui/skeleton";
import { AdminLogo } from "../../components/admin/AdminLogo";
import { api, ApiError } from "../../lib/api";

export function AdminResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token")?.trim() || "";

  const [verifying, setVerifying] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [maskedEmail, setMaskedEmail] = useState<string | null>(null);
  const [verifyError, setVerifyError] = useState<string | null>(null);

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!token) {
      setVerifying(false);
      setTokenValid(false);
      setVerifyError("No password reset token provided. Please request a new link.");
      return;
    }

    void api<{ valid: boolean; email?: string; message?: string }>(
      `/auth/verify-reset-token?token=${encodeURIComponent(token)}`,
    )
      .then((res) => {
        if (cancelled) return;
        if (res.valid) {
          setTokenValid(true);
          setMaskedEmail(res.email || null);
        } else {
          setTokenValid(false);
          setVerifyError(res.message || "This password reset link is invalid or has expired.");
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setTokenValid(false);
        setVerifyError(err instanceof ApiError ? err.message : "Could not verify reset token.");
      })
      .finally(() => {
        if (!cancelled) setVerifying(false);
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);

    if (newPassword.length < 8) {
      setFormError("Password must be at least 8 characters long.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setFormError("Passwords do not match. Please verify both fields.");
      return;
    }

    setSubmitting(true);
    try {
      await api<{ ok: true; message: string }>("/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({ token, newPassword }),
      });
      setResetSuccess(true);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Could not reset password. Please try again.");
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
            <h1 className="font-display text-4xl leading-tight">Create new password</h1>
            <p className="text-sm leading-relaxed text-[hsl(var(--sidebar-foreground))]/80">
              Set a strong, unique password for your desk account. All existing active sessions will be revoked upon password update.
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-center bg-background px-admin-gutter py-footer-y">
        <Card className="w-full max-w-md border-border/80 shadow-sm">
          <CardHeader className="space-y-3 text-center">
            <AdminLogo className="mx-auto h-16" />
            <CardTitle className="font-display text-2xl">
              {resetSuccess
                ? "Password updated"
                : verifying
                  ? "Verifying link"
                  : tokenValid
                    ? "Set new password"
                    : "Reset link invalid"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {verifying ? (
              <div className="space-y-3 py-4">
                <Skeleton className="h-4 w-3/4 mx-auto" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : resetSuccess ? (
              <div className="space-y-5 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-accent/15 text-accent">
                  <CheckCircle2 className="h-6 w-6" />
                </div>
                <div className="space-y-2">
                  <p className="text-sm text-foreground">
                    Your desk password has been successfully updated. All active sessions have been securely closed.
                  </p>
                  <p className="text-xs text-muted-foreground">
                    You can now sign in using your new password.
                  </p>
                </div>
                <Button className="w-full" asChild>
                  <Link to="/admin/login">Sign in now</Link>
                </Button>
              </div>
            ) : !tokenValid ? (
              <div className="space-y-5 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/15 text-destructive">
                  <ShieldAlert className="h-6 w-6" />
                </div>
                <div className="space-y-2">
                  <p className="text-sm text-foreground">
                    {verifyError || "This password reset link is invalid or has expired."}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Password reset links are single-use and expire after 60 minutes for security.
                  </p>
                </div>
                <Button className="w-full" asChild>
                  <Link to="/admin/forgot-password">Request a new reset link</Link>
                </Button>
                <div>
                  <Button variant="ghost" size="sm" asChild>
                    <Link to="/admin/login">Return to sign in</Link>
                  </Button>
                </div>
              </div>
            ) : (
              <form className="space-y-admin-stack-sm" onSubmit={onSubmit}>
                {maskedEmail ? (
                  <p className="text-xs text-muted-foreground">
                    Resetting password for <span className="font-mono text-foreground font-medium">{maskedEmail}</span>
                  </p>
                ) : null}

                <div className="space-y-2">
                  <Label htmlFor="new-password">New password</Label>
                  <div className="relative">
                    <Input
                      id="new-password"
                      type={showPassword ? "text" : "password"}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="At least 8 characters"
                      autoComplete="new-password"
                      required
                      minLength={8}
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

                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Confirm new password</Label>
                  <Input
                    id="confirm-password"
                    type={showPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repeat new password"
                    autoComplete="new-password"
                    required
                    minLength={8}
                  />
                </div>

                {formError ? <p className="text-sm text-destructive">{formError}</p> : null}

                <Button type="submit" className="w-full" loading={submitting}>
                  <KeyRound className="mr-2 h-4 w-4" />
                  {submitting ? "Resetting password…" : "Reset password"}
                </Button>

                <div className="pt-1 text-center">
                  <Button variant="ghost" size="sm" asChild>
                    <Link to="/admin/login">Cancel and sign in</Link>
                  </Button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
