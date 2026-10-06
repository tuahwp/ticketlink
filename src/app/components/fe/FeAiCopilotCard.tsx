"use client";

import React, { useState, useRef } from "react";
import {
  Sparkles,
  Bot,
  Wrench,
  AlertTriangle,
  CheckSquare,
  HelpCircle,
  Loader2,
  ChevronDown,
  ChevronUp,
  Camera,
  Send,
  Copy,
  Check,
  RefreshCw,
  Cpu,
  X,
} from "lucide-react";
import { getTicketAiAssistanceAction } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface FeAiCopilotCardProps {
  ticket: {
    id: number;
    ticketRefNo?: string | null;
    clientSiteName: string;
    issueDescription: string;
    device?: { brand: string; model: string; category: string } | null;
    customDeviceDetails?: string | null;
  };
}

export default function FeAiCopilotCard({ ticket }: FeAiCopilotCardProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [guidance, setGuidance] = useState<string | null>(null);
  const [modelUsed, setModelUsed] = useState<string | null>(null);
  const [userQuery, setUserQuery] = useState("");
  const [copied, setCopied] = useState(false);

  // Multimodal Image state
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [imageMimeType, setImageMimeType] = useState<string>("image/jpeg");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchAiGuidance = async (customQuestion?: string) => {
    setLoading(true);
    try {
      const res = await getTicketAiAssistanceAction({
        ticketId: ticket.id,
        userQuestion: customQuestion || userQuery || undefined,
        imageBase64: selectedImage || undefined,
        imageMimeType: imageMimeType,
      });

      if (res.success && res.guidance) {
        setGuidance(res.guidance);
        setModelUsed(res.modelUsed || "gemini-3.8-flash");
        setUserQuery("");
        if (customQuestion || selectedImage) {
          toast.success("AI diagnostic guidance generated!");
        }
      } else {
        toast.error(res.error || "Failed to generate AI guidance.");
      }
    } catch (err: any) {
      toast.error(err.message || "Error communicating with AI service.");
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = () => {
    const nextState = !isOpen;
    setIsOpen(nextState);
    if (nextState && !guidance && !loading) {
      fetchAiGuidance();
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please upload a valid image file.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image file size should be less than 5MB.");
      return;
    }

    setImageMimeType(file.type);
    const reader = new FileReader();
    reader.onload = () => {
      setSelectedImage(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleCopy = () => {
    if (!guidance) return;
    navigator.clipboard.writeText(guidance);
    setCopied(true);
    toast.success("AI guidance copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  const formatMarkdown = (content: string) => {
    return content
      .split("\n")
      .map((line, i) => {
        const trimmed = line.trim();
        if (trimmed.startsWith("###") || trimmed.startsWith("##")) {
          return (
            <h4 key={i} className="text-sm font-bold text-foreground mt-3 mb-1.5 flex items-center gap-1.5">
              {trimmed.replace(/^#+\s*/, "")}
            </h4>
          );
        }
        if (trimmed.startsWith("1.") || trimmed.startsWith("2.") || trimmed.startsWith("3.") || trimmed.startsWith("4.")) {
          return (
            <div key={i} className="flex items-start gap-2 my-1 text-xs text-foreground/90 pl-1">
              <span className="font-bold text-primary shrink-0">{trimmed.slice(0, 2)}</span>
              <span className="leading-relaxed">{trimmed.slice(2).trim()}</span>
            </div>
          );
        }
        if (trimmed.startsWith("-") || trimmed.startsWith("*")) {
          return (
            <div key={i} className="flex items-start gap-2 my-1 text-xs text-foreground/90 pl-1">
              <span className="h-1.5 w-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
              <span className="leading-relaxed">{trimmed.replace(/^[-*]\s*/, "")}</span>
            </div>
          );
        }
        if (!trimmed) {
          return <div key={i} className="h-1.5" />;
        }
        return (
          <p key={i} className="text-xs text-muted-foreground leading-relaxed my-1">
            {trimmed}
          </p>
        );
      });
  };

  return (
    <div className="rounded-xl border border-amber-500/30 bg-gradient-to-r from-amber-500/5 via-primary/5 to-transparent shadow-sm overflow-hidden transition-all mb-4">
      {/* Header bar */}
      <button
        type="button"
        onClick={handleToggle}
        className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-muted/30 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-amber-500 to-primary text-white flex items-center justify-center shadow-sm shrink-0">
            <Sparkles className="h-4 w-4 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                AI Technical Copilot
              </span>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                Google Gemini
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground line-clamp-1">
              On-site root cause analysis, SOP checklist, tools & safety protocols
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isOpen ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </button>

      {/* Expanded Copilot Content */}
      {isOpen && (
        <div className="px-4 pb-4 pt-1 border-t border-border/40 space-y-4">
          {/* Controls Bar */}
          <div className="flex items-center justify-between gap-2 pt-2">
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fetchAiGuidance()}
                disabled={loading}
                className="h-7 text-[11px] gap-1.5 border-primary/30 hover:border-primary"
              >
                <RefreshCw className={`h-3 w-3 text-primary ${loading ? "animate-spin" : ""}`} />
                {guidance ? "Regenerate SOP" : "Analyze Ticket"}
              </Button>

              {/* Photo Upload Trigger */}
              <input
                type="file"
                ref={fileInputRef}
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={loading}
                className="h-7 text-[11px] gap-1.5 border-border"
              >
                <Camera className="h-3 w-3 text-muted-foreground" />
                {selectedImage ? "Change Photo" : "Add Error Photo"}
              </Button>
            </div>

            {guidance && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleCopy}
                className="h-7 text-[11px] gap-1 text-muted-foreground hover:text-foreground"
              >
                {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                {copied ? "Copied" : "Copy SOP"}
              </Button>
            )}
          </div>

          {/* Attached Photo Preview */}
          {selectedImage && (
            <div className="relative inline-block border border-border rounded-lg overflow-hidden p-1 bg-muted/30">
              <div className="relative w-28 h-20 rounded overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={selectedImage}
                  alt="Site Error Snapshot"
                  className="w-full h-full object-cover"
                />
              </div>
              <button
                type="button"
                onClick={() => setSelectedImage(null)}
                className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-red-600 text-white flex items-center justify-center text-[10px] shadow"
              >
                <X className="h-3 w-3" />
              </button>
              <div className="text-[10px] text-muted-foreground mt-1 text-center font-medium">
                Photo attached
              </div>
            </div>
          )}

          {/* AI Response Card */}
          {loading ? (
            <div className="py-8 px-4 text-center rounded-lg bg-card/60 border border-border/60 flex flex-col items-center justify-center gap-2.5">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <div className="space-y-0.5">
                <span className="text-xs font-semibold text-foreground">Gemini AI is analyzing hardware diagnostics...</span>
                <p className="text-[11px] text-muted-foreground">Synthesizing ticket issue, device specs, and past resolution data.</p>
              </div>
            </div>
          ) : guidance ? (
            <div className="p-3.5 rounded-lg bg-card border border-border/80 shadow-xs space-y-2">
              <div className="prose prose-xs max-w-none text-xs text-foreground/90">
                {formatMarkdown(guidance)}
              </div>
              {modelUsed && (
                <div className="pt-2 border-t border-border/40 flex items-center justify-between text-[10px] text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Cpu className="h-3 w-3 text-primary" />
                    Engineered by {modelUsed}
                  </span>
                  <span>Safety first: Always verify power isolation before servicing.</span>
                </div>
              )}
            </div>
          ) : (
            <div className="py-6 px-4 text-center rounded-lg bg-muted/20 border border-dashed border-border flex flex-col items-center justify-center gap-1.5">
              <Bot className="h-6 w-6 text-muted-foreground/60" />
              <p className="text-xs text-muted-foreground">
                Click <strong>"Analyze Ticket"</strong> to get instant on-site troubleshooting SOPs, candidate spare parts, and tool checklists.
              </p>
            </div>
          )}

          {/* Ask Custom Follow-Up Query Input */}
          <div className="pt-1">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (userQuery.trim() || selectedImage) {
                  fetchAiGuidance(userQuery.trim());
                }
              }}
              className="flex items-center gap-2"
            >
              <input
                type="text"
                value={userQuery}
                onChange={(e) => setUserQuery(e.target.value)}
                placeholder="Ask specific question (e.g., 'Error code E-04 on Epson printer', 'RAM beep codes')..."
                className="flex-1 h-8 px-3 text-xs rounded-lg border border-input bg-background text-foreground focus:ring-1 focus:ring-primary focus:outline-none"
              />
              <Button
                type="submit"
                size="sm"
                disabled={loading || (!userQuery.trim() && !selectedImage)}
                className="h-8 px-3 text-xs gap-1"
              >
                <Send className="h-3 w-3" />
                Ask
              </Button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
