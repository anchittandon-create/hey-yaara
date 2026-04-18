/**
 * Dashboard.tsx  –  Call History (Dark Theme)
 *
 * Warm dark design with high contrast for elderly readability.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  Phone, Clock, FileText, Calendar, MessageSquare,
  ChevronDown, ChevronUp, Download, Trash2, Play, Pause, ArrowLeft, Share2,
} from "lucide-react";
import WaveformPlayer from "@/lib/waveform-player";
import { cn } from "@/lib/utils";
import { callStorage, type CallRecord, type TranscriptLine } from "@/lib/call-storage";
import { fetchUserCalls, deleteCall, countCallsWithoutRecordings } from "@/lib/cloud-sync";
import { useAuth } from "@/contexts/AuthContext";

const CALLS_UPDATED_EVENT = "yaara_calls_updated";

const fmtDuration = (secs: number | undefined): string => {
  if (!secs || secs < 0) return "0:00";
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
};

const callName = (call: CallRecord): string => {
  const iso = call.startTime || call.endTime;
  if (!iso) return "Yaara Call";
  try {
    const d = new Date(iso);
    const date = d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
    const time = d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
    return `Yaara Call — ${date}, ${time}`;
  } catch {
    return "Yaara Call";
  }
};

const relativeDay = (iso: string | undefined): string => {
  if (!iso) return "";
  try {
    const d  = new Date(iso);
    const today     = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (d.toDateString() === today.toDateString())     return "Today";
    if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
    return d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
  } catch {
    return "";
  }
};

const statusColor = (status: string) => {
  if (status === "completed") return "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20";
  if (status === "failed")    return "bg-red-500/15 text-red-400 border border-red-500/20";
  return "bg-white/5 text-slate-400 border border-white/10";
};

const statusLabel = (status: string) => {
  if (status === "completed") return "✓ Completed";
  if (status === "failed")    return "✗ Failed";
  return status || "Unknown";
};

const downloadTranscript = (call: CallRecord) => {
  // Filter transcript to Roman script only (remove non-Roman characters)
  const lines = (call.transcript ?? [])
    .filter(t => t.role !== "system")
    .map(t => {
      const ts = t.timestamp ? new Date(t.timestamp).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "";
      const who = t.role === "user" ? "You" : "Yaara";
      // Filter text to Roman script only (basic Latin characters, numbers, punctuation)
      // Keep common punctuation and spaces, remove other non-ASCII characters
      const romanText = t.text.replace(/[^\x00-\x7F]/g, ''); // Remove non-ASCII characters
      return ts ? `[${ts}] ${who}: ${romanText}` : `${who}: ${romanText}`;
    })
    .filter(line => line.trim().length > 0) // Remove empty lines
    .join("\n\n");

  if (!lines.trim()) {
    alert("No transcript available for this call.");
    return;
  }

  // Generate a simple but valid PDF
  try {
    // Escape special PDF characters in the text
    const escapedText = lines
      .replace(/\\/g, '\\\\')  // Backslash
      .replace(/\(/g, '\\(')   // Left parenthesis
      .replace(/\)/g, '\\)')   // Right parenthesis
      .replace(/\r/g, '\\r')   // Carriage return
      .replace(/\n/g, '\\n');  // Newline

    // Create a simple PDF with the text
    const pdfContent = 
      '%PDF-1.7\n' +
      '1 0 obj\n' +
      '<</Type/Catalog/Pages 2 0 R>>\n' +
      'endobj\n' +
      '2 0 obj\n' +
      '<</Type/Pages/Kids[3 0 R]/Count 1>>\n' +
      'endobj\n' +
      '3 0 obj\n' +
      '<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Resources<<>>/Contents 4 0 R>>\n' +
      'endobj\n' +
      '4 0 obj\n' +
      '<</Length ' + (escapedText.length + 100) + '>>\n' +
      'stream\n' +
      'BT\n' +
      '/F1 12 Tf\n' +
      '72 720 Td\n' +
      '(' + escapedText + ') Tj\n' +
      'ET\n' +
      'endstream\n' +
      'endobj\n' +
      'xref\n' +
      '0 5\n' +
      '0000000000 65535 f \n' +
      '0000000010 00000 n \n' +
      '0000000060 00000 n \n' +
      '0000000117 00000 n \n' +
      '0000000210 00000 n \n' +
      'trailer\n' +
      '<</Size 5/Root 1 0 R>>\n' +
      'startxref\n' +
      '290\n' +
      '%%EOF';

    const blob = new Blob([pdfContent], { type: "application/pdf" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = `yaara-transcript-${call.id}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (pdfError) {
    console.error("PDF generation failed:", pdfError);
    // Fallback to text file if PDF generation fails
    const blob = new Blob([lines], { type: "text/plain;charset=utf-8" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = `yaara-transcript-${call.id}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
};

const CallCard = ({ call, onDelete }: { call: CallRecord; onDelete: () => void }) => {
  const [expanded,  setExpanded]  = useState(false);
  const msgs = (call.transcript ?? []).filter(t => t.role !== "system");

   const handleShare = async () => {
     try {
       const text = msgs.map(m => `${m.role === "user" ? "You" : "Yaara"}: ${m.text}`).join('\n\n');
       if (!navigator.share) {
         await navigator.clipboard.writeText(text);
         return;
       }
       await navigator.share({
         title: "Yaara Call",
         text
       });
     } catch (err: any) {
       // Ignore user cancel
       if (err?.name === "AbortError") return;
       console.error("Share failed:", err);
     }
   };

  return (
    <div className="rounded-2xl glass-card overflow-hidden transition-all hover:border-amber-500/20">

      {/* Top row */}
      <div className="flex items-start justify-between gap-3 p-4 md:p-5">
        <div className="flex-shrink-0 flex h-11 w-11 items-center justify-center rounded-xl bg-blue-500/15">
          <Phone className="h-5 w-5 text-blue-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-amber-50 leading-tight truncate">{callName(call)}</p>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-400">
            <span className="flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" />
              {relativeDay(call.startTime || call.endTime)}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              {fmtDuration(call.duration)}
            </span>
            <span className="flex items-center gap-1">
              <MessageSquare className="h-3.5 w-3.5" />
              {msgs.length} messages
            </span>
          </div>
        </div>
        <span className={cn("flex-shrink-0 rounded-full px-2.5 py-0.5 text-xs font-bold whitespace-nowrap", statusColor(call.status))}>
          {statusLabel(call.status)}
        </span>
      </div>

        {/* Action bar */}
        <div className="flex flex-wrap items-center gap-2 border-t border-white/5 px-4 py-3 md:px-5">
          {call.audioPath ? (
            <WaveformPlayer audioPath={call.audioPath} />
          ) : (
            <p className="text-slate-400 text-center">No recording available</p>
          )}
          {msgs.length > 0 && (
            <button onClick={() => setExpanded(v => !v)} className="flex items-center gap-1.5 rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm font-bold text-slate-400 transition hover:bg-white/10">
              <FileText className="h-4 w-4" />
              {expanded ? "Hide" : "View"} Transcript
              {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </button>
          )}
          <button onClick={handleShare} className="flex items-center gap-1.5 rounded-xl bg-purple-500/10 border border-purple-500/20 px-3 py-2 text-sm font-bold text-purple-400 transition hover:bg-purple-500/20">
            <Share2 className="h-4 w-4" /> Share
          </button>
          <button onClick={() => downloadTranscript(call)} className="flex items-center gap-1.5 rounded-xl bg-amber-500/10 border border-amber-500/20 px-3 py-2 text-sm font-bold text-amber-400 transition hover:bg-amber-500/20">
            <Download className="h-4 w-4" /> Transcript
          </button>
          <button onClick={onDelete} className="ml-auto flex items-center gap-1.5 rounded-xl bg-red-500/10 border border-red-500/20 px-3 py-2 text-sm font-bold text-red-400 transition hover:bg-red-500/20">
            <Trash2 className="h-4 w-4" />
            <span className="hidden sm:inline">Delete</span>
          </button>
        </div>

      {/* Expanded transcript */}
      {expanded && msgs.length > 0 && (
        <div className="border-t border-white/5 px-4 pb-4 pt-3 md:px-5">
          <p className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">Full Transcript</p>
          <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
            {msgs.map((msg, i) => (
              <div
                key={msg.id || i}
                className={cn(
                  "rounded-xl px-3 py-2 text-sm leading-relaxed",
                  msg.role === "user"
                    ? "ml-auto max-w-[85%] bg-blue-500/10 border border-blue-500/10 text-blue-200"
                    : "mr-auto max-w-[85%] bg-white/5 border border-white/5 text-slate-300",
                )}
              >
                <span className="mb-0.5 block text-xs font-bold opacity-60">
                  {msg.role === "user" ? "👤 You" : "🤖 Yaara"}
                  {msg.timestamp && (
                    <span className="ml-2 font-normal">
                      {new Date(msg.timestamp).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  )}
                </span>
                {msg.text}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const Dashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [calls,   setCalls]   = useState<CallRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [missingRecordingsCount, setMissingRecordingsCount] = useState(0);

  const loadCalls = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    
    console.log("=== Dashboard loading ===");
    
    try {
      // Fetch only this user's calls
      const userCalls = await fetchUserCalls();
      console.log("Calls from cloud:", userCalls.length);
      console.log("Calls:", userCalls.slice(0, 3));
      setCalls(userCalls);
      
      // Count calls without recordings
      const missingCount = await countCallsWithoutRecordings();
      setMissingRecordingsCount(missingCount);
      console.log("Calls without recordings:", missingCount);
    } catch (err) {
      console.error("Dashboard error:", err);
      setLoadError("Failed to load");
    } finally {
      setLoading(false);
      console.log("=== Loading done ===");
    }
  }, [user?.mobile]);

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this call record?")) return;
    try {
      await callStorage.deleteCall(id, user?.mobile);
      loadCalls();
    } catch (err) {
      console.error("[Dashboard] Delete failed:", err);
    }
  };

   useEffect(() => {
     loadCalls();
   }, [loadCalls]);

  const totalCalls    = calls.length;
  const totalSecs     = calls.reduce((s, c) => s + (c.duration ?? 0), 0);
  const completedCnt  = calls.filter(c => c.status === "completed").length;
  const todayCnt      = calls.filter(c => {
    const iso = c.startTime || c.endTime;
    if (!iso) return false;
    return new Date(iso).toDateString() === new Date().toDateString();
  }).length;

  // Force refresh from cloud
  const handleRefresh = useCallback(() => {
    loadCalls();
  }, [loadCalls]);

  return (
    <div className="min-h-screen pb-32">
      {/* Background glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] left-[10%] w-[40%] h-[40%] bg-blue-500/6 rounded-full blur-[120px]" />
        <div className="absolute bottom-[10%] right-[5%] w-[30%] h-[30%] bg-indigo-500/5 rounded-full blur-[120px]" />
      </div>

      <div className="relative mx-auto w-full max-w-3xl px-4 pt-6 md:px-8 md:pt-10 xl:max-w-6xl 2xl:max-w-7xl">

        {/* Header */}
        <div className="mb-6 flex items-center gap-4">
          <button
            onClick={() => navigate("/")}
            aria-label="Back"
            className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/5 border border-white/10 text-slate-400 transition hover:text-amber-50"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-2xl font-black text-amber-50 md:text-3xl">📞 Call History</h1>
            <p className="text-sm md:text-base text-slate-400 font-medium">All your conversations with Yaara</p>
          </div>
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="ml-auto flex h-10 items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 text-xs font-bold text-slate-400 hover:bg-white/10"
          >
            {loading ? (
              <>
                <div className="h-3 w-3 animate-spin rounded-full border-2 border-blue-400 border-t-transparent" />
                Syncing...
              </>
            ) : (
              <>
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Refresh
              </>
            )}
          </button>
        </div>

         {/* Stats grid */}
         <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
           {[
             { icon: Phone,       label: "Total Calls",   value: totalCalls },
             { icon: Clock,       label: "Total Time",    value: fmtDuration(totalSecs) },
             { icon: FileText,    label: "Completed",     value: completedCnt },
             { icon: Calendar,    label: "Today",         value: todayCnt },
             { icon: FileText,    label: "No Recording",  value: missingRecordingsCount },
           ].map(({ icon: Icon, label, value }) => (
             <div key={label} className="flex items-center gap-3 rounded-2xl glass-card p-4">
               <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/15">
                 <Icon className="h-5 w-5 text-blue-400" />
               </div>
               <div>
                 <p className="text-xl font-black text-amber-50 leading-none">{value}</p>
                 <p className="mt-0.5 text-xs text-slate-500 font-bold">{label}</p>
               </div>
             </div>
           ))}
         </div>

        {/* Call list */}
        {loadError && (
          <div className="mb-6 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
            <p className="font-bold">{loadError}</p>
            <button
              type="button"
              onClick={() => loadCalls()}
              className="mt-2 text-xs font-bold underline underline-offset-2 hover:text-white"
            >
              Try again
            </button>
          </div>
        )}
        {loading ? (
          <div className="text-center py-20 text-slate-500 font-bold">Loading your history...</div>
        ) : calls.length === 0 && !loadError ? (
          <div className="flex flex-col items-center justify-center rounded-2xl glass-card py-16 text-center">
            <Phone className="mb-4 h-12 w-12 text-slate-600" />
            <h2 className="mb-1 text-lg font-bold text-amber-50">No calls yet</h2>
            <p className="mb-5 text-base text-slate-500">Start a conversation with Yaara to see your history here.</p>
            <button
              onClick={() => navigate("/talk")}
              className="rounded-2xl bg-gradient-to-r from-blue-500 to-indigo-600 px-6 py-3 text-base font-bold text-white shadow-lg shadow-blue-500/20 transition hover:-translate-y-0.5"
            >
              Start Talking
            </button>
          </div>
        ) : calls.length > 0 ? (
          <div className="space-y-3">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
              {totalCalls} {totalCalls === 1 ? "call" : "calls"} — newest first
            </p>
            {calls.map(call => (
              <CallCard
                key={call.id}
                call={call}
                onDelete={() => handleDelete(call.id)}
              />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default Dashboard;
