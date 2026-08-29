"use client";

import React, { useState, useEffect, useTransition } from "react";
import {
  getUsers,
  updateUserRoleAndLinks,
  createFieldEngineer,
  getRegistrationCodes,
  createRegistrationCode,
  deleteRegistrationCode,
  adminSetUserPasswordAction,
} from "@/app/actions";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { RotateCw, KeyRound, UserCheck, Loader2 } from "lucide-react";

interface User {
  id: string;
  email: string;
  name: string | null;
  avatarUrl?: string | null;
  role: "SUPERADMIN" | "MODERATOR" | "AGENT" | "FIELD_ENGINEER";
  partnerId: number | null;
  engineerId: number | null;
  partner?: { id: number; name: string } | null;
  engineer?: { id: number; name: string } | null;
  createdAt: Date | string;
}

interface UserManagementTabProps {
  partners: Array<{
    id: number;
    name: string;
    engineers?: Array<{
      id: number;
      name: string;
    }>;
  }>;
}

export default function UserManagementTab({ partners }: UserManagementTabProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [isPending, startTransition] = useTransition();

  const [role, setRole] = useState<User["role"]>("FIELD_ENGINEER");
  const [partnerId, setPartnerId] = useState<string>("");
  const [engineerId, setEngineerId] = useState<string>("");

  // Registration codes states
  const [registrationCodes, setRegistrationCodes] = useState<any[]>([]);
  const [loadingCodes, setLoadingCodes] = useState(true);
  const [newPartnerId, setNewPartnerId] = useState("");
  const [newRole, setNewRole] = useState<"AGENT" | "FIELD_ENGINEER">("FIELD_ENGINEER");
  const [newMaxUses, setNewMaxUses] = useState("1");

  // Link method and creation states for Field Engineer
  const [linkMethod, setLinkMethod] = useState<"existing" | "create">("existing");
  const [newFeName, setNewFeName] = useState("");
  const [newFePhone, setNewFePhone] = useState("");
  const [newFePartnerId, setNewFePartnerId] = useState("");

  // Set Password State for Superadmin
  const [settingPasswordUser, setSettingPasswordUser] = useState<User | null>(null);
  const [newPasswordInput, setNewPasswordInput] = useState("");
  const [isSettingPassword, setIsSettingPassword] = useState(false);

  const fetchCodes = async () => {
    try {
      setLoadingCodes(true);
      const data = await getRegistrationCodes();
      setRegistrationCodes(data);
    } catch (err) {
      console.error("Failed to fetch registration codes:", err);
    } finally {
      setLoadingCodes(false);
    }
  };

  const handleGenerateCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPartnerId) {
      toast.error("Please select a Service Partner.");
      return;
    }
    startTransition(async () => {
      try {
        await createRegistrationCode({
          partnerId: Number(newPartnerId),
          role: newRole,
          maxUses: newMaxUses ? Number(newMaxUses) : 1,
        });
        setNewPartnerId("");
        setNewMaxUses("1");
        await fetchCodes();
        toast.success("Invitation code generated successfully!");
      } catch (err: any) {
        toast.error(err.message || "Failed to generate code.");
      }
    });
  };

  const handleDeleteCode = async (codeId: number) => {
    if (!confirm("Are you sure you want to revoke this invitation code?")) return;
    startTransition(async () => {
      try {
        await deleteRegistrationCode(codeId);
        await fetchCodes();
        toast.success("Invitation code revoked successfully.");
      } catch (err: any) {
        toast.error(err.message || "Failed to delete code.");
      }
    });
  };

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const data = await getUsers();
      setUsers(data as unknown as User[]);
    } catch (err: any) {
      toast.error("Failed to load users: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchCodes();
  }, []);

  const handleSaveUserPassword = async () => {
    if (!settingPasswordUser) return;
    if (newPasswordInput.length < 6) {
      toast.error("Password must be at least 6 characters.");
      return;
    }
    setIsSettingPassword(true);
    try {
      const res = await adminSetUserPasswordAction(settingPasswordUser.id, newPasswordInput);
      if (res.success) {
        toast.success(`Password updated successfully for ${settingPasswordUser.name || settingPasswordUser.email}`);
        setSettingPasswordUser(null);
        setNewPasswordInput("");
      } else {
        throw new Error(res.error);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to update password.");
    } finally {
      setIsSettingPassword(false);
    }
  };

  const openEditModal = (user: User) => {
    setEditingUser(user);
    setRole(user.role);
    setPartnerId(user.partnerId ? String(user.partnerId) : "");
    setEngineerId(user.engineerId ? String(user.engineerId) : "");
    setLinkMethod("existing");
    setNewFeName(user.name || "");
    setNewFePhone("");
    setNewFePartnerId("");
  };

  const handleSave = async () => {
    if (!editingUser) return;

    startTransition(async () => {
      try {
        let finalEngineerId = role === "FIELD_ENGINEER" && engineerId ? Number(engineerId) : null;

        if (role === "FIELD_ENGINEER" && linkMethod === "create") {
          if (!newFePartnerId) {
            throw new Error("Please select a Service Partner Agency.");
          }
          if (!newFeName.trim()) {
            throw new Error("Please enter the Field Engineer name.");
          }
          if (!newFePhone.trim()) {
            throw new Error("Please enter a phone number.");
          }

          const fe = await createFieldEngineer({
            name: newFeName,
            phone: newFePhone,
            partnerId: Number(newFePartnerId),
            email: editingUser.email,
          });
          
          finalEngineerId = fe.id;
        }

        await updateUserRoleAndLinks(editingUser.id, {
          role,
          partnerId: role === "AGENT" && partnerId ? Number(partnerId) : null,
          engineerId: finalEngineerId,
        });
        await fetchUsers();
        setEditingUser(null);
        toast.success("User access & profile updated successfully!");
      } catch (err: any) {
        toast.error(err.message || "Failed to update user");
      }
    });
  };

  const allEngineers = partners.flatMap((p) =>
    (p.engineers || []).map((e) => ({
      ...e,
      partnerName: p.name,
    }))
  );

  const getRoleBadge = (userRole: User["role"]) => {
    switch (userRole) {
      case "SUPERADMIN":
        return <Badge variant="destructive">SUPERADMIN</Badge>;
      case "MODERATOR":
        return <Badge className="bg-purple-600 hover:bg-purple-700 text-white">MODERATOR</Badge>;
      case "AGENT":
        return <Badge className="bg-indigo-600 hover:bg-indigo-700 text-white">AGENT</Badge>;
      default:
        return <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white">FIELD ENGINEER</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* User Accounts Directory */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-4">
          <div>
            <CardTitle className="text-lg">User Management</CardTitle>
            <CardDescription className="text-xs">
              Manage employee/partner credentials, assign access levels, and map user log-ins to operational profiles.
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={fetchUsers}
            title="Reload Users"
            className="h-8 w-8"
          >
            <RotateCw className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center items-center py-12">
              <Loader2 className="h-7 w-7 text-primary animate-spin" />
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User Details</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Linkage Status</TableHead>
                    <TableHead>Joined Date</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((u) => {
                    let linkage = "None";
                    if (u.role === "AGENT" && u.partner) {
                      linkage = `Partner Agent: ${u.partner.name}`;
                    } else if (u.role === "FIELD_ENGINEER" && u.engineer) {
                      linkage = `Field Engineer: ${u.engineer.name}`;
                    }

                    return (
                      <TableRow key={u.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            {u.avatarUrl ? (
                              <img
                                src={u.avatarUrl}
                                alt={u.name || ""}
                                className="w-8 h-8 rounded-full object-cover border shadow-sm flex-shrink-0"
                              />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-muted text-muted-foreground flex items-center justify-center font-bold text-xs border shadow-sm flex-shrink-0">
                                {(u.name || u.email).charAt(0).toUpperCase()}
                              </div>
                            )}
                            <div>
                              <div className="font-semibold text-foreground leading-tight">{u.name || "N/A"}</div>
                              <div className="text-xs text-muted-foreground">{u.email}</div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>{getRoleBadge(u.role)}</TableCell>
                        <TableCell className="text-xs font-medium">
                          {linkage !== "None" ? (
                            <span className="text-foreground">{linkage}</span>
                          ) : (
                            <span className="text-muted-foreground italic">Unlinked</span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {new Date(u.createdAt).toLocaleDateString("en-MY", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSettingPasswordUser(u);
                                setNewPasswordInput("");
                              }}
                              className="text-xs font-medium text-muted-foreground hover:text-foreground"
                            >
                              <KeyRound className="h-3.5 w-3.5 mr-1" />
                              Set Password
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openEditModal(u)}
                              className="text-xs font-semibold text-primary hover:text-primary/80"
                            >
                              Edit Role/Link
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Registration/Invitation Codes Panel */}
      <Card>
        <CardHeader className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-4 border-b">
          <div>
            <div className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">Invitation Codes</CardTitle>
            </div>
            <CardDescription className="text-xs mt-1">
              Create and manage codes that newly registering Field Engineers or Agents can use to automatically link to their agency.
            </CardDescription>
          </div>

          <form onSubmit={handleGenerateCode} className="flex flex-wrap items-end gap-3 bg-muted/40 p-3 rounded-lg border">
            <div className="space-y-1">
              <Label className="text-[10px] font-bold text-muted-foreground uppercase">Service Partner *</Label>
              <select
                required
                value={newPartnerId}
                onChange={(e) => setNewPartnerId(e.target.value)}
                className="h-8 px-2.5 rounded-md bg-background border text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="">-- Select Partner --</option>
                {partners.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <Label className="text-[10px] font-bold text-muted-foreground uppercase">Target Role *</Label>
              <select
                value={newRole}
                onChange={(e) => setNewRole(e.target.value as "AGENT" | "FIELD_ENGINEER")}
                className="h-8 px-2.5 rounded-md bg-background border text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="FIELD_ENGINEER">Field Engineer</option>
                <option value="AGENT">Partner Agent</option>
              </select>
            </div>

            <div className="space-y-1">
              <Label className="text-[10px] font-bold text-muted-foreground uppercase">Max Uses</Label>
              <Input
                type="number"
                min="1"
                required
                value={newMaxUses}
                onChange={(e) => setNewMaxUses(e.target.value)}
                className="w-20 h-8 text-xs font-semibold"
              />
            </div>

            <Button
              type="submit"
              size="sm"
              disabled={isPending}
              className="h-8 text-xs font-semibold"
            >
              {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Generate Code"}
            </Button>
          </form>
        </CardHeader>

        <CardContent className="pt-4">
          {loadingCodes ? (
            <div className="flex justify-center items-center py-8">
              <Loader2 className="h-6 w-6 text-primary animate-spin" />
            </div>
          ) : registrationCodes.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-6">No invitation codes generated yet.</p>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invitation Code</TableHead>
                    <TableHead>Partner Agency</TableHead>
                    <TableHead>Target Role</TableHead>
                    <TableHead>Usage Status</TableHead>
                    <TableHead>Created At</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {registrationCodes.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-mono font-bold text-primary select-all">
                        {c.code}
                      </TableCell>
                      <TableCell className="font-medium">{c.partner?.name || "Unknown"}</TableCell>
                      <TableCell>
                        <Badge variant={c.role === "AGENT" ? "secondary" : "default"}>
                          {c.role === "AGENT" ? "AGENT" : "FE ENGINEER"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs font-medium">
                        {c.uses} / {c.maxUses} uses
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(c.createdAt).toLocaleDateString("en-MY", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteCode(c.id)}
                          disabled={isPending}
                          className="text-xs font-semibold text-destructive hover:text-destructive hover:bg-destructive/10"
                        >
                          Revoke
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Role Dialog */}
      <Dialog open={!!editingUser} onOpenChange={(open) => !open && setEditingUser(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCheck className="h-5 w-5 text-primary" /> Modify User Access
            </DialogTitle>
            <DialogDescription className="text-xs">
              Assign roles, link partner accounts, or generate engineer dispatch profiles.
            </DialogDescription>
          </DialogHeader>

          {editingUser && (
            <div className="space-y-4 py-2 text-xs">
              <div className="p-3 bg-muted/40 rounded-lg border space-y-1">
                <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider block">Target Account</span>
                <span className="font-bold text-sm text-foreground block">{editingUser.name || "N/A"}</span>
                <span className="text-muted-foreground block">{editingUser.email}</span>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold uppercase text-muted-foreground">Access Role</Label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as User["role"])}
                  className="w-full h-9 px-3 rounded-md bg-background border text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="SUPERADMIN">Superadmin (Full CRUD + User Admin)</option>
                  <option value="MODERATOR">Moderator (Dispatch + General CRUD)</option>
                  <option value="AGENT">Agent (Service Partner Agent)</option>
                  <option value="FIELD_ENGINEER">Field Engineer (Mobile Portal)</option>
                </select>
              </div>

              {role === "AGENT" && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold uppercase text-muted-foreground">Link to Service Partner</Label>
                  <select
                    value={partnerId}
                    onChange={(e) => setPartnerId(e.target.value)}
                    required
                    className="w-full h-9 px-3 rounded-md bg-background border text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="">-- Select Partner --</option>
                    {partners.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {role === "FIELD_ENGINEER" && (
                <div className="space-y-3 pt-2 border-t">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold uppercase text-muted-foreground">Link Method</Label>
                    <div className="flex gap-4 text-xs mt-1">
                      <label className="flex items-center gap-2 cursor-pointer font-medium">
                        <input
                          type="radio"
                          name="linkMethod"
                          checked={linkMethod === "existing"}
                          onChange={() => setLinkMethod("existing")}
                          className="accent-primary"
                        />
                        Link Existing Profile
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer font-medium">
                        <input
                          type="radio"
                          name="linkMethod"
                          checked={linkMethod === "create"}
                          onChange={() => setLinkMethod("create")}
                          className="accent-primary"
                        />
                        Create New Profile & Link
                      </label>
                    </div>
                  </div>

                  {linkMethod === "existing" ? (
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold uppercase text-muted-foreground">Select Existing Profile</Label>
                      <select
                        value={engineerId}
                        onChange={(e) => setEngineerId(e.target.value)}
                        required={linkMethod === "existing"}
                        className="w-full h-9 px-3 rounded-md bg-background border text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                      >
                        <option value="">-- Select Engineer --</option>
                        {allEngineers.map((e) => (
                          <option key={e.id} value={e.id}>
                            {e.name} ({e.partnerName})
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <div className="space-y-2.5 bg-muted/40 p-3 rounded-lg border">
                      <div className="space-y-1">
                        <Label className="text-[10px] text-muted-foreground font-bold uppercase">Service Partner Agency *</Label>
                        <select
                          value={newFePartnerId}
                          onChange={(e) => setNewFePartnerId(e.target.value)}
                          required={linkMethod === "create"}
                          className="w-full h-8 px-2 rounded-md bg-background border text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                        >
                          <option value="">-- Select Partner Agency --</option>
                          {partners.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-1">
                        <Label className="text-[10px] text-muted-foreground font-bold uppercase">Engineer Name *</Label>
                        <Input
                          type="text"
                          value={newFeName}
                          onChange={(e) => setNewFeName(e.target.value)}
                          required={linkMethod === "create"}
                          placeholder="Full Name"
                          className="h-8 text-xs font-medium"
                        />
                      </div>

                      <div className="space-y-1">
                        <Label className="text-[10px] text-muted-foreground font-bold uppercase">Phone Number *</Label>
                        <Input
                          type="text"
                          value={newFePhone}
                          onChange={(e) => setNewFePhone(e.target.value)}
                          required={linkMethod === "create"}
                          placeholder="e.g. +60 12-345 6789"
                          className="h-8 text-xs font-medium"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEditingUser(null)}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={isPending}
              className="text-xs font-bold"
            >
              {isPending ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Admin Set Password Dialog */}
      <Dialog
        open={Boolean(settingPasswordUser)}
        onOpenChange={(open) => {
          if (!open) {
            setSettingPasswordUser(null);
            setNewPasswordInput("");
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-primary" />
              Set Password for User
            </DialogTitle>
            <DialogDescription className="text-xs">
              Assign or reset the password for <strong>{settingPasswordUser?.name || settingPasswordUser?.email}</strong> ({settingPasswordUser?.email}).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="adminNewPass">New Password (Min. 6 Characters)</Label>
              <Input
                id="adminNewPass"
                type="password"
                placeholder="Enter new password"
                value={newPasswordInput}
                onChange={(e) => setNewPasswordInput(e.target.value)}
                disabled={isSettingPassword}
              />
            </div>
            <p className="text-[11px] text-muted-foreground">
              The user will be able to log in immediately with this new password.
            </p>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSettingPasswordUser(null);
                setNewPasswordInput("");
              }}
              disabled={isSettingPassword}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSaveUserPassword}
              disabled={isSettingPassword || newPasswordInput.length < 6}
            >
              {isSettingPassword ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                  Saving...
                </>
              ) : (
                "Update Password"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
