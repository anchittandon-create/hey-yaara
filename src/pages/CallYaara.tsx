/**
 * CallYaara.tsx  –  Hey Yaara Voice Assistant
 *
 * Premium, minimal UI with 3 distinct states:
 * 1. Idle - Start conversation
 * 2. Active - Live transcript  
 * 3. Post-call - Summary
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { flushSync } from "react-dom";
import { Mic, MicOff, PhoneOff, Play, Pause, ArrowLeft, X, Clock, MessageCircle } from "lucide-react";
import { useFreeConversation } from "@/hooks/use-free-conversation";
import { callStorage } from "@/lib/call-storage";
import { useAuth } from "@/contexts/AuthContext";
import { DEFAULT_FEMALE_VOICE_ID, DEFAULT_MALE_VOICE_ID } from "@/lib/voice-options";
import VoiceOrb from "@/components/VoiceOrb";
import { useToast } from "@/hooks/use-toast";
import { YAARA_AGENT_PROMPT } from "@/lib/yaara-agent";
import { cn } from "@/lib/utils";

type TranscriptRole = "user" | "yaara";
type TranscriptStatus = "live" | "final";

interface TranscriptEntry {
  id: string;
  role: TranscriptRole;
  text: string;
  status: TranscriptStatus;
  timestamp: Date;
}

const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
const getFirstName = (name?: string | null) => name?.trim().split(/\s+/)[0] || "Friend";

const CallYaara = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();

  // Call states: 'idle' | 'active' | 'ended'
  const [callState, setCallState] = useState<'idle' | 'active' | 'ended'>('idle');
  const [connecting, setConnecting] = useState(false);
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [callError, setCallError] = useState<string | null>(null);
  const [transcripts, setTranscripts] = useState<TranscriptEntry[]>([]);
  
  // Voice gender selection
  const [voiceGender, setVoiceGender] = useState<"female" | "male">(user?.gender === "male" ? "male" : "female");
  const [sessionVoiceGender, setSessionVoiceGender] = useState<"female" | "male">("female");
  const [sessionVoiceId, setSessionVoiceId] = useState<string>(DEFAULT_FEMALE_VOICE_ID);

  const callStartTimeRef = useRef<Date | null>(null);
  const transcriptEndRef = useRef<HTMLDivElement>(null);

  const userFirstName = useMemo(() => getFirstName(user?.name), [user?.name]);

  const personalizedAgentPrompt = useMemo(
    () => `${YAARA_AGENT_PROMPT}\nUser: ${user?.name || userFirstName}\nAddress as ${userFirstName}. Keep it warm.`,
    [user?.name, userFirstName],
  );

  const chooseVoice = useCallback((gender: "female" | "male") => {
    if (callState !== 'idle') return;
    setVoiceGender(gender);
  }, [callState]);

  const upsert = useCallback((role: TranscriptRole, text: string, status: TranscriptStatus) => {
    setTranscripts(prev => {
      const next = [...prev];
      const lastIndex = next.length - 1;
      const last = next[lastIndex];
      if (status === "live" && last && last.role === role && last.status === "live") {
        next[lastIndex] = { ...last, text, timestamp: new Date() };
        return next;
      }
      if (status === "final" && last && last.role === role && last.status === "live") {
        next[lastIndex] = { ...last, text, status: "final", timestamp: new Date() };
        return next;
      }
      next.push({ id: uid(), role, text, status, timestamp: new Date() });
      return next;
    });
  }, []);

  const getSessionVoiceId = () => voiceGender === "female" 
    ? (user?.yaaraFemaleVoiceId || DEFAULT_FEMALE_VOICE_ID)
    : (user?.yaarMaleVoiceId || DEFAULT_MALE_VOICE_ID);

  const { mode: voiceMode, startSession, endSession, setMuted, agentAudioRef } = useFreeConversation({
    overrides: { 
      agent: { 
        prompt: { prompt: personalizedAgentPrompt },
        voicePreference: sessionVoiceGender,
        voiceId: sessionVoiceId,
      } 
    },
    onConnect: () => {
      setConnecting(false);
    },
    onDisconnect: () => {
      if (callState === 'active') {
        setCallState('ended');
      }
    },
    onModeChange: () => {},
    onMessage: (msg) => {
      const type = msg.type;
      const isFinal = msg.is_final !== false;
      const text = (msg.text || "").trim();
      if (!text) return;
      if (type === "user_speech") upsert("user", text, isFinal ? "final" : "live");
      if (type === "yaara_response") upsert("yaara", text, isFinal ? "final" : "live");
    },
    onError: (err) => {
      console.error("[UI] error:", err);
      setCallError("Connection issue");
      setConnecting(false);
    },
  });

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcripts]);

  const startCall = useCallback(async () => {
    if (connecting || callState !== 'idle') return;
    setCallError(null);
    setConnecting(true);
    setTranscripts([]);
    const timer = setTimeout(() => {
      flushSync(() => {
        setSessionVoiceGender(voiceGender);
        setSessionVoiceId(getSessionVoiceId());
        setCallState('active');
      });
    }, 1500);
    
    try {
      await startSession();
      callStartTimeRef.current = new Date();
    } catch (err) {
      console.error("[Call] start error:", err);
      setConnecting(false);
      setCallError("Could not start. Check mic permissions.");
    }
  }, [connecting, callState, startSession, voiceGender]);

  const endCall = useCallback(async () => {
    try { await endSession(); } catch {}
    setCallState('ended');
    const endTime = new Date();
    const startTime = callStartTimeRef.current ?? endTime;
    const durationSec = Math.round((endTime.getTime() - startTime.getTime()) / 1000);
    
    const callData = {
      id: uid(),
      userMobile: user?.mobile || "",
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      duration: durationSec,
      status: "completed" as const,
      transcript: transcripts.filter(t => t.status === "final").map(t => ({
        id: t.id,
        role: t.role,
        text: t.text,
        timestamp: t.timestamp.toISOString(),
        status: "final" as const,
      })),
      audioBlob: null,
      updatedAt: endTime.toISOString(),
    };
    try {
      await callStorage.saveCall(callData);
    } catch (err) {
      console.error("[Call] save failed:", err);
    }
  }, [endSession, transcripts, user?.mobile]);

  const toggleMute = useCallback(() => {
    const next = !isMicMuted;
    setIsMicMuted(next);
    setMuted(next);
  }, [isMicMuted, setMuted]);

  const startNewCall = useCallback(() => {
    setCallState('idle');
    setTranscripts([]);
    setIsMicMuted(false);
    setCallError(null);
  }, []);

  // Call duration for post-call state
  const callDuration = useMemo(() => {
    if (!callStartTimeRef.current) return "0:00";
    const end = new Date();
    const diff = Math.round((end.getTime() - callStartTimeRef.current.getTime()) / 1000);
    const m = Math.floor(diff / 60);
    const s = diff % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  }, [callState === 'ended' ? callStartTimeRef.current : null]);

  return (
    <div className="fixed inset-0 flex bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-white">
      {/* Background glow */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
      </div>

      {/* HEADER */}
      <div className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between p-6">
        <button onClick={() => navigate("/")} className="p-3 rounded-full bg-white/5 hover:bg-white/10 transition">
          <ArrowLeft className="h-5 w-5" />
        </button>
        
        {/* Gender Toggle - Only in Idle state */}
        {callState === 'idle' && (
          <div className="flex gap-2">
            <button
              onClick={() => chooseVoice("female")}
              className={cn(
                "px-4 py-2 rounded-full text-sm font-medium transition",
                voiceGender === "female" 
                  ? "bg-blue-500 text-white" 
                  : "bg-white/10 text-slate-400 hover:bg-white/20"
              )}
            >
              Yaara (F)
            </button>
            <button
              onClick={() => chooseVoice("male")}
              className={cn(
                "px-4 py-2 rounded-full text-sm font-medium transition",
                voiceGender === "male" 
                  ? "bg-blue-500 text-white" 
                  : "bg-white/10 text-slate-400 hover:bg-white/20"
              )}
            >
              Yaar (M)
            </button>
          </div>
        )}
        
        <div className="w-12" />
      </div>

      {/* MAIN CONTENT */}
      <div className="relative z-10 flex flex-1 flex-col items-center justify-center p-6">
        
        {/* STATE 1: IDLE */}
        {callState === 'idle' && (
          <div className="flex flex-col items-center gap-8">
            {/* Subtitle */}
            <p className="text-slate-400 text-lg">Your AI voice companion</p>
            
            {/* Main Mic Button */}
            <button
              onClick={startCall}
              disabled={connecting}
              className="group relative"
            >
              {/* Glow effect */}
              <div className="absolute inset-0 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 blur-xl opacity-50 group-hover:opacity-75 transition" />
              
              <div className={cn(
                "relative h-40 w-40 rounded-full flex items-center justify-center transition",
                connecting 
                  ? "bg-slate-800 animate-pulse" 
                  : "bg-gradient-to-br from-amber-500 to-orange-600 group-hover:scale-105"
              )}>
                {connecting ? (
                  <div className="h-12 w-12 border-4 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
                ) : (
                  <Mic className="h-16 w-16 text-white" />
                )}
              </div>
            </button>
            
            {/* Single CTA */}
            <p className="text-white font-medium text-lg">
              {connecting ? "Connecting..." : "Start Conversation"}
            </p>
            
            {/* User name */}
            <p className="text-slate-500 text-sm">{userFirstName}</p>
          </div>
        )}

        {/* STATE 2: ACTIVE */}
        {callState === 'active' && (
          <div className="flex w-full max-w-4xl gap-8">
            {/* Center - Voice */}
            <div className="flex-1 flex flex-col items-center justify-center">
              {/* Animated Orb */}
              <div className="mb-8">
                <VoiceOrb
                  isActive={voiceMode === "speaking"}
                  isProcessing={voiceMode === "processing"}
                  isListening={voiceMode === "listening"}
                  size="xl"
                />
              </div>
              
              {/* Dynamic State Text */}
              <p className={cn(
                "text-2xl font-medium",
                voiceMode === "speaking" ? "text-amber-400" :
                voiceMode === "processing" ? "text-purple-400" :
                "text-blue-400"
              )}>
                {voiceMode === "speaking" ? "Speaking..." :
                 voiceMode === "processing" ? "Thinking..." :
                 "Listening..."}
              </p>
              
              {/* Bottom Controls */}
              <div className="flex gap-4 mt-8">
                <button
                  onClick={toggleMute}
                  className={cn(
                    "px-6 py-3 rounded-full font-medium transition",
                    isMicMuted 
                      ? "bg-orange-500 text-white" 
                      : "border border-white/30 text-white hover:bg-white/10"
                  )}
                >
                  {isMicMuted ? "Unmute" : "Mute"}
                </button>
                <button
                  onClick={endCall}
                  className="px-8 py-3 rounded-full bg-red-500 text-white font-medium hover:bg-red-600 transition"
                >
                  End Call
                </button>
              </div>
            </div>
            
            {/* Right Panel - Live Transcript */}
            <div className="w-96 bg-slate-900/50 backdrop-blur-xl rounded-2xl p-6 border border-white/10">
              <div className="flex items-center gap-2 mb-4">
                <MessageCircle className="h-4 w-4 text-amber-400" />
                <span className="text-sm font-medium text-slate-400">Live Transcript</span>
              </div>
              
              <div className="space-y-3 max-h-80 overflow-y-auto">
                {transcripts.length === 0 ? (
                  <p className="text-slate-500 text-sm">Listening...</p>
                ) : (
                  transcripts.map(t => (
                    <div key={t.id} className={cn(
                      "p-3 rounded-xl text-sm",
                      t.role === "user" 
                        ? "bg-blue-500/20 text-blue-200 ml-6" 
                        : "bg-amber-500/20 text-amber-200 mr-6"
                    )}>
                      <span className="text-xs font-bold opacity-60 block mb-1">
                        {t.role === "user" ? "You" : "Yaara"}
                      </span>
                      {t.text}
                    </div>
                  ))
                )}
                <div ref={transcriptEndRef} />
              </div>
            </div>
          </div>
        )}

        {/* STATE 3: POST-CALL */}
        {callState === 'ended' && (
          <div className="flex w-full max-w-4xl gap-8">
            {/* Center - Summary */}
            <div className="flex-1 flex flex-col items-center justify-center">
              {/* Static Mic with low glow */}
              <div className="relative mb-8">
                <div className="absolute inset-0 rounded-full bg-amber-500/20 blur-xl" />
                <div className="relative h-32 w-32 rounded-full bg-slate-800 flex items-center justify-center">
                  <Mic className="h-12 w-12 text-slate-500" />
                </div>
              </div>
              
              {/* Call Summary Card */}
              <div className="bg-slate-900/50 backdrop-blur-xl rounded-2xl p-8 border border-white/10 text-center">
                <h2 className="text-2xl font-bold text-white mb-4">Call Summary</h2>
                
                {/* Duration */}
                <div className="flex items-center justify-center gap-2 mb-6">
                  <Clock className="h-5 w-5 text-amber-400" />
                  <span className="text-3xl font-bold text-white">{callDuration}</span>
                </div>
                
                {/* Actions */}
                <div className="flex flex-col gap-3">
                  <button
                    onClick={startNewCall}
                    className="px-8 py-3 rounded-full bg-gradient-to-r from-amber-500 to-orange-600 text-white font-medium hover:scale-105 transition"
                  >
                    Start New Call
                  </button>
                  <button
                    onClick={() => navigate("/history")}
                    className="px-8 py-3 rounded-full border border-white/30 text-white font-medium hover:bg-white/10 transition"
                  >
                    View Full Transcript
                  </button>
                </div>
              </div>
            </div>
            
            {/* Right Panel - Transcript Preview */}
            <div className="w-96 bg-slate-900/50 backdrop-blur-xl rounded-2xl p-6 border border-white/10">
              <div className="flex items-center gap-2 mb-4">
                <MessageCircle className="h-4 w-4 text-slate-400" />
                <span className="text-sm font-medium text-slate-400">Transcript</span>
              </div>
              
              <div className="space-y-3 max-h-80 overflow-y-auto">
                {transcripts.filter(t => t.status === "final").map(t => (
                  <div key={t.id} className={cn(
                    "p-3 rounded-xl text-sm",
                    t.role === "user" 
                      ? "bg-blue-500/20 text-blue-200" 
                      : "bg-amber-500/20 text-amber-200"
                  )}>
                    <span className="text-xs font-bold opacity-60 block mb-1">
                      {t.role === "user" ? "You" : "Yaara"}
                    </span>
                    {t.text}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CallYaara;