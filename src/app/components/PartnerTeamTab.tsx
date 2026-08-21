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
  const [error, setError] = useState<string | null>(null);

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
      } catch (err: any) {
        alert(err.message || "Failed to remove agent");
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
        alert("Invitation code generated successfully!");
      } catch (err: any) {
        alert(err.message || "Failed to generate code.");
      }
    });
  };

  const handleDeleteCode = async (codeId: number) => {
    if (!confirm("Are you sure you want to delete this invitation code?")) return;
    startTransition(async () => {
      try {
        await deleteRegistrationCode(codeId);
        await fetchCodes();
      } catch (err: any) {
        alert(err.message || "Failed to delete code.");
      }
    });
  };

  const handleCopyLink = (code: string) => {
    const origin = window.location.origin;
    const inviteUrl = `${origin}/login?code=${encodeURIComponent(code)}&mode=signup`;
    navigator.clipboard.writeText(inviteUrl)
      .then(() => {
        alert(`Invitation link copied! Share this link with your Field Engineers so they can register and automatically join your team: \n\n${inviteUrl}`);
      })
      .catch((err) => {
        console.error("Clipboard copy failed:", err);
        alert(`Invitation link: ${inviteUrl}`);
      });
  };

  const fetchEngineers = async () => {
    try {
      setLoading(true);
      const data = await getPartnerEngineers(partnerId);
      setEngineers(data as any);
    } catch (err) {
      console.error("Error fetching engineers:", err);
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
    setError(null);
    setShowAddModal(true);
  };

  const handleOpenEdit = (eng: Engineer) => {
    setSelectedEngineer(eng);
    setName(eng.name);
    setPhone(eng.phone);
    setEmail(eng.email || "");
    setRegion(eng.region || "");
    setError(null);
    setShowEditModal(true);
  };

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

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
        fetchEngineers();
      } catch (err: any) {
        setError(err.message || "Failed to create engineer");
      }
    });
  };

  const handleEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEngineer) return;
    setError(null);

    startTransition(async () => {
      try {
        await updatePartnerEngineerAction(selectedEngineer.id, {
          name,
          phone,
          email,
          region,
        });
        setShowEditModal(false);
        fetchEngineers();
      } catch (err: any) {
        setError(err.message || "Failed to update engineer");
      }
    });
  };
  const handleDelete = (id: number) => {
    if (!confirm("Are you sure you want to delete this engineer?")) return;

    startTransition(async () => {
      try {
        await deletePartnerEngineerAction(id);
        fetchEngineers();
      } catch (err: any) {
        alert(err.message || "Failed to delete engineer");
      }
    });
  };

  const handleCopyInvite = (eng: Engineer) => {
    if (!eng.email) {
      alert("Please add an email address to this engineer profile first to generate an invitation link.");
      return;
    }
    const origin = window.location.origin;
    const inviteUrl = `${origin}/login?email=${encodeURIComponent(eng.email)}&name=${encodeURIComponent(eng.name)}&role=FIELD_ENGINEER&mode=signup`;
    
    navigator.clipboard.writeText(inviteUrl)
      .then(() => {
        alert(`Invitation link copied for ${eng.name}! Send it to them to complete registration.`);
      })
      .catch((err) => {
        console.error("Clipboard copy failed:", err);
        alert(`Direct link: ${inviteUrl}`);
      });
  };

  return (
    <div className="space-y-6">
      {/* Tab Header Actions */}
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div>
          <h2 className="text-lg font-bold text-foreground">Manage Team</h2>
          <p className="text-xs text-muted-text mt-0.5">
            Register and manage your Field Engineers. Newly registered engineers will be auto-linked when they sign up with their matching email.
          </p>
        </div>
        <button
          onClick={handleOpenAdd}
          className="px-4 py-2 bg-indigo-65 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 active:scale-95"
        >
          ➕ Register Engineer
        </button>
      </div>

      {/* Team List Table */}
      {loading ? (
        <div className="text-center py-10">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500" />
          <p className="text-xs text-muted-text mt-2">Loading engineers list...</p>
        </div>
      ) : engineers.length === 0 ? (
        <div className="bg-card border border-card-border rounded-2xl p-10 text-center">
          <p className="text-sm text-muted-text font-medium">No engineers registered under your agency yet.</p>
          <button
            onClick={handleOpenAdd}
            className="mt-3 text-xs text-indigo-600 dark:text-indigo-400 font-bold hover:underline"
          >
            Add your first engineer
          </button>
        </div>
      ) : (
        <div className="bg-card border border-card-border rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-card-border bg-slate-50 dark:bg-slate-900/40 text-[10px] uppercase font-bold text-muted-text tracking-wider">
                  <th className="py-3.5 px-4">Name</th>
                  <th className="py-3.5 px-4">Phone</th>
                  <th className="py-3.5 px-4">Email</th>
                  <th className="py-3.5 px-4">Region Coverage</th>
                  <th className="py-3.5 px-4">Portal Connection</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-card-border text-xs">
                {engineers.map((eng) => (
                  <tr key={eng.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-all">
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        {eng.user?.avatarUrl ? (
                          <img
                            src={eng.user.avatarUrl}
                            alt={eng.name}
                            className="w-8 h-8 rounded-full object-cover border border-card-border shadow-sm flex-shrink-0"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400 flex items-center justify-center font-bold text-xs border border-card-border shadow-sm flex-shrink-0">
                            {eng.name.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <span className="font-bold text-foreground">{eng.name}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-muted-text">{eng.phone}</td>
                    <td className="py-3.5 px-4 text-muted-text">{eng.email || <span className="text-slate-400 dark:text-slate-600 font-normal">N/A</span>}</td>
                    <td className="py-3.5 px-4 font-semibold text-foreground">{eng.region || <span className="text-slate-400 dark:text-slate-600 font-normal">Unspecified</span>}</td>
                    <td className="py-3.5 px-4">
                      {eng.user ? (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-[10px] font-bold uppercase rounded-md border bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20">
                          🟢 Active Login
                        </span>
                      ) : eng.email ? (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-[10px] font-bold uppercase rounded-md border bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20" title="Awaiting user to sign up using this email">
                          ⏳ Pending Sign-Up
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-[10px] font-bold uppercase rounded-md border bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20" title="Add an email to allow login">
                          ⚪ No Email
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right space-x-3">
                      {eng.email && !eng.user && (
                        <button
                          onClick={() => handleCopyInvite(eng)}
                          className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline font-bold"
                          title="Copy Portal Invite Link"
                        >
                          Copy Invite Link
                        </button>
                      )}
                      <button
                        onClick={() => handleOpenEdit(eng)}
                        className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-bold"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(eng.id)}
                        disabled={isPending}
                        className="text-xs text-rose-500 hover:underline font-bold disabled:opacity-40"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Agency Coordinators Panel */}
      <div className="bg-card border border-card-border rounded-2xl p-6 shadow-sm mt-6">
        <div className="mb-6">
          <h2 className="text-lg font-bold text-foreground">Agency Coordinators</h2>
          <p className="text-xs text-muted-text mt-0.5">
            Office staff members with administrative access to dispatch tickets, link engineers, and manage this agency workspace.
          </p>
        </div>

        {loadingAgents ? (
          <div className="text-center py-6">
            <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-500" />
            <p className="text-xs text-muted-text mt-2">Loading coordinators...</p>
          </div>
        ) : agents.length === 0 ? (
          <div className="bg-slate-50 dark:bg-slate-900/40 border border-card-border rounded-xl p-6 text-center">
            <p className="text-xs text-muted-text">No other office coordinators registered for your agency.</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-card-border">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-card-border bg-slate-50 dark:bg-slate-900/40 text-[10px] uppercase font-bold text-muted-text tracking-wider font-semibold">
                  <th className="py-3 px-4">Name</th>
                  <th className="py-3 px-4">Email</th>
                  <th className="py-3 px-4">Access Role</th>
                  <th className="py-3 px-4">Joined Date</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-card-border text-xs">
                {agents.map((ag) => {
                  const isSelf = ag.id === user?.id;
                  return (
                    <tr key={ag.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-all font-semibold text-foreground">
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          {ag.avatarUrl ? (
                            <img
                              src={ag.avatarUrl}
                              alt={ag.name || ""}
                              className="w-8 h-8 rounded-full object-cover border border-card-border shadow-sm flex-shrink-0"
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400 flex items-center justify-center font-bold text-xs border border-card-border shadow-sm flex-shrink-0">
                              {(ag.name || ag.email).charAt(0).toUpperCase()}
                            </div>
                          )}
                          <span>
                            {ag.name || "N/A"} {isSelf && <span className="text-[10px] text-indigo-500 font-semibold italic">(You)</span>}
                          </span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-muted-text font-normal">{ag.email}</td>
                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-[9px] font-bold uppercase rounded-md border bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20">
                          AGENT
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-muted-text font-normal">
                        {new Date(ag.createdAt).toLocaleDateString("en-MY", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        {isSelf ? (
                          <span className="text-xs text-slate-400 dark:text-slate-600 italic">Self (Active)</span>
                        ) : (
                          <button
                            onClick={() => handleRemoveAgent(ag.id, ag.name || ag.email)}
                            disabled={isPending}
                            className="text-xs text-rose-500 hover:underline font-bold disabled:opacity-40"
                          >
                            Remove Access
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Registration/Invitation Codes Panel */}
      <div className="bg-card border border-card-border rounded-2xl p-6 shadow-sm mt-6">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-6 border-b border-card-border pb-6">
          <div>
            <h3 className="text-lg font-bold text-foreground">Team Join Codes</h3>
            <p className="text-xs text-muted-text mt-0.5">
              Generate invite codes for new members. When they register with a code, they will automatically join your Service Partner team.
            </p>
          </div>
          
          <form onSubmit={handleGenerateCode} className="flex flex-wrap items-end gap-3 bg-slate-50 dark:bg-slate-900/40 p-4 rounded-xl border border-card-border w-full lg:w-auto">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-muted-text uppercase tracking-wider block">Target Role *</label>
              <select
                value={newRole}
                onChange={(e) => setNewRole(e.target.value as "AGENT" | "FIELD_ENGINEER")}
                className="px-3 py-2 rounded-lg bg-white dark:bg-slate-950 border border-card-border text-foreground text-xs focus:outline-none focus:border-indigo-500 font-semibold"
              >
                <option value="FIELD_ENGINEER">Field Engineer</option>
                <option value="AGENT">Agent (Coordinator)</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-muted-text uppercase tracking-wider block">Max Uses</label>
              <input
                type="number"
                min="1"
                required
                value={newMaxUses}
                onChange={(e) => setNewMaxUses(e.target.value)}
                className="w-20 px-3 py-2 rounded-lg bg-white dark:bg-slate-950 border border-card-border text-foreground text-xs focus:outline-none focus:border-indigo-500 font-semibold"
              />
            </div>

            <button
              type="submit"
              disabled={isPending}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold transition-all disabled:opacity-50"
            >
              Generate Join Code
            </button>
          </form>
        </div>

        {loadingCodes ? (
          <div className="flex justify-center items-center py-6">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-500" />
          </div>
        ) : registrationCodes.length === 0 ? (
          <p className="text-xs text-muted-text text-center py-6">No join codes generated yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-card-border">
            <table className="min-w-full divide-y divide-card-border text-xs border-collapse">
              <thead>
                <tr className="border-b border-card-border bg-slate-50 dark:bg-slate-900/40 text-[10px] uppercase font-bold text-muted-text tracking-wider font-semibold">
                  <th className="py-3 px-4 text-left">Join Code</th>
                  <th className="py-3 px-4 text-left">Target Role</th>
                  <th className="py-3 px-4 text-left">Usage status</th>
                  <th className="py-3 px-4 text-left">Created At</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-card-border text-xs">
                {registrationCodes.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-all font-semibold text-foreground">
                    <td className="py-3.5 px-4 font-mono font-bold text-indigo-600 dark:text-indigo-400 text-sm select-all">
                      {c.code}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase ${
                        c.role === "AGENT"
                          ? "bg-indigo-500/10 text-indigo-500 border border-indigo-500/20"
                          : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                      }`}>
                        {c.role === "AGENT" ? "AGENT" : "FE ENGINEER"}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      {c.uses} / {c.maxUses} uses
                    </td>
                    <td className="py-3.5 px-4 font-normal text-muted-text">
                      {new Date(c.createdAt).toLocaleDateString("en-MY", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>
                    <td className="py-3.5 px-4 text-right space-x-3">
                      <button
                        onClick={() => handleCopyLink(c.code)}
                        className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline font-bold"
                      >
                        Copy Invite Link
                      </button>
                      <button
                        onClick={() => handleDeleteCode(c.id)}
                        disabled={isPending}
                        className="text-xs text-rose-500 hover:underline font-bold disabled:opacity-40"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / Register Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-card border border-card-border rounded-2xl max-w-md w-full shadow-2xl p-6 relative">
            <h3 className="text-base font-bold text-foreground mb-4">Register Field Engineer</h3>
            
            {error && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-400">
                {error}
              </div>
            )}

            <form onSubmit={handleAdd} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted-text mb-1.5">Full Name *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Ahmad Zaki"
                  className="w-full px-3 py-2.5 rounded-xl bg-input-bg border border-card-border text-foreground text-xs focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 transition-all font-semibold"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted-text mb-1.5">Phone Number *</label>
                <input
                  type="text"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="e.g. +6012-3456789"
                  className="w-full px-3 py-2.5 rounded-xl bg-input-bg border border-card-border text-foreground text-xs focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 transition-all font-mono font-semibold"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted-text mb-1.5">Email Address</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. engineer@company.com"
                  className="w-full px-3 py-2.5 rounded-xl bg-input-bg border border-card-border text-foreground text-xs focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 transition-all font-semibold"
                />
                <p className="text-[10px] text-muted-text mt-1">If set, the user account with this email will auto-link on registration.</p>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted-text mb-1.5">Region Coverage (State)</label>
                <input
                  type="text"
                  value={region}
                  onChange={(e) => setRegion(e.target.value)}
                  placeholder="e.g. Selangor"
                  className="w-full px-3 py-2.5 rounded-xl bg-input-bg border border-card-border text-foreground text-xs focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 transition-all font-semibold"
                />
              </div>

              <div className="flex gap-2 justify-end pt-3 border-t border-card-border">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 border border-card-border hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-xs font-bold transition-all text-muted-text"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all disabled:opacity-50"
                >
                  {isPending ? "Registering..." : "Submit"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && selectedEngineer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-card border border-card-border rounded-2xl max-w-md w-full shadow-2xl p-6 relative">
            <h3 className="text-base font-bold text-foreground mb-4">Edit Engineer Details</h3>
            
            {error && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-400">
                {error}
              </div>
            )}

            <form onSubmit={handleEdit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted-text mb-1.5">Full Name *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-input-bg border border-card-border text-foreground text-xs focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 transition-all font-semibold"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted-text mb-1.5">Phone Number *</label>
                <input
                  type="text"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-input-bg border border-card-border text-foreground text-xs focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 transition-all font-mono font-semibold"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted-text mb-1.5">Email Address</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-input-bg border border-card-border text-foreground text-xs focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 transition-all font-semibold"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted-text mb-1.5">Region Coverage (State)</label>
                <input
                  type="text"
                  value={region}
                  onChange={(e) => setRegion(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-input-bg border border-card-border text-foreground text-xs focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 transition-all font-semibold"
                />
              </div>

              <div className="flex gap-2 justify-end pt-3 border-t border-card-border">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 border border-card-border hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-xs font-bold transition-all text-muted-text"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all disabled:opacity-50"
                >
                  {isPending ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
