"use client";

import React, { useState, useEffect, useTransition } from "react";
import { getUsers, updateUserRoleAndLinks, createFieldEngineer } from "@/app/actions";
import { supabase } from "@/lib/supabaseClient";

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

  // Form states for editing
  const [role, setRole] = useState<User["role"]>("FIELD_ENGINEER");
  const [partnerId, setPartnerId] = useState<string>("");
  const [engineerId, setEngineerId] = useState<string>("");

  // Link method and creation states for Field Engineer
  const [linkMethod, setLinkMethod] = useState<"existing" | "create">("existing");
  const [newFeName, setNewFeName] = useState("");
  const [newFePhone, setNewFePhone] = useState("");
  const [newFePartnerId, setNewFePartnerId] = useState("");

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const data = await getUsers();
      setUsers(data as unknown as User[]);
    } catch (err) {
      console.error("Failed to fetch users:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();

    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!anonKey) return;

    const channel = supabase
      .channel("realtime-users-management")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "User" },
        async () => {
          console.log("Realtime DB event received on User table");
          const data = await getUsers();
          setUsers(data as unknown as User[]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

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

          // Create the Field Engineer profile
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
        alert("User updated successfully!");
      } catch (err: any) {
        alert(err.message || "Failed to update user");
      }
    });
  };

  // Flatten all engineers for the dropdown selection
  const allEngineers = partners.flatMap((p) =>
    (p.engineers || []).map((e) => ({
      ...e,
      partnerName: p.name,
    }))
  );

  return (
    <div className="bg-card border border-card-border rounded-2xl p-6 backdrop-blur-sm shadow-md">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h3 className="text-lg font-bold text-foreground">User Management</h3>
          <p className="text-xs text-muted-text">Manage employee/partner credentials, assign roles, and map user log-ins to operational profiles.</p>
        </div>
        <button
          onClick={fetchUsers}
          className="p-2 border border-card-border hover:bg-slate-100 dark:hover:bg-slate-800 text-muted-text hover:text-foreground rounded-xl transition-all"
          title="Reload Users"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
          </svg>
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-12">
          <svg className="animate-spin h-7 w-7 text-indigo-500" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4 animate-pulse-soft" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-card-border">
          <table className="min-w-full divide-y divide-card-border text-sm">
            <thead className="bg-slate-50 dark:bg-slate-900/50">
              <tr className="text-left font-bold text-muted-text text-xs uppercase tracking-wider">
                <th className="px-6 py-4">User Details</th>
                <th className="px-6 py-4">Role Badge</th>
                <th className="px-6 py-4">Linkage Status</th>
                <th className="px-6 py-4">Joined Date</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-card-border">
              {users.map((u) => {
                let linkage = "None";
                if (u.role === "AGENT" && u.partner) {
                  linkage = `Partner Agent: ${u.partner.name}`;
                } else if (u.role === "FIELD_ENGINEER" && u.engineer) {
                  linkage = `Field Engineer: ${u.engineer.name}`;
                }

                return (
                  <tr key={u.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-950/20">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        {u.avatarUrl ? (
                          <img
                            src={u.avatarUrl}
                            alt={u.name || ""}
                            className="w-8 h-8 rounded-full object-cover border border-card-border shadow-sm flex-shrink-0"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400 flex items-center justify-center font-bold text-xs border border-card-border shadow-sm flex-shrink-0">
                            {(u.name || u.email).charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div>
                          <div className="font-semibold text-foreground leading-tight">{u.name || "N/A"}</div>
                          <div className="text-xs text-muted-text mt-0.5">{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                        u.role === "SUPERADMIN"
                          ? "bg-red-500/10 text-red-500 border border-red-500/20"
                          : u.role === "MODERATOR"
                          ? "bg-purple-500/10 text-purple-500 border border-purple-500/20"
                          : u.role === "AGENT"
                          ? "bg-indigo-500/10 text-indigo-500 border border-indigo-500/20"
                          : "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                      }`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-xs text-foreground font-medium">
                      {linkage !== "None" ? (
                        <span className="text-foreground">{linkage}</span>
                      ) : (
                        <span className="text-muted-text italic">Unlinked</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-xs text-muted-text">
                      {new Date(u.createdAt).toLocaleDateString("en-MY", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => openEditModal(u)}
                        className="text-xs font-semibold text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300 transition-colors"
                      >
                        Edit Role/Link
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Edit Role Modal */}
      {editingUser && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95">
            <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-950/20">
              <h3 className="font-bold text-lg text-white">Modify Access</h3>
              <button
                onClick={() => setEditingUser(null)}
                className="p-1 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-400 hover:text-white transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6 space-y-4 text-sm text-slate-300">
              <div>
                <span className="text-xs text-slate-500 font-bold block">User Account</span>
                <span className="text-white font-semibold text-base mt-0.5 block">{editingUser.name || "N/A"}</span>
                <span className="text-slate-400 text-xs mt-0.5 block">{editingUser.email}</span>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs text-slate-400 font-bold uppercase tracking-wider">Access Role</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as User["role"])}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm focus:outline-none focus:border-cyan-500/50"
                >
                  <option value="SUPERADMIN">Superadmin (Full CRUD + User Admin)</option>
                  <option value="MODERATOR">Moderator (Dispatch + General CRUD)</option>
                  <option value="AGENT">Agent (Service Partner Agent)</option>
                  <option value="FIELD_ENGINEER">Field Engineer (Mobile Portal)</option>
                </select>
              </div>

              {role === "AGENT" && (
                <div className="space-y-1.5">
                  <label className="text-xs text-slate-400 font-bold uppercase tracking-wider">Link to Service Partner</label>
                  <select
                    value={partnerId}
                    onChange={(e) => setPartnerId(e.target.value)}
                    required
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm focus:outline-none focus:border-cyan-500/50"
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
                <div className="space-y-4 pt-2 border-t border-slate-805">
                  <div className="space-y-1.5">
                    <label className="text-xs text-slate-400 font-bold uppercase tracking-wider block">Link Method</label>
                    <div className="flex gap-4 text-xs mt-1">
                      <label className="flex items-center gap-2 cursor-pointer text-white">
                        <input
                          type="radio"
                          name="linkMethod"
                          checked={linkMethod === "existing"}
                          onChange={() => setLinkMethod("existing")}
                          className="text-indigo-600 focus:ring-indigo-500 bg-slate-950 border-slate-800"
                        />
                        Link to Existing Profile
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer text-white">
                        <input
                          type="radio"
                          name="linkMethod"
                          checked={linkMethod === "create"}
                          onChange={() => setLinkMethod("create")}
                          className="text-indigo-600 focus:ring-indigo-500 bg-slate-950 border-slate-800"
                        />
                        Create New Profile & Link
                      </label>
                    </div>
                  </div>

                  {linkMethod === "existing" ? (
                    <div className="space-y-1.5">
                      <label className="text-xs text-slate-400 font-bold uppercase tracking-wider block">Select Existing Profile</label>
                      <select
                        value={engineerId}
                        onChange={(e) => setEngineerId(e.target.value)}
                        required={linkMethod === "existing"}
                        className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm focus:outline-none focus:border-cyan-500/50"
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
                    <div className="space-y-3 bg-slate-950/40 p-3 rounded-xl border border-slate-800">
                      <div className="space-y-1">
                        <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Service Partner Agency *</label>
                        <select
                          value={newFePartnerId}
                          onChange={(e) => setNewFePartnerId(e.target.value)}
                          required={linkMethod === "create"}
                          className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-cyan-500/50"
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
                        <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Engineer Name *</label>
                        <input
                          type="text"
                          value={newFeName}
                          onChange={(e) => setNewFeName(e.target.value)}
                          required={linkMethod === "create"}
                          placeholder="Full Name"
                          className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-cyan-500/50"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Phone Number *</label>
                        <input
                          type="text"
                          value={newFePhone}
                          onChange={(e) => setNewFePhone(e.target.value)}
                          required={linkMethod === "create"}
                          placeholder="e.g. +60 12-345 6789"
                          className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-cyan-500/50"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="p-4 border-t border-slate-800 bg-slate-950/20 flex justify-end space-x-2">
              <button
                onClick={() => setEditingUser(null)}
                className="px-4 py-2 bg-slate-800 text-slate-200 hover:bg-slate-750 font-semibold rounded-xl text-xs transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={isPending}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-xs transition-colors disabled:opacity-50"
              >
                {isPending ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
