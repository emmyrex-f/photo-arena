import { FormEvent, useEffect, useMemo, useState } from "react";
import { KeyRound, Plus } from "lucide-react";
import { Navigate } from "react-router-dom";
import { Button } from "../../admin/components/ui/button";
import { Checkbox } from "../../admin/components/ui/checkbox";
import { ConfirmDialog } from "../../admin/components/ui/confirm-dialog";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../admin/components/ui/dialog";
import { EmptyState } from "../../admin/components/ui/empty-state";
import { ErrorBanner } from "../../admin/components/ui/error-banner";
import { FormField } from "../../admin/components/ui/form-field";
import { Input } from "../../admin/components/ui/input";
import { PageHeader } from "../../admin/components/ui/page-header";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../admin/components/ui/select";
import { Skeleton } from "../../admin/components/ui/skeleton";
import { ActiveBadge, RoleBadge } from "../../admin/components/ui/status-badge";
import { Switch } from "../../admin/components/ui/switch";
import { toast } from "../../admin/components/ui/toaster";
import { useAdminApi } from "../../admin/lib/adminApi";
import { formatLagosDateTime, formatRelative } from "../../admin/lib/format";
import {
  accessSummary,
  DESK_PERMISSIONS,
  FULL_ACCESS,
  type DeskPermission,
} from "../../admin/lib/permissions";
import type { AdminUser, Role } from "../../admin/lib/types";
import { ROLES } from "../../admin/lib/types";
import { useQuery } from "../../admin/lib/useQuery";
import { errorMessage } from "../../lib/api";
import { useAuth } from "../../lib/auth";

const ALL_KEYS = DESK_PERMISSIONS.map((item) => item.key);

export function AdminUsersPage() {
  const api = useAdminApi();
  const { user, hasPermission } = useAuth();
  const isOwner = user?.role === "OWNER";
    const canList = user?.role === "OWNER" || (user?.role === "ADMIN" && hasPermission("users"));
  const query = useQuery(() => api.users.list(), [], { enabled: !!canList });
  const [createOpen, setCreateOpen] = useState(false);
  const [edit, setEdit] = useState<AdminUser | null>(null);
  const [resetUser, setResetUser] = useState<AdminUser | null>(null);

  const ownerCount = useMemo(
    () => (query.data ?? []).filter((u) => u.role === "OWNER" && u.isActive).length,
    [query.data],
  );

  if (!canList) {
    return <Navigate to="/admin" replace />;
  }

  return (
    <div className="space-y-admin">
      <PageHeader
        title="Users"
        description="Desk staff accounts. Only the owner can create, edit, or delete logins."
        actions={
          isOwner ? (
            <Button onClick={() => setCreateOpen(true)}>
              <Plus />
              Add user
            </Button>
          ) : null
        }
      />
      <ErrorBanner message={query.error} onRetry={() => void query.refetch()} retrying={query.fetching} />

      {query.loading ? (
        Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)
      ) : !query.data?.length ? (
        <EmptyState title="No users" />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[820px] text-sm">
            <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-3">Name</th>
                <th className="px-3 py-3">Email</th>
                <th className="px-3 py-3">Role</th>
                <th className="px-3 py-3">Access</th>
                <th className="px-3 py-3">Last login</th>
                <th className="px-3 py-3">Status</th>
                <th className="px-3 py-3" />
              </tr>
            </thead>
            <tbody>
              {query.data.map((u) => {
                const isLastOwner = u.role === "OWNER" && u.isActive && ownerCount <= 1;
                return (
                  <tr key={u.id} className="border-t border-border">
                    <td className="px-3 py-3 font-medium">{u.name}</td>
                    <td className="px-3 py-3">{u.role === "OWNER" ? u.email : "Studio login"}</td>
                    <td className="px-3 py-3">
                      <RoleBadge role={u.role} />
                    </td>
                    <td className="px-3 py-3 text-muted-foreground">{accessSummary(u)}</td>
                    <td className="px-3 py-3 text-muted-foreground">
                      {u.lastLoginAt ? formatRelative(u.lastLoginAt) : "Never"}
                    </td>
                    <td className="px-3 py-3">
                      <ActiveBadge active={u.isActive} />
                    </td>
                    <td className="px-3 py-3 text-right">
                      {isOwner ? (
                        <div className="flex justify-end gap-1">
                          <Button size="sm" variant="outline" onClick={() => setEdit(u)}>
                            Edit
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setResetUser(u)}>
                            <KeyRound />
                          </Button>
                          {u.role === "OWNER" && !isLastOwner && u.id !== user?.id ? (
                            <ConfirmDialog
                              title="Deactivate owner?"
                              description={`${u.name} will no longer be able to sign in. Owner accounts cannot be deleted.`}
                              confirmLabel="Deactivate"
                              destructive
                              successMessage="User deactivated"
                              onConfirm={async () => {
                                await api.users.update(u.id, { isActive: false });
                                await query.refetch();
                              }}
                              trigger={
                                <Button size="sm" variant="ghost" className="text-destructive">
                                  Deactivate
                                </Button>
                              }
                            />
                          ) : null}
                          {u.role !== "OWNER" && u.id !== user?.id ? (
                            <ConfirmDialog
                              title="Delete this login permanently?"
                              description={`${u.name} will be removed completely. They cannot sign in with that password again.`}
                              confirmLabel="Delete account"
                              destructive
                              successMessage="Account deleted"
                              onConfirm={async () => {
                                await api.users.remove(u.id);
                                await query.refetch();
                              }}
                              trigger={
                                <Button size="sm" variant="ghost" className="text-destructive">
                                  Delete
                                </Button>
                              }
                            />
                          ) : null}
                        </div>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <CreateUserDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={async () => {
          setCreateOpen(false);
          await query.refetch();
        }}
      />
      <EditUserDialog
        user={edit}
        protectOwner={!!edit && edit.role === "OWNER" && ownerCount <= 1}
        onOpenChange={(open) => !open && setEdit(null)}
        onSaved={async () => {
          setEdit(null);
          await query.refetch();
        }}
      />
      <ResetPasswordDialog
        user={resetUser}
        onOpenChange={(open) => !open && setResetUser(null)}
        onDone={() => setResetUser(null)}
      />
    </div>
  );
}

function AccessPicker({
  fullAccess,
  permissions,
  onFullAccess,
  onToggle,
}: {
  fullAccess: boolean;
  permissions: string[];
  onFullAccess: (value: boolean) => void;
  onToggle: (key: DeskPermission, checked: boolean) => void;
}) {
  return (
    <div className="space-y-3 rounded-lg border border-border bg-muted/20 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium">Portal access</p>
          <p className="text-xs text-muted-foreground">
            Full access opens every desk area. Turn it off to choose specific pages.
          </p>
        </div>
        <Switch
          checked={fullAccess}
          onCheckedChange={onFullAccess}
          aria-label="Full access"
        />
      </div>
      {!fullAccess ? (
        <div className="grid gap-2 sm:grid-cols-2">
          {DESK_PERMISSIONS.map((item) => {
            const checked = permissions.includes(item.key);
            return (
              <label
                key={item.key}
                className="flex cursor-pointer items-start gap-2 rounded-md border border-transparent px-1 py-1.5 hover:bg-background"
              >
                <Checkbox
                  checked={checked}
                  onCheckedChange={(value) => onToggle(item.key, value === true)}
                  className="mt-0.5"
                />
                <span>
                  <span className="block text-sm leading-tight">{item.label}</span>
                  <span className="block text-[11px] text-muted-foreground">{item.hint}</span>
                </span>
              </label>
            );
          })}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">This admin can open every area of the desk.</p>
      )}
    </div>
  );
}

function CreateUserDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => Promise<void>;
}) {
  const api = useAdminApi();
  const [name, setName] = useState("");
  const [role, setRole] = useState<Role>("ADMIN");
  const [password, setPassword] = useState("");
  const [fullAccess, setFullAccess] = useState(true);
  const [permissions, setPermissions] = useState<string[]>(ALL_KEYS);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName("");
    setPassword("");
    setRole("ADMIN");
    setFullAccess(true);
    setPermissions(ALL_KEYS);
  }, [open]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    try {
      await api.users.create({
        name,
        role,
        password,
        ...(role === "ADMIN" ? { fullAccess, permissions: fullAccess ? [FULL_ACCESS] : permissions } : {}),
      });
      toast.success("User created");
      await onCreated();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Add user</DialogTitle>
        </DialogHeader>
        <form className="space-y-4" onSubmit={onSubmit}>
          <FormField label="Name" required>
            {(c) => <Input id={c.id} value={name} onChange={(e) => setName(e.target.value)} required />}
          </FormField>
          <FormField label="Role">
            {(c) => (
              <Select
                value={role}
                onValueChange={(v) => {
                  const next = v as Role;
                  setRole(next);
                  if (next === "ADMIN") {
                    setFullAccess(true);
                    setPermissions(ALL_KEYS);
                  }
                }}
              >
                <SelectTrigger id={c.id}><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => (
                    <SelectItem key={r} value={r}>{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </FormField>
          {role === "ADMIN" ? (
            <AccessPicker
              fullAccess={fullAccess}
              permissions={permissions}
              onFullAccess={(value) => {
                setFullAccess(value);
                if (!value) setPermissions(ALL_KEYS);
              }}
              onToggle={(key, checked) => {
                setPermissions((current) =>
                  checked ? [...current.filter((item) => item !== key), key] : current.filter((item) => item !== key),
                );
              }}
            />
          ) : null}
          <FormField label="Temporary password" required hint="Must be unique. They sign in with the studio email and this password.">
            {(c) => (
              <Input id={c.id} type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
            )}
          </FormField>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" loading={pending}>Create</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditUserDialog({
  user,
  protectOwner,
  onOpenChange,
  onSaved,
}: {
  user: AdminUser | null;
  protectOwner: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => Promise<void>;
}) {
  const api = useAdminApi();
  const [name, setName] = useState("");
  const [role, setRole] = useState<Role>("STAFF");
  const [isActive, setIsActive] = useState(true);
  const [fullAccess, setFullAccess] = useState(true);
  const [permissions, setPermissions] = useState<string[]>(ALL_KEYS);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!user) return;
    setName(user.name);
    setRole(user.role);
    setIsActive(user.isActive);
    const perms = user.permissions ?? [];
    const isFull = user.role !== "ADMIN" || perms.includes(FULL_ACCESS);
    setFullAccess(isFull);
    setPermissions(isFull ? ALL_KEYS : perms.filter((item) => ALL_KEYS.includes(item as DeskPermission)));
  }, [user]);

  return (
    <Dialog open={!!user} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Edit {user?.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <FormField label="Name">
            {(c) => <Input id={c.id} value={name} onChange={(e) => setName(e.target.value)} />}
          </FormField>
          <FormField label="Role">
            {(c) => (
              <Select
                value={role}
                onValueChange={(v) => {
                  const next = v as Role;
                  setRole(next);
                  if (next === "ADMIN") {
                    setFullAccess(true);
                    setPermissions(ALL_KEYS);
                  }
                }}
                disabled={protectOwner}
              >
                <SelectTrigger id={c.id}><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => (
                    <SelectItem key={r} value={r}>{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </FormField>
          {role === "ADMIN" ? (
            <AccessPicker
              fullAccess={fullAccess}
              permissions={permissions}
              onFullAccess={(value) => {
                setFullAccess(value);
                if (!value) setPermissions(ALL_KEYS);
              }}
              onToggle={(key, checked) => {
                setPermissions((current) =>
                  checked ? [...current.filter((item) => item !== key), key] : current.filter((item) => item !== key),
                );
              }}
            />
          ) : null}
          <FormField label="Active" inline hint={protectOwner ? "Cannot deactivate the last owner." : undefined}>
            {() => (
              <Switch
                checked={isActive}
                onCheckedChange={setIsActive}
                disabled={protectOwner && isActive}
              />
            )}
          </FormField>
          {user ? (
            <p className="text-xs text-muted-foreground">Joined {formatLagosDateTime(user.createdAt)}</p>
          ) : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            loading={pending}
            onClick={() => {
              if (!user) return;
              setPending(true);
              void api.users
                .update(user.id, {
                  name,
                  role,
                  isActive,
                  ...(role === "ADMIN"
                    ? { fullAccess, permissions: fullAccess ? [FULL_ACCESS] : permissions }
                    : { fullAccess: false, permissions: [] }),
                })
                .then(() => {
                  toast.success("User updated");
                  return onSaved();
                })
                .catch((err) => toast.error(errorMessage(err)))
                .finally(() => setPending(false));
            }}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ResetPasswordDialog({
  user,
  onOpenChange,
  onDone,
}: {
  user: AdminUser | null;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
}) {
  const api = useAdminApi();
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);

  return (
    <Dialog open={!!user} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reset password · {user?.name}</DialogTitle>
        </DialogHeader>
        <FormField label="New password">
          {(c) => (
            <Input id={c.id} type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} />
          )}
        </FormField>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            loading={pending}
            disabled={password.length < 8}
            onClick={() => {
              if (!user) return;
              setPending(true);
              void api.users
                .resetPassword(user.id, password)
                .then(() => {
                  toast.success("Password reset");
                  setPassword("");
                  onDone();
                })
                .catch((err) => toast.error(errorMessage(err)))
                .finally(() => setPending(false));
            }}
          >
            Reset
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
