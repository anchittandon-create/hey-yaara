import { useEffect, useRef, useState } from "react"
import WaveSurfer from "wavesurfer.js"
import { getAudioSignedUrl } from "./cloud-sync"

export default function WaveformPlayer({ audioPath }: { audioPath: string | null }) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const waveRef = useRef<any>(null)
  const [playing, setPlaying] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!containerRef.current || !audioPath) {
      setLoading(false)
      return
    }
    let isMounted = true
    async function init() {
      try {
        const url = await getAudioSignedUrl(audioPath)
        if (!url || !isMounted) return
        const wave = WaveSurfer.create({
          container: containerRef.current!,
          waveColor: "#4f46e5",
          progressColor: "#22c55e",
          height: 40,
          barWidth: 2,
          barGap: 2,
          responsive: true,
          // Hide cursor for cleaner look
          cursorWidth: 0,
        })
        wave.load(url)
        wave.on("ready", () => {
          if (!isMounted) return
          setLoading(false)
        })
        wave.on("finish", () => {
          setPlaying(false)
        })
        wave.on("error", (err: any) => {
          console.error("WaveSurfer error:", err)
          setError("Failed to load audio")
          setLoading(false)
        })
        waveRef.current = wave
      } catch (err) {
        console.error("Waveform init error:", err)
        setError("Failed to initialize player")
        setLoading(false)
      }
    }
    init()
    return () => {
      isMounted = false
      waveRef.current?.destroy()
    }
  }, [audioPath])

  const toggle = () => {
    if (!waveRef.current) return
    waveRef.current.playPause()
    setPlaying(waveRef.current.isPlaying())
  }

  if (error) {
    return <div className="text-red-500 text-sm text-center py-4">{error}</div>
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

  return (
    <div className="flex items-center gap-3 bg-[#0f172a] p-3 rounded-xl border border-[rgba(255,255,255,0.1)]">
      
      {/* Play button */}
      <button
        onClick={toggle}
        className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200 ${playing ? "bg-gray-500 text-white hover:bg-gray-600" : "bg-blue-500 text-white hover:bg-blue-600"}`}
      >
        {playing ? "❚❚" : "▶"}
      </button>
      
      {/* Waveform */}
      <div className="flex-1">
        <div ref={containerRef} />
      </div>
    </div>
  )
}