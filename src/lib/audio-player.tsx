import { useEffect, useRef, useState } from "react"
import { getAudioSignedUrl } from "./cloud-sync"

export default function AudioPlayer({ audioPath }: { audioPath: string | null }) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [url, setUrl] = useState<string | null>(null)
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [duration, setDuration] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState<boolean>(false)

  // Load signed URL
  useEffect(() => {
    if (!audioPath) return
    
    setLoading(true)
    setError(null)
    
    getAudioSignedUrl(audioPath)
      .then((signedUrl) => {
        if (signedUrl) {
          setUrl(signedUrl)
        } else {
          setError("Could not load audio")
        }
      })
      .catch((err) => {
        console.error("Audio URL error:", err)
        setError("Failed to load audio")
      })
      .finally(() => setLoading(false))
  }, [audioPath])

  // Progress tracking
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    
    const update = () => {
      setProgress(audio.currentTime)
    }
    
    audio.addEventListener("timeupdate", update)
    audio.addEventListener("loadedmetadata", () => {
      setDuration(audio.duration)
    })
    
    return () => {
      audio.removeEventListener("timeupdate", update)
      audio.removeEventListener("loadedmetadata", () => setDuration(audio.duration))
    }
  }, [url])

  const togglePlay = async () => {
    const audio = audioRef.current
    if (!audio) return
    
    try {
      if (playing) {
        audio.pause()
      } else {
        await audio.play()
      }
      setPlaying(!playing)
    } catch (err) {
      console.error("Playback error:", err)
      setError("Playback failed")
    }
  }

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current
    if (!audio) return
    
    const val = Number(e.target.value)
    audio.currentTime = val
    setProgress(val)
  }

  const formatTime = (t: number) => {
    const m = Math.floor(t / 60)
    const s = Math.floor(t % 60)
    return `${m}:${s < 10 ? "0" : ""}${s}`
  }

  if (!audioPath) {
    return <div className="text-gray-400 text-sm text-center py-4">No audio available</div>
  }

  if (loading) {
    return <div className="flex items-center justify-center py-4">
      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
      <span className="ml-2 text-sm text-gray-500">Loading audio...</span>
    </div>
  }

  if (error) {
    return <div className="text-red-500 text-sm text-center py-4">{error}</div>
  }

  return (
    <div className="flex items-center gap-3 bg-[#1e293b] p-4 rounded-xl border border-[rgba(255,255,255,0.1)]">
      
      {/* Play Button */}
      <button
        onClick={togglePlay}
        disabled={loading || error}
        className="w-11 h-11 rounded-full flex items-center justify-center transition-all duration-200"
        :class="{ 
          'bg-blue-500 text-white hover:bg-blue-600': !playing,
          'bg-gray-500 text-white hover:bg-gray-600': playing
        }"
      >
        {playing ? "❚❚" : "▶"}
      </button>
      
      {/* Progress Section */}
      <div className="flex-1 min-w-0">
        <input
          type="range"
          min={0}
          max={duration || 100}
          value={progress}
          onChange={handleSeek}
          className="w-full h-2 bg-gray-700 rounded appearance-none cursor-pointer"
          style={{ 
            "&::-webkit-slider-thumb": { 
              appearance: "none", 
              width: "12px", 
              height: "12px", 
              background: "blue-500", 
              borderRadius: "50%", 
              cursor: "pointer" 
            } 
          }}
        />
        <div className="flex justify-between text-xs text-gray-400 mt-1">
          <span>{formatTime(progress)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>
      
      {/* Download Button */}
      {url && (
        <a
          href={url}
          download={`call-recording-${Date.now()}.webm`}
          className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300"
        >
          <span>⬇️</span>
          <span>Download</span>
        </a>
      )}
      
      {/* Hidden audio element */}
      {url && (
        <audio
          ref={audioRef}
          src={url}
          onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
          onEnded={() => setPlaying(false)}
          onError={(e) => {
            console.error("Audio element error:", e)
            setError("Audio playback error")
          }}
        />
      )}
    </div>
  )
}