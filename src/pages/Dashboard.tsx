/**
 * Dashboard.tsx  –  Call History (Dark Theme)
 *
 * Warm dark design with high contrast for elderly readability.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  Phone, Clock, FileText, Calendar, MessageSquare,
  ChevronDown, ChevronUp, Download, Trash2, Play, Pause, ArrowLeft, Share2
} from "lucide-react";
import { cn } from "@/lib/utils";
import { callStorage, type CallRecord, type TranscriptLine } from "@/lib/call-storage";
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
  const lines = (call.transcript ?? [])
    .filter(t => t.role !== "system")
    .map(t => {
      const ts = t.timestamp ? new Date(t.timestamp).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "";
      const who = t.role === "user" ? "You" : "Yaara";
      return ts ? `[${ts}] ${who}: ${t.text}` : `${who}: ${t.text}`;
    })
    .join("\n\n");

  if (!lines.trim()) {
    alert("No transcript available for this call.");
    return;
  }

  const blob = new Blob([lines], { type: "text/plain;charset=utf-8" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = `yaara-transcript-${call.id}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

const CallCard = ({ call, onDelete }: { call: CallRecord; onDelete: () => void }) => {
  const [expanded,  setExpanded]  = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const msgs = (call.transcript ?? []).filter(t => t.role !== "system");

  const togglePlay = () => {
    if (!call.audioBlob) return;
    if (!audioRef.current) {
      audioRef.current = new Audio(call.audioBlob);
      audioRef.current.onended  = () => setIsPlaying(false);
      audioRef.current.onpause  = () => setIsPlaying(false);
      audioRef.current.onplay   = () => setIsPlaying(true);
    }
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch(() => setIsPlaying(false));
    }
  };

  const downloadAudio = () => {
    if (!call.audioBlob) return;
    const ext = call.audioBlob.includes("audio/mpeg") || call.audioBlob.includes("audio/mp3")
      ? "mp3"
      : call.audioBlob.includes("audio/webm")
        ? "webm"
        : "m4a";
        
    const a = document.createElement("a");
    a.href = call.audioBlob;
    a.download = `yaara-call-${call.id}.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  useEffect(() => () => { audioRef.current?.pause(); }, []);

  const handleShare = async () => {
    try {
      const text = msgs.map(m => `${m.role === "user" ? "You" : "Yaara"}: ${m.text}`).join('\n\n');
      const shareData = {
        title: callName(call),
        text: `Meri Yaara ke saath baat-cheet:\n\n${text}`,
      };
      if (navigator.share && navigator.canShare(shareData)) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(shareData.text);
        alert("Transcript copied to clipboard!");
      }
    } catch (e) {
      console.error("[Dashboard] Share failed", e);
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
        {call.audioBlob && (
          <>
            <button onClick={togglePlay} className="flex items-center gap-1.5 rounded-xl bg-blue-500/10 border border-blue-500/20 px-3 py-2 text-sm font-bold text-blue-400 transition hover:bg-blue-500/20">
              {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              {isPlaying ? "Pause" : "Play"}
            </button>
            <button onClick={downloadAudio} className="flex items-center gap-1.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 px-3 py-2 text-sm font-bold text-indigo-400 transition hover:bg-indigo-500/20">
              <Download className="h-4 w-4" /> Audio
            </button>
          </>
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

  const [syncing, setSyncing] = useState(false);

  const loadCalls = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Load initial data from local sync as fast as possible (0ms wait)
      const localList = await callStorage.getCalls(user?.mobile, user?.name, true);
      setCalls(localList);
      setLoading(false); // Stop main spinner immediately

      // 2. Heavy processing in background (Migration + Remote Cloud Merge)
      (async () => {
        try {
          await callStorage.migrateFromLocalStorage();
          if (user?.mobile) {
            setSyncing(true);
            const fullList = await callStorage.getCalls(user.mobile, user.name);
            setCalls(fullList);
          }
        } catch (err) {
          console.warn("[Dashboard] Background sync finished with issues:", err);
        } finally {
          setSyncing(false);
        }
      })();
    } catch (err) {
      console.error("[Dashboard] Initial load failed:", err);
      setLoading(false);
    }
  }, [user?.mobile, user?.name]);

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
    window.addEventListener(CALLS_UPDATED_EVENT, loadCalls);
    return () => window.removeEventListener(CALLS_UPDATED_EVENT, loadCalls);
  }, [loadCalls]);

  const totalCalls    = calls.length;
  const totalSecs     = calls.reduce((s, c) => s + (c.duration ?? 0), 0);
  const completedCnt  = calls.filter(c => c.status === "completed").length;
  const todayCnt      = calls.filter(c => {
    const iso = c.startTime || c.endTime;
    if (!iso) return false;
    return new Date(iso).toDateString() === new Date().toDateString();
  }).length;

  return (
    <div className="min-h-screen pb-32">
      {/* Background glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] left-[10%] w-[40%] h-[40%] bg-blue-500/6 rounded-full blur-[120px]" />
        <div className="absolute bottom-[10%] right-[5%] w-[30%] h-[30%] bg-indigo-500/5 rounded-full blur-[120px]" />
      </div>

      <div className="relative mx-auto w-full max-w-3xl px-4 pt-6 md:px-6 md:pt-10">

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
            onClick={() => loadCalls()}
            disabled={syncing}
            className={cn(
              "ml-auto flex h-10 items-center gap-2 rounded-xl border px-4 text-xs font-bold transition-all",
              syncing 
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400" 
                : "border-white/10 bg-white/5 text-slate-400 hover:bg-white/10"
            )}
          >
            {syncing ? (
              <>
                <div className="h-3 w-3 animate-spin rounded-full border-2 border-emerald-400 border-t-transparent" />
                Syncing...
              </>
            ) : (
              <>
                <Sparkles className="h-3 w-3" />
                Sync All Data
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
        {loading ? (
          <div className="text-center py-20 text-slate-500 font-bold">Loading your history...</div>
        ) : calls.length === 0 ? (
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
        ) : (
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
        )}
      </div>
    </div>
  );
};

export default Dashboard;
