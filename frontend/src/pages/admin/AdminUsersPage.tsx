import { useCallback, useMemo, useState, type FormEvent } from "react";
import { KeyRound, MoreHorizontal, Plus, ShieldAlert, Trash2, UserPlus, Users } from "lucide-react";
import { ActiveBadge, RoleBadge } from "../../admin/components/ui/status-badge";
import { Button } from "../../admin/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../admin/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../../admin/components/ui/dropdown-menu";
import { EmptyState } from "../../admin/components/ui/empty-state";
import { ErrorBanner } from "../../admin/components/ui/error-banner";
import { Input } from "../../admin/components/ui/input";
import { Label } from "../../admin/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../admin/components/ui/select";
import { Skeleton } from "../../admin/components/ui/skeleton";
import { StatCard } from "../../admin/components/ui/stat-card";
import { Switch } from "../../admin/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../admin/components/ui/table";
import { toast } from "../../admin/components/ui/toaster";
import { useAdminApi } from "../../admin/lib/adminApi";
import { accessSummary, DESK_PERMISSIONS, FULL_ACCESS } from "../../admin/lib/permissions";
import { formatLagosDateTime } from "../../admin/lib/format";
import type { AdminUser } from "../../admin/lib/types";
import { useQuery } from "../../admin/lib/useQuery";
import { errorMessage } from "../../lib/api";
import { isOwner, useAuth, type Role } from "../../lib/auth";
import { cn } from "../../lib/cn";

type EditorMode = "create" | "edit" | "password";

type EditorForm = {
  email: string;
  name: string;
  role: Role;
  password: string;
  isActive: boolean;
  fullAccess: boolean;
  permissions: string[];
};

const EMPTY_FORM: EditorForm = {
  email: "",
  name: "",
  role: "ADMIN",
  password: "",
  isActive: true,
  fullAccess: false,
  permissions: [],
};

export function AdminUsersPage() {
  const api = useAdminApi();
  const { user: me, refreshUser } = useAuth();
  const owner = isOwner(me?.role);

  const listQuery = useQuery(() => api.users.list(), []);
  const rows = listQuery.data ?? [];

  const [mode, setMode] = useState<EditorMode | null>(null);
  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [form, setForm] = useState<EditorForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const stats = useMemo(() => {
    const total = rows.length;
    const active = rows.filter((row) => row.isActive).length;
    const owners = rows.filter((row) => row.role === "OWNER").length;
    const admins = rows.filter((row) => row.role === "ADMIN").length;
    return { total, active, owners, admins };
  }, [rows]);

  const openCreate = useCallback(() => {
    setMode("create");
    setEditing(null);
    setForm(EMPTY_FORM);
  }, []);

  const openEdit = useCallback((row: AdminUser) => {
    const perms = row.permissions ?? [];
    setMode("edit");
    setEditing(row);
    setForm({
      email: row.email,
      name: row.name,
      role: row.role,
      password: "",
      isActive: row.isActive,
      fullAccess: perms.includes(FULL_ACCESS),
      permissions: perms.filter((p) => p !== FULL_ACCESS),
    });
  }, []);

  const openPassword = useCallback((row: AdminUser) => {
    setMode("password");
    setEditing(row);
    setForm({ ...EMPTY_FORM, password: "" });
  }, []);

  const closeEditor = useCallback(() => {
    setMode(null);
    setEditing(null);
    setForm(EMPTY_FORM);
    setSaving(false);
  }, []);

  function togglePermission(key: string) {
    setForm((prev) => {
      if (prev.permissions.includes(key)) {
        return { ...prev, permissions: prev.permissions.filter((p) => p !== key) };
      }
      return { ...prev, permissions: [...prev.permissions, key] };
    });
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!owner && editing?.role === "OWNER" && editing?.id !== me?.id) {
      toast.error("Only the owner can modify owner accounts");
      return;
    }

    setSaving(true);
    try {
      if (mode === "create") {
        if (form.password.length < 8) {
          toast.error("Password must be at least 8 characters");
          setSaving(false);
          return;
        }
        const created = await api.users.create({
          email: form.email.trim(),
          name: form.name.trim(),
          role: form.role,
          password: form.password,
          fullAccess: form.role === "OWNER" ? true : form.fullAccess,
          permissions: form.fullAccess || form.role === "OWNER" ? undefined : form.permissions,
        });
        listQuery.setData((current) => (current ? [...current, created] : [created]));
        toast.success("User created");
      } else if (mode === "edit" && editing) {
        const nextEmail = form.email.trim();
        if (!nextEmail) {
          toast.error("Email cannot be empty");
          setSaving(false);
          return;
        }
        const updated = await api.users.update(editing.id, {
          email: nextEmail,
          name: form.name.trim(),
          ...(owner
            ? {
                role: form.role,
                isActive: form.isActive,
                fullAccess: form.role === "OWNER" ? true : form.fullAccess,
                permissions: form.fullAccess || form.role === "OWNER" ? undefined : form.permissions,
              }
            : me?.role === "ADMIN" && editing.role !== "OWNER" && editing.id !== me?.id
              ? {
                  isActive: form.isActive,
                }
              : {}),
        });
        listQuery.setData((current) =>
          current ? current.map((row) => (row.id === updated.id ? { ...row, ...updated } : row)) : [updated],
        );
        if (editing.id === me?.id) {
          void refreshUser();
        }
        toast.success("User updated");
      } else if (mode === "password" && editing) {
        if (form.password.length < 8) {
          toast.error("Password must be at least 8 characters");
          setSaving(false);
          return;
        }
        await api.users.resetPassword(editing.id, form.password);
        toast.success("Password reset");
      }
      closeEditor();
    } catch (err) {
      toast.error(errorMessage(err, "Could not save user"));
      setSaving(false);
    }
  }

  async function deactivate(row: AdminUser) {
    if (!owner && me?.role !== "ADMIN") return;
    if (row.role === "OWNER") {
      toast.error("Only the owner can deactivate owner accounts");
      return;
    }
    if (row.id === me?.id) {
      toast.error("You cannot deactivate yourself");
      return;
    }
    if (!window.confirm(`Deactivate ${row.name}? Their sessions will end.`)) return;
    setBusyId(row.id);
    try {
      const updated = await api.users.remove(row.id);
      listQuery.setData((current) =>
        current ? current.map((item) => (item.id === updated.id ? { ...item, ...updated } : item)) : [updated],
      );
      toast.success("User deactivated");
    } catch (err) {
      toast.error(errorMessage(err, "Could not deactivate user"));
    } finally {
      setBusyId(null);
    }
  }

  async function revokeSessions(row: AdminUser) {
    if (!owner) return;
    if (!window.confirm(`Revoke all active sessions for ${row.name}? They will be forced to log in again.`)) return;
    setBusyId(row.id);
    try {
      await api.users.revokeSessions(row.id);
      toast.success(`Active sessions revoked for ${row.name}`);
    } catch (err) {
      toast.error(errorMessage(err, "Could not revoke sessions"));
    } finally {
      setBusyId(null);
    }
  }

  const showAccessControls = form.role === "ADMIN" || form.role === "STAFF";

  return (
    <div className="pa-users space-y-admin-stack">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-normal tracking-tight text-foreground sm:text-[2rem]">
            Users
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Desk accounts. Owner manages create, access, and password resets.
          </p>
        </div>
        {owner ? (
          <Button type="button" onClick={openCreate}>
            <UserPlus strokeWidth={1.5} />
            Add user
          </Button>
        ) : null}
      </header>

      {!owner ? (
        <p className="rounded-lg border border-border bg-card/50 px-3 py-2 text-sm text-muted-foreground">
          You have admin permissions to update staff details (name, email, and active status) and deactivate accounts. Only the owner can create users, assign roles, or manage desk permissions.
        </p>
      ) : null}

      <ErrorBanner message={listQuery.error} onRetry={() => void listQuery.refetch()} retrying={listQuery.fetching} />

      <section className="grid gap-admin-gap sm:grid-cols-2 xl:grid-cols-4" aria-label="User metrics">
        <StatCard label="Accounts" icon={Users} tone="primary" loading={listQuery.loading} value={stats.total} />
        <StatCard label="Active" icon={Users} loading={listQuery.loading} value={stats.active} />
        <StatCard label="Owners" icon={Users} loading={listQuery.loading} value={stats.owners} />
        <StatCard label="Admins" icon={Users} loading={listQuery.loading} value={stats.admins} />
      </section>

      {listQuery.loading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-14 w-full rounded-xl" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState icon={Users} title="No users" description="Create the first desk account." />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Access</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last login</TableHead>
                <TableHead className="w-12 text-right"> </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id} className={cn(!row.isActive && "opacity-70")}>
                  <TableCell>
                    <p className="text-sm text-foreground">{row.name}</p>
                    <p className="text-xs text-muted-foreground">{row.email}</p>
                  </TableCell>
                  <TableCell>
                    <RoleBadge role={row.role} />
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {accessSummary(row)}
                  </TableCell>
                  <TableCell>
                    <ActiveBadge active={row.isActive} />
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {row.lastLoginAt ? formatLagosDateTime(row.lastLoginAt) : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    {owner || (me?.role === "ADMIN" && row.role !== "OWNER") || row.id === me?.id ? (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            type="button"
                            size="icon-sm"
                            variant="ghost"
                            aria-label={`Actions for ${row.name}`}
                            disabled={busyId === row.id}
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEdit(row)}>Edit</DropdownMenuItem>
                          {owner ? (
                            <>
                              <DropdownMenuItem onClick={() => openPassword(row)}>
                                <KeyRound className="h-4 w-4" />
                                Reset password
                              </DropdownMenuItem>
                              {row.isActive ? (
                                <DropdownMenuItem onClick={() => void revokeSessions(row)}>
                                  <ShieldAlert className="h-4 w-4" />
                                  Revoke sessions
                                </DropdownMenuItem>
                              ) : null}
                            </>
                          ) : null}
                          {row.isActive && row.id !== me?.id && (owner || (me?.role === "ADMIN" && row.role !== "OWNER")) ? (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={() => void deactivate(row)}
                              >
                                <Trash2 className="h-4 w-4" />
                                Deactivate
                              </DropdownMenuItem>
                            </>
                          ) : null}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    ) : null}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={mode != null} onOpenChange={(open) => !open && closeEditor()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {mode === "create" ? "Add user" : mode === "password" ? "Reset password" : "Edit user"}
            </DialogTitle>
            <DialogDescription>
              {mode === "password"
                ? "Passwords must be unique across active desk users and at least 8 characters."
                : "Access is loaded from the database on every request — not from the login form."}
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-admin-stack-sm" onSubmit={(event) => void onSubmit(event)}>
            {mode === "password" ? (
              <div className="space-y-1.5">
                <Label htmlFor="user-password">New password</Label>
                <Input
                  id="user-password"
                  type="password"
                  autoComplete="new-password"
                  value={form.password}
                  onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
                  required
                  minLength={8}
                />
              </div>
            ) : (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="user-email">Email</Label>
                  <Input
                    id="user-email"
                    type="email"
                    value={form.email}
                    onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="user-name">Name</Label>
                  <Input
                    id="user-name"
                    value={form.name}
                    onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="user-role">Role</Label>
                  <Select
                    value={form.role}
                    onValueChange={(value) => setForm((prev) => ({ ...prev, role: value as Role }))}
                    disabled={!owner}
                  >
                    <SelectTrigger id="user-role">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="OWNER">Owner</SelectItem>
                      <SelectItem value="ADMIN">Admin</SelectItem>
                      <SelectItem value="STAFF">Staff</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {mode === "create" ? (
                  <div className="space-y-1.5">
                    <Label htmlFor="user-password-create">Password</Label>
                    <Input
                      id="user-password-create"
                      type="password"
                      autoComplete="new-password"
                      value={form.password}
                      onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
                      required
                      minLength={8}
                    />
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2">
                    <div>
                      <p className="text-sm text-foreground">Active</p>
                      <p className="text-xs text-muted-foreground">Inactive users cannot sign in.</p>
                    </div>
                    <Switch
                      checked={form.isActive}
                      onCheckedChange={(isActive) => setForm((prev) => ({ ...prev, isActive }))}
                      aria-label="Active"
                      disabled={editing?.id === me?.id || (!owner && editing?.role === "OWNER")}
                    />
                  </div>
                )}
                {showAccessControls && owner ? (
                  <>
                    <div className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2">
                      <div>
                        <p className="text-sm text-foreground">Full desk access</p>
                        <p className="text-xs text-muted-foreground">All areas (`*`). Overrides the checklist.</p>
                      </div>
                      <Switch
                        checked={form.fullAccess}
                        onCheckedChange={(fullAccess) => setForm((prev) => ({ ...prev, fullAccess }))}
                        aria-label="Full desk access"
                      />
                    </div>
                    {!form.fullAccess ? (
                      <fieldset className="space-y-2 rounded-lg border border-border p-3">
                        <legend className="px-1 text-sm text-foreground">Areas</legend>
                        <div className="grid gap-2 sm:grid-cols-2">
                          {DESK_PERMISSIONS.map((perm) => {
                            const checked = form.permissions.includes(perm.key);
                            return (
                              <label
                                key={perm.key}
                                className="flex cursor-pointer items-start gap-2 rounded-md border border-transparent px-2 py-1.5 hover:bg-muted/40"
                              >
                                <input
                                  type="checkbox"
                                  className="mt-1"
                                  checked={checked}
                                  onChange={() => togglePermission(perm.key)}
                                />
                                <span>
                                  <span className="block text-sm text-foreground">{perm.label}</span>
                                  <span className="block text-xs text-muted-foreground">{perm.hint}</span>
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      </fieldset>
                    ) : null}
                  </>
                ) : null}
              </>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeEditor} disabled={saving}>
                Cancel
              </Button>
              <Button type="submit" loading={saving}>
                {mode === "create" ? (
                  <>
                    <Plus className="h-4 w-4" />
                    Create
                  </>
                ) : (
                  "Save"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
