"use client";

import React, { useState, useEffect, useTransition, useMemo } from "react";
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
import {
  Plus,
  Copy,
  Trash2,
  Edit2,
  Users,
  KeyRound,
  Loader2,
  UserPlus,
  Shield,
  Search,
  Check,
  Share2,
  Send,
  UserCheck,
  Sparkles,
  ExternalLink,
  Wrench,
  Building2,
} from "lucide-react";

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
    isActive?: boolean;
    isEmailVerified?: boolean;
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

  // Search
  const [engineerSearch, setEngineerSearch] = useState("");

  // Modal States
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedEngineer, setSelectedEngineer] = useState<Engineer | null>(null);

  // Generate Code Modal
  const [showGenerateCodeModal, setShowGenerateCodeModal] = useState(false);
  const [newMaxUses, setNewMaxUses] = useState("5");
  const [newRole, setNewRole] = useState<"AGENT" | "FIELD_ENGINEER">("FIELD_ENGINEER");
  const [copiedCodeId, setCopiedCodeId] = useState<number | null>(null);

  // Form Fields
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [region, setRegion] = useState("");

  // Join codes states
  const [registrationCodes, setRegistrationCodes] = useState<any[]>([]);
  const [loadingCodes, setLoadingCodes] = useState(true);

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
        setShowGenerateCodeModal(false);
        setNewMaxUses("5");
        await fetchCodes();
        toast.success("Team join invitation code generated successfully!");
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
        toast.success("Invitation code revoked.");
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
        toast.success("Registration link copied to clipboard! Share with your engineer.");
        setTimeout(() => setCopiedCodeId(null), 3000);
      })
      .catch(() => {
        toast.info(`Registration link: ${inviteUrl}`);
      });
  };

  const fetchEngineers = async () => {
    try {
      setLoading(true);
      const data = await getPartnerEngineers(partnerId);
      setEngineers(data);
    } catch (err) {
      console.error("Error fetching engineers:", err);
      toast.error("Failed to load engineers");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (partnerId) {
      fetchEngineers();
      fetchCodes();
      fetchAgents();
    }
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
        toast.success(`Engineer ${name} pre-registered successfully!`);
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
    if (!confirm("Are you sure you want to delete this engineer record?")) return;

    startTransition(async () => {
      try {
        await deletePartnerEngineerAction(id);
        await fetchEngineers();
        toast.success("Engineer removed successfully");
      } catch (err: any) {
        toast.error(err.message || "Failed to delete engineer");
      }
    });
  };

  const filteredEngineers = useMemo(() => {
    const q = engineerSearch.toLowerCase().trim();
    if (!q) return engineers;
    return engineers.filter(
      (e) =>
        e.name.toLowerCase().includes(q) ||
        (e.email && e.email.toLowerCase().includes(q)) ||
        e.phone.includes(q) ||
        (e.region && e.region.toLowerCase().includes(q))
    );
  }, [engineers, engineerSearch]);

  return (
    <div className="space-y-6">
      {/* HERO SECTION: Team Join Codes */}
      <Card className="border-border shadow-sm">
        <CardHeader className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-border">
          <div>
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400">
                <KeyRound className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-lg">Team Join Codes & Auto-Registration</CardTitle>
                <CardDescription className="text-xs mt-0.5">
                  Share registration links with your field engineers to allow instant self-service sign-up.
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
            <div className="flex justify-center items-center py-6">
              <Loader2 className="h-6 w-6 text-primary animate-spin" />
            </div>
          ) : registrationCodes.length === 0 ? (
            <div className="text-center py-8 border border-dashed rounded-xl space-y-2 bg-muted/20">
              <div className="w-10 h-10 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto">
                <KeyRound className="w-5 h-5" />
              </div>
              <p className="text-sm font-bold text-foreground">No Active Join Codes</p>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                Generate a join code and send the invite link via WhatsApp or email for your team members to register themselves.
              </p>
              <Button
                size="sm"
                onClick={() => setShowGenerateCodeModal(true)}
                className="mt-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Create First Join Code
              </Button>
            </div>
          ) : (
            <div className="rounded-xl border border-border overflow-hidden bg-card">
              <Table>
                <TableHeader className="bg-muted/40">
                  <TableRow>
                    <TableHead className="font-bold">Join Code</TableHead>
                    <TableHead className="font-bold">Target Role</TableHead>
                    <TableHead className="font-bold">Claimed / Capacity</TableHead>
                    <TableHead className="font-bold">Status</TableHead>
                    <TableHead className="font-bold">Created Date</TableHead>
                    <TableHead className="text-right font-bold">Share & Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {registrationCodes.map((c) => {
                    const isExhausted = c.uses >= c.maxUses;
                    const isCopied = copiedCodeId === c.id;

                    return (
                      <TableRow key={c.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-extrabold text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 px-2.5 py-1 rounded-md border border-indigo-500/20 text-sm select-all">
                              {c.code}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={c.role === "AGENT" ? "secondary" : "default"} className="text-[10px] font-bold">
                            {c.role === "AGENT" ? "COORDINATOR" : "FIELD ENGINEER"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs font-semibold">
                          <span className={isExhausted ? "text-rose-500 font-bold" : "text-foreground"}>
                            {c.uses} / {c.maxUses} registered
                          </span>
                        </TableCell>
                        <TableCell>
                          {isExhausted ? (
                            <Badge variant="outline" className="text-rose-600 border-rose-500/30 bg-rose-500/10 text-[10px]">
                              Exhausted
                            </Badge>
                          ) : (
                            <Badge className="bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 text-[10px]">
                              Active & Usable
                            </Badge>
                          )}
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
                                  <Check className="h-3.5 w-3.5" /> Copied Link!
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

      {/* Field Engineers Directory */}
      <Card className="border-border shadow-sm">
        <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-lg">Field Engineers Roster ({engineers.length})</CardTitle>
                <CardDescription className="text-xs mt-0.5">
                  Engineers under your agency ready for mobile operations and ticket assignments.
                </CardDescription>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-56">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search engineers..."
                value={engineerSearch}
                onChange={(e) => setEngineerSearch(e.target.value)}
                className="pl-8 h-8 text-xs"
              />
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={handleOpenAdd}
              className="h-8 text-xs font-semibold gap-1.5 flex-shrink-0 cursor-pointer"
              title="Manual Pre-Registration"
            >
              <UserPlus className="h-3.5 w-3.5" /> Direct Pre-Register
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-10">
              <Loader2 className="h-7 w-7 text-primary animate-spin mx-auto" />
              <p className="text-xs text-muted-foreground mt-2">Loading engineers list...</p>
            </div>
          ) : filteredEngineers.length === 0 ? (
            <div className="rounded-xl border border-dashed p-8 text-center space-y-2">
              <Users className="w-8 h-8 text-muted-foreground mx-auto opacity-50" />
              <p className="text-sm font-semibold text-foreground">No engineers found</p>
              <p className="text-xs text-muted-foreground">
                Generate a <strong>Team Join Code</strong> above and share the link with your engineers to have them self-register!
              </p>
            </div>
          ) : (
            <div className="rounded-xl border border-border overflow-hidden">
              <Table>
                <TableHeader className="bg-muted/40">
                  <TableRow>
                    <TableHead className="font-bold">Engineer</TableHead>
                    <TableHead className="font-bold">Phone Contact</TableHead>
                    <TableHead className="font-bold">Email Address</TableHead>
                    <TableHead className="font-bold">Region Coverage</TableHead>
                    <TableHead className="font-bold">Account Linkage</TableHead>
                    <TableHead className="text-right font-bold">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEngineers.map((eng) => (
                    <TableRow key={eng.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          {eng.user?.avatarUrl ? (
                            <img
                              src={eng.user.avatarUrl}
                              alt={eng.name}
                              className="w-8 h-8 rounded-full object-cover border shadow-xs flex-shrink-0"
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-xs border border-emerald-500/20 shadow-xs flex-shrink-0">
                              {eng.name.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div>
                            <span className="font-bold text-foreground block text-sm">{eng.name}</span>
                            <span className="text-[10px] text-muted-foreground">ID #{eng.id}</span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-muted-foreground text-xs">{eng.phone}</TableCell>
                      <TableCell className="text-xs text-muted-foreground font-mono">{eng.email || "N/A"}</TableCell>
                      <TableCell className="text-xs font-semibold text-foreground">{eng.region || "All Assigned"}</TableCell>
                      <TableCell>
                        {eng.user ? (
                          <Badge className="bg-emerald-600 text-white text-[10px] font-bold">
                            ✓ App Login Active
                          </Badge>
                        ) : eng.email ? (
                          <Badge variant="secondary" className="text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/20 text-[10px] font-bold">
                            Pending Signup
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] text-muted-foreground">
                            Profile Only
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenEdit(eng)}
                            className="h-8 w-8 p-0 cursor-pointer"
                            title="Edit details"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(eng.id)}
                            className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10 cursor-pointer"
                            title="Delete engineer"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Office Coordinators (Agent Staff) */}
      <Card className="border-border shadow-sm">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400">
              <Shield className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-lg">Office Coordinators ({agents.length})</CardTitle>
              <CardDescription className="text-xs mt-0.5">
                Agency dispatchers and team leaders who have management access to dispatch tickets.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loadingAgents ? (
            <div className="text-center py-6">
              <Loader2 className="h-6 w-6 text-primary animate-spin mx-auto" />
            </div>
          ) : agents.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">No other office coordinators registered.</p>
          ) : (
            <div className="rounded-xl border border-border overflow-hidden">
              <Table>
                <TableHeader className="bg-muted/40">
                  <TableRow>
                    <TableHead className="font-bold">Coordinator</TableHead>
                    <TableHead className="font-bold">Email</TableHead>
                    <TableHead className="font-bold">Access Level</TableHead>
                    <TableHead className="font-bold">Joined</TableHead>
                    <TableHead className="text-right font-bold">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {agents.map((ag) => {
                    const isSelf = user?.id === ag.id;
                    return (
                      <TableRow key={ag.id}>
                        <TableCell className="font-bold text-foreground text-xs">
                          {ag.name || "N/A"} {isSelf && <span className="text-indigo-600 text-[10px] ml-1 font-normal">(You)</span>}
                        </TableCell>
                        <TableCell className="text-xs font-mono text-muted-foreground">{ag.email}</TableCell>
                        <TableCell>
                          <Badge className="bg-indigo-600 text-white text-[10px] font-bold">
                            AGENT COORDINATOR
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
                            <span className="text-xs text-muted-foreground italic">Current Session</span>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoveAgent(ag.id, ag.name || ag.email)}
                              disabled={isPending}
                              className="text-xs text-destructive hover:bg-destructive/10 font-semibold cursor-pointer"
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

      {/* Professional Generate Join Code Dialog Modal */}
      <Dialog open={showGenerateCodeModal} onOpenChange={setShowGenerateCodeModal}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400">
                <KeyRound className="h-5 w-5" />
              </div>
              Create Team Join Invitation Code
            </DialogTitle>
            <DialogDescription className="text-xs">
              Generate a shareable code for team members to register and automatically join your agency.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleGenerateCode} className="space-y-4 py-2">
            {/* Target Role Visual Selector */}
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Target Role for New Member *
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
                      name="agentNewRole"
                      checked={newRole === "FIELD_ENGINEER"}
                      onChange={() => setNewRole("FIELD_ENGINEER")}
                      className="accent-indigo-600"
                    />
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-snug">
                    Mobile portal access to view dispatched tickets and upload reports.
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
                      <Shield className="w-3.5 h-3.5 text-indigo-600" /> Office Coordinator
                    </span>
                    <input
                      type="radio"
                      name="agentNewRole"
                      checked={newRole === "AGENT"}
                      onChange={() => setNewRole("AGENT")}
                      className="accent-indigo-600"
                    />
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-snug">
                    Agency dispatcher access to assign tickets and manage team members.
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
                disabled={isPending}
                className="text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5 cursor-pointer shadow-xs"
              >
                {isPending ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-3.5 w-3.5" /> Generate Join Code
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add Modal */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-primary" /> Direct Pre-Register Engineer
            </DialogTitle>
            <DialogDescription className="text-xs">
              Pre-create an engineer record. When this engineer signs up using their matching email, their account will be automatically linked.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAdd} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase text-muted-foreground">Full Name *</Label>
              <Input
                required
                placeholder="e.g. Ahmad Razif"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-9 text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase text-muted-foreground">Phone Number *</Label>
              <Input
                required
                placeholder="e.g. +60 12-345 6789"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="h-9 text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase text-muted-foreground">Email Address</Label>
              <Input
                type="email"
                placeholder="e.g. ahmad@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-9 text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase text-muted-foreground">Region Coverage</Label>
              <Input
                placeholder="e.g. Klang Valley, Johor Bahru"
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                className="h-9 text-xs"
              />
            </div>
            <DialogFooter className="gap-2 sm:gap-0 pt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setShowAddModal(false)} className="text-xs cursor-pointer">
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={isPending} className="text-xs font-bold cursor-pointer">
                {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}
                Save Engineer
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Modal */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit2 className="h-5 w-5 text-primary" /> Edit Engineer Details
            </DialogTitle>
            <DialogDescription className="text-xs">
              Update phone number, email address, or service region for this engineer.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEdit} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase text-muted-foreground">Full Name *</Label>
              <Input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-9 text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase text-muted-foreground">Phone Number *</Label>
              <Input
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="h-9 text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase text-muted-foreground">Email Address</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-9 text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase text-muted-foreground">Region Coverage</Label>
              <Input
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                className="h-9 text-xs"
              />
            </div>
            <DialogFooter className="gap-2 sm:gap-0 pt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setShowEditModal(false)} className="text-xs cursor-pointer">
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={isPending} className="text-xs font-bold cursor-pointer">
                {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}
                Update Details
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
