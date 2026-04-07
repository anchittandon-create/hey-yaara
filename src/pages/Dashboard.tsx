/**
 * Dashboard.tsx  –  Call History
 *
 * Fixes:
 *  - Calls sorted newest-first (descending)
 *  - Call named with human-readable date + time in local timezone
 *  - Duration computed and displayed correctly
 *  - Handles incomplete/legacy entries gracefully
 *  - Fully responsive: mobile, tablet, desktop
 *  - Transcript preview works on all devices
 */

import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Phone, Clock, FileText, Calendar, MessageSquare,
  ChevronDown, ChevronUp, Download, Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Schema ───────────────────────────────────────────────────────────────────

interface TranscriptLine {
  id:        string;
  role:      "user" | "yaara" | "system";
  text:      string;
  timestamp: string;
  status:    "live" | "final";
}

interface CallRecord {
  id:         string;
  startTime:  string;        // ISO string – may be missing in legacy records
  endTime:    string;        // ISO string
  duration:   number;        // seconds
  status:     "completed" | "failed" | string;
  transcript: TranscriptLine[];
  audioBlob:  string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Human-friendly date: "7 Apr 2026, 06:45 AM" */
const fmtDate = (iso: string | undefined): string => {
  if (!iso) return "Unknown";
  try {
    return new Date(iso).toLocaleString("en-IN", {
      day:    "numeric",
      month:  "short",
      year:   "numeric",
      hour:   "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return "Invalid date";
  }
};

/** "2:34" from seconds */
const fmtDuration = (secs: number | undefined): string => {
  if (!secs || secs < 0) return "0:00";
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
};

/** Derive a human call name: "Yaara Call — 7 Apr, 06:45 AM" */
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

/** Relative label: "Today", "Yesterday", or date string */
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
  if (status === "completed") return "bg-green-100 text-green-800";
  if (status === "failed")    return "bg-red-100   text-red-800";
  return "bg-gray-100 text-gray-600";
};

const statusLabel = (status: string) => {
  if (status === "completed") return "✓ Completed";
  if (status === "failed")    return "✗ Failed";
  return status || "Unknown";
};

// ─── Load / save ──────────────────────────────────────────────────────────────

const loadCalls = (): CallRecord[] => {
  try {
    const raw = localStorage.getItem("yaara_calls");
    if (!raw) return [];
    const arr = JSON.parse(raw) as CallRecord[];
    // Sort newest first
    return [...arr].sort((a, b) => {
      const ta = new Date(a.startTime || a.endTime || 0).getTime();
      const tb = new Date(b.startTime || b.endTime || 0).getTime();
      return tb - ta;
    });
  } catch {
    return [];
  }
};

const deleteCall = (id: string) => {
  try {
    const arr = JSON.parse(localStorage.getItem("yaara_calls") || "[]") as CallRecord[];
    localStorage.setItem("yaara_calls", JSON.stringify(arr.filter(c => c.id !== id)));
    window.dispatchEvent(new Event("yaara_calls_updated"));
  } catch { /* ignore */ }
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

// ─── Call Card ────────────────────────────────────────────────────────────────

const CallCard = ({ call, onDelete }: { call: CallRecord; onDelete: () => void }) => {
  const [expanded, setExpanded] = useState(false);
  const msgs = (call.transcript ?? []).filter(t => t.role !== "system");

  return (
    <div className="rounded-2xl bg-white shadow-sm border border-gray-100 overflow-hidden transition-shadow hover:shadow-md">

      {/* ── Top row ── */}
      <div className="flex items-start justify-between gap-3 p-4 md:p-5">
        {/* Icon */}
        <div className="flex-shrink-0 flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50">
          <Phone className="h-5 w-5 text-blue-500" />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-900 leading-tight truncate">{callName(call)}</p>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-gray-500">
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

        {/* Status badge */}
        <span className={cn("flex-shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap", statusColor(call.status))}>
          {statusLabel(call.status)}
        </span>
      </div>

      {/* ── Action bar ── */}
      <div className="flex flex-wrap items-center gap-2 border-t border-gray-50 px-4 py-3 md:px-5">
        {msgs.length > 0 && (
          <button
            onClick={() => setExpanded(v => !v)}
            className="flex items-center gap-1.5 rounded-lg bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-700 transition hover:bg-gray-200"
          >
            <FileText className="h-4 w-4" />
            {expanded ? "Hide" : "View"} Transcript
            {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
        )}
        <button
          onClick={() => downloadTranscript(call)}
          className="flex items-center gap-1.5 rounded-lg bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-700 transition hover:bg-blue-100"
        >
          <Download className="h-4 w-4" />
          <span className="hidden xs:inline">Download</span> Transcript
        </button>
        <button
          onClick={onDelete}
          className="ml-auto flex items-center gap-1.5 rounded-lg bg-red-50 px-3 py-1.5 text-sm font-medium text-red-600 transition hover:bg-red-100"
        >
          <Trash2 className="h-4 w-4" />
          <span className="hidden sm:inline">Delete</span>
        </button>
      </div>

      {/* ── Expanded transcript ── */}
      {expanded && msgs.length > 0 && (
        <div className="border-t border-gray-100 px-4 pb-4 pt-3 md:px-5">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-400">Full Transcript</p>
          <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
            {msgs.map((msg, i) => (
              <div
                key={msg.id || i}
                className={cn(
                  "rounded-xl px-3 py-2 text-sm leading-relaxed",
                  msg.role === "user"
                    ? "ml-auto max-w-[85%] bg-blue-50 text-blue-900"
                    : "mr-auto max-w-[85%] bg-gray-100 text-gray-800",
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

// ─── Dashboard ────────────────────────────────────────────────────────────────

const Dashboard = () => {
  const navigate = useNavigate();
  const [calls, setCalls] = useState<CallRecord[]>(loadCalls);

  const refresh = useCallback(() => {
    setCalls(loadCalls());
  }, []);

  useEffect(() => {
    refresh();
    window.addEventListener("yaara_calls_updated", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("yaara_calls_updated", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, [refresh]);

  const handleDelete = (id: string) => {
    deleteCall(id);
    setCalls(loadCalls());
  };

  // ── Stats ─────────────────────────────────────────────────────────────────
  const totalCalls    = calls.length;
  const totalSecs     = calls.reduce((s, c) => s + (c.duration ?? 0), 0);
  const completedCnt  = calls.filter(c => c.status === "completed").length;
  const todayCnt      = calls.filter(c => {
    const iso = c.startTime || c.endTime;
    if (!iso) return false;
    return new Date(iso).toDateString() === new Date().toDateString();
  }).length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 pb-32">
      <div className="mx-auto w-full max-w-3xl px-4 pt-6 md:px-6 md:pt-10">

        {/* ── Header ── */}
        <div className="mb-6 flex items-center gap-3">
          <button
            onClick={() => navigate("/")}
            aria-label="Back"
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-white shadow-sm border border-gray-100 text-gray-600 transition hover:bg-gray-50"
          >
            ←
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 md:text-3xl">📞 Call History</h1>
            <p className="text-sm text-gray-500">All your conversations with Yaara</p>
          </div>
        </div>

        {/* ── Stats grid ── */}
        <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
          {[
            { icon: Phone,       label: "Total Calls",   value: totalCalls },
            { icon: Clock,       label: "Total Time",    value: fmtDuration(totalSecs) },
            { icon: FileText,    label: "Completed",     value: completedCnt },
            { icon: Calendar,    label: "Today",         value: todayCnt },
          ].map(({ icon: Icon, label, value }) => (
            <div key={label} className="flex items-center gap-3 rounded-2xl bg-white p-4 shadow-sm border border-gray-100">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50">
                <Icon className="h-4 w-4 text-blue-500" />
              </div>
              <div>
                <p className="text-xl font-bold text-gray-900 leading-none">{value}</p>
                <p className="mt-0.5 text-xs text-gray-500">{label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* ── Call list ── */}
        {calls.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl bg-white py-16 shadow-sm border border-gray-100 text-center">
            <Phone className="mb-4 h-12 w-12 text-gray-300" />
            <h2 className="mb-1 text-lg font-semibold text-gray-700">No calls yet</h2>
            <p className="mb-5 text-sm text-gray-400">Start a conversation with Yaara to see your history here.</p>
            <button
              onClick={() => navigate("/talk")}
              className="rounded-xl bg-blue-500 px-5 py-2.5 text-sm font-semibold text-white shadow transition hover:bg-blue-600"
            >
              Start Talking
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
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