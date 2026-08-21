"use client";

import React, { useState, useEffect, useTransition } from "react";
import {
  getPartnerEngineers,
  createPartnerEngineerAction,
  updatePartnerEngineerAction,
  deletePartnerEngineerAction,
  getRegistrationCodes,
  createRegistrationCode,
  deleteRegistrationCode,
  getPartnerAgents,
  removePartnerAgentAction,
} from "../actions";
import { useAuth } from "./AuthProvider";
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
import { Plus, Copy, Trash2, Edit2, Users, KeyRound, Loader2, UserPlus, Shield } from "lucide-react";

interface Engineer {
  id: number;
  name: string;
  phone: string;
  email: string | null;
  region: string | null;
  country: string | null;
  user?: {
    id: string;
    email: string;
    avatarUrl?: string | null;
  } | null;
}

interface PartnerTeamTabProps {
  partnerId: number;
}

export default function PartnerTeamTab({ partnerId }: PartnerTeamTabProps) {
  const { user } = useAuth();
  const [engineers, setEngineers] = useState<Engineer[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  // Modal States
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedEngineer, setSelectedEngineer] = useState<Engineer | null>(null);

  // Form Fields
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [region, setRegion] = useState("");

  // Join codes states
  const [registrationCodes, setRegistrationCodes] = useState<any[]>([]);
  const [loadingCodes, setLoadingCodes] = useState(true);
  const [newMaxUses, setNewMaxUses] = useState("1");
  const [newRole, setNewRole] = useState<"AGENT" | "FIELD_ENGINEER">("FIELD_ENGINEER");

  // Coordinator / Agent states
  const [agents, setAgents] = useState<any[]>([]);
  const [loadingAgents, setLoadingAgents] = useState(true);

  const fetchAgents = async () => {
    try {
      setLoadingAgents(true);
      const data = await getPartnerAgents(partnerId);
      setAgents(data);
    } catch (err) {
      console.error("Error fetching agents:", err);
    } finally {
      setLoadingAgents(false);
    }
  };

  const handleRemoveAgent = async (userId: string, userName: string) => {
    if (!confirm(`Are you sure you want to remove ${userName || "this coordinator"} from your agency? They will lose dashboard access.`)) return;
    startTransition(async () => {
      try {
        await removePartnerAgentAction(userId);
        await fetchAgents();
        toast.success(`Removed coordinator access for ${userName || "user"}.`);
      } catch (err: any) {
        toast.error(err.message || "Failed to remove agent");
      }
    });
  };

  const fetchCodes = async () => {
    try {
      setLoadingCodes(true);
      const data = await getRegistrationCodes(partnerId);
      setRegistrationCodes(data);
    } catch (err) {
      console.error("Error fetching codes:", err);
    } finally {
      setLoadingCodes(false);
    }
  };

  const handleGenerateCode = async (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      try {
        await createRegistrationCode({
          partnerId,
          role: newRole,
          maxUses: newMaxUses ? Number(newMaxUses) : 1,
        });
        setNewMaxUses("1");
        await fetchCodes();
        toast.success("Invitation code generated successfully!");
      } catch (err: any) {
        toast.error(err.message || "Failed to generate code.");
      }
    });
  };

  const handleDeleteCode = async (codeId: number) => {
    if (!confirm("Are you sure you want to delete this invitation code?")) return;
    startTransition(async () => {
      try {
        await deleteRegistrationCode(codeId);
        await fetchCodes();
        toast.success("Invitation code deleted.");
      } catch (err: any) {
        toast.error(err.message || "Failed to delete code.");
      }
    });
  };

  const handleCopyLink = (code: string) => {
    const origin = window.location.origin;
    const inviteUrl = `${origin}/login?code=${encodeURIComponent(code)}&mode=signup`;
    navigator.clipboard.writeText(inviteUrl)
      .then(() => {
        toast.success("Invitation link copied to clipboard!");
      })
      .catch(() => {
        toast.info(`Invitation link: ${inviteUrl}`);
      });
  };

  const fetchEngineers = async () => {
    try {
      setLoading(true);
      const data = await getPartnerEngineers(partnerId);
      setEngineers(data as any);
    } catch (err) {
      console.error("Error fetching engineers:", err);
      toast.error("Failed to fetch engineers list.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEngineers();
    fetchCodes();
    fetchAgents();
  }, [partnerId]);

  const handleOpenAdd = () => {
    setName("");
    setPhone("");
    setEmail("");
    setRegion("");
    setShowAddModal(true);
  };

  const handleOpenEdit = (eng: Engineer) => {
    setSelectedEngineer(eng);
    setName(eng.name);
    setPhone(eng.phone);
    setEmail(eng.email || "");
    setRegion(eng.region || "");
    setShowEditModal(true);
  };

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();

    startTransition(async () => {
      try {
        await createPartnerEngineerAction({
          name,
          phone,
          email,
          partnerId,
          region,
        });
        setShowAddModal(false);
        await fetchEngineers();
        toast.success(`Engineer ${name} registered successfully!`);
      } catch (err: any) {
        toast.error(err.message || "Failed to create engineer");
      }
    });
  };

  const handleEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEngineer) return;

    startTransition(async () => {
      try {
        await updatePartnerEngineerAction(selectedEngineer.id, {
          name,
          phone,
          email,
          region,
        });
        setShowEditModal(false);
        await fetchEngineers();
        toast.success("Engineer details updated successfully!");
      } catch (err: any) {
        toast.error(err.message || "Failed to update engineer");
      }
    });
  };

  const handleDelete = (id: number) => {
    if (!confirm("Are you sure you want to delete this engineer?")) return;

    startTransition(async () => {
      try {
        await deletePartnerEngineerAction(id);
        await fetchEngineers();
        toast.success("Engineer profile removed.");
      } catch (err: any) {
        toast.error(err.message || "Failed to delete engineer");
      }
    });
  };

  const handleCopyInvite = (eng: Engineer) => {
    if (!eng.email) {
      toast.error("Please add an email address to this profile first to generate an invitation link.");
      return;
    }
    const origin = window.location.origin;
    const inviteUrl = `${origin}/login?email=${encodeURIComponent(eng.email)}&name=${encodeURIComponent(eng.name)}&role=FIELD_ENGINEER&mode=signup`;
    
    navigator.clipboard.writeText(inviteUrl)
      .then(() => {
        toast.success(`Invite link copied for ${eng.name}!`);
      })
      .catch(() => {
        toast.info(`Direct link: ${inviteUrl}`);
      });
  };

  return (
    <div className="space-y-6">
      {/* Field Engineers Directory */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-4">
          <div>
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">Manage Field Engineers</CardTitle>
            </div>
            <CardDescription className="text-xs mt-1">
              Register and manage your Field Engineers. Newly registered engineers will be auto-linked when signing up with matching email.
            </CardDescription>
          </div>
          <Button size="sm" onClick={handleOpenAdd} className="h-8 text-xs font-semibold gap-1">
            <Plus className="h-3.5 w-3.5" /> Register Engineer
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-10">
              <Loader2 className="h-7 w-7 text-primary animate-spin mx-auto" />
              <p className="text-xs text-muted-foreground mt-2">Loading engineers list...</p>
            </div>
          ) : engineers.length === 0 ? (
            <div className="rounded-lg border border-dashed p-8 text-center">
              <p className="text-sm text-muted-foreground font-medium">No engineers registered under your agency yet.</p>
              <Button variant="link" size="sm" onClick={handleOpenAdd} className="mt-2 text-xs">
                Add your first engineer
              </Button>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Region Coverage</TableHead>
                    <TableHead>Portal Connection</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {engineers.map((eng) => (
                    <TableRow key={eng.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          {eng.user?.avatarUrl ? (
                            <img
                              src={eng.user.avatarUrl}
                              alt={eng.name}
                              className="w-8 h-8 rounded-full object-cover border shadow-sm flex-shrink-0"
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-muted text-muted-foreground flex items-center justify-center font-bold text-xs border shadow-sm flex-shrink-0">
                              {eng.name.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <span className="font-bold text-foreground">{eng.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-muted-foreground text-xs">{eng.phone}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{eng.email || "N/A"}</TableCell>
                      <TableCell className="text-xs font-semibold text-foreground">{eng.region || "Unspecified"}</TableCell>
                      <TableCell>
                        {eng.user ? (
                          <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white text-[10px]">
                            Active Login
                          </Badge>
                        ) : eng.email ? (
                          <Badge variant="secondary" className="text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/20 text-[10px]">
                            Pending Sign-Up
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] text-muted-foreground">
                            No Email
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right space-x-1">
                        {eng.email && !eng.user && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleCopyInvite(eng)}
                            className="text-xs text-emerald-600 dark:text-emerald-400 hover:text-emerald-700"
                            title="Copy Portal Invite Link"
                          >
                            <Copy className="h-3.5 w-3.5 mr-1" /> Invite
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenEdit(eng)}
                          className="text-xs text-primary"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(eng.id)}
                          disabled={isPending}
                          className="text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
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

      {/* Agency Coordinators Panel */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Agency Coordinators</CardTitle>
          </div>
          <CardDescription className="text-xs mt-1">
            Office staff members with administrative access to dispatch tickets, link engineers, and manage this agency workspace.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadingAgents ? (
            <div className="text-center py-6">
              <Loader2 className="h-6 w-6 text-primary animate-spin mx-auto" />
              <p className="text-xs text-muted-foreground mt-2">Loading coordinators...</p>
            </div>
          ) : agents.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">No other office coordinators registered for your agency.</p>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Access Role</TableHead>
                    <TableHead>Joined Date</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {agents.map((ag) => {
                    const isSelf = ag.id === user?.id;
                    return (
                      <TableRow key={ag.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            {ag.avatarUrl ? (
                              <img
                                src={ag.avatarUrl}
                                alt={ag.name || ""}
                                className="w-8 h-8 rounded-full object-cover border shadow-sm flex-shrink-0"
                              />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-muted text-muted-foreground flex items-center justify-center font-bold text-xs border shadow-sm flex-shrink-0">
                                {(ag.name || ag.email).charAt(0).toUpperCase()}
                              </div>
                            )}
                            <span className="font-semibold text-foreground text-xs">
                              {ag.name || "N/A"} {isSelf && <span className="text-[10px] text-primary font-normal italic">(You)</span>}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{ag.email}</TableCell>
                        <TableCell>
                          <Badge className="bg-indigo-600 hover:bg-indigo-700 text-white text-[10px]">
                            AGENT
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {new Date(ag.createdAt).toLocaleDateString("en-MY", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })}
                        </TableCell>
                        <TableCell className="text-right">
                          {isSelf ? (
                            <span className="text-xs text-muted-foreground italic">Self (Active)</span>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoveAgent(ag.id, ag.name || ag.email)}
                              disabled={isPending}
                              className="text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                            >
                              Remove Access
                            </Button>
                          )}
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
        <CardHeader className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 pb-4 border-b">
          <div>
            <div className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">Team Join Codes</CardTitle>
            </div>
            <CardDescription className="text-xs mt-1">
              Generate invite codes for new members to automatically join your Service Partner team.
            </CardDescription>
          </div>

          <form onSubmit={handleGenerateCode} className="flex flex-wrap items-end gap-3 bg-muted/40 p-3 rounded-lg border w-full lg:w-auto">
            <div className="space-y-1">
              <Label className="text-[10px] font-bold text-muted-foreground uppercase">Target Role *</Label>
              <select
                value={newRole}
                onChange={(e) => setNewRole(e.target.value as "AGENT" | "FIELD_ENGINEER")}
                className="h-8 px-2.5 rounded-md bg-background border text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="FIELD_ENGINEER">Field Engineer</option>
                <option value="AGENT">Agent (Coordinator)</option>
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
              {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Generate Join Code"}
            </Button>
          </form>
        </CardHeader>
        <CardContent className="pt-4">
          {loadingCodes ? (
            <div className="flex justify-center items-center py-6">
              <Loader2 className="h-6 w-6 text-primary animate-spin" />
            </div>
          ) : registrationCodes.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-6">No join codes generated yet.</p>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Join Code</TableHead>
                    <TableHead>Target Role</TableHead>
                    <TableHead>Usage Status</TableHead>
                    <TableHead>Created At</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {registrationCodes.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-mono font-bold text-primary select-all text-xs">
                        {c.code}
                      </TableCell>
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
                      <TableCell className="text-right space-x-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleCopyLink(c.code)}
                          className="text-xs text-emerald-600 dark:text-emerald-400 hover:text-emerald-700"
                        >
                          <Copy className="h-3.5 w-3.5 mr-1" /> Copy Link
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteCode(c.id)}
                          disabled={isPending}
                          className="text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
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

      {/* Register Field Engineer Dialog */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-primary" /> Register Field Engineer
            </DialogTitle>
            <DialogDescription className="text-xs">
              Add a new Field Engineer to your agency roster.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleAdd} className="space-y-3.5 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase text-muted-foreground">Full Name *</Label>
              <Input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Ahmad Zaki"
                className="text-xs font-medium"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase text-muted-foreground">Phone Number *</Label>
              <Input
                type="text"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="e.g. +6012-3456789"
                className="text-xs font-mono font-medium"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase text-muted-foreground">Email Address</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="e.g. engineer@company.com"
                className="text-xs font-medium"
              />
              <p className="text-[10px] text-muted-foreground">Used for portal log-in auto-association.</p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase text-muted-foreground">Region Coverage (State)</Label>
              <Input
                type="text"
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                placeholder="e.g. Selangor"
                className="text-xs font-medium"
              />
            </div>

            <DialogFooter className="pt-2 gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowAddModal(false)}
                className="text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isPending}
                className="text-xs font-bold"
              >
                {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Submit"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Field Engineer Dialog */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit2 className="h-5 w-5 text-primary" /> Edit Engineer Details
            </DialogTitle>
            <DialogDescription className="text-xs">
              Update contact information and regional coverage.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleEdit} className="space-y-3.5 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase text-muted-foreground">Full Name *</Label>
              <Input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="text-xs font-medium"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase text-muted-foreground">Phone Number *</Label>
              <Input
                type="text"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="text-xs font-mono font-medium"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase text-muted-foreground">Email Address</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="text-xs font-medium"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase text-muted-foreground">Region Coverage (State)</Label>
              <Input
                type="text"
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                className="text-xs font-medium"
              />
            </div>

            <DialogFooter className="pt-2 gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowEditModal(false)}
                className="text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isPending}
                className="text-xs font-bold"
              >
                {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
