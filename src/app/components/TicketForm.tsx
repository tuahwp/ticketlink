"use client";

import React, { useState, useEffect } from "react";

export interface State {
  id: number;
  name: string;
}
export interface Maincon {
  id: number;
  name: string;
  sheetName: string;
  customFieldsSchema: unknown;
}
export interface ServicePartner {
  id: number;
  name: string;
  statesCovered: unknown;
  engineers?: FieldEngineer[];
}
export interface FieldEngineer {
  id: number;
  name: string;
  phone: string;
  partnerId: number;
}
export interface DeviceCatalog {
  id: number;
  category: string;
  brand: string;
  model: string;
  isStandard: boolean;
}

function safeParseJson<T>(val: unknown, fallback: T): T {
  if (val === null || val === undefined) return fallback;
  if (typeof val === "string") {
    try {
      return JSON.parse(val) as T;
    } catch {
      return fallback;
    }
  }
  return val as T;
}

interface TicketFormProps {
  isOpen: boolean;
  onClose: () => void;
  states: State[];
  maincons: Maincon[];
  partners: ServicePartner[];
  devices: DeviceCatalog[];
}

export default function TicketForm({ isOpen, onClose, states, maincons, partners, devices }: TicketFormProps) {
  // Core ticket fields
  const [clientSiteName, setClientSiteName] = useState("");
  const [state, setState] = useState("");
  const [issueDescription, setIssueDescription] = useState("");
  const [mainconId, setMainconId] = useState("");
  const [customValues, setCustomValues] = useState<Record<string, string>>({});

  // Cascading service data
  const [partnerId, setPartnerId] = useState("");
  const [assignedFeId, setAssignedFeId] = useState("");

  // Device selection
  const [deviceId, setDeviceId] = useState("");
  const [deviceStatus, setDeviceStatus] = useState<"STANDARD" | "ON_REQUEST">("STANDARD");
  const [customDeviceDetails, setCustomDeviceDetails] = useState("");

  // Derived data for UI
  const filteredPartners = state
    ? partners.filter((p) => {
        const covered = safeParseJson<string[]>(p.statesCovered, []);
        return covered.includes(state);
      })
    : [];

  const selectedPartner = partners.find((p) => p.id === Number(partnerId));
  const filteredEngineers = selectedPartner?.engineers || [];

  // When the selected Maincon changes, reset dynamic fields
  useEffect(() => {
    const fields = safeParseJson<string[]>(
      maincons.find((m) => m.id === Number(mainconId))?.customFieldsSchema,
      []
    );
    const newValues: Record<string, string> = {};
    fields.forEach((f) => (newValues[f] = ""));
    setCustomValues(newValues);
  }, [mainconId, maincons]);

  const handleDynamicChange = (field: string, value: string) => {
    setCustomValues((prev) => ({ ...prev, [field]: value }));
  };

  const handleDeviceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (val === "on-request") {
      setDeviceStatus("ON_REQUEST");
      setDeviceId("");
    } else {
      setDeviceStatus("STANDARD");
      setDeviceId(val);
    }
  };

  const validate = (): boolean => {
    if (!clientSiteName || !state || !mainconId) {
      alert("Please fill in Site Name, State, and Maincon.");
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    const payload = {
      ticketRefNo: null,
      clientSiteName,
      state,
      issueDescription,
      mainconId: Number(mainconId),
      customValues,
      partnerId: partnerId ? Number(partnerId) : undefined,
      assignedFeId: assignedFeId ? Number(assignedFeId) : undefined,
      deviceId: deviceId ? Number(deviceId) : undefined,
      deviceStatus,
      customDeviceDetails: deviceStatus === "ON_REQUEST" ? customDeviceDetails : undefined,
    };
    try {
      const res = await fetch("/api/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`Server responded ${res.status}`);
      // Reset form and close modal on success
      setClientSiteName("");
      setState("");
      setIssueDescription("");
      setMainconId("");
      setCustomValues({});
      setPartnerId("");
      setAssignedFeId("");
      setDeviceId("");
      setDeviceStatus("STANDARD");
      setCustomDeviceDetails("");
      onClose();
    } catch (err) {
      alert("Error creating ticket: " + (err instanceof Error ? err.message : String(err)));
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-2xl bg-[#0B0F19] text-slate-100 rounded-xl shadow-lg border border-slate-800 overflow-y-auto max-h-[90vh]">
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <h2 className="text-xl font-bold text-center mb-4 bg-gradient-to-r from-indigo-400 via-purple-300 to-pink-400 bg-clip-text text-transparent">
            Create Ticket
          </h2>

          {/* Core Fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Site Name</label>
              <input
                type="text"
                value={clientSiteName}
                onChange={(e) => setClientSiteName(e.target.value)}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-indigo-500"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">State</label>
              <select
                value={state}
                onChange={(e) => setState(e.target.value)}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-indigo-500"
                required
              >
                <option value="">Select State</option>
                {states.map((s) => (
                  <option key={s.id} value={s.name}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-slate-400 mb-1">Issue Description</label>
              <textarea
                rows={3}
                value={issueDescription}
                onChange={(e) => setIssueDescription(e.target.value)}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Maincon</label>
              <select
                value={mainconId}
                onChange={(e) => setMainconId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-indigo-500"
                required
              >
                <option value="">Select Maincon</option>
                {maincons.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Dynamic Custom Fields – only when a Maincon is chosen */}
          {mainconId && (
            <div className="mt-4 p-4 bg-slate-900/30 rounded-lg border border-slate-800">
              <h3 className="text-sm font-semibold text-slate-300 mb-2">Additional Details</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Object.entries(customValues).map(([field, value]) => {
                  const isDate = /date|due/i.test(field);
                  return (
                    <div key={field}>
                      <label className="block text-xs font-medium text-slate-400 mb-1">{field}</label>
                      <input
                        type={isDate ? "date" : "text"}
                        value={value}
                        onChange={(e) => handleDynamicChange(field, e.target.value)}
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Service Partner & Engineer */}
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Service Partner</label>
              <select
                value={partnerId}
                onChange={(e) => setPartnerId(e.target.value)}
                disabled={!state}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-indigo-500"
              >
                <option value="">Select Partner</option>
                {filteredPartners.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Field Engineer</label>
              <select
                value={assignedFeId}
                onChange={(e) => setAssignedFeId(e.target.value)}
                disabled={!partnerId}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-indigo-500"
              >
                <option value="">Select Engineer</option>
                {filteredEngineers.map((fe) => (
                  <option key={fe.id} value={fe.id}>
                    {fe.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Device Selection */}
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Device</label>
              <select
                value={deviceId || (deviceStatus === "ON_REQUEST" ? "on-request" : "")}
                onChange={handleDeviceChange}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-indigo-500"
              >
                <option value="">Select Device</option>
                {/* Group by category */}
                {Array.from(new Set(devices.map((d) => d.category))).map((cat) => (
                  <optgroup key={cat} label={cat}>
                    {devices
                      .filter((d) => d.category === cat)
                      .map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.brand} {d.model}
                        </option>
                      ))}
                  </optgroup>
                ))}
                <option value="on-request">Device Not Listed (On Request)</option>
              </select>
            </div>
            {deviceStatus === "ON_REQUEST" && (
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Device Brand & Model Details</label>
                <input
                  type="text"
                  value={customDeviceDetails}
                  onChange={(e) => setCustomDeviceDetails(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-indigo-500"
                  required
                />
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end space-x-3 pt-4 border-t border-slate-800 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition"
            >
              Create Ticket
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
