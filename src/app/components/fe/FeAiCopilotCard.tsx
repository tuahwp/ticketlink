"use client";

import React, { useState, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Sparkles,
  Bot,
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
          toast.success("Panduan diagnostik AI berjaya dijana!");
        }
      } else {
        toast.error(res.error || "Gagal menjana panduan AI.");
      }
    } catch (err: any) {
      toast.error(err.message || "Ralat berkomunikasi dengan perkhidmatan AI.");
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
      toast.error("Sila pilih fail imej yang sah.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Saiz fail imej mestilah kurang daripada 5MB.");
      return;
    }

    setImageMimeType(file.type);
    const reader = new FileReader();
    reader.onload = () => {
      setSelectedImage(reader.result as string);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleCopy = () => {
    if (!guidance) return;
    navigator.clipboard.writeText(guidance);
    setCopied(true);
    toast.success("Panduan SOP AI disalin ke papan keratan!");
    setTimeout(() => setCopied(false), 2000);
  };

  // Strip empty/redundant delimiter artifacts like '--' or '---'
  const sanitizeMarkdown = (raw: string) => {
    return raw
      .split("\n")
      .filter((line) => {
        const trimmed = line.trim();
        return trimmed !== "--" && trimmed !== "---" && trimmed !== "- - -";
      })
      .join("\n");
  };

  return (
    <div className="rounded-xl border border-amber-500/30 bg-gradient-to-r from-amber-500/5 via-primary/5 to-transparent shadow-xs overflow-hidden transition-all mb-4">
      {/* Header bar */}
      <button
        type="button"
        onClick={handleToggle}
        className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-muted/30 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-600 dark:text-amber-400">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-xs text-foreground">
                Pembantu Teknikal Gemini AI
              </span>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                LIVE
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Analisis diagnostik, langkah SOP perkakasan & keselamatan ESD
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 text-muted-foreground">
          {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </div>
      </button>

      {/* Expandable Content */}
      {isOpen && (
        <div className="px-4 pb-4 pt-1 space-y-3 border-t border-border/40">
          {/* Quick Actions Row */}
          <div className="flex items-center justify-between gap-2 flex-wrap pt-2">
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
                {guidance ? "Jana Semula SOP" : "Analisis Tiket Ini"}
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
                {selectedImage ? "Tukar Foto" : "Tambah Foto Ralat"}
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
                {copied ? "Disalin" : "Salin SOP"}
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
                  alt="Tangkapan Ralat Tapak"
                  className="w-full h-full object-cover"
                />
              </div>
              <button
                type="button"
                onClick={() => setSelectedImage(null)}
                className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-red-600 text-white flex items-center justify-center text-[10px] shadow-xs"
              >
                <X className="h-3 w-3" />
              </button>
              <div className="text-[10px] text-muted-foreground mt-1 text-center font-medium">
                Foto dilampirkan
              </div>
            </div>
          )}

          {/* AI Response Card */}
          {loading ? (
            <div className="py-8 px-4 text-center rounded-lg bg-card/60 border border-border/60 flex flex-col items-center justify-center gap-2.5">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <div className="space-y-0.5">
                <span className="text-xs font-semibold text-foreground">Gemini AI sedang menganalisis diagnostik perkakasan...</span>
                <p className="text-[11px] text-muted-foreground">Mensintesis isu tiket, spesifikasi peranti, dan resolusi lepas.</p>
              </div>
            </div>
          ) : guidance ? (
            <div className="p-3.5 rounded-lg bg-card border border-border/80 shadow-xs space-y-2">
              <div className="prose prose-xs max-w-none text-xs text-foreground/90 dark:prose-invert">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    h1: ({ children }) => <h3 className="font-bold text-sm text-foreground mt-2 mb-1">{children}</h3>,
                    h2: ({ children }) => <h4 className="font-bold text-sm text-foreground mt-2 mb-1">{children}</h4>,
                    h3: ({ children }) => <h5 className="font-semibold text-xs text-foreground mt-1.5 mb-1">{children}</h5>,
                    p: ({ children }) => <p className="text-xs leading-relaxed my-1 text-foreground/90">{children}</p>,
                    ul: ({ children }) => <ul className="list-disc pl-4 my-1 space-y-0.5 text-xs">{children}</ul>,
                    ol: ({ children }) => <ol className="list-decimal pl-4 my-1 space-y-0.5 text-xs">{children}</ol>,
                    li: ({ children }) => <li className="text-xs leading-relaxed">{children}</li>,
                    strong: ({ children }) => <strong className="font-bold text-primary dark:text-cyan-400">{children}</strong>,
                  }}
                >
                  {sanitizeMarkdown(guidance)}
                </ReactMarkdown>
              </div>
              {modelUsed && (
                <div className="pt-2 border-t border-border/40 flex items-center justify-between text-[10px] text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Cpu className="h-3 w-3 text-primary" />
                    Dikuasakan oleh {modelUsed}
                  </span>
                  <span>Keselamatan diutamakan: Sentiasa sahkan pengasingan kuasa sebelum penyelenggaraan.</span>
                </div>
              )}
            </div>
          ) : (
            <div className="py-6 px-4 text-center rounded-lg bg-muted/20 border border-dashed border-border flex flex-col items-center justify-center gap-1.5">
              <Bot className="h-6 w-6 text-muted-foreground/60" />
              <p className="text-xs text-muted-foreground">
                Klik <strong>"Analisis Tiket Ini"</strong> untuk menjana SOP diagnostik di tapak, alatan wajib, dan cadangan alat ganti.
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
                placeholder="Tanya soalan teknikal spesifik (cth: 'Kod ralat E-04 pencetak Epson', 'Bunyi bip kod RAM')..."
                className="flex-1 h-8 px-3 text-xs rounded-lg border border-input bg-background text-foreground focus:ring-1 focus:ring-primary focus:outline-none"
              />
              <Button
                type="submit"
                size="sm"
                disabled={loading || (!userQuery.trim() && !selectedImage)}
                className="h-8 px-3 text-xs gap-1"
              >
                <Send className="h-3 w-3" />
                Tanya
              </Button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
