import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, CheckCircle2, Mail } from "lucide-react";
import { Button } from "../../admin/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../admin/components/ui/card";
import { Input } from "../../admin/components/ui/input";
import { Label } from "../../admin/components/ui/label";
import { AdminLogo } from "../../components/admin/AdminLogo";
import { api, ApiError } from "../../lib/api";

export function AdminForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!email.trim()) return;

    setError(null);
    setSubmitting(true);
    try {
      await api<{ ok: true; message: string }>("/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      setSubmittedEmail(email.trim());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not request password reset. Please try again.");
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
            <h1 className="font-display text-4xl leading-tight">Account recovery</h1>
            <p className="text-sm leading-relaxed text-[hsl(var(--sidebar-foreground))]/80">
              Reset your credentials securely via email. Password reset links expire after 60 minutes.
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-center bg-background px-admin-gutter py-footer-y">
        <Card className="w-full max-w-md border-border/80 shadow-sm">
          <CardHeader className="space-y-3 text-center">
            <AdminLogo className="mx-auto h-16" />
            <CardTitle className="font-display text-2xl">
              {submittedEmail ? "Check your email" : "Reset your password"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {submittedEmail ? (
              <div className="space-y-5 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-accent/15 text-accent">
                  <CheckCircle2 className="h-6 w-6" />
                </div>
                <div className="space-y-2">
                  <p className="text-sm text-foreground">
                    If an active account exists for <strong className="text-accent">{submittedEmail}</strong>, we have sent a secure password reset link to your inbox.
                  </p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Please check your email and click the button to set a new password. The link will remain valid for 60 minutes.
                  </p>
                </div>
                <div className="pt-2">
                  <Button variant="outline" className="w-full" asChild>
                    <Link to="/admin/login">
                      <ArrowLeft className="mr-2 h-4 w-4" />
                      Back to sign in
                    </Link>
                  </Button>
                </div>
              </div>
            ) : (
              <form className="space-y-admin-stack-sm" onSubmit={onSubmit}>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Enter your registered desk account email address and we’ll send you a link to reset your password.
                </p>
                <div className="space-y-2">
                  <Label htmlFor="email">Account email</Label>
                  <div className="relative">
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="e.g. staff@photoarenang.com"
                      autoComplete="email"
                      required
                      className="pl-9"
                    />
                    <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  </div>
                </div>

                {error ? <p className="text-sm text-destructive">{error}</p> : null}

                <Button type="submit" className="w-full" loading={submitting}>
                  {submitting ? "Sending reset link…" : "Send reset link"}
                </Button>

                <div className="pt-1 text-center">
                  <Link
                    to="/admin/login"
                    className="inline-flex items-center text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
                    Back to sign in
                  </Link>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
