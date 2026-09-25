import { FormEvent, useEffect, useState } from "react";
import { Button } from "../../admin/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../admin/components/ui/dialog";
import { Input } from "../../admin/components/ui/input";
import { Label } from "../../admin/components/ui/label";
import { toast } from "../../admin/components/ui/toaster";
import { useAdminApi } from "../../admin/lib/adminApi";
import { useAuth } from "../../lib/auth";
import { errorMessage } from "../../lib/api";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function EditProfileDialog({ open, onOpenChange }: Props) {
  const api = useAdminApi();
  const { user, applyAccount } = useAuth();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (open && user) {
      setName(user.name ?? "");
      setEmail(user.email ?? "");
      setCurrentPassword("");
    }
  }, [open, user]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmedName = name.trim();
    const trimmedEmail = email.trim().toLowerCase();

    if (!trimmedName) {
      toast.error("Name is required");
      return;
    }
    if (!trimmedEmail) {
      toast.error("Email address is required");
      return;
    }
    if (!currentPassword) {
      toast.error("Please enter your current password to save changes");
      return;
    }

    if (trimmedName === user?.name && trimmedEmail === user?.email) {
      toast.info("No changes to update");
      onOpenChange(false);
      return;
    }

    setPending(true);
    try {
      const res = await api.auth.updateAccount({
        name: trimmedName,
        email: trimmedEmail,
        currentPassword,
      });

      applyAccount(res.user, res.token);
      toast.success("Profile updated successfully");
      setCurrentPassword("");
      onOpenChange(false);
    } catch (err) {
      toast.error(errorMessage(err, "Could not update profile"));
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit profile</DialogTitle>
          <DialogDescription>
            Update your desk account details. Your current password is required to verify changes.
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={onSubmit}>
          <div className="space-y-2">
            <Label htmlFor="profile-name">Full name</Label>
            <Input
              id="profile-name"
              type="text"
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="profile-email">Email address</Label>
            <Input
              id="profile-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="profile-current-password">Current password</Label>
            <Input
              id="profile-current-password"
              type="password"
              autoComplete="current-password"
              placeholder="Confirm your current password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button type="submit" loading={pending}>
              Save changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
