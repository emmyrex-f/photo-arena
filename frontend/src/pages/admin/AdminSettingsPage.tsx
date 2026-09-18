import { FormEvent, useEffect, useState } from "react";
import { KeyRound, Monitor, Moon, Sun } from "lucide-react";
import { Button } from "../../admin/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../admin/components/ui/card";
import { Input } from "../../admin/components/ui/input";
import { Label } from "../../admin/components/ui/label";
import { PageHeader } from "../../admin/components/ui/page-header";
import { RoleBadge } from "../../admin/components/ui/status-badge";
import { toast } from "../../admin/components/ui/toaster";
import { useAdminApi } from "../../admin/lib/adminApi";
import type { ThemePreference } from "../../admin/lib/theme";
import { useAdminTheme } from "../../admin/lib/theme";
import { ChangePasswordDialog } from "../../components/admin/ChangePasswordDialog";
import { errorMessage } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { cn } from "../../lib/cn";

const THEMES: Array<{ value: ThemePreference; label: string; icon: typeof Sun }> = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
];

export function AdminSettingsPage() {
  const { user, lastLoginAt, applyAccount } = useAuth();
  const api = useAdminApi();
  const { theme, setTheme, resolved } = useAdminTheme();
  const [passwordOpen, setPasswordOpen] = useState(false);
  const owner = user?.role === "OWNER";

  const [name, setName] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    setName(user.name);
    setEmail(user.email);
  }, [user]);

  async function onSaveLogin(event: FormEvent) {
    event.preventDefault();
    if (newPassword && newPassword.length < 8) {
      toast.error("New password must be at least 8 characters");
      return;
    }
    if (newPassword && newPassword !== confirmPassword) {
      toast.error("New passwords do not match");
      return;
    }
    setSaving(true);
    try {
      const result = await api.auth.updateAccount({
        currentPassword,
        name: name.trim(),
        email: email.trim().toLowerCase(),
        ...(newPassword ? { newPassword } : {}),
      });
      applyAccount(
        {
          id: result.user.id,
          email: result.user.email,
          name: result.user.name,
          role: result.user.role,
          permissions: result.user.permissions,
          isActive: result.user.isActive,
          lastLoginAt: result.user.lastLoginAt,
        },
        result.token,
      );
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast.success("Login details updated");
    } catch (err) {
      toast.error(errorMessage(err, "Could not update login details"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-admin">
      <PageHeader
        title="Settings"
        description={
          owner
            ? "Theme and desk login details for the owner account."
            : "Theme, password and account details for this desk session."
        }
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Appearance</CardTitle>
            <CardDescription>Stored in this browser as pa_admin_theme. Currently resolving to {resolved}.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-3 gap-2">
            {THEMES.map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => setTheme(item.value)}
                className={cn(
                  "flex flex-col items-center gap-2 rounded-lg border px-3 py-4 text-sm transition",
                  theme === item.value ? "border-primary bg-primary/10" : "border-border hover:bg-muted/40",
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </button>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{owner ? "Desk login" : "Account"}</CardTitle>
            <CardDescription>
              {owner
                ? "This email is the studio sign-in address. Confirm with your current password to save."
                : "Signed-in desk user."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {owner ? (
              <form className="space-y-4" onSubmit={onSaveLogin}>
                <div className="space-y-2">
                  <Label htmlFor="login-name">Name</Label>
                  <Input
                    id="login-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    autoComplete="name"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="login-email">Login email</Label>
                  <Input
                    id="login-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="username"
                    required
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Role:</span>
                  {user ? <RoleBadge role={user.role} /> : null}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="login-current">Current password</Label>
                  <Input
                    id="login-current"
                    type="password"
                    autoComplete="current-password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="login-new">New password (optional)</Label>
                  <Input
                    id="login-new"
                    type="password"
                    autoComplete="new-password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    minLength={8}
                  />
                </div>
                {newPassword ? (
                  <div className="space-y-2">
                    <Label htmlFor="login-confirm">Confirm new password</Label>
                    <Input
                      id="login-confirm"
                      type="password"
                      autoComplete="new-password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      minLength={8}
                    />
                  </div>
                ) : null}
                {lastLoginAt ? (
                  <p className="text-xs text-muted-foreground">
                    Session started {new Date(lastLoginAt).toLocaleString()}
                  </p>
                ) : null}
                <Button type="submit" loading={saving}>
                  Save login details
                </Button>
              </form>
            ) : (
              <>
                <p>
                  <span className="text-muted-foreground">Name:</span> {user?.name}
                </p>
                <p>
                  <span className="text-muted-foreground">Email:</span> {user?.email}
                </p>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Role:</span>
                  {user ? <RoleBadge role={user.role} /> : null}
                </div>
                {lastLoginAt ? (
                  <p className="text-xs text-muted-foreground">
                    Session started {new Date(lastLoginAt).toLocaleString()}
                  </p>
                ) : null}
                <Button variant="outline" onClick={() => setPasswordOpen(true)}>
                  <KeyRound />
                  Change password
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">About Photo Arena desk</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>Admin portal for Photo Arena — Port Harcourt walk-in portrait studio.</p>
            <p>Money is stored in kobo; times display in Africa/Lagos. Public site content is managed under Content.</p>
            <p>API base: /api · Uploads: /uploads</p>
          </CardContent>
        </Card>
      </div>

      <ChangePasswordDialog open={passwordOpen} onOpenChange={setPasswordOpen} />
    </div>
  );
}
