import { motion } from 'framer-motion'
import { AlertTriangle, Clock, Pause, Play, SkipBack, SkipForward, Users, Zap } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'

interface TimelineFrame {
  timestamp: number
  holderCount: number
  topHolders: Array<{ address: string; pct: number }>
  events: Array<{ type: 'launch' | 'sniper' | 'bundle' | 'rug' | 'whale'; description: string }>
  riskScore: number
}

interface TemporalPlaybackProps {
  frames: TimelineFrame[]
  onFrameChange?: (frame: TimelineFrame) => void
}

export default function TemporalPlayback({ frames, onFrameChange }: TemporalPlaybackProps) {
  const [currentFrame, setCurrentFrame] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [speed, setSpeed] = useState(1)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const frame = frames[currentFrame] || null

  const play = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current)
    intervalRef.current = setInterval(() => {
      setCurrentFrame((prev) => {
        const next = prev + 1
        if (next >= frames.length) {
          setIsPlaying(false)
          return prev
        }
        return next
      })
    }, 1000 / speed)
  }, [frames.length, speed])

  const pause = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [])

  useEffect(() => {
    if (isPlaying) play()
    else pause()
    return () => pause()
  }, [isPlaying, play, pause])

  useEffect(() => {
    if (frame && onFrameChange) onFrameChange(frame)
  }, [currentFrame, frame, onFrameChange])

  if (!frames.length) return null

  const progress = ((currentFrame + 1) / frames.length) * 100
  const dateStr = frame ? new Date(frame.timestamp).toLocaleDateString() : ''
  const timeStr = frame ? new Date(frame.timestamp).toLocaleTimeString() : ''

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="glass-card rounded-[16px] p-5">
      <div className="flex items-center gap-2.5 mb-4">
        <div className="w-8 h-8 rounded-[9px] bg-cyan-500/10 flex items-center justify-center">
          <Clock className="w-[15px] h-[15px] text-cyan-400" />
        </div>
        <div>
          <h3 className="text-[14px] font-semibold text-[#F1F1F6]">Temporal Playback</h3>
        </div>
        <span className="badge badge-info text-[9.5px] ml-auto">{frames.length} frames</span>
      </div>

      {/* Timeline Scrubber */}
      <div className="mb-4">
        <div
          className="h-2 rounded-full bg-[rgba(255,255,255,0.05)] overflow-hidden cursor-pointer"
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect()
            const pct = (e.clientX - rect.left) / rect.width
            setCurrentFrame(Math.floor(pct * (frames.length - 1)))
          }}
        >
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-purple-400"
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
        <div className="flex justify-between mt-1 text-[9px] text-[#5C6080]">
          <span>Launch</span>
          <span>
            {dateStr} {timeStr}
          </span>
          <span>Now</span>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-3 mb-4">
        <button
          onClick={() => setCurrentFrame(0)}
          className="p-2 rounded-[8px] hover:bg-[rgba(255,255,255,0.05)] text-[#5C6080]"
        >
          <SkipBack className="w-4 h-4" />
        </button>
        <button
          onClick={() => setIsPlaying(!isPlaying)}
          className="p-2.5 rounded-[10px] bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 hover:bg-cyan-500/20"
        >
          {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
        </button>
        <button
          onClick={() => setCurrentFrame(Math.min(frames.length - 1, currentFrame + 10))}
          className="p-2 rounded-[8px] hover:bg-[rgba(255,255,255,0.05)] text-[#5C6080]"
        >
          <SkipForward className="w-4 h-4" />
        </button>
        <div className="flex items-center gap-1 ml-auto">
          {[0.5, 1, 2, 4].map((s) => (
            <button
              key={s}
              onClick={() => setSpeed(s)}
              className={`px-2 py-1 rounded-[6px] text-[10px] ${speed === s ? 'bg-cyan-500/20 text-cyan-400' : 'text-[#5C6080] hover:text-[#9DA0B0]'}`}
            >
              {s}x
            </button>
          ))}
        </div>
      </div>

      {/* Frame Stats */}
      {frame && (
        <div className="grid grid-cols-3 gap-2">
          <div className="p-2.5 rounded-[10px] bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.04)]">
            <div className="text-[10px] text-[#5C6080] mb-1">Holders</div>
            <div className="text-[14px] font-bold text-[#F1F1F6] font-mono">{frame.holderCount.toLocaleString()}</div>
          </div>
          <div className="p-2.5 rounded-[10px] bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.04)]">
            <div className="text-[10px] text-[#5C6080] mb-1">Risk</div>
            <div
              className={`text-[14px] font-bold font-mono ${frame.riskScore >= 70 ? 'text-[#FF3366]' : frame.riskScore >= 40 ? 'text-[#F59E0B]' : 'text-emerald-400'}`}
            >
              {frame.riskScore}/100
            </div>
          </div>
          <div className="p-2.5 rounded-[10px] bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.04)]">
            <div className="text-[10px] text-[#5C6080] mb-1">Events</div>
            <div className="text-[14px] font-bold text-[#F1F1F6] font-mono">{frame.events.length}</div>
          </div>
        </div>
      )}

      {/* Events */}
      {frame?.events && frame.events.length > 0 && (
        <div className="mt-3 space-y-1.5">
          {frame!.events.slice(0, 3).map((event, i) => (
            <div key={i} className="flex items-center gap-2 text-[11px]">
              {event.type === 'sniper' && <Zap className="w-3.5 h-3.5 text-[#F59E0B]" />}
              {event.type === 'bundle' && <Users className="w-3.5 h-3.5 text-[#8B5CF6]" />}
              {event.type === 'rug' && <AlertTriangle className="w-3.5 h-3.5 text-[#FF3366]" />}
              {event.type === 'whale' && <Users className="w-3.5 h-3.5 text-[#F59E0B]" />}
              {event.type === 'launch' && <Clock className="w-3.5 h-3.5 text-emerald-400" />}
              <span className="text-[#9DA0B0]">{event.description}</span>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  )
}
