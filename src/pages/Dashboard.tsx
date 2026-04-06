import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Play, Download, FileText, Calendar, Clock, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface CallRecording {
  id: string;
  startTime: string;
  endTime: string;
  duration: number;
  status: 'completed' | 'failed';
  transcript: Array<{
    id: string;
    role: 'user' | 'yaara' | 'system';
    text: string;
    timestamp: string;
    status: 'live' | 'final';
  }>;
  audioBlob: string | null;
}

const Dashboard = () => {
  const navigate = useNavigate();
  const [calls, setCalls] = useState<CallRecording[]>([]);
  const [selectedCall, setSelectedCall] = useState<CallRecording | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentAudio, setCurrentAudio] = useState<HTMLAudioElement | null>(null);

  // Load calls from localStorage
  useEffect(() => {
    const savedCalls = localStorage.getItem('yaara_calls');
    if (savedCalls) {
      try {
        const parsedCalls = JSON.parse(savedCalls);
        setCalls(parsedCalls);
      } catch (error) {
        console.error('Error loading calls:', error);
      }
    }
  }, []);

  const formatDuration = (seconds?: number) => {
    if (!seconds) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('hi-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const playRecording = async (call: CallRecording) => {
    if (!call.audioBlob) return;

    if (currentAudio) {
      currentAudio.pause();
      setIsPlaying(false);
    }

    const audio = new Audio(call.audioBlob);
    audio.onended = () => setIsPlaying(false);
    audio.onpause = () => setIsPlaying(false);
    audio.onplay = () => setIsPlaying(true);

    setCurrentAudio(audio);
    await audio.play();
  };

  useEffect(() => {
    return () => {
      if (currentAudio) {
        currentAudio.pause();
      }
    };
  }, [currentAudio]);

  const downloadRecording = (call: CallRecording) => {
    if (!call.audioBlob) return;

    const a = document.createElement('a');
    a.href = call.audioBlob;
    a.download = `yaara-call-${call.id}.webm`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const downloadTranscript = (call: CallRecording) => {
    const transcriptText = call.transcript
      .filter(t => t.role !== 'system')
      .map(t => {
        const timestamp = new Date(t.timestamp).toLocaleTimeString('hi-IN', {
          hour: '2-digit',
          minute: '2-digit',
        });
        const speaker = t.role === 'user' ? 'You' : 'Yaara';
        return `[${timestamp}] ${speaker}: ${t.text}`;
      })
      .join('\n\n');

    const blob = new Blob([transcriptText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `yaara-transcript-${call.id}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800';
      case 'active': return 'bg-blue-100 text-blue-800';
      case 'error': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="min-h-screen bg-background pb-28">
      <div className="mx-auto flex min-h-screen w-full max-w-screen-2xl flex-col px-4 md:px-8 lg:px-12">
        {/* Header */}
        <div className="flex items-center gap-3 pt-6 pb-4 md:pt-8 md:pb-5">
          <button
            onClick={() => navigate("/")}
            className="rounded-full bg-card p-3 shadow-sm"
            aria-label="Back"
          >
            <ArrowLeft className="h-6 w-6 text-foreground" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Call History</h1>
            <p className="text-muted-foreground">All your conversations with Yaara</p>
          </div>
        </div>

        {/* Stats */}
        <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-2xl font-bold">{calls.length}</p>
                  <p className="text-sm text-muted-foreground">Total Calls</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-2xl font-bold">
                    {formatDuration(calls.reduce((acc, call) => acc + call.duration, 0))}
                  </p>
                  <p className="text-sm text-muted-foreground">Total Time</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <User className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-2xl font-bold">
                    {calls.filter(c => c.status === 'completed').length}
                  </p>
                  <p className="text-sm text-muted-foreground">Completed</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-2xl font-bold">
                    {calls.filter(c => {
                      const today = new Date();
                      const callDate = new Date(c.startTime);
                      return callDate.toDateString() === today.toDateString();
                    }).length}
                  </p>
                  <p className="text-sm text-muted-foreground">Today</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Calls List */}
        <div className="space-y-4">
          {calls.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <FileText className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No calls yet</h3>
                <p className="text-muted-foreground mb-4">
                  Start a conversation with Yaara to see your call history here.
                </p>
                <Button onClick={() => navigate("/talk")}>
                  Start Talking to Yaara
                </Button>
              </CardContent>
            </Card>
          ) : (
            <>
              {[...calls]
                .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())
                .map((call) => (
                  <Card key={call.id} className="cursor-pointer hover:shadow-md transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">
                        Call on {formatDate(call.startTime)}
                      </CardTitle>
                      <Badge className={getStatusColor(call.status)}>
                        {call.status}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="h-4 w-4" />
                        {formatDuration(call.duration)}
                      </span>
                      <span className="flex items-center gap-1">
                        <FileText className="h-4 w-4" />
                        {call.transcript.filter(t => t.role !== 'system').length} messages
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2 mb-4">
                      {call.audioBlob && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => playRecording(call)}
                          className="flex items-center gap-2"
                        >
                          <Play className="h-4 w-4" />
                          Play
                        </Button>
                      )}
                      {call.audioBlob && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => downloadRecording(call)}
                          className="flex items-center gap-2"
                        >
                          <Download className="h-4 w-4" />
                          Audio
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => downloadTranscript(call)}
                        className="flex items-center gap-2"
                      >
                        <Download className="h-4 w-4" />
                        Transcript
                      </Button>
                      <Button
                        size="sm"
                        variant="default"
                        onClick={() => setSelectedCall((current) => current?.id === call.id ? null : call)}
                      >
                        {selectedCall?.id === call.id ? 'Hide' : 'View'} Details
                      </Button>
                    </div>

                    {selectedCall?.id === call.id && (
                      <div className="border-t pt-4">
                        <h4 className="font-semibold mb-3">Transcript</h4>
                        <div className="space-y-2 max-h-60 overflow-y-auto">
                          {call.transcript
                            .filter(t => t.role !== 'system')
                            .map((message) => (
                              <div
                                key={message.id}
                                className={cn(
                                  "rounded-lg p-3 text-sm",
                                  message.role === 'user'
                                    ? "bg-primary/10 ml-auto max-w-[80%]"
                                    : "bg-muted mr-auto max-w-[80%]"
                                )}
                              >
                                <div className="font-medium mb-1">
                                  {message.role === 'user' ? 'You' : 'Yaara'}
                                </div>
                                <div className="text-xs text-muted-foreground mb-1">
                                  {new Date(message.timestamp).toLocaleTimeString('hi-IN', {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}
                                </div>
                                {message.text}
                              </div>
                            ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;