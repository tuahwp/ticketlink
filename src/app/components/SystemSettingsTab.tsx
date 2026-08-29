"use client";

import React, { useState, useEffect } from "react";
import {
  getSmtpConfigAction,
  saveSmtpConfigAction,
  testSmtpConfigAction,
  getEmailTemplatesAction,
  updateEmailTemplateAction,
  toggleEmailTemplateAction,
} from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Mail,
  Send,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Server,
  FileCode,
  Eye,
  Edit3,
  HelpCircle,
  Lock,
} from "lucide-react";

interface EmailTemplateItem {
  id: number;
  eventKey: string;
  title: string;
  description: string | null;
  subject: string;
  bodyHtml: string;
  isEnabled: boolean;
  placeholders: string[];
}

export default function SystemSettingsTab() {
  const [activeTab, setActiveTab] = useState<"smtp" | "templates">("smtp");

  // SMTP Settings State
  const [host, setHost] = useState("smtp.gmail.com");
  const [port, setPort] = useState(465);
  const [secure, setSecure] = useState(true);
  const [user, setUser] = useState("");
  const [password, setPassword] = useState("");
  const [fromName, setFromName] = useState("TicketLink Support");
  const [fromEmail, setFromEmail] = useState("");
  const [adminCc, setAdminCc] = useState("");
  const [hasExistingPass, setHasExistingPass] = useState(false);
  const [loadingSmtp, setLoadingSmtp] = useState(true);
  const [savingSmtp, setSavingSmtp] = useState(false);

  // Test Email State
  const [testRecipient, setTestRecipient] = useState("");
  const [testingSmtp, setTestingSmtp] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // Templates State
  const [templates, setTemplates] = useState<EmailTemplateItem[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(true);
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplateItem | null>(null);
  const [editSubject, setEditSubject] = useState("");
  const [editBody, setEditBody] = useState("");
  const [editEnabled, setEditEnabled] = useState(true);
  const [previewMode, setPreviewMode] = useState(false);
  const [savingTemplate, setSavingTemplate] = useState(false);

  useEffect(() => {
    loadSmtpConfig();
    loadTemplates();
  }, []);

  const loadSmtpConfig = async () => {
    setLoadingSmtp(true);
    try {
      const config = await getSmtpConfigAction();
      if (config) {
        setHost(config.host || "smtp.gmail.com");
        setPort(config.port || 465);
        setSecure(config.secure !== undefined ? config.secure : true);
        setUser(config.user || "");
        setPassword(config.password || "");
        setHasExistingPass(config.hasPassword || false);
        setFromName(config.fromName || "TicketLink Support");
        setFromEmail(config.fromEmail || config.user || "");
        setAdminCc(config.adminCc || "");
        if (!testRecipient && config.user) {
          setTestRecipient(config.user);
        }
      }
    } catch (err) {
      console.error("Failed to load SMTP config:", err);
    } finally {
      setLoadingSmtp(false);
    }
  };

  const loadTemplates = async () => {
    setLoadingTemplates(true);
    try {
      const data = await getEmailTemplatesAction();
      setTemplates(data);
    } catch (err) {
      console.error("Failed to load templates:", err);
    } finally {
      setLoadingTemplates(false);
    }
  };

  const handleSaveSmtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSmtp(true);
    try {
      const res = await saveSmtpConfigAction({
        host,
        port,
        secure,
        user,
        password,
        fromName,
        fromEmail: fromEmail || user,
        adminCc,
      });

      if (res.success) {
        toast.success("SMTP configuration saved successfully!");
        setHasExistingPass(true);
      } else {
        throw new Error(res.error || "Failed to save configuration.");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to save SMTP settings.");
    } finally {
      setSavingSmtp(false);
    }
  };

  const handleTestSmtp = async () => {
    if (!testRecipient) {
      toast.error("Please enter a test recipient email address.");
      return;
    }

    setTestingSmtp(true);
    setTestResult(null);

    try {
      const res = await testSmtpConfigAction(testRecipient, {
        host,
        port,
        secure,
        user,
        password,
        fromName,
        fromEmail: fromEmail || user,
      });

      setTestResult(res);
      if (res.success) {
        toast.success(res.message);
      } else {
        toast.error(res.message);
      }
      setTimeout(() => {
        setTestResult(null);
      }, 5000);
    } catch (err: any) {
      const msg = err.message || "Failed to dispatch test email.";
      setTestResult({ success: false, message: msg });
      toast.error(msg);
      setTimeout(() => {
        setTestResult(null);
      }, 5000);
    } finally {
      setTestingSmtp(false);
    }
  };

  const handleToggleTemplate = async (template: EmailTemplateItem) => {
    const nextState = !template.isEnabled;
    // Optimistic update
    setTemplates((prev) =>
      prev.map((t) => (t.id === template.id ? { ...t, isEnabled: nextState } : t))
    );

    try {
      const res = await toggleEmailTemplateAction(template.id, nextState);
      if (res.success) {
        toast.success(`${template.title} ${nextState ? "activated" : "disabled"}.`);
      } else {
        throw new Error(res.error);
      }
    } catch (err: any) {
      // Revert on error
      setTemplates((prev) =>
        prev.map((t) => (t.id === template.id ? { ...t, isEnabled: template.isEnabled } : t))
      );
      toast.error(err.message || "Failed to toggle template.");
    }
  };

  const handleOpenEdit = (template: EmailTemplateItem) => {
    setEditingTemplate(template);
    setEditSubject(template.subject);
    setEditBody(template.bodyHtml);
    setEditEnabled(template.isEnabled);
    setPreviewMode(false);
  };

  const handleSaveTemplate = async () => {
    if (!editingTemplate) return;
    setSavingTemplate(true);

    try {
      const res = await updateEmailTemplateAction(editingTemplate.id, {
        subject: editSubject,
        bodyHtml: editBody,
        isEnabled: editEnabled,
      });

      if (res.success && res.template) {
        setTemplates((prev) =>
          prev.map((t) => (t.id === editingTemplate.id ? res.template : t))
        );
        toast.success("Template saved successfully!");
        setEditingTemplate(null);
      } else {
        throw new Error(res.error || "Failed to update template.");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to save template.");
    } finally {
      setSavingTemplate(false);
    }
  };

  const insertPlaceholder = (tag: string) => {
    setEditBody((prev) => `${prev} ${tag}`);
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-16">
      {/* Header banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Server className="h-6 w-6 text-primary" />
            System & Email Settings
          </h2>
          <p className="text-sm text-muted-foreground">
            Manage Google Workspace SMTP configuration, test delivery, and customize notification templates.
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
        <TabsList className="grid grid-cols-2 max-w-md mb-6">
          <TabsTrigger value="smtp" className="flex items-center gap-2">
            <Mail className="h-4 w-4" />
            SMTP Configuration
          </TabsTrigger>
          <TabsTrigger value="templates" className="flex items-center gap-2">
            <FileCode className="h-4 w-4" />
            Notification Templates
          </TabsTrigger>
        </TabsList>

        {/* ───────────────────────────────────────────────────────────── */}
        {/* SUBTAB 1: SMTP CONFIGURATION */}
        {/* ───────────────────────────────────────────────────────────── */}
        <TabsContent value="smtp" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left 2 Cols: SMTP Form */}
            <div className="lg:col-span-2 space-y-6">
              <Card className="border-card-border shadow-sm">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Mail className="h-5 w-5 text-primary" />
                    Google Workspace SMTP Credentials
                  </CardTitle>
                  <CardDescription>
                    Configure the outgoing email server to send password reset links and ticket alerts.
                  </CardDescription>
                </CardHeader>

                {loadingSmtp ? (
                  <CardContent className="py-12 flex justify-center">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </CardContent>
                ) : (
                  <form onSubmit={handleSaveSmtp}>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <Label htmlFor="host">SMTP Host</Label>
                          <Input
                            id="host"
                            value={host}
                            onChange={(e) => setHost(e.target.value)}
                            placeholder="smtp.gmail.com"
                            required
                          />
                        </div>

                        <div className="space-y-1.5">
                          <Label htmlFor="port">Port</Label>
                          <div className="flex gap-2">
                            <Input
                              id="port"
                              type="number"
                              value={port}
                              onChange={(e) => setPort(Number(e.target.value))}
                              placeholder="465"
                              required
                            />
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="shrink-0 text-xs"
                              onClick={() => {
                                if (port === 465) {
                                  setPort(587);
                                  setSecure(false);
                                } else {
                                  setPort(465);
                                  setSecure(true);
                                }
                              }}
                            >
                              {secure ? "SSL (465)" : "TLS (587)"}
                            </Button>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <Label htmlFor="user">Google Workspace Email (Username)</Label>
                        <Input
                          id="user"
                          type="email"
                          value={user}
                          onChange={(e) => {
                            setUser(e.target.value);
                            if (!fromEmail) setFromEmail(e.target.value);
                          }}
                          placeholder="support@neutron.com.my"
                          required
                        />
                      </div>

                      <div className="space-y-1.5">
                        <div className="flex justify-between items-center">
                          <Label htmlFor="password">Google App Password (16 Characters)</Label>
                          {hasExistingPass && (
                            <span className="text-[11px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-medium">
                              <Lock className="h-3 w-3" /> Password Configured
                            </span>
                          )}
                        </div>
                        <Input
                          id="password"
                          type="password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder={hasExistingPass ? "•••••••••••••••• (Leave blank to keep unchanged)" : "xxxx xxxx xxxx xxxx"}
                        />
                        <p className="text-[12px] text-muted-foreground">
                          Generate via: <strong>Google Account</strong> ➡️ <strong>Security</strong> ➡️ <strong>2-Step Verification</strong> ➡️ <strong>App Passwords</strong>.
                        </p>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                        <div className="space-y-1.5">
                          <Label htmlFor="fromName">Sender Display Name</Label>
                          <Input
                            id="fromName"
                            value={fromName}
                            onChange={(e) => setFromName(e.target.value)}
                            placeholder="TicketLink Support"
                            required
                          />
                        </div>

                        <div className="space-y-1.5">
                          <Label htmlFor="fromEmail">Sender From Email</Label>
                          <Input
                            id="fromEmail"
                            type="email"
                            value={fromEmail}
                            onChange={(e) => setFromEmail(e.target.value)}
                            placeholder="support@neutron.com.my"
                            required
                          />
                        </div>
                      </div>

                      <div className="space-y-1.5 pt-2 border-t border-card-border/60">
                        <div className="flex justify-between items-center">
                          <Label htmlFor="adminCc">Admin CC Recipients (Audit Copy)</Label>
                          <span className="text-[11px] text-muted-foreground">Optional</span>
                        </div>
                        <Input
                          id="adminCc"
                          value={adminCc}
                          onChange={(e) => setAdminCc(e.target.value)}
                          placeholder="admin@neutron.com.my, audit@neutron.com.my"
                        />
                        <p className="text-[12px] text-muted-foreground">
                          Email addresses (separated by comma) that will receive an automatic CC copy of all outgoing ticket and system dispatches.
                        </p>
                      </div>
                    </CardContent>

                    <CardFooter className="flex justify-end border-t border-border pt-4">
                      <Button type="submit" disabled={savingSmtp}>
                        {savingSmtp ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Saving Settings...
                          </>
                        ) : (
                          "Save SMTP Configuration"
                        )}
                      </Button>
                    </CardFooter>
                  </form>
                )}
              </Card>
            </div>

            {/* Right 1 Col: Test Email Card & Guidance */}
            <div className="space-y-6">
              <Card className="border-card-border shadow-sm bg-card/60">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Send className="h-4 w-4 text-primary" />
                    Live SMTP Delivery Test
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Send a test email to verify authentication with Google Workspace servers.
                  </CardDescription>
                </CardHeader>

                <CardContent className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="testEmail" className="text-xs">Recipient Email</Label>
                    <Input
                      id="testEmail"
                      type="email"
                      placeholder="your.email@company.com"
                      value={testRecipient}
                      onChange={(e) => setTestRecipient(e.target.value)}
                      className="text-sm"
                    />
                  </div>

                  <Button
                    type="button"
                    variant="secondary"
                    className="w-full text-xs font-medium"
                    onClick={handleTestSmtp}
                    disabled={testingSmtp || !user}
                  >
                    {testingSmtp ? (
                      <>
                        <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                        Verifying & Sending...
                      </>
                    ) : (
                      <>
                        <Send className="mr-2 h-3.5 w-3.5" />
                        Send Test Email
                      </>
                    )}
                  </Button>

                  {testResult && (
                    <div
                      className={`p-3 rounded-lg text-xs flex items-start gap-2 ${
                        testResult.success
                          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                          : "bg-destructive/10 text-destructive border border-destructive/20"
                      }`}
                    >
                      {testResult.success ? (
                        <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
                      ) : (
                        <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                      )}
                      <div className="flex-1">
                        <span className="font-semibold block">{testResult.success ? "Success" : "Failed"}</span>
                        {testResult.message}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Instructions Guide */}
              <Card className="border-card-border shadow-sm text-xs bg-muted/40">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-semibold flex items-center gap-1.5 text-muted-foreground uppercase tracking-wider">
                    <HelpCircle className="h-3.5 w-3.5" />
                    Quick Setup Guide
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-muted-foreground leading-relaxed">
                  <p>1. Ensure <strong>2-Step Verification</strong> is enabled on your Google Workspace account.</p>
                  <p>2. Create a dedicated <strong>App Password</strong> with app name <em>&quot;TicketLink&quot;</em>.</p>
                  <p>3. Paste the 16-character code into the password field above.</p>
                  <p>4. Port <strong>465 (SSL)</strong> is recommended for Google Workspace.</p>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* ───────────────────────────────────────────────────────────── */}
        {/* SUBTAB 2: NOTIFICATION TEMPLATES */}
        {/* ───────────────────────────────────────────────────────────── */}
        <TabsContent value="templates" className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-lg font-semibold text-foreground">Notification Templates</h3>
              <p className="text-xs text-muted-foreground">
                Control which email notifications are triggered and customize their wording.
              </p>
            </div>
          </div>

          {loadingTemplates ? (
            <div className="py-16 flex justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {templates.map((tmpl) => (
                <Card
                  key={tmpl.id}
                  className={`border transition-all duration-200 ${
                    tmpl.isEnabled ? "border-card-border bg-card shadow-sm" : "border-border/60 bg-muted/30 opacity-75"
                  }`}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1 flex-1">
                        <div className="flex items-center gap-2">
                          <CardTitle className="text-base font-semibold">{tmpl.title}</CardTitle>
                          <Badge variant={tmpl.isEnabled ? "default" : "secondary"} className="text-[10px] px-1.5 py-0">
                            {tmpl.isEnabled ? "Active" : "Disabled"}
                          </Badge>
                        </div>
                        <CardDescription className="text-xs line-clamp-1">{tmpl.description}</CardDescription>
                      </div>

                      {/* Toggle Button */}
                      <button
                        type="button"
                        onClick={() => handleToggleTemplate(tmpl)}
                        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                          tmpl.isEnabled ? "bg-primary" : "bg-muted-foreground/30"
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                            tmpl.isEnabled ? "translate-x-4" : "translate-x-0"
                          }`}
                        />
                      </button>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-3 pt-0">
                    <div className="bg-muted/50 rounded p-2 text-xs border border-border/50">
                      <span className="text-muted-foreground font-medium block text-[11px]">Subject:</span>
                      <p className="font-mono text-foreground line-clamp-1 mt-0.5">{tmpl.subject}</p>
                    </div>

                    <div className="flex flex-wrap gap-1 items-center">
                      <span className="text-[11px] text-muted-foreground mr-1">Tags:</span>
                      {(tmpl.placeholders as string[])?.slice(0, 3).map((p) => (
                        <span
                          key={p}
                          className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20"
                        >
                          {p}
                        </span>
                      ))}
                      {(tmpl.placeholders as string[])?.length > 3 && (
                        <span className="text-[10px] text-muted-foreground">
                          +{(tmpl.placeholders as string[]).length - 3} more
                        </span>
                      )}
                    </div>
                  </CardContent>

                  <CardFooter className="pt-0 flex justify-end">
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs h-8"
                      onClick={() => handleOpenEdit(tmpl)}
                    >
                      <Edit3 className="h-3.5 w-3.5 mr-1.5" />
                      Customize Template
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* EDIT TEMPLATE MODAL */}
      {/* ───────────────────────────────────────────────────────────── */}
      <Dialog open={Boolean(editingTemplate)} onOpenChange={(open) => !open && setEditingTemplate(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between pr-6">
              <DialogTitle className="text-lg flex items-center gap-2">
                <FileCode className="h-5 w-5 text-primary" />
                Customize Template: {editingTemplate?.title}
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs">
              {editingTemplate?.description}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Status Toggle */}
            <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/30">
              <div className="space-y-0.5">
                <Label className="text-sm font-medium">Enable this Email Notification</Label>
                <p className="text-xs text-muted-foreground">
                  If disabled, system events will not send this email to recipients.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditEnabled(!editEnabled)}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                  editEnabled ? "bg-primary" : "bg-muted-foreground/30"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    editEnabled ? "translate-x-4" : "translate-x-0"
                  }`}
                />
              </button>
            </div>

            {/* Subject Input */}
            <div className="space-y-1.5">
              <Label htmlFor="editSub">Email Subject Line</Label>
              <Input
                id="editSub"
                value={editSubject}
                onChange={(e) => setEditSubject(e.target.value)}
                placeholder="e.g. Action Required: #{{ticketRefNo}}"
                required
              />
            </div>

            {/* Placeholders Chip Bar */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground flex items-center gap-1">
                Supported Dynamic Placeholders (Click to insert):
              </Label>
              <div className="flex flex-wrap gap-1.5">
                {editingTemplate?.placeholders?.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => insertPlaceholder(tag)}
                    className="font-mono text-[11px] px-2 py-1 rounded bg-secondary hover:bg-primary/10 hover:text-primary hover:border-primary/30 border border-border transition-colors flex items-center gap-1"
                  >
                    + {tag}
                  </button>
                ))}
              </div>
            </div>

            {/* Editor vs Preview Mode Switcher */}
            <div className="flex items-center justify-between border-b border-border pb-1 pt-2">
              <Label htmlFor="editBody" className="text-sm font-medium">
                {previewMode ? "Rendered Preview" : "Email Body (HTML / Text)"}
              </Label>
              <div className="flex gap-1">
                <Button
                  type="button"
                  size="sm"
                  variant={!previewMode ? "secondary" : "ghost"}
                  className="h-7 text-xs"
                  onClick={() => setPreviewMode(false)}
                >
                  <Edit3 className="h-3 w-3 mr-1" />
                  Code / HTML
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={previewMode ? "secondary" : "ghost"}
                  className="h-7 text-xs"
                  onClick={() => setPreviewMode(true)}
                >
                  <Eye className="h-3 w-3 mr-1" />
                  Preview
                </Button>
              </div>
            </div>

            {previewMode ? (
              <div className="border border-border rounded-lg p-4 bg-white text-slate-800 min-h-[220px] max-h-[350px] overflow-y-auto">
                <div
                  className="prose prose-sm max-w-none text-slate-800"
                  dangerouslySetInnerHTML={{
                    __html: editBody
                      .replace(/{{userName}}/g, "John Doe")
                      .replace(/{{userEmail}}/g, "john@example.com")
                      .replace(/{{userRole}}/g, "Field Engineer")
                      .replace(/{{ticketRefNo}}/g, "TK-2026-0042")
                      .replace(/{{siteName}}/g, "JPJ Putrajaya HQ")
                      .replace(/{{state}}/g, "Putrajaya")
                      .replace(/{{severity}}/g, "P1")
                      .replace(/{{issueDescription}}/g, "Router link failure on main gateway")
                      .replace(/{{resetLink}}/g, "#")
                      .replace(/{{loginLink}}/g, "#")
                      .replace(/{{ticketLink}}/g, "#")
                      .replace(/{{expiryMinutes}}/g, "60")
                      .replace(/{{newStatus}}/g, "IN_PROGRESS")
                      .replace(/{{oldStatus}}/g, "NEW")
                      .replace(/{{recipientName}}/g, "John Doe")
                      .replace(/{{notes}}/g, "Engineer dispatched on site with spare router.")
                      .replace(/{{timeRemaining}}/g, "1h 45m")
                      .replace(/{{slaDeadline}}/g, new Date().toLocaleString()),
                  }}
                />
              </div>
            ) : (
              <textarea
                id="editBody"
                value={editBody}
                onChange={(e) => setEditBody(e.target.value)}
                className="w-full min-h-[220px] p-3 text-xs font-mono rounded-lg border border-input bg-background focus:ring-2 focus:ring-primary focus:outline-none"
                placeholder="Enter HTML / Markdown formatted email template body..."
              />
            )}
          </div>

          <DialogFooter className="border-t border-border pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setEditingTemplate(null)}
              disabled={savingTemplate}
            >
              Cancel
            </Button>
            <Button type="button" onClick={handleSaveTemplate} disabled={savingTemplate}>
              {savingTemplate ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Template"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
