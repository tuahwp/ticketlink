"use client";

import React, { useState, useEffect, useTransition, useMemo } from "react";
import {
  getUsers,
  updateUserRoleAndLinks,
  createFieldEngineer,
  getRegistrationCodes,
  createRegistrationCode,
  deleteRegistrationCode,
  adminSetUserPasswordAction,
  toggleUserStatusAction,
  deleteUserAction,
  adminQuickLinkUserAction,
  adminMarkUserVerifiedAction,
  resendVerificationOtpAction,
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import {
  RotateCw,
  KeyRound,
  UserCheck,
  Loader2,
  Trash2,
  Power,
  Link2,
  CheckCircle2,
  AlertCircle,
  Mail,
  Search,
  MoreVertical,
  Plus,
  ShieldCheck,
  UserX,
  Users,
  Copy,
  Check,
  Sparkles,
  Wrench,
  Shield,
  Building2,
} from "lucide-react";

interface User {
  id: string;
  email: string;
  name: string | null;
  avatarUrl?: string | null;
  role: "SUPERADMIN" | "MODERATOR" | "AGENT" | "FIELD_ENGINEER";
  isActive: boolean;
  isEmailVerified: boolean;
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
  initialUsers?: User[];
  initialCodes?: any[];
}

export default function UserManagementTab({ partners, initialUsers, initialCodes }: UserManagementTabProps) {
  const [users, setUsers] = useState<User[]>(initialUsers || []);
  const [loading, setLoading] = useState(!initialUsers);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [isPending, startTransition] = useTransition();

  // Search and Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "DISABLED" | "UNLINKED" | "UNVERIFIED" | "SUPERADMIN" | "AGENT" | "FIELD_ENGINEER">("ALL");

  // Edit Role / Link Modal states
  const [role, setRole] = useState<User["role"]>("FIELD_ENGINEER");
  const [partnerId, setPartnerId] = useState<string>("");
  const [engineerId, setEngineerId] = useState<string>("");
  const [linkMethod, setLinkMethod] = useState<"existing" | "create">("existing");
  const [newFeName, setNewFeName] = useState("");
  const [newFePhone, setNewFePhone] = useState("");
  const [newFePartnerId, setNewFePartnerId] = useState("");

  // Quick Link & Repair Modal State
  const [quickLinkUser, setQuickLinkUser] = useState<User | null>(null);
  const [quickPartnerId, setQuickPartnerId] = useState("");
  const [quickAutoCreateFe, setQuickAutoCreateFe] = useState(true);
  const [quickFePhone, setQuickFePhone] = useState("");
  const [quickFeName, setQuickFeName] = useState("");

  // Delete User Confirmation State
  const [deletingUser, setDeletingUser] = useState<User | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Set Password State for Superadmin
  const [settingPasswordUser, setSettingPasswordUser] = useState<User | null>(null);
  const [newPasswordInput, setNewPasswordInput] = useState("");
  const [isSettingPassword, setIsSettingPassword] = useState(false);

  // Registration codes states
  const [registrationCodes, setRegistrationCodes] = useState<any[]>(initialCodes || []);
  const [loadingCodes, setLoadingCodes] = useState(!initialCodes);
  const [showGenerateCodeModal, setShowGenerateCodeModal] = useState(false);
  const [newPartnerId, setNewPartnerId] = useState("");
  const [newRole, setNewRole] = useState<"AGENT" | "FIELD_ENGINEER">("FIELD_ENGINEER");
  const [newMaxUses, setNewMaxUses] = useState("5");
  const [copiedCodeId, setCopiedCodeId] = useState<number | null>(null);

  const fetchCodes = async () => {
    try {
      setLoadingCodes(true);
      const data = await getRegistrationCodes();
      if (Array.isArray(data)) {
        setRegistrationCodes(data);
      }
    } catch (err: any) {
      if (err?.message && (err.message.includes("Server Action") || err.message.includes("deployment"))) {
        if (typeof window !== "undefined") {
          window.location.reload();
          return;
        }
      }
      console.error("Failed to fetch registration codes:", err);
    } finally {
      setLoadingCodes(false);
    }
  };

  const handleGenerateCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPartnerId) {
      toast.error("Please select a Service Partner Agency.");
      return;
    }
    startTransition(async () => {
      try {
        await createRegistrationCode({
          partnerId: Number(newPartnerId),
          role: newRole,
          maxUses: newMaxUses ? Number(newMaxUses) : 1,
        });
        setShowGenerateCodeModal(false);
        setNewPartnerId("");
        setNewMaxUses("5");
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

  const handleCopyLink = (code: string, codeId: number) => {
    const origin = window.location.origin;
    const inviteUrl = `${origin}/login?code=${encodeURIComponent(code)}&mode=signup`;
    navigator.clipboard.writeText(inviteUrl)
      .then(() => {
        setCopiedCodeId(codeId);
        toast.success("Registration link copied to clipboard!");
        setTimeout(() => setCopiedCodeId(null), 3000);
      })
      .catch(() => {
        toast.info(`Registration link: ${inviteUrl}`);
      });
  };

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const data = await getUsers();
      if (Array.isArray(data)) {
        setUsers(data as unknown as User[]);
      }
    } catch (err: any) {
      if (err?.message && (err.message.includes("Server Action") || err.message.includes("deployment"))) {
        if (typeof window !== "undefined") {
          window.location.reload();
          return;
        }
      }
      toast.error("Failed to load users: " + (err.message || "Unknown error"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!initialUsers || initialUsers.length === 0) {
      fetchUsers();
    }
    if (!initialCodes || initialCodes.length === 0) {
      fetchCodes();
    }
  }, []);

  // Filtered users calculation
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      // Search
      const search = searchQuery.toLowerCase().trim();
      if (search) {
        const matchName = u.name?.toLowerCase().includes(search);
        const matchEmail = u.email.toLowerCase().includes(search);
        const matchPartner = u.partner?.name.toLowerCase().includes(search);
        const matchEngineer = u.engineer?.name.toLowerCase().includes(search);
        if (!matchName && !matchEmail && !matchPartner && !matchEngineer) {
          return false;
        }
      }

      // Status filter
      if (statusFilter === "ACTIVE") return u.isActive;
      if (statusFilter === "DISABLED") return !u.isActive;
      if (statusFilter === "UNVERIFIED") return !u.isEmailVerified;
      if (statusFilter === "UNLINKED") {
        if (u.role === "FIELD_ENGINEER" && !u.engineer) return true;
        if (u.role === "AGENT" && !u.partner) return true;
        return false;
      }
      if (statusFilter === "SUPERADMIN") return u.role === "SUPERADMIN";
      if (statusFilter === "AGENT") return u.role === "AGENT";
      if (statusFilter === "FIELD_ENGINEER") return u.role === "FIELD_ENGINEER";

      return true;
    });
  }, [users, searchQuery, statusFilter]);

  const handleToggleStatus = async (user: User) => {
    const newStatus = !user.isActive;
    const actionName = newStatus ? "activate" : "deactivate";
    if (!confirm(`Are you sure you want to ${actionName} ${user.name || user.email}? ${!newStatus ? "They will be immediately blocked from logging in." : ""}`)) {
      return;
    }

    startTransition(async () => {
      try {
        await toggleUserStatusAction(user.id, newStatus);
        await fetchUsers();
        toast.success(`User ${user.name || user.email} ${newStatus ? "activated" : "deactivated"} successfully.`);
      } catch (err: any) {
        toast.error(err.message || "Failed to update user status.");
      }
    });
  };

  const handleConfirmDeleteUser = async () => {
    if (!deletingUser) return;
    setIsDeleting(true);
    try {
      await deleteUserAction(deletingUser.id);
      await fetchUsers();
      toast.success(`Account for ${deletingUser.name || deletingUser.email} has been permanently deleted.`);
      setDeletingUser(null);
    } catch (err: any) {
      toast.error(err.message || "Failed to delete user account.");
    } finally {
      setIsDeleting(false);
    }
  };

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

  const openQuickLinkModal = (user: User) => {
    setQuickLinkUser(user);
    setQuickPartnerId("");
    setQuickAutoCreateFe(true);
    setQuickFeName(user.name || user.email.split("@")[0]);
    setQuickFePhone("");
  };

  const handleSaveQuickLink = async () => {
    if (!quickLinkUser || !quickPartnerId) {
      toast.error("Please select a Service Partner Agency.");
      return;
    }

    startTransition(async () => {
      try {
        await adminQuickLinkUserAction(quickLinkUser.id, {
          partnerId: Number(quickPartnerId),
          autoCreateFe: quickAutoCreateFe,
          name: quickFeName,
          phone: quickFePhone,
        });
        await fetchUsers();
        setQuickLinkUser(null);
        toast.success("User account successfully linked & repaired!");
      } catch (err: any) {
        toast.error(err.message || "Failed to link user account.");
      }
    });
  };

  const handleMarkVerified = async (user: User) => {
    startTransition(async () => {
      try {
        await adminMarkUserVerifiedAction(user.id);
        await fetchUsers();
        toast.success(`Email marked verified for ${user.name || user.email}.`);
      } catch (err: any) {
        toast.error(err.message || "Failed to mark email verified.");
      }
    });
  };

  const handleResendVerification = async (user: User) => {
    startTransition(async () => {
      try {
        const res = await resendVerificationOtpAction(user.email, window.location.origin);
        if (res.success) {
          toast.success(res.message);
        } else {
          throw new Error(res.error);
        }
      } catch (err: any) {
        toast.error(err.message || "Failed to resend verification email.");
      }
    });
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
        return <Badge variant="destructive" className="font-bold text-[10px]">SUPERADMIN</Badge>;
      case "MODERATOR":
        return <Badge className="bg-purple-600 hover:bg-purple-700 text-white font-bold text-[10px]">MODERATOR</Badge>;
      case "AGENT":
        return <Badge className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[10px]">AGENT</Badge>;
      default:
        return <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px]">FIELD ENGINEER</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* User Accounts Directory */}
      <Card className="border-border shadow-sm">
        <CardHeader className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <CardTitle className="text-lg">User Directory & Access Management</CardTitle>
                <CardDescription className="text-xs mt-0.5">
                  Manage team logins, activate/deactivate accounts, verify emails, and repair unlinked engineer profiles.
                </CardDescription>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchUsers}
              title="Reload Users"
              className="h-8 gap-1.5 text-xs font-semibold cursor-pointer"
            >
              <RotateCw className="h-3.5 w-3.5" />
              Refresh
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Search & Filter Pills */}
          <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between bg-muted/30 p-3 rounded-xl border border-border">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search user name, email, agency, or engineer..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 h-8 text-xs bg-background"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-2 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Filter Pills */}
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <button
                onClick={() => setStatusFilter("ALL")}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  statusFilter === "ALL"
                    ? "bg-foreground text-background shadow-xs"
                    : "bg-background text-muted-foreground hover:text-foreground border border-border"
                }`}
              >
                All ({users.length})
              </button>
              <button
                onClick={() => setStatusFilter("ACTIVE")}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  statusFilter === "ACTIVE"
                    ? "bg-emerald-600 text-white"
                    : "bg-background text-muted-foreground hover:text-foreground border border-border"
                }`}
              >
                Active ({users.filter((u) => u.isActive).length})
              </button>
              <button
                onClick={() => setStatusFilter("DISABLED")}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  statusFilter === "DISABLED"
                    ? "bg-rose-600 text-white"
                    : "bg-background text-muted-foreground hover:text-foreground border border-border"
                }`}
              >
                Disabled ({users.filter((u) => !u.isActive).length})
              </button>
              <button
                onClick={() => setStatusFilter("UNLINKED")}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  statusFilter === "UNLINKED"
                    ? "bg-amber-600 text-white"
                    : "bg-background text-muted-foreground hover:text-foreground border border-border"
                }`}
              >
                ⚠️ Unlinked ({users.filter((u) => (u.role === "FIELD_ENGINEER" && !u.engineer) || (u.role === "AGENT" && !u.partner)).length})
              </button>
              <button
                onClick={() => setStatusFilter("UNVERIFIED")}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  statusFilter === "UNVERIFIED"
                    ? "bg-sky-600 text-white"
                    : "bg-background text-muted-foreground hover:text-foreground border border-border"
                }`}
              >
                Pending Email ({users.filter((u) => !u.isEmailVerified).length})
              </button>
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center items-center py-12">
              <Loader2 className="h-7 w-7 text-primary animate-spin" />
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="text-center py-10 border border-dashed rounded-xl space-y-1">
              <Users className="w-8 h-8 text-muted-foreground mx-auto opacity-50" />
              <p className="text-sm font-semibold text-foreground">No matching users found</p>
              <p className="text-xs text-muted-foreground">Try adjusting your search query or status filter.</p>
            </div>
          ) : (
            <div className="rounded-xl border border-border overflow-hidden">
              <Table>
                <TableHeader className="bg-muted/40">
                  <TableRow>
                    <TableHead className="font-bold">User Details</TableHead>
                    <TableHead className="font-bold">Role & Account Status</TableHead>
                    <TableHead className="font-bold">Linkage & Agency</TableHead>
                    <TableHead className="font-bold">Email Verification</TableHead>
                    <TableHead className="font-bold">Joined Date</TableHead>
                    <TableHead className="text-right font-bold">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map((u) => {
                    const isUnlinked =
                      (u.role === "FIELD_ENGINEER" && !u.engineer) ||
                      (u.role === "AGENT" && !u.partner);

                    return (
                      <TableRow key={u.id} className={!u.isActive ? "bg-rose-500/5 opacity-85" : undefined}>
                        {/* User Details */}
                        <TableCell>
                          <div className="flex items-center gap-3">
                            {u.avatarUrl ? (
                              <img
                                src={u.avatarUrl}
                                alt={u.name || ""}
                                className="w-9 h-9 rounded-full object-cover border shadow-xs flex-shrink-0"
                              />
                            ) : (
                              <div className="w-9 h-9 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-xs border border-indigo-500/20 shadow-xs flex-shrink-0">
                                {(u.name || u.email).charAt(0).toUpperCase()}
                              </div>
                            )}
                            <div>
                              <div className="font-semibold text-foreground leading-tight flex items-center gap-1.5">
                                {u.name || "N/A"}
                                {!u.isActive && (
                                  <Badge variant="outline" className="text-[9px] px-1 py-0 text-rose-600 border-rose-500/30 bg-rose-500/10">
                                    Deactivated
                                  </Badge>
                                )}
                              </div>
                              <div className="text-xs text-muted-foreground font-mono">{u.email}</div>
                            </div>
                          </div>
                        </TableCell>

                        {/* Role & Status */}
                        <TableCell>
                          <div className="space-y-1">
                            <div>{getRoleBadge(u.role)}</div>
                            <div className="flex items-center gap-1.5">
                              <span
                                className={`inline-block w-1.5 h-1.5 rounded-full ${
                                  u.isActive ? "bg-emerald-500" : "bg-rose-500"
                                }`}
                              />
                              <span className="text-[11px] font-medium text-muted-foreground">
                                {u.isActive ? "Active Account" : "Disabled"}
                              </span>
                            </div>
                          </div>
                        </TableCell>

                        {/* Linkage Status */}
                        <TableCell>
                          {u.role === "AGENT" && u.partner ? (
                            <div className="space-y-0.5">
                              <div className="text-xs font-semibold text-foreground flex items-center gap-1">
                                <span className="text-indigo-600 dark:text-indigo-400 font-bold">Agency:</span> {u.partner.name}
                              </div>
                              <div className="text-[10px] text-muted-foreground">Partner Agent</div>
                            </div>
                          ) : u.role === "FIELD_ENGINEER" && u.engineer ? (
                            <div className="space-y-0.5">
                              <div className="text-xs font-semibold text-foreground flex items-center gap-1">
                                <span className="text-emerald-600 dark:text-emerald-400 font-bold">FE:</span> {u.engineer.name}
                              </div>
                              <div className="text-[10px] text-muted-foreground">
                                {u.partner?.name ? `Agency: ${u.partner.name}` : "Linked Engineer Profile"}
                              </div>
                            </div>
                          ) : u.role === "SUPERADMIN" || u.role === "MODERATOR" ? (
                            <span className="text-xs text-muted-foreground italic">System Internal</span>
                          ) : (
                            <div className="flex items-center gap-2">
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
                                <AlertCircle className="w-3 h-3" /> Unlinked
                              </span>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => openQuickLinkModal(u)}
                                className="h-6 px-2 text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/10 border-indigo-500/30 cursor-pointer"
                              >
                                Quick Link
                              </Button>
                            </div>
                          )}
                        </TableCell>

                        {/* Email Verification */}
                        <TableCell>
                          {u.isEmailVerified ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                              <CheckCircle2 className="w-3 h-3" /> Verified
                            </span>
                          ) : (
                            <div className="space-y-1">
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-sky-600 dark:text-sky-400 bg-sky-500/10 px-2 py-0.5 rounded-full border border-sky-500/20">
                                <Mail className="w-3 h-3" /> Pending OTP
                              </span>
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => handleResendVerification(u)}
                                  className="text-[10px] font-semibold text-primary hover:underline cursor-pointer"
                                >
                                  Resend
                                </button>
                                <span className="text-muted-foreground text-[10px]">·</span>
                                <button
                                  onClick={() => handleMarkVerified(u)}
                                  className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
                                >
                                  Mark Verified
                                </button>
                              </div>
                            </div>
                          )}
                        </TableCell>

                        {/* Joined Date */}
                        <TableCell className="text-xs text-muted-foreground">
                          {new Date(u.createdAt).toLocaleDateString("en-MY", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })}
                        </TableCell>

                        {/* Actions Dropdown */}
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 cursor-pointer">
                                <MoreVertical className="h-4 w-4 text-muted-foreground" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48 text-xs font-medium">
                              <DropdownMenuLabel className="text-[10px] font-bold uppercase text-muted-foreground">
                                Account Controls
                              </DropdownMenuLabel>
                              <DropdownMenuItem
                                onClick={() => openEditModal(u)}
                                className="cursor-pointer"
                              >
                                <UserCheck className="w-3.5 h-3.5 mr-2 text-primary" />
                                Edit Role / Linkage
                              </DropdownMenuItem>

                              <DropdownMenuItem
                                onClick={() => {
                                  setSettingPasswordUser(u);
                                  setNewPasswordInput("");
                                }}
                                className="cursor-pointer"
                              >
                                <KeyRound className="w-3.5 h-3.5 mr-2 text-indigo-600 dark:text-indigo-400" />
                                Set Password
                              </DropdownMenuItem>

                              {isUnlinked && (
                                <DropdownMenuItem
                                  onClick={() => openQuickLinkModal(u)}
                                  className="cursor-pointer text-amber-600 dark:text-amber-400 font-bold"
                                >
                                  <Link2 className="w-3.5 h-3.5 mr-2" />
                                  Quick Link & Repair
                                </DropdownMenuItem>
                              )}

                              <DropdownMenuSeparator />

                              <DropdownMenuItem
                                onClick={() => handleToggleStatus(u)}
                                className={`cursor-pointer ${
                                  u.isActive
                                    ? "text-amber-600 dark:text-amber-400"
                                    : "text-emerald-600 dark:text-emerald-400"
                                }`}
                              >
                                <Power className="w-3.5 h-3.5 mr-2" />
                                {u.isActive ? "Deactivate Account" : "Activate Account"}
                              </DropdownMenuItem>

                              <DropdownMenuItem
                                onClick={() => setDeletingUser(u)}
                                className="cursor-pointer text-rose-600 dark:text-rose-400 focus:text-rose-600 focus:bg-rose-500/10 font-bold"
                              >
                                <Trash2 className="w-3.5 h-3.5 mr-2" />
                                Delete User Account
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
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
      <Card className="border-border shadow-sm">
        <CardHeader className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-border">
          <div>
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400">
                <KeyRound className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-lg">Team Join & Registration Codes</CardTitle>
                <CardDescription className="text-xs mt-0.5">
                  Create and manage invitation codes that new Field Engineers or Agents can use to register and automatically link to their agency.
                </CardDescription>
              </div>
            </div>
          </div>

          <Button
            onClick={() => setShowGenerateCodeModal(true)}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs h-9 px-4 gap-2 shadow-xs cursor-pointer flex-shrink-0"
          >
            <Plus className="h-4 w-4" /> Generate Join Code
          </Button>
        </CardHeader>

        <CardContent className="pt-4">
          {loadingCodes ? (
            <div className="flex justify-center items-center py-8">
              <Loader2 className="h-6 w-6 text-primary animate-spin" />
            </div>
          ) : registrationCodes.length === 0 ? (
            <div className="text-center py-8 border border-dashed rounded-xl space-y-2 bg-muted/20">
              <div className="w-10 h-10 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto">
                <KeyRound className="w-5 h-5" />
              </div>
              <p className="text-sm font-bold text-foreground">No Invitation Codes Active</p>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                Create a join code for any Service Partner agency to allow their coordinators and field engineers to self-register.
              </p>
              <Button
                size="sm"
                onClick={() => setShowGenerateCodeModal(true)}
                className="mt-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Generate First Code
              </Button>
            </div>
          ) : (
            <div className="rounded-xl border border-border overflow-hidden bg-card">
              <Table>
                <TableHeader className="bg-muted/40">
                  <TableRow>
                    <TableHead className="font-bold">Invitation Code</TableHead>
                    <TableHead className="font-bold">Partner Agency</TableHead>
                    <TableHead className="font-bold">Target Role</TableHead>
                    <TableHead className="font-bold">Usage Status</TableHead>
                    <TableHead className="font-bold">Created Date</TableHead>
                    <TableHead className="text-right font-bold">Share & Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {registrationCodes.map((c) => {
                    const isExhausted = c.uses >= c.maxUses;
                    const isCopied = copiedCodeId === c.id;

                    return (
                      <TableRow key={c.id}>
                        <TableCell>
                          <span className="font-mono font-extrabold text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 px-2.5 py-1 rounded-md border border-indigo-500/20 text-sm select-all">
                            {c.code}
                          </span>
                        </TableCell>
                        <TableCell className="font-semibold text-xs text-foreground">{c.partner?.name || "Unknown"}</TableCell>
                        <TableCell>
                          <Badge variant={c.role === "AGENT" ? "secondary" : "default"} className="text-[10px] font-bold">
                            {c.role === "AGENT" ? "COORDINATOR" : "FIELD ENGINEER"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs font-semibold">
                          <span className={isExhausted ? "text-rose-500 font-bold" : "text-foreground"}>
                            {c.uses} / {c.maxUses} used
                          </span>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {new Date(c.createdAt).toLocaleDateString("en-MY", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleCopyLink(c.code, c.id)}
                              disabled={isExhausted}
                              className={`h-8 px-3 text-xs font-bold gap-1.5 transition cursor-pointer ${
                                isCopied ? "bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-600" : "hover:border-indigo-500"
                              }`}
                            >
                              {isCopied ? (
                                <>
                                  <Check className="h-3.5 w-3.5" /> Copied!
                                </>
                              ) : (
                                <>
                                  <Copy className="h-3.5 w-3.5" /> Copy Invite Link
                                </>
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteCode(c.id)}
                              disabled={isPending}
                              className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10 cursor-pointer"
                              title="Revoke Code"
                            >
                              <Trash2 className="h-4 w-4" />
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

      {/* Professional Generate Join Code Dialog Modal */}
      <Dialog open={showGenerateCodeModal} onOpenChange={setShowGenerateCodeModal}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400">
                <KeyRound className="h-5 w-5" />
              </div>
              Generate Team Registration Code
            </DialogTitle>
            <DialogDescription className="text-xs">
              Create an invitation code linked to a specific Service Partner Agency.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleGenerateCode} className="space-y-4 py-2">
            {/* Service Partner Selection */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                <Building2 className="w-3.5 h-3.5 text-indigo-600" /> Target Service Partner Agency *
              </Label>
              <select
                required
                value={newPartnerId}
                onChange={(e) => setNewPartnerId(e.target.value)}
                className="w-full h-9 px-3 rounded-lg bg-background border text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
              >
                <option value="">-- Select Service Partner Agency --</option>
                {partners.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Target Role Visual Selector */}
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Target Role for Registering User *
              </Label>
              <div className="grid grid-cols-2 gap-3">
                <div
                  onClick={() => setNewRole("FIELD_ENGINEER")}
                  className={`p-3.5 rounded-xl border-2 transition cursor-pointer space-y-1 ${
                    newRole === "FIELD_ENGINEER"
                      ? "border-indigo-600 bg-indigo-500/5 shadow-xs"
                      : "border-border hover:border-indigo-300 dark:hover:border-zinc-700 bg-card"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-foreground flex items-center gap-1.5">
                      <Wrench className="w-3.5 h-3.5 text-emerald-600" /> Field Engineer
                    </span>
                    <input
                      type="radio"
                      name="superadminNewRole"
                      checked={newRole === "FIELD_ENGINEER"}
                      onChange={() => setNewRole("FIELD_ENGINEER")}
                      className="accent-indigo-600"
                    />
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-snug">
                    Mobile dispatch portal access to view assigned tickets and upload resolution reports.
                  </p>
                </div>

                <div
                  onClick={() => setNewRole("AGENT")}
                  className={`p-3.5 rounded-xl border-2 transition cursor-pointer space-y-1 ${
                    newRole === "AGENT"
                      ? "border-indigo-600 bg-indigo-500/5 shadow-xs"
                      : "border-border hover:border-indigo-300 dark:hover:border-zinc-700 bg-card"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-foreground flex items-center gap-1.5">
                      <Shield className="w-3.5 h-3.5 text-indigo-600" /> Partner Agent
                    </span>
                    <input
                      type="radio"
                      name="superadminNewRole"
                      checked={newRole === "AGENT"}
                      onChange={() => setNewRole("AGENT")}
                      className="accent-indigo-600"
                    />
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-snug">
                    Agency coordinator access to manage team engineers and assign service tickets.
                  </p>
                </div>
              </div>
            </div>

            {/* Capacity Presets */}
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Registration Capacity (Max Uses)
              </Label>
              <div className="flex flex-wrap items-center gap-2">
                {["1", "5", "10", "25", "50"].map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setNewMaxUses(val)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                      newMaxUses === val
                        ? "bg-indigo-600 text-white shadow-xs"
                        : "bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground border border-border"
                    }`}
                  >
                    {val === "1" ? "1 Single Use" : `${val} Uses`}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2 pt-1">
                <span className="text-[11px] text-muted-foreground font-medium">Or enter custom count:</span>
                <Input
                  type="number"
                  min="1"
                  required
                  value={newMaxUses}
                  onChange={(e) => setNewMaxUses(e.target.value)}
                  className="w-24 h-8 text-xs font-semibold"
                />
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0 pt-3 border-t border-border">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowGenerateCodeModal(false)}
                className="text-xs cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isPending || !newPartnerId}
                className="text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5 cursor-pointer shadow-xs"
              >
                {isPending ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-3.5 w-3.5" /> Generate Invitation Code
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Quick Link & Repair Modal */}
      <Dialog open={!!quickLinkUser} onOpenChange={(open) => !open && setQuickLinkUser(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Link2 className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
              Quick Link & Repair Unlinked Account
            </DialogTitle>
            <DialogDescription className="text-xs">
              Assign this login account to a Service Partner Agency and automatically generate their operational Field Engineer profile.
            </DialogDescription>
          </DialogHeader>

          {quickLinkUser && (
            <div className="space-y-4 py-2 text-xs">
              <div className="p-3 bg-muted/40 rounded-xl border space-y-1">
                <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider block">Target Account</span>
                <span className="font-bold text-sm text-foreground block">{quickLinkUser.name || "N/A"}</span>
                <span className="text-muted-foreground block font-mono">{quickLinkUser.email}</span>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold uppercase text-muted-foreground">Assign Service Partner Agency *</Label>
                <select
                  value={quickPartnerId}
                  onChange={(e) => setQuickPartnerId(e.target.value)}
                  required
                  className="w-full h-9 px-3 rounded-lg bg-background border text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                >
                  <option value="">-- Select Partner Agency --</option>
                  {partners.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2 p-3 bg-indigo-500/5 rounded-xl border border-indigo-500/20">
                <label className="flex items-center gap-2 cursor-pointer font-bold text-indigo-700 dark:text-indigo-300">
                  <input
                    type="checkbox"
                    checked={quickAutoCreateFe}
                    onChange={(e) => setQuickAutoCreateFe(e.target.checked)}
                    className="accent-indigo-600"
                  />
                  Auto-create Field Engineer operational profile
                </label>
                <p className="text-[11px] text-muted-foreground">
                  Creates an engineer record under this agency matching email <code className="font-mono">{quickLinkUser.email}</code> so tickets can be dispatched to them immediately.
                </p>

                {quickAutoCreateFe && (
                  <div className="grid grid-cols-2 gap-2 pt-2">
                    <div className="space-y-1">
                      <Label className="text-[10px] font-bold text-muted-foreground uppercase">Engineer Name</Label>
                      <Input
                        value={quickFeName}
                        onChange={(e) => setQuickFeName(e.target.value)}
                        placeholder="Engineer Full Name"
                        className="h-8 text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] font-bold text-muted-foreground uppercase">Phone Number</Label>
                      <Input
                        value={quickFePhone}
                        onChange={(e) => setQuickFePhone(e.target.value)}
                        placeholder="+60 12-345 6789"
                        className="h-8 text-xs"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" size="sm" onClick={() => setQuickLinkUser(null)} className="text-xs cursor-pointer">
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSaveQuickLink}
              disabled={isPending || !quickPartnerId}
              className="text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer shadow-xs"
            >
              {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : "Link & Repair Profile"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete User Confirmation Modal */}
      <Dialog open={!!deletingUser} onOpenChange={(open) => !open && setDeletingUser(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-rose-600">
              <UserX className="h-5 w-5" /> Confirm Account Deletion
            </DialogTitle>
            <DialogDescription className="text-xs">
              Are you sure you want to permanently delete this user account?
            </DialogDescription>
          </DialogHeader>

          {deletingUser && (
            <div className="space-y-3 py-2 text-xs">
              <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl space-y-1 text-rose-700 dark:text-rose-300">
                <span className="font-bold text-sm block">{deletingUser.name || "N/A"}</span>
                <span className="font-mono block">{deletingUser.email}</span>
                <span className="text-[11px] block mt-1">Role: <strong>{deletingUser.role}</strong></span>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                This action will delete the login credentials and profile mapping. Past ticket activity logs will remain preserved in historical records.
              </p>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" size="sm" onClick={() => setDeletingUser(null)} disabled={isDeleting} className="text-xs cursor-pointer">
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleConfirmDeleteUser}
              disabled={isDeleting}
              className="text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white cursor-pointer"
            >
              {isDeleting ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : "Permanently Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Role Dialog */}
      <Dialog open={!!editingUser} onOpenChange={(open) => !open && setEditingUser(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCheck className="h-5 w-5 text-primary" /> Modify User Access & Roles
            </DialogTitle>
            <DialogDescription className="text-xs">
              Assign roles, link partner accounts, or generate engineer dispatch profiles.
            </DialogDescription>
          </DialogHeader>

          {editingUser && (
            <div className="space-y-4 py-2 text-xs">
              <div className="p-3 bg-muted/40 rounded-xl border space-y-1">
                <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider block">Target Account</span>
                <span className="font-bold text-sm text-foreground block">{editingUser.name || "N/A"}</span>
                <span className="text-muted-foreground block font-mono">{editingUser.email}</span>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold uppercase text-muted-foreground">Access Role</Label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as User["role"])}
                  className="w-full h-9 px-3 rounded-lg bg-background border text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
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
                    className="w-full h-9 px-3 rounded-lg bg-background border text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
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
                        className="w-full h-9 px-3 rounded-lg bg-background border text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
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
                    <div className="space-y-2.5 bg-muted/40 p-3 rounded-xl border">
                      <div className="space-y-1">
                        <Label className="text-[10px] text-muted-foreground font-bold uppercase">Service Partner Agency *</Label>
                        <select
                          value={newFePartnerId}
                          onChange={(e) => setNewFePartnerId(e.target.value)}
                          required={linkMethod === "create"}
                          className="w-full h-8 px-2 rounded-lg bg-background border text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
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
              className="text-xs cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={isPending}
              className="text-xs font-bold cursor-pointer"
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
              <KeyRound className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
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
              className="cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSaveUserPassword}
              disabled={isSettingPassword || newPasswordInput.length < 6}
              className="cursor-pointer"
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
