'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/db/client'
import { signOut } from '@/lib/auth/actions'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Issue, Profile, Department } from '@/lib/db/types'
import {
  Plus,
  LogOut,
  Star,
  MapPin,
  Clock,
  ChevronRight,
  CheckCircle2,
  Clock3,
  AlertCircle,
  Award,
  Building,
  ShieldCheck,
  Zap,
  Leaf,
  Trash2,
  Wrench,
  ShieldAlert,
  Calendar,
  TrendingUp,
  Sparkles,
  Cpu,
  Database,
  ArrowUpRight,
  ExternalLink,
  Activity,
  CheckSquare,
  Info,
  FileText,
  Loader2,
  Globe,
  AlertTriangle,
  Share2,
  MinusCircle,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { IssueMapPanel } from './IssueMapPanel'
import { Agent2MapVisuals } from './Agent2MapVisuals'
import { CitizenLeaderboardPanel } from './CitizenLeaderboardPanel'
import { MiniMapWidget } from './MiniMapWidget'
import { MarkdownRenderer } from '@/components/ui/markdown'

// Categories metadata for styling
const CATEGORY_DETAILS: Record<string, { icon: any; label: string; color: string; bgColor: string; borderColor: string }> = {
  infrastructure: {
    icon: Wrench,
    label: 'Infrastructure',
    color: 'text-[#2f3fa8]',
    bgColor: 'bg-sky/60',
    borderColor: 'border-black/10'
  },
  sanitation: {
    icon: Trash2,
    label: 'Sanitation',
    color: 'text-emerald-700',
    bgColor: 'bg-olive/60',
    borderColor: 'border-black/10'
  },
  safety: {
    icon: ShieldAlert,
    label: 'Safety',
    color: 'text-red-700',
    bgColor: 'bg-blush/60',
    borderColor: 'border-black/10'
  },
  utilities: {
    icon: Zap,
    label: 'Utilities',
    color: 'text-amber-700',
    bgColor: 'bg-sun/60',
    borderColor: 'border-black/10'
  },
  environment: {
    icon: Leaf,
    label: 'Environment',
    color: 'text-teal-700',
    bgColor: 'bg-olive/60',
    borderColor: 'border-black/10'
  },
  miscellaneous: {
    icon: Info,
    label: 'Miscellaneous',
    color: 'text-stone-600',
    bgColor: 'bg-black/5',
    borderColor: 'border-black/10'
  }
}

// Status styling mapping
const STATUS_DETAILS: Record<string, { label: string; bgClass: string; borderClass: string; textClass: string; dotClass: string }> = {
  open: {
    label: 'Under Review',
    bgClass: 'bg-sky/60',
    borderClass: 'border-black/10',
    textClass: 'text-[#2f3fa8]',
    dotClass: 'bg-[#5a6fd0]'
  },
  in_progress: {
    label: 'In Progress',
    bgClass: 'bg-sun/60',
    borderClass: 'border-black/10',
    textClass: 'text-amber-700',
    dotClass: 'bg-sun-deep'
  },
  resolved: {
    label: 'Resolved',
    bgClass: 'bg-olive/60',
    borderClass: 'border-black/10',
    textClass: 'text-emerald-700',
    dotClass: 'bg-olive-deep'
  },
  false_closure: {
    label: 'Disputed',
    bgClass: 'bg-blush/60',
    borderClass: 'border-black/10',
    textClass: 'text-rose-700',
    dotClass: 'bg-rose-500'
  },
  closed: {
    label: 'Closed',
    bgClass: 'bg-card/40',
    borderClass: 'border-border',
    textClass: 'text-muted-foreground',
    dotClass: 'bg-stone-400'
  }
}

function getKarmaLevel(score: number) {
  if (score >= 300) return { name: 'Civic Ambassador', level: 4, min: 300, max: 1000, next: 'Max Level' }
  if (score >= 150) return { name: 'Civic Champion', level: 3, min: 150, max: 300, next: 'Civic Ambassador' }
  if (score >= 50) return { name: 'Civic Guardian', level: 2, min: 50, max: 150, next: 'Civic Champion' }
  return { name: 'Civic Observer', level: 1, min: 0, max: 50, next: 'Civic Guardian' }
}


// SLA helpers: progress of the SLA window elapsed (0-100) and urgency tone
function getSlaProgress(createdAt: string, deadline: string | null): number | null {
  if (!deadline) return null
  const start = new Date(createdAt).getTime()
  const end = new Date(deadline).getTime()
  if (!isFinite(start) || !isFinite(end) || end <= start) return null
  return Math.min(100, Math.max(0, ((Date.now() - start) / (end - start)) * 100))
}

function getSlaTone(pct: number | null, daysLeft: number | null, closed: boolean) {
  if (closed) return { bar: 'bg-olive-deep', text: 'text-emerald-700' }
  if ((daysLeft !== null && daysLeft < 0) || (pct !== null && pct >= 90)) return { bar: 'bg-[#d6553f]', text: 'text-rose-700' }
  if (pct !== null && pct >= 60) return { bar: 'bg-sun-deep', text: 'text-amber-700' }
  return { bar: 'bg-[#17140f]', text: 'text-[#2f3fa8]' }
}

export type PipelineState = 'done' | 'in_progress' | 'pending' | 'failed' | 'skipped'

const getAgentState = (currentStage: string | null, targetStage: string, isDuplicate?: boolean): PipelineState => {
  if (isDuplicate && (targetStage === 'agent3_validation' || targetStage === 'agent4_resolution' || targetStage === 'agent5_predictive')) {
    return 'skipped'
  }

  const stages = ['agent0_translation', 'agent1_classifier', 'agent2_deduplication', 'agent3_validation', 'awaiting_community_review', 'agent4_resolution', 'completed']
  const cleanCurrentStage = currentStage?.replace('_failed', '') || ''
  const currentIndex = currentStage ? stages.indexOf(cleanCurrentStage) : -1
  const targetIndex = stages.indexOf(targetStage)

  if (currentStage === `${targetStage}_failed`) return 'failed'
  if (currentIndex > targetIndex || currentStage === 'completed') return 'done'
  if (currentIndex === targetIndex && !currentStage?.endsWith('_failed')) return 'in_progress'
  return 'pending'
}

const AgentDot = ({ state }: { state: PipelineState }) => {
  if (state === 'done') return <div className="absolute -left-[33px] top-0.5 bg-[#17140f] border-4 border-background w-4 h-4 rounded-full flex items-center justify-center shadow-md shadow-black/10" />
  if (state === 'in_progress') return <div className="absolute -left-[33px] top-0.5 bg-sun-deep border-4 border-background w-4 h-4 rounded-full flex items-center justify-center shadow-md shadow-black/10 animate-pulse" />
  if (state === 'failed') return <div className="absolute -left-[33px] top-0.5 bg-rose-500 border-4 border-background w-4 h-4 rounded-full flex items-center justify-center shadow-md shadow-black/10" />
  if (state === 'skipped') return <div className="absolute -left-[33px] top-0.5 bg-stone-400 border-4 border-background w-4 h-4 rounded-full flex items-center justify-center shadow-md shadow-black/10" />
  return <div className="absolute -left-[33px] top-0.5 bg-stone-300 border-4 border-background w-4 h-4 rounded-full flex items-center justify-center shadow-md opacity-40" />
}

const AgentStatusBadge = ({ state, issueId, onRetry }: { state: PipelineState, issueId: string, onRetry: (issueId: string) => void }) => {
  if (state === 'failed') {
    return (
      <div className="flex items-center gap-2">
        <span className="text-[9px] font-bold text-rose-700 bg-blush/40 px-1.5 py-0.2 rounded border border-rose-700/30 uppercase tracking-wide leading-none">FAILED</span>
        <button
          onClick={() => onRetry(issueId)}
          className="text-[9px] font-bold text-stone-600 bg-stone-300 hover:bg-stone-300 px-2 py-0.5 rounded border border-black/15 transition-colors uppercase cursor-pointer"
        >
          Retry
        </button>
      </div>
    )
  }
  if (state === 'done') {
    return <span className="text-[9px] font-bold text-emerald-700 bg-olive/40 px-1.5 py-0.2 rounded border border-olive-deep/40 uppercase tracking-wide leading-none">DONE</span>
  }
  if (state === 'skipped') {
    return <span className="text-[9px] font-bold text-stone-600 bg-stone-400 px-1.5 py-0.2 rounded border border-black/10 uppercase tracking-wide leading-none">SKIPPED</span>
  }
  if (state === 'in_progress') {
    return <span className="text-[9px] font-bold text-amber-700 bg-sun/40 px-1.5 py-0.2 rounded border border-sun-deep/60 uppercase tracking-wide flex items-center gap-1"><Loader2 className="w-2.5 h-2.5 animate-spin" /> IN PROGRESS</span>
  }
  return <span className="text-[9px] font-bold text-muted-foreground bg-muted px-1.5 py-0.2 rounded border border-border uppercase tracking-wide leading-none">PENDING</span>
}

interface Props {
  user: any
  profile: Profile | null
  initialIssues: Issue[]
  departments: Department[]
}

function Agent1Visuals({ issue, isRunning }: { issue: Issue, isRunning: boolean }) {
  const [spinCategory, setSpinCategory] = useState('Analyzing...')
  const [spinSeverity, setSpinSeverity] = useState(0)

  useEffect(() => {
    if (isRunning) {
      const categories = ['Infrastructure', 'Sanitation', 'Safety', 'Environment', 'Utilities', 'Miscellaneous']
      const interval = setInterval(() => {
        setSpinCategory(categories[Math.floor(Math.random() * categories.length)])
        setSpinSeverity(Math.floor(Math.random() * 10) + 1)
      }, 700)
      return () => clearInterval(interval)
    }
  }, [isRunning])

  const imageAnalysisText = issue.image_analysis;

  return (
    <div className="mt-3 space-y-3">
      {issue.photo_url && (
        <div className="relative w-full h-32 sm:h-40 rounded-xl overflow-hidden border border-border bg-black/50">
          <img src={issue.photo_url} className={`w-full h-full object-cover transition-all duration-500 ${isRunning ? 'opacity-50 grayscale' : 'opacity-100'}`} alt="Scanning" />
          {isRunning && (
            <>
              <motion.div
                animate={{ top: ['0%', '100%', '0%'] }}
                transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
                className="absolute left-0 w-full h-[2px] bg-[#17140f] shadow-[0_0_15px_3px_rgba(9,105,218,0.8)] z-10"
              />
              <div className="absolute inset-0 bg-sky/40 animate-pulse mix-blend-overlay" />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="bg-black/70 text-[#2f3fa8] text-[10px] font-bold px-2 py-1 rounded border border-black/15 uppercase tracking-widest backdrop-blur-sm flex items-center gap-1.5">
                  <Loader2 className="w-3 h-3 animate-spin" /> Scanning Vision Model
                </span>
              </div>
            </>
          )}
        </div>
      )}

      <div className="flex flex-col gap-2 bg-card/30 p-2.5 rounded-lg border border-border text-[10px] overflow-hidden">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <div className="flex items-center w-[170px] shrink-0">
            <span className="text-muted-foreground font-semibold">Subcategory:</span>
            <span className={`ml-1 font-medium capitalize transition-colors flex ${isRunning ? 'text-[#2f3fa8] font-mono' : 'text-muted-foreground'}`}>
              <AnimatePresence mode="popLayout">
                <motion.span
                  key={isRunning ? spinCategory : (issue.subcategory || 'N/A')}
                  initial={{ y: 15, opacity: 0, filter: 'blur(4px)' }}
                  animate={{ y: 0, opacity: 1, filter: 'blur(0px)' }}
                  exit={{ y: -15, opacity: 0, filter: 'blur(4px)' }}
                  transition={{ duration: 0.4 }}
                  className="inline-block"
                >
                  {isRunning ? spinCategory : (issue.subcategory || 'N/A')}
                </motion.span>
              </AnimatePresence>
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-muted-foreground font-semibold">Severity Score:</span>
            <span className={`font-bold transition-colors flex items-center ${isRunning ? 'text-[#2f3fa8] font-mono' : (issue.severity >= 7 ? 'text-rose-700' : issue.severity >= 4 ? 'text-amber-700' : 'text-emerald-700')}`}>
              <AnimatePresence mode="popLayout">
                <motion.span
                  key={isRunning ? spinSeverity : issue.severity}
                  initial={{ y: 15, opacity: 0, filter: 'blur(4px)' }}
                  animate={{ y: 0, opacity: 1, filter: 'blur(0px)' }}
                  exit={{ y: -15, opacity: 0, filter: 'blur(4px)' }}
                  transition={{ duration: 0.4 }}
                  className="inline-block"
                >
                  {isRunning ? spinSeverity : issue.severity}
                </motion.span>
              </AnimatePresence>
              <span>/10</span>
            </span>
            <div className="w-16 bg-background rounded-full h-1.5 border border-border overflow-hidden shrink-0 ml-1">
              <div
                className={`h-full rounded-full transition-all duration-300 ${isRunning ? 'bg-[#17140f]' : (issue.severity >= 7 ? 'bg-rose-500' : issue.severity >= 4 ? 'bg-sun-deep' : 'bg-olive-deep')}`}
                style={{ width: `${isRunning ? spinSeverity * 10 : (issue.severity || 0) * 10}%` }}
              />
            </div>
          </div>
        </div>

        {imageAnalysisText && !isRunning && (
          <div className="mt-4 bg-sky/40 border border-black/15 rounded-xl p-4 sm:p-5">
            <span className="text-[11px] font-bold text-[#2f3fa8] uppercase tracking-widest flex items-center gap-1.5 mb-2.5">
              <Sparkles className="w-4 h-4" /> Visual Analysis
            </span>
            <MarkdownRenderer content={imageAnalysisText} />
          </div>
        )}
      </div>
    </div>
  )
}

function Agent3Visuals({ isRunning, issue }: { isRunning: boolean, issue: any }) {
  // Use exact database tracking if available. If still running or missing DB fields, assume true (running state).
  // When done, if the field is explicitly false, we mark it as skipped.
  const skipWeather = !isRunning && issue?.weather_checked === false;
  const skipWebSearch = !isRunning && issue?.web_search_checked === false;

  return (
    <div className="mt-4 bg-black/40 border border-border rounded-xl p-4 sm:p-6 overflow-hidden relative">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 sm:gap-2 relative z-20">

        {/* Step 1: Weather */}
        <div className={`flex flex-col items-center text-center gap-2 shrink-0 transition-opacity duration-300 w-24 ${skipWeather ? 'opacity-50' : 'opacity-100'}`}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${isRunning ? 'bg-sky/40 text-[#2f3fa8] animate-pulse ring-2 ring-[#17140f]/40' : skipWeather ? 'bg-muted/50 text-muted-foreground ring-1 ring-border' : 'bg-olive/60 text-emerald-700 ring-1 ring-emerald-500/50'}`}>
            {isRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : skipWeather ? <MinusCircle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
          </div>
          <div>
            <span className={`text-[11px] font-mono block ${isRunning ? 'text-[#2f3fa8]' : skipWeather ? 'text-muted-foreground' : 'text-emerald-700'}`}>
              {skipWeather ? 'Weather Call Skipped' : 'Check Open-Meteo'}
            </span>
          </div>
        </div>

        {/* Progress Line 1 */}
        <div className="hidden sm:block h-[2px] flex-1 bg-border/50 relative rounded-full overflow-hidden">
          <div className={`absolute left-0 top-0 bottom-0 transition-all duration-1000 ${isRunning ? 'w-full animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-[#17140f] to-transparent' : 'w-full bg-olive-deep'}`} />
        </div>

        {/* Step 2: Web Search */}
        <div className={`flex flex-col items-center text-center gap-2 shrink-0 transition-opacity duration-300 w-24 ${skipWebSearch ? 'opacity-50' : 'opacity-100'}`}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${isRunning ? 'bg-sun/60 text-amber-700 animate-pulse ring-2 ring-amber-500/50' : skipWebSearch ? 'bg-muted/50 text-muted-foreground ring-1 ring-border' : 'bg-olive/60 text-emerald-700 ring-1 ring-emerald-500/50'}`}>
            {isRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : skipWebSearch ? <MinusCircle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
          </div>
          <div>
            <span className={`text-[11px] font-mono block ${isRunning ? 'text-amber-700' : skipWebSearch ? 'text-muted-foreground' : 'text-emerald-700'}`}>
              {skipWebSearch ? 'Web Search Skipped' : 'Web Search'}
            </span>
          </div>
        </div>

        {/* Progress Line 2 */}
        <div className="hidden sm:block h-[2px] flex-1 bg-border/50 relative rounded-full overflow-hidden">
          <div className={`absolute left-0 top-0 bottom-0 transition-all duration-1000 ${isRunning ? 'w-full animate-[shimmer_1.5s_infinite_0.2s] bg-gradient-to-r from-transparent via-amber-500 to-transparent' : 'w-full bg-olive-deep'}`} />
        </div>

        {/* Step 3: Synthesis */}
        <div className="flex flex-col items-center text-center gap-2 shrink-0 transition-opacity duration-300 opacity-100 w-24">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${isRunning ? 'bg-blush/60 text-purple-700 animate-pulse ring-2 ring-purple-500/50' : 'bg-olive/60 text-emerald-700 ring-1 ring-emerald-500/50'}`}>
            {isRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
          </div>
          <div>
            <span className={`text-[11px] font-mono block ${isRunning ? 'text-purple-700' : 'text-emerald-700'}`}>
              Synthesize Score
            </span>
          </div>
        </div>

      </div>
    </div>
  )
}

function Agent4Visuals({ isRunning }: { isRunning: boolean }) {
  return (
    <div className="mt-4 bg-black/40 border border-border rounded-xl p-4 sm:p-6 overflow-hidden relative">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 sm:gap-2 relative z-20">

        {/* Step 1: SOP Search */}
        <div className="flex flex-col items-center text-center gap-2 shrink-0 transition-opacity duration-300 opacity-100 w-24">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border ${isRunning ? 'bg-olive/60 text-teal-700 border-olive-deep/40 shadow-[0_0_10px_rgba(45,212,191,0.3)] animate-pulse' : 'bg-olive/60 text-emerald-700 border-olive-deep/40'}`}>
            {isRunning ? <Database className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
          </div>
          <div>
            <span className={`text-[11px] font-mono block ${isRunning ? 'text-teal-700' : 'text-emerald-700'}`}>
              Knowledge Base
            </span>
          </div>
        </div>

        {/* Progress Line 1 */}
        <div className="hidden sm:block h-[2px] flex-1 bg-border/50 relative rounded-full overflow-hidden">
          <div className={`absolute left-0 top-0 bottom-0 transition-all duration-1000 ${isRunning ? 'w-full animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-teal-500 to-transparent' : 'w-full bg-olive-deep'}`} />
        </div>

        {/* Step 2: Brief Drafting */}
        <div className="flex flex-col items-center text-center gap-2 shrink-0 transition-opacity duration-300 opacity-100 w-24">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border ${isRunning ? 'bg-sky/40 text-[#2f3fa8] border-black/15 shadow-[0_0_10px_rgba(9,105,218,0.3)] animate-pulse' : 'bg-olive/60 text-emerald-700 border-olive-deep/40'}`}>
            {isRunning ? <FileText className="w-4 h-4 animate-pulse" /> : <CheckCircle2 className="w-4 h-4" />}
          </div>
          <div>
            <span className={`text-[11px] font-mono block ${isRunning ? 'text-[#2f3fa8]' : 'text-emerald-700'}`}>
              Drafting Brief
            </span>
          </div>
        </div>

        {/* Progress Line 2 */}
        <div className="hidden sm:block h-[2px] flex-1 bg-border/50 relative rounded-full overflow-hidden">
          <div className={`absolute left-0 top-0 bottom-0 transition-all duration-1000 ${isRunning ? 'w-full animate-[shimmer_1.5s_infinite_0.2s] bg-gradient-to-r from-transparent via-[#17140f] to-transparent' : 'w-full bg-olive-deep'}`} />
        </div>

        {/* Step 3: SLA */}
        <div className="flex flex-col items-center text-center gap-2 shrink-0 transition-opacity duration-300 opacity-100 w-24">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border ${isRunning ? 'bg-sun/60 text-amber-700 border-sun-deep/60 shadow-[0_0_10px_rgba(245,158,11,0.3)] animate-pulse' : 'bg-olive/60 text-emerald-700 border-olive-deep/40'}`}>
            {isRunning ? <Calendar className="w-4 h-4 animate-pulse" /> : <CheckCircle2 className="w-4 h-4" />}
          </div>
          <div>
            <span className={`text-[11px] font-mono block ${isRunning ? 'text-amber-700' : 'text-emerald-700'}`}>
              Determine SLA
            </span>
          </div>
        </div>

      </div>
    </div>
  )
}

export function DashboardClient({ user, profile, initialIssues, departments }: Props) {
  const router = useRouter()
  const [issues, setIssues] = useState<Issue[]>(initialIssues)
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null)

  const [statusFilter, setStatusFilter] = useState('all') // 'all', 'active', 'resolved'
  const [categoryFilter, setCategoryFilter] = useState('all') // 'all', 'infrastructure', etc.
  const [isProfileOpen, setIsProfileOpen] = useState(false)
  const [isRetrying, setIsRetrying] = useState(false)
  const [isSettingLocation, setIsSettingLocation] = useState(false)
  const [nearbyReviews, setNearbyReviews] = useState<Issue[]>([])
  const [isFetchingReviews, setIsFetchingReviews] = useState(false)
  const [voteTally, setVoteTally] = useState<{ confirms: number; denies: number } | null>(null)
  const [isMapOpen, setIsMapOpen] = useState(false)
  const [isLeaderboardOpen, setIsLeaderboardOpen] = useState(false)
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null)

  // Get user's geolocation once on mount for the map center
  useEffect(() => {
    if (typeof window !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => { } // silently fall back to Nashik center in the map component
      )
    }
  }, [])

  // Auto-open issue from URL params
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      const issueId = params.get('issueId')
      if (issueId && initialIssues.length > 0) {
        const found = initialIssues.find(i => i.id === issueId)
        if (found) {
          setSelectedIssue(found)
          // Clean up URL without reloading
          window.history.replaceState({}, '', '/dashboard')
        }
      }
    }
  }, [initialIssues])

  useEffect(() => {
    if (selectedIssue?.status === 'community_review') {
      const fetchTally = async () => {
        try {
          const supabase = createClient()
          const { data } = await supabase.from('verifications').select('verdict').eq('issue_id', selectedIssue.id)
          if (data) {
            const confirms = data.filter(v => v.verdict).length
            const denies = data.filter(v => !v.verdict).length
            setVoteTally({ confirms, denies })
          }
        } catch (e) { }
      }
      fetchTally()
    } else {
      setVoteTally(null)
    }
  }, [selectedIssue])

  const fetchNearbyReviews = async () => {
    if (!profile?.home_location) return
    setIsFetchingReviews(true)
    try {
      const res = await fetch('/api/reviews')
      if (res.ok) {
        const data = await res.json()
        setNearbyReviews(data.issues || [])
      }
    } catch (e) {
      console.error(e)
    } finally {
      setIsFetchingReviews(false)
    }
  }

  useEffect(() => {
    fetchNearbyReviews()
  }, [profile?.home_location])

  const handleVote = async (issueId: string, verdict: boolean) => {
    const toastId = toast.loading('Submitting your vote...')
    try {
      const res = await fetch(`/api/reviews/${issueId}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ verdict })
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Failed to submit vote')
      }
      toast.success('Vote submitted successfully!', { id: toastId })
      setNearbyReviews(prev => prev.filter(i => i.id !== issueId))
    } catch (error: any) {
      toast.error(error.message, { id: toastId })
    }
  }

  const handleSetHomeLocation = () => {
    setIsSettingLocation(true)
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported by your browser')
      setIsSettingLocation(false)
      return
    }

    toast.loading('Finding your location...', { id: 'location-toast' })
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const lat = position.coords.latitude
          const lng = position.coords.longitude

          // Reverse geocode to get city/state
          let address = null
          try {
            const geoRes = await fetch(`/api/geocode?lat=${lat}&lng=${lng}`)
            if (geoRes.ok) {
              const geoData = await geoRes.json()
              if (geoData.address) {
                address = geoData.address
              }
            }
          } catch (e) {
            console.error('Geocoding failed:', e)
          }

          const res = await fetch('/api/profile/home-location', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId: user.id,
              lat,
              lng,
              address
            }),
          })
          if (!res.ok) throw new Error('Failed to save home location')
          toast.success('Home location saved successfully! Refreshing dashboard...', { id: 'location-toast' })
          setIsProfileOpen(false)
          setTimeout(() => window.location.reload(), 1500)
        } catch (error: any) {
          toast.error(error.message, { id: 'location-toast' })
        } finally {
          setIsSettingLocation(false)
        }
      },
      (error) => {
        toast.error('Unable to retrieve your location', { id: 'location-toast' })
        setIsSettingLocation(false)
      }
    )
  }

  const departmentMap = useMemo(() => {
    const map: Record<string, string> = {}
    departments.forEach(d => {
      map[d.id] = d.name
    })
    return map
  }, [departments])

  const handleRetry = async (issueId: string) => {
    setIsRetrying(true)
    toast.loading('Resuming pipeline...', { id: 'retry-toast' })
    try {
      const res = await fetch('/api/reports/retry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ issueId })
      })
      if (!res.ok) throw new Error('Failed to resume pipeline')
      toast.success('Pipeline resumed successfully', { id: 'retry-toast' })
    } catch (err: any) {
      toast.error(err.message, { id: 'retry-toast' })
    } finally {
      setIsRetrying(false)
    }
  }

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel('issues-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'issues',
          filter: `user_id=eq.${user.id}`,
        },
        payload => {
          if (payload.eventType === 'UPDATE') {
            const updatedIssue = payload.new as Issue
            setIssues(prev => {
              const exists = prev.some(i => i.id === updatedIssue.id)
              if (exists) {
                return prev.map(i => (i.id === updatedIssue.id ? updatedIssue : i))
              }
              return [updatedIssue, ...prev]
            })
            // Update selected issue if it's currently open
            setSelectedIssue(prev => (prev?.id === updatedIssue.id ? updatedIssue : prev))

            if (updatedIssue.pipeline_stage === 'failed' || updatedIssue.pipeline_stage?.endsWith('_failed')) {
              toast.error('Pipeline Failed', {
                description: `Error processing "${updatedIssue.title || 'your report'}". Please try again.`,
              })
            } else {
              toast.info('Status Updated', {
                description: `"${updatedIssue.title || 'Your report'}" status is now ${STATUS_DETAILS[updatedIssue.status]?.label || updatedIssue.status}.`,
              })
            }
          }
          if (payload.eventType === 'INSERT') {
            const newIssue = payload.new as Issue
            setIssues(prev => {
              if (prev.some(i => i.id === newIssue.id)) return prev
              return [newIssue, ...prev]
            })

            toast.success('New Issue Registered', {
              description: `"${newIssue.title || 'Your report'}" has been successfully processed by the AI pipeline.`,
            })
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user.id])

  // Statistics calculations
  const totalCount = issues.length
  const resolvedCount = issues.filter(i => i.status === 'resolved').length
  const activeCount = issues.filter(i => i.status === 'open' || i.status === 'in_progress').length
  const resolutionRate = totalCount > 0 ? Math.round((resolvedCount / totalCount) * 100) : 0

  // Filtered & Sorted issues
  const filteredIssues = useMemo(() => {
    return issues
      .filter(issue => {
        // Status matching
        let matchesStatus = true
        if (statusFilter === 'active') {
          matchesStatus = issue.status === 'open' || issue.status === 'in_progress'
        } else if (statusFilter === 'resolved') {
          matchesStatus = issue.status === 'resolved'
        }

        // Category matching
        const matchesCategory = categoryFilter === 'all' || issue.category === categoryFilter

        return matchesStatus && matchesCategory
      })
      .sort((a, b) => {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      })
  }, [issues, statusFilter, categoryFilter])

  // Karma Level Computations
  const karmaScore = profile?.karma_score || 0
  const karmaLvl = getKarmaLevel(karmaScore)
  const karmaProgress = karmaLvl.level === 4
    ? 100
    : Math.min(100, Math.max(0, ((karmaScore - karmaLvl.min) / (karmaLvl.max - karmaLvl.min)) * 100))
  const karmaToNext = karmaLvl.max - karmaScore

  // Helper for severity displays
  const getSeverityLabel = (s: number) => {
    if (s >= 7) return { text: 'High Priority', color: 'text-rose-700 border-black/10 bg-blush/60' }
    if (s >= 4) return { text: 'Medium Priority', color: 'text-amber-700 border-black/10 bg-sun/60' }
    return { text: 'Low Priority', color: 'text-emerald-700 border-black/10 bg-olive/60' }
  }

  // Helper for SLA days calculation
  const getSlaDaysRemaining = (deadlineStr: string | null) => {
    if (!deadlineStr) return null
    const deadline = new Date(deadlineStr)
    const now = new Date()
    const diffTime = deadline.getTime() - now.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    return diffDays
  }

  return (
    <div className="min-h-screen bg-[#fbf8ef] text-foreground font-sans selection:bg-sky/60 selection:text-indigo-700 relative">
      {/* Top Navigation */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[420px] bg-[radial-gradient(ellipse_60%_100%_at_50%_0%,rgba(23,20,15,0.14),transparent)]" />
      <nav className="sticky top-0 z-40 bg-[#fbf8ef]/70 backdrop-blur-xl border-b border-black/10 transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <div className="flex justify-between items-center h-16">
            {/* Left side empty placeholder to balance flex layout */}
            <div className="flex-1"></div>

            {/* Centered Logo / Title */}
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none select-none">
              <span className="text-base font-semibold tracking-tight text-foreground block leading-none">
                CivicPulse
              </span>
              <span className="text-[10px] font-bold text-muted-foreground tracking-wider uppercase block mt-1">
                Citizen Portal
              </span>
            </div>

            {/* Right side: User Profile Icon with GitHub-style dropdown */}
            <div className="flex-1 flex justify-end relative">
              <button
                onClick={() => setIsProfileOpen(!isProfileOpen)}
                className="flex items-center gap-2 focus:outline-none cursor-pointer"
                type="button"
                aria-label="User menu"
              >
                <Avatar className="w-9 h-9 ring-2 ring-background shadow-inner hover:ring-4 hover:ring-black/10 hover:shadow-[0_0_12px_rgba(148,163,184,0.25)] hover:scale-105 transition-all duration-200">
                  {(user.user_metadata?.avatar_url || user.user_metadata?.picture) && (
                    <AvatarImage
                      src={user.user_metadata.avatar_url || user.user_metadata.picture}
                      alt={user.user_metadata.full_name || 'User Avatar'}
                      referrerPolicy="no-referrer"
                    />
                  )}
                  <AvatarFallback className="bg-muted text-foreground text-xs font-semibold">
                    {user.user_metadata?.full_name?.[0]?.toUpperCase() || user.email?.[0]?.toUpperCase() || 'U'}
                  </AvatarFallback>
                </Avatar>
              </button>

              {/* Dropdown Card */}
              {isProfileOpen && (
                <>
                  {/* Backdrop overlay to close the dropdown when clicking outside */}
                  <div
                    className="fixed inset-0 z-40 cursor-default"
                    onClick={() => setIsProfileOpen(false)}
                  />
                  <div className="absolute right-0 top-full mt-2 w-56 rounded-2xl shadow-2xl shadow-black/50 bg-[#fbf8ef]/95 backdrop-blur-xl border border-black/10 z-50 py-1 origin-top-right focus:outline-none overflow-hidden">
                    {/* User info header in dropdown (GitHub style) */}
                    <div className="px-4 py-2 border-b border-border text-left">
                      <p className="text-xs font-semibold text-foreground truncate">
                        {user.user_metadata?.full_name || user.user_metadata?.name || user.email || 'Citizen'}
                      </p>
                      {(user.user_metadata?.full_name || user.user_metadata?.name) && (
                        <p className="text-[10px] text-muted-foreground truncate mt-0.5">
                          {user.email}
                        </p>
                      )}
                    </div>
                    {/* Action: Set Home Location */}
                    {profile?.home_address ? (
                      <div className="px-4 py-2 border-b border-border text-left bg-muted/30">
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-0.5">Home Location</p>
                        <p className="text-xs font-semibold text-foreground flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-[#2f3fa8]" />
                          {profile.home_address}
                        </p>
                        <button
                          onClick={handleSetHomeLocation}
                          disabled={isSettingLocation}
                          className="text-[10px] text-muted-foreground hover:text-foreground mt-1 underline underline-offset-2 disabled:opacity-50"
                        >
                          {isSettingLocation ? 'Updating...' : 'Update location'}
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={handleSetHomeLocation}
                        disabled={isSettingLocation}
                        className="w-full text-left px-4 py-2 text-xs text-foreground hover:bg-muted transition-colors flex items-center gap-2 font-medium cursor-pointer disabled:opacity-50 border-b border-border"
                      >
                        {isSettingLocation ? <Loader2 className="w-4 h-4 animate-spin" /> : <MapPin className="w-4 h-4" />}
                        Set Home Location
                      </button>
                    )}
                    {/* Action: Sign Out */}
                    <form action={signOut} className="w-full">
                      <button
                        type="submit"
                        className="w-full text-left px-4 py-2 text-xs text-rose-700 hover:bg-blush/40 transition-colors flex items-center gap-2 font-medium cursor-pointer"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                        Sign Out
                      </button>
                    </form>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">

          {/* LEFT COLUMN: Profile & Action & Stats */}
          <div className="lg:col-span-1 space-y-6">


            {/* Quick Actions (Large Primary Button) */}
            <Button
              onClick={() => router.push('/report')}
              className="w-full bg-[#17140f] hover:bg-black text-[#f5f0e1] font-semibold text-sm h-12 rounded-full hover:-translate-y-0.5 transition-all duration-200 group"
            >
              <div className="flex items-center justify-center gap-2">
                <Plus className="w-4 h-4 transition-transform group-hover:rotate-90" />
                Report a New Issue
              </div>
            </Button>

            {/* Mini Map Widget */}
            <MiniMapWidget
              onOpenFullMap={() => { setIsMapOpen(true); setIsLeaderboardOpen(false); setSelectedIssue(null); }}
              userLocation={userLocation}
            />

            {/* Leaderboard Button */}
            <Button
              onClick={() => { setIsLeaderboardOpen(true); setIsMapOpen(false); setSelectedIssue(null); }}
              variant="outline"
              className="w-full border border-black/10 bg-[#fbf8ef] hover:bg-white hover:border-black/25 text-foreground font-semibold text-sm h-11 rounded-2xl hover:-translate-y-0.5 transition-all duration-200 group mt-3"
            >
              <div className="flex items-center justify-center gap-2">
                <Award className="w-4 h-4 text-muted-foreground group-hover:text-amber-700 transition-colors" />
                <span className="text-sm font-semibold">Show Leaderboard</span>
              </div>
            </Button>

            {/* KPI Overview */}
            <div className="space-y-3">
              <h3 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground pl-1">
                Dashboard Overview
              </h3>

              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Total Reports', value: totalCount, icon: CheckSquare, bg: 'bg-sun', blob: 'bg-sun-deep/70 rounded-3xl rotate-12', trend: `${activeCount} in flight` },
                  { label: 'Active Issues', value: activeCount, icon: Activity, bg: 'bg-blush', blob: 'bg-blush-deep/60 rounded-full', trend: totalCount > 0 ? `${Math.round((activeCount / totalCount) * 100)}% of total` : 'None yet' },
                  { label: 'Resolved', value: resolvedCount, icon: CheckCircle2, bg: 'bg-olive', blob: 'bg-olive-deep/60 rounded-3xl -rotate-12', trend: `${resolutionRate}% resolution rate` },
                  { label: 'Karma', value: karmaScore, icon: Award, bg: 'bg-sky', blob: 'bg-sky-deep/60 rounded-full', trend: karmaLvl.level === 4 ? 'Max level' : `${karmaToNext} to next` },
                ].map((stat, i) => (
                  <motion.div
                    key={stat.label}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: i * 0.05 }}
                    whileHover={{ y: -3 }}
                    className={`relative overflow-hidden rounded-3xl p-4 ${stat.bg}`}
                  >
                    <div className={`pointer-events-none absolute -right-5 -top-5 h-20 w-20 ${stat.blob}`} />
                    <div className="relative flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-black/70 truncate">
                        {stat.label}
                      </span>
                      <stat.icon className="w-4 h-4 text-[#17140f]" />
                    </div>
                    <p className="relative mt-4 font-heading text-4xl font-semibold tracking-tight text-[#17140f] leading-none">
                      {stat.value}
                    </p>
                    <p className="relative mt-2 text-[10px] font-mono text-black/65 flex items-center gap-1">
                      <TrendingUp className="w-3 h-3" />
                      {stat.trend}
                    </p>
                  </motion.div>
                ))}
              </div>

              {/* Karma balance bar */}
              <div className="relative overflow-hidden rounded-3xl bg-[#fbf8ef] border border-black/10 p-4">
                <div className="relative flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Civic Level {karmaLvl.level}</p>
                    <p className="mt-1 text-sm font-semibold tracking-tight text-foreground">{karmaLvl.name}</p>
                  </div>
                  <span className="text-[10px] font-mono text-muted-foreground">
                    {karmaScore}{karmaLvl.level === 4 ? '' : ` / ${karmaLvl.max}`}
                  </span>
                </div>
                <div className="relative mt-3 h-2 w-full overflow-hidden rounded-full bg-black/10">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${karmaProgress}%` }}
                    transition={{ duration: 0.9, ease: 'easeOut' }}
                    className="h-full rounded-full bg-[#17140f]"
                  />
                </div>
                <p className="relative mt-2 text-[10px] text-muted-foreground">
                  {karmaLvl.level === 4 ? 'You have reached the highest civic level.' : `${karmaToNext} karma to reach ${karmaLvl.next}`}
                </p>
              </div>
            </div>

            {/* "Your Community Needs You" Section (Moved to Left Column) */}
            {profile?.home_location && nearbyReviews.length > 0 && (
              <div className="bg-sun/40 border border-sun-deep/60 rounded-3xl p-4 space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <ShieldCheck className="w-5 h-5 text-amber-700" />
                  <h2 className="text-base font-semibold tracking-tight text-foreground">Community Review</h2>
                  <Badge variant="outline" className="bg-sun/40 text-amber-700 border-sun-deep/60 text-[10px] ml-auto">
                    {nearbyReviews.length} Pending
                  </Badge>
                </div>
                <div className="space-y-4">
                  {nearbyReviews.map(review => (
                    <div key={review.id} className="p-4 rounded-2xl bg-black/5 border border-black/10 hover:border-black/25 transition-colors flex flex-col gap-3">
                      {review.photo_url && (
                        <div className="w-full h-32 rounded-lg overflow-hidden border border-border mb-1">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={review.photo_url} alt="Issue" className="w-full h-full object-cover" />
                        </div>
                      )}
                      <div className="flex justify-between items-start gap-2">
                        <div>
                          <h4 className="font-semibold text-sm leading-tight">{review.title}</h4>
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{review.description}</p>
                        </div>
                        {review.credibility_score !== null && (
                          <Badge variant="outline" className="bg-background text-[10px] shrink-0">
                            Score: {review.credibility_score}/10
                          </Badge>
                        )}
                      </div>
                      {review.reasoning && (
                        <div className="bg-muted/50 p-2 rounded text-[10px] border border-border">
                          <span className="font-semibold text-muted-foreground mr-1">AI Note:</span>
                          <MarkdownRenderer content={review.reasoning} className="text-[10px] text-muted-foreground" />
                        </div>
                      )}
                      <div className="flex gap-2 mt-1">
                        <Button
                          onClick={() => handleVote(review.id, true)}
                          size="sm"
                          variant="outline"
                          className="flex-1 bg-olive/40 text-emerald-700 hover:bg-olive/60 hover:text-emerald-700 border-olive-deep/40 text-[11px] h-8"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" /> Confirm
                        </Button>
                        <Button
                          onClick={() => handleVote(review.id, false)}
                          size="sm"
                          variant="outline"
                          className="flex-1 bg-blush/40 text-rose-700 hover:bg-blush/60 hover:text-rose-700 border-rose-700/30 text-[11px] h-8"
                        >
                          <AlertCircle className="w-3.5 h-3.5 mr-1.5" /> Deny
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>

          {/* RIGHT COLUMN: Search, Filters, and Feed */}
          <div className="lg:col-span-2 space-y-6">

            {/* Feed Controls Header */}
            <div className="bg-[#fbf8ef] border border-black/10 rounded-3xl p-4 space-y-4">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div>
                  <h2 className="text-lg font-semibold tracking-tight text-foreground flex items-center gap-2">
                    Your Civic Reports
                    <Badge variant="outline" className="bg-black/[0.04] border-black/10 text-muted-foreground text-[10px] px-2 py-0.5 h-5 font-mono font-semibold">
                      {filteredIssues.length}
                    </Badge>
                  </h2>
                </div>
              </div>

              {/* Status Segment Tabs */}
              <div className="w-full">
                {/* Status Segment Control */}
                <div role="tablist" aria-label="Status Filters" className="flex bg-black/5 p-1 rounded-full border border-black/10 items-center">
                  {[
                    { id: 'all', label: 'All Reports' },
                    { id: 'active', label: 'Active Only' },
                    { id: 'resolved', label: 'Resolved' },
                  ].map(tab => (
                    <button
                      key={tab.id}
                      role="tab"
                      aria-selected={statusFilter === tab.id}
                      onClick={() => setStatusFilter(tab.id)}
                      className={`relative flex-1 text-center text-[11px] font-semibold py-1.5 rounded-full transition-colors focus-visible:ring-2 focus-visible:ring-[#17140f]/40 focus-visible:outline-none ${statusFilter === tab.id
                        ? 'text-white'
                        : 'text-muted-foreground hover:text-foreground'
                        }`}
                    >
                      {statusFilter === tab.id && (
                        <motion.span
                          layoutId="status-tab-pill"
                          transition={{ type: 'spring', stiffness: 450, damping: 36 }}
                          className="absolute inset-0 rounded-full bg-[#17140f] shadow-[0_0_18px_-2px_rgba(23,20,15,0.6),inset_0_1px_0_0_rgba(255,255,255,0.2)]"
                        />
                      )}
                      <span className="relative z-10">{tab.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Scrollable Category Filter Pills */}
              <div role="group" aria-label="Category Filters" className="flex items-center gap-2 overflow-x-auto pb-1.5 scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent">
                <button
                  aria-pressed={categoryFilter === 'all'}
                  onClick={() => setCategoryFilter('all')}
                  className={`text-[10px] font-semibold px-3 py-1 rounded-full border transition-all whitespace-nowrap focus-visible:ring-2 focus-visible:ring-[#17140f]/40 focus-visible:outline-none ${categoryFilter === 'all'
                    ? 'bg-sky/40 text-[#2f3fa8] border-black/15 font-bold shadow-[0_0_14px_-4px_rgba(23,20,15,0.5)]'
                    : 'bg-black/[0.04] text-muted-foreground border-black/10 hover:text-foreground hover:border-black/25'
                    }`}
                >
                  All Categories
                </button>
                {Object.entries(CATEGORY_DETAILS).map(([key, value]) => {
                  const Icon = value.icon
                  const isActive = categoryFilter === key
                  return (
                    <button
                      key={key}
                      aria-pressed={isActive}
                      onClick={() => setCategoryFilter(key)}
                      className={`flex items-center gap-1.5 text-[10px] font-semibold px-3 py-1 rounded-full border transition-all whitespace-nowrap focus-visible:ring-2 focus-visible:ring-[#17140f]/40 focus-visible:outline-none ${isActive
                        ? 'bg-sky/40 text-[#2f3fa8] border-black/15 font-bold shadow-[0_0_14px_-4px_rgba(23,20,15,0.5)]'
                        : 'bg-black/[0.04] text-muted-foreground border-black/10 hover:text-foreground hover:border-black/25'
                        }`}
                    >
                      <Icon className="w-3 h-3" />
                      {value.label}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Reports List Feed */}
            <div className="space-y-3">
              <AnimatePresence mode="popLayout">
                {filteredIssues.length === 0 ? (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="w-full"
                    key="empty"
                  >
                    <Card className="relative overflow-hidden rounded-2xl ring-0 bg-[#fbf8ef] border border-dashed border-black/20 py-16 text-center">
                      <CardContent className="flex flex-col items-center">
                        <div className="w-14 h-14 rounded-2xl bg-sky/40 border border-black/15 shadow-[0_0_30px_-6px_rgba(23,20,15,0.5)] flex items-center justify-center mb-4">
                          <MapPin className="w-6 h-6 text-[#2f3fa8]" />
                        </div>
                        <h4 className="text-base font-semibold tracking-tight text-foreground">No matching reports</h4>
                        <p className="text-[11px] text-muted-foreground max-w-xs mt-1 leading-relaxed">
                          {categoryFilter !== 'all' || statusFilter !== 'all'
                            ? "We couldn't find any reports matching your current filter configuration."
                            : "You haven't submitted any civic issues yet. Report one to help improve your city."}
                        </p>
                        {(categoryFilter !== 'all' || statusFilter !== 'all') ? (
                          <Button
                            variant="ghost"
                            onClick={() => {
                              setCategoryFilter('all')
                              setStatusFilter('all')
                            }}
                            className="mt-4 text-[11px] font-semibold text-[#2f3fa8] hover:text-indigo-700 hover:bg-sky/40 rounded-full"
                          >
                            Reset Filter Settings
                          </Button>
                        ) : (
                          <Button
                            onClick={() => router.push('/report')}
                            className="mt-4 bg-[#17140f] hover:bg-[#17140f] text-white text-[11px] font-semibold h-9 px-5 rounded-full  hover:-translate-y-0.5 transition-all"
                          >
                            Submit First Report
                          </Button>
                        )}
                      </CardContent>
                    </Card>
                  </motion.div>
                ) : (
                  filteredIssues.map((issue, idx) => {
                    const cat = CATEGORY_DETAILS[issue.category] || {
                      icon: MapPin,
                      label: issue.category,
                      color: 'text-muted-foreground',
                      bgColor: 'bg-background/40',
                      borderColor: 'border-border/30'
                    }
                    const CatIcon = cat.icon
                    const status = STATUS_DETAILS[issue.status] || {
                      label: issue.status,
                      bgClass: 'bg-card/40',
                      borderClass: 'border-border',
                      textClass: 'text-muted-foreground',
                      dotClass: 'bg-stone-400'
                    }
                    const severity = getSeverityLabel(issue.severity)
                    const slaDays = getSlaDaysRemaining(issue.sla_deadline)
                    const slaPct = getSlaProgress(issue.created_at, issue.sla_deadline)
                    const isIssueClosed = issue.status === 'resolved' || issue.status === 'closed'
                    const slaTone = getSlaTone(slaPct, slaDays, isIssueClosed)
                    const isPipelineRunning = !!issue.pipeline_stage && issue.pipeline_stage !== 'completed' && !issue.pipeline_stage.endsWith('failed')

                    return (
                      <motion.div
                        key={issue.id}
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        whileHover={{ y: -2 }}
                        transition={{ duration: 0.2, delay: Math.min(idx * 0.03, 0.3) }}
                        layout
                      >
                        <Card
                          role="button"
                          tabIndex={0}
                          aria-label={`View issue: ${issue.title || 'Untitled'}`}
                          onClick={() => setSelectedIssue(issue)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault()
                              setSelectedIssue(issue)
                            }
                          }}
                          className="rounded-3xl ring-0 border border-black/10 bg-[#fbf8ef] hover:bg-white hover:border-black/25 hover:shadow-[0_20px_40px_-24px_rgba(23,20,15,0.35)] transition-all duration-200 cursor-pointer relative overflow-hidden group/card focus-visible:ring-2 focus-visible:ring-[#17140f] focus-visible:outline-none"
                        >

                          <CardContent className="p-4 flex flex-col gap-3.5">
                            <div className="flex items-center justify-between gap-4">
                              <div className="flex items-center gap-3.5 min-w-0 flex-1">
                                {/* Category Icon or Uploaded Media */}
                                {issue.photo_url ? (
                                  <img
                                    src={issue.photo_url}
                                    alt={issue.title || 'Issue'}
                                    className="w-12 h-12 rounded-xl object-cover border border-black/10 shadow-inner shrink-0"
                                  />
                                ) : issue.video_url ? (
                                  <div className="w-12 h-12 rounded-xl bg-black border border-black/10 flex items-center justify-center shrink-0 shadow-inner overflow-hidden relative">
                                    <video src={issue.video_url} className="w-full h-full object-cover opacity-70" />
                                  </div>
                                ) : (
                                  <div className={`w-12 h-12 rounded-xl border flex items-center justify-center shrink-0 shadow-inner ${cat.bgColor} ${cat.borderColor}`}>
                                    <CatIcon className={`w-5 h-5 ${cat.color}`} />
                                  </div>
                                )}

                                {/* Title, Address, Date */}
                                <div className="min-w-0 flex-1">
                                  <h3 className="text-sm font-semibold tracking-tight text-foreground truncate leading-tight group-hover/card:text-[#2f3fa8] transition-colors">
                                    {issue.title || issue.description?.slice(0, 60) + '...'}
                                  </h3>

                                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 mt-1.5">
                                    <div className="flex items-center gap-1 text-muted-foreground shrink-0">
                                      <MapPin className="w-3 h-3" />
                                      <span className="text-[11px] max-w-[150px] sm:max-w-[240px] truncate">
                                        {issue.address || 'Location recorded'}
                                      </span>
                                    </div>

                                    <div className="flex items-center gap-1 text-muted-foreground shrink-0">
                                      <Clock className="w-3 h-3" />
                                      <span className="text-[11px] font-mono">
                                        {new Date(issue.created_at).toLocaleDateString('en-IN', {
                                          day: 'numeric',
                                          month: 'short'
                                        })}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              </div>

                              <ChevronRight className="w-4 h-4 shrink-0 text-muted-foreground group-hover/card:text-foreground transition-all group-hover/card:translate-x-0.5 duration-200" />
                            </div>

                            {/* Chips: category, status, severity, pipeline */}
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${cat.bgColor} ${cat.borderColor} ${cat.color}`}>
                                <CatIcon className="w-2.5 h-2.5" />
                                {cat.label}
                              </span>
                              <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${status.bgClass} ${status.borderClass} ${status.textClass}`}>
                                <span className={`h-1.5 w-1.5 rounded-full ${status.dotClass}`} />
                                {status.label}
                              </span>
                              {issue.severity ? (
                                <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${severity.color}`}>
                                  <AlertTriangle className="w-2.5 h-2.5" />
                                  {severity.text}
                                  <span className="font-mono opacity-70">{issue.severity}/10</span>
                                </span>
                              ) : null}
                              {isPipelineRunning && (
                                <span className="inline-flex items-center gap-1.5 rounded-full border border-black/15 bg-sky/40 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#2f3fa8]">
                                  <span className="relative flex h-1.5 w-1.5">
                                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#17140f] opacity-75" />
                                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#17140f]" />
                                  </span>
                                  AI Processing
                                </span>
                              )}
                            </div>

                            {/* SLA progress */}
                            {slaPct !== null && (
                              <div className="space-y-1.5">
                                <div className="flex items-center justify-between">
                                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                                    {isIssueClosed ? 'SLA' : 'SLA Window'}
                                  </span>
                                  <span className={`text-[10px] font-mono ${slaTone.text}`}>
                                    {isIssueClosed
                                      ? 'Completed'
                                      : slaDays !== null && slaDays < 0
                                        ? `Overdue ${Math.abs(slaDays)}d`
                                        : slaDays === 0
                                          ? 'Due today'
                                          : `${slaDays}d left`}
                                  </span>
                                </div>
                                <div className="h-1.5 w-full overflow-hidden rounded-full bg-black/[0.04]">
                                  <motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: `${isIssueClosed ? 100 : slaPct}%` }}
                                    transition={{ duration: 0.8, ease: 'easeOut' }}
                                    className={`h-full rounded-full ${slaTone.bar}`}
                                  />
                                </div>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      </motion.div>
                    )
                  })
                )}
              </AnimatePresence>
            </div>

          </div>

        </div>
      </main>

      {/* DETAILED DIALOG: AI Pipeline Trace and Report Details */}
      <Dialog open={!!selectedIssue} onOpenChange={open => !open && setSelectedIssue(null)}>
        {selectedIssue && (() => {
          const cat = CATEGORY_DETAILS[selectedIssue.category] || {
            icon: MapPin,
            label: selectedIssue.category,
            color: 'text-muted-foreground',
            bgColor: 'bg-background/40',
            borderColor: 'border-border/30'
          }
          const CatIcon = cat.icon
          const status = STATUS_DETAILS[selectedIssue.status] || {
            label: selectedIssue.status,
            bgClass: 'bg-card/40',
            borderClass: 'border-border',
            textClass: 'text-muted-foreground',
            dotClass: 'bg-stone-400'
          }
          const severity = getSeverityLabel(selectedIssue.severity)
          const slaDays = getSlaDaysRemaining(selectedIssue.sla_deadline)

          return (
            <DialogContent className="bg-background border-border text-foreground w-[95vw] max-w-7xl sm:max-w-7xl overflow-y-auto max-h-[90vh] p-0 rounded-2xl shadow-2xl [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none']">
              <div className="p-8 sm:p-12">
                {/* Screen Reader Announcement for live updates */}
                <div aria-live="polite" aria-atomic="true" className="sr-only">
                  {`Issue status: ${selectedIssue.status}. Pipeline stage: ${selectedIssue.pipeline_stage ? selectedIssue.pipeline_stage.replace(/_/g, ' ') : 'Not started'}`}
                </div>

                {/* Header Information (Top Row) */}
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6">
                  <div className="flex items-center gap-4">
                    {/* Icon or Image */}
                    <div className={`w-14 h-14 rounded-2xl border flex shrink-0 items-center justify-center shadow-inner overflow-hidden ${cat.bgColor} ${cat.borderColor}`}>
                      {selectedIssue.photo_url ? (
                        <>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={selectedIssue.photo_url} alt="Issue" className="w-full h-full object-cover" />
                        </>
                      ) : selectedIssue.video_url ? (
                        <video src={selectedIssue.video_url} className="w-full h-full object-cover bg-black" />
                      ) : (
                        <CatIcon className={`w-7 h-7 ${cat.color}`} />
                      )}
                    </div>
                    {/* Title & Badges */}
                    <div className="flex flex-col gap-1.5">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mt-1">
                        <DialogTitle className="text-xl sm:text-2xl font-bold text-foreground leading-none">
                          {selectedIssue.title || 'Untitled Report'}
                        </DialogTitle>

                        {(() => {
                          const cat = CATEGORY_DETAILS[selectedIssue.category]
                          if (!cat) return null
                          const Icon = cat.icon
                          return (
                            <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wider border ${cat.color} ${cat.bgColor} ${cat.borderColor} w-fit`}>
                              <Icon className="w-3.5 h-3.5" />
                              {cat.label}
                            </div>
                          )
                        })()}
                      </div>
                      <div className="flex flex-wrap items-center gap-2 mt-1">
                        <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full border shadow-sm ${status.bgClass} ${status.borderClass} ${status.textClass}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${status.dotClass}`} />
                          {status.label}
                        </span>
                        {selectedIssue.is_emergency && (
                          <span className="bg-blush/60 border border-black/10 text-rose-700 text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider animate-pulse flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" /> Emergency
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Location (Top Right) */}
                  <div className="flex items-start gap-2 text-foreground text-sm font-medium sm:text-right sm:max-w-[300px] mt-2 sm:mt-0 bg-card/40 p-2.5 rounded-xl border border-border/50">
                    <MapPin className="w-4 h-4 mt-0.5 text-[#2f3fa8] shrink-0 sm:order-2 sm:mt-0.5 sm:ml-2" />
                    <div className="flex flex-col sm:items-end w-full">
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-0.5">Location</p>
                      <span className="leading-snug text-xs text-muted-foreground break-words w-full">{selectedIssue.address || 'Address recorded'}</span>
                    </div>
                  </div>
                </div>

                {/* Divider */}
                <div className="w-full h-px bg-border mb-8" />

                {/* Single Column Layout */}
                <div className="space-y-12">

                  {/* Description */}
                  <p className="text-[15px] text-foreground/90 leading-relaxed whitespace-pre-line font-medium mt-4">
                    {selectedIssue.description}
                  </p>

                  {/* Attached Media */}
                  {(selectedIssue.photo_url || selectedIssue.video_url) && (
                    <div className="flex flex-col sm:flex-row gap-4 mt-2">
                      {selectedIssue.photo_url && (
                        <div className="rounded-xl overflow-hidden border border-border sm:max-w-[50%]">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={selectedIssue.photo_url} alt="Attached photo" className="w-full h-auto object-cover max-h-[300px]" />
                        </div>
                      )}
                      {selectedIssue.video_url && (
                        <div className="rounded-xl overflow-hidden border border-border bg-black sm:max-w-[50%] flex items-center justify-center">
                          <video src={selectedIssue.video_url} controls className="w-full h-auto max-h-[300px]" />
                        </div>
                      )}
                    </div>
                  )}

                  {/* Routing Details */}
                  <div className="bg-card/50 border border-border rounded-xl p-6 sm:p-8 space-y-6">
                    <h4 className="text-xs font-bold text-muted-foreground tracking-wider uppercase flex items-center gap-1.5 leading-none">
                      <Building className="w-4 h-4 text-muted-foreground" /> Administrative Routing Details
                    </h4>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                      <div className="space-y-1">
                        <span className="text-[10px] text-muted-foreground font-semibold">Assigned Department</span>
                        <p className="text-xs font-bold text-foreground flex items-center gap-1.5 mt-1">
                          <Building className="w-4 h-4 text-indigo-700" />
                          {selectedIssue.department_id ? (departmentMap[selectedIssue.department_id] || `Department ID: ${selectedIssue.department_id}`) : 'Municipal Processing Queue'}
                        </p>
                      </div>

                      <div className="space-y-0.5">
                        <span className="text-[10px] text-muted-foreground font-semibold">SLA Resolution Target</span>
                        {selectedIssue.status === 'resolved' ? (
                          <p className="text-xs font-bold text-emerald-700 flex items-center gap-1.5 mt-1">
                            <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                            Resolved
                          </p>
                        ) : selectedIssue.sla_deadline ? (
                          <div className="mt-1">
                            <p className="text-xs font-bold text-foreground flex items-center gap-1.5">
                              <Calendar className="w-4 h-4 text-amber-700" />
                              {new Date(selectedIssue.sla_deadline).toLocaleDateString('en-IN', {
                                day: 'numeric', month: 'short', year: 'numeric'
                              })}
                            </p>
                            {slaDays !== null && (
                              <p className={`text-[10px] font-semibold mt-1 ${slaDays < 0 ? 'text-rose-700' : 'text-amber-700'
                                }`}>
                                {slaDays < 0 ? `Overdue by ${Math.abs(slaDays)} days` : slaDays === 0 ? 'Due today' : `${slaDays} days remaining`}
                              </p>
                            )}
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground italic mt-1">Pending SLA Assignment</p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* AI Processing Trace (Stepper / Timeline) */}
                  <div className="space-y-6 pt-4">
                    <h4 className="text-xs font-bold text-muted-foreground tracking-wider uppercase flex items-center gap-1.5 leading-none pl-1">
                      <Cpu className="w-4 h-4 text-muted-foreground" /> AI Agent Pipeline Processing Trace
                    </h4>

                    <div className="relative pl-8 border-l-2 border-border/80 space-y-10 ml-2 mt-6">

                      {/* AGENT 0: TRANSLATOR */}
                      {(() => {
                        const state0 = getAgentState(selectedIssue.pipeline_stage, 'agent0_translation')
                        return (
                          <div className={`relative ${state0 === 'pending' ? 'opacity-40' : ''}`}>
                            <AgentDot state={state0} />
                            <div className="space-y-2">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-foreground flex items-center gap-1.5 leading-none">
                                  <Globe className="w-3.5 h-3.5 text-[#2f3fa8]" />
                                  Agent 0: Multilingual Translator
                                </span>
                                <AgentStatusBadge state={state0} issueId={selectedIssue.id} onRetry={handleRetry} />
                              </div>
                              <p className="text-[11px] text-muted-foreground leading-relaxed">
                                Detects language and provides an English translation for downstream agents.
                              </p>

                              {state0 === 'done' && (
                                <div className="bg-sky/40 p-4 sm:p-5 rounded-xl border border-black/15 mt-4">
                                  <div className="flex flex-col gap-2.5">
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-muted-foreground font-bold text-xs uppercase tracking-wider">Language Detected:</span>
                                      <span className="font-bold text-[#2f3fa8] text-xs uppercase tracking-wider">{selectedIssue.original_language || 'English'}</span>
                                    </div>
                                    {selectedIssue.translation_trace && (
                                      <div className="text-[13px] sm:text-sm text-foreground/90 leading-relaxed font-medium">
                                        <span className="font-bold text-muted-foreground">Trace:</span> {selectedIssue.translation_trace}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        )
                      })()}

                      {/* AGENT 1: CLASSIFIER */}
                      {(() => {
                        const state1 = getAgentState(selectedIssue.pipeline_stage, 'agent1_classifier')
                        return (
                          <div className={`relative ${state1 === 'pending' ? 'opacity-40' : ''}`}>
                            <AgentDot state={state1} />
                            <div className="space-y-2">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-foreground flex items-center gap-1.5 leading-none">
                                  <Cpu className="w-3.5 h-3.5 text-[#2f3fa8]" />
                                  Agent 1: Semantic Classifier
                                </span>
                                <AgentStatusBadge state={state1} issueId={selectedIssue.id} onRetry={handleRetry} />
                              </div>
                              <p className="text-[11px] text-muted-foreground leading-relaxed">
                                Analyzed raw text/media, classified category, subcategory and mapped initial severity.
                              </p>

                              {(state1 === 'done' || state1 === 'in_progress') && (
                                <Agent1Visuals issue={selectedIssue} isRunning={state1 === 'in_progress'} />
                              )}
                            </div>
                          </div>
                        )
                      })()}

                      {/* AGENT 2: DEDUPLICATION */}
                      {(() => {
                        const state2 = getAgentState(selectedIssue.pipeline_stage, 'agent2_deduplication')
                        return (
                          <div className={`relative ${state2 === 'pending' ? 'opacity-40' : ''}`}>
                            <AgentDot state={state2} />
                            <div className="space-y-2">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-foreground flex items-center gap-1.5 leading-none">
                                  <Database className="w-3.5 h-3.5 text-[#2f3fa8]" />
                                  Agent 2: Vector Deduplicator
                                </span>
                                <AgentStatusBadge state={state2} issueId={selectedIssue.id} onRetry={handleRetry} />
                              </div>
                              <p className="text-[11px] text-muted-foreground leading-relaxed">
                                Scanned localized pgvector database within a 200-meter radius to prevent duplicate reports.
                              </p>

                              <Agent2MapVisuals key={selectedIssue.id} issue={selectedIssue} allIssues={issues} agentState={state2}>
                                {state2 === 'done' && (
                                  <div className="bg-sky/40 p-4 sm:p-5 rounded-xl border border-black/15 mt-4">
                                    {selectedIssue.cluster_id ? (
                                      <div className="flex flex-col gap-2.5">
                                        <div className="flex items-center gap-1.5">
                                          <AlertTriangle className="w-3.5 h-3.5 text-amber-700" />
                                          <span className="font-bold text-amber-700 text-xs uppercase tracking-wider">Duplicate Detected</span>
                                        </div>
                                        <div className="text-[13px] sm:text-sm text-foreground/90 leading-relaxed font-medium">
                                          <span className="font-bold text-muted-foreground">Trace:</span> This issue has been clustered with an existing report in this vicinity.
                                          <br />
                                          <span className="font-mono text-[11px] mt-2 block text-muted-foreground">
                                            Cluster ID: {selectedIssue.cluster_id.slice(0, 8)}...
                                          </span>
                                        </div>
                                      </div>
                                    ) : (
                                      <div className="flex flex-col gap-2.5">
                                        <div className="flex items-center gap-1.5">
                                          <ShieldCheck className="w-3.5 h-3.5 text-[#2f3fa8]" />
                                          <span className="font-bold text-[#2f3fa8] text-xs uppercase tracking-wider">Unique Report</span>
                                        </div>
                                        <div className="text-[13px] sm:text-sm text-foreground/90 leading-relaxed font-medium">
                                          <span className="font-bold text-muted-foreground">Trace:</span> Checked unique report. No duplicate entries detected within range.
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </Agent2MapVisuals>
                            </div>
                          </div>
                        )
                      })()}

                      {/* AGENT 3: VALIDATION */}
                      {(() => {
                        const isDuplicate = !!selectedIssue.cluster_id && selectedIssue.status === 'closed'
                        const state3 = getAgentState(selectedIssue.pipeline_stage, 'agent3_validation', isDuplicate)
                        return (
                          <div className={`relative ${state3 === 'pending' || state3 === 'skipped' ? 'opacity-40' : ''}`}>
                            <AgentDot state={state3} />
                            <div className="space-y-2">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-foreground flex items-center gap-1.5 leading-none">
                                  <ShieldCheck className="w-3.5 h-3.5 text-[#2f3fa8]" />
                                  Agent 3: Credibility Validator
                                </span>
                                <AgentStatusBadge state={state3} issueId={selectedIssue.id} onRetry={handleRetry} />
                              </div>
                              <p className="text-[11px] text-muted-foreground leading-relaxed">
                                Verified credibility index against historical data, user profile reliability, and weather datasets.
                              </p>

                              {(state3 === 'done' || state3 === 'in_progress') && (
                                <Agent3Visuals isRunning={state3 === 'in_progress'} issue={selectedIssue} />
                              )}

                              {state3 === 'done' && (
                                <div className="bg-sky/40 p-4 sm:p-5 rounded-xl border border-black/15 mt-4">
                                  <div className="flex flex-col gap-2.5">
                                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                                      <div className="flex items-center gap-1.5">
                                        <span className="text-muted-foreground font-bold text-xs uppercase tracking-wider">Credibility Index:</span>
                                        <span className={`font-bold text-xs uppercase tracking-wider ${selectedIssue.credibility_score && selectedIssue.credibility_score >= 6 ? 'text-emerald-700' : 'text-amber-700'}`}>
                                          {selectedIssue.credibility_score ? `${(selectedIssue.credibility_score * 10).toFixed(0)}%` : 'Processing...'}
                                        </span>
                                      </div>
                                      <div className="hidden sm:block text-muted-foreground/30">|</div>
                                      <div className="flex items-center gap-1.5">
                                        <span className="text-muted-foreground font-bold text-xs uppercase tracking-wider">Validation:</span>
                                        {selectedIssue.needs_community_verification === false ? (
                                          <span className="font-bold text-emerald-700 text-xs uppercase tracking-wider">Approved (by AI)</span>
                                        ) : selectedIssue.needs_community_verification === true ? (
                                          getAgentState(selectedIssue.pipeline_stage, 'awaiting_community_review', isDuplicate) === 'done' ? (
                                            <span className="font-bold text-emerald-700 text-xs uppercase tracking-wider">Community Review Completed</span>
                                          ) : (
                                            <span className="font-bold text-amber-700 text-xs uppercase tracking-wider">Community Review Required</span>
                                          )
                                        ) : (
                                          <span className="font-bold text-muted-foreground text-xs uppercase tracking-wider">Pending</span>
                                        )}
                                      </div>
                                    </div>
                                    
                                    {selectedIssue.status === 'community_review' && voteTally && (
                                      <div className="text-[13px] sm:text-sm text-foreground/90 leading-relaxed font-medium">
                                        <span className="font-bold text-muted-foreground">Community Tally:</span>{' '}
                                        <span className="text-emerald-700 font-semibold">{voteTally.confirms} Confirms</span>{' '}
                                        <span className="text-muted-foreground mx-1">/</span>{' '}
                                        <span className="text-rose-700 font-semibold">{voteTally.denies} Denies</span>
                                      </div>
                                    )}

                                    {selectedIssue.reasoning && (
                                      <div className="text-[13px] sm:text-sm text-foreground/90 leading-relaxed font-medium space-y-1">
                                        <span className="font-bold text-muted-foreground block">Trace:</span>
                                        <MarkdownRenderer content={selectedIssue.reasoning} />
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        )
                      })()}

                      {/* AGENT 4: RESOLUTION PLANNING */}
                      {(() => {
                        const isDuplicate = !!selectedIssue.cluster_id && selectedIssue.status === 'closed'
                        const state4 = getAgentState(selectedIssue.pipeline_stage, 'agent4_resolution', isDuplicate)
                        return (
                          <div className={`relative ${state4 === 'pending' || state4 === 'skipped' ? 'opacity-40' : ''}`}>
                            <AgentDot state={state4} />
                            <div className="space-y-2">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-foreground flex items-center gap-1.5 leading-none">
                                  <Sparkles className="w-3.5 h-3.5 text-[#2f3fa8]" />
                                  Agent 4: Resolution Routing & SLA Planner
                                </span>
                                <AgentStatusBadge state={state4} issueId={selectedIssue.id} onRetry={handleRetry} />
                              </div>
                              <p className="text-[11px] text-muted-foreground leading-relaxed">
                                Generated a concise civic action brief for department staff and computed completion SLA.
                              </p>

                              {(state4 === 'done' || state4 === 'in_progress') && (
                                <Agent4Visuals isRunning={state4 === 'in_progress'} />
                              )}

                              {state4 === 'done' && (
                                <div className="mt-2">
                                  {selectedIssue.civic_brief ? (
                                    <div className="bg-card/50 border border-border rounded-xl p-5 shadow-inner mt-4 relative overflow-hidden">
                                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-olive/60" />
                                      <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 mb-2.5">
                                        <FileText className="w-4 h-4 text-emerald-700" /> Generated Civic Brief (Officer view)
                                      </span>
                                      <MarkdownRenderer content={selectedIssue.civic_brief} />
                                    </div>
                                  ) : (
                                    <p className="text-[10px] text-muted-foreground italic">SLA generated, awaiting brief indexing.</p>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        )
                      })()}

                      {/* AGENT 5: PREDICTIVE ANALYTICS */}
                      {(() => {
                        const isDuplicate = !!selectedIssue.cluster_id && selectedIssue.status === 'closed'
                        let state5: PipelineState = 'pending'
                        if (isDuplicate) state5 = 'skipped'
                        else if (selectedIssue.agent5_completed) state5 = 'done'

                        return (
                          <div className={`relative ${state5 === 'pending' || state5 === 'skipped' ? 'opacity-40' : ''}`}>
                            <div className={`absolute -left-[33px] top-0.5 border-4 border-background w-4 h-4 rounded-full flex items-center justify-center shadow-md ${state5 === 'done' ? 'bg-[#17140f] shadow-black/10' : state5 === 'skipped' ? 'bg-stone-400 shadow-black/10' : 'bg-stone-300 opacity-40'}`} />
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-muted-foreground flex items-center gap-1.5 leading-none">
                                  <TrendingUp className="w-3.5 h-3.5 text-muted-foreground" />
                                  Agent 5: Predictive Analytics Agent
                                </span>
                                {state5 === 'skipped' ? (
                                  <span className="text-[9px] font-bold text-stone-600 bg-stone-400 px-1.5 py-0.2 rounded border border-black/10 uppercase tracking-wide leading-none">SKIPPED</span>
                                ) : state5 === 'done' ? (
                                  <span className="text-[9px] font-bold text-emerald-700 bg-olive/40 px-1.5 py-0.2 rounded border border-olive-deep/40 uppercase tracking-wide leading-none">DONE</span>
                                ) : (
                                  <span className="text-[9px] font-bold text-muted-foreground bg-card px-1.5 py-0.2 rounded border border-border uppercase tracking-wide leading-none">PENDING</span>
                                )}
                              </div>
                              <p className="text-[11px] text-muted-foreground leading-relaxed">
                                Runs asynchronously to analyze ward-level trends and predict seasonal civic issues.
                              </p>
                            </div>
                          </div>
                        )
                      })()}

                    </div>
                  </div>
                </div>

                {/* Footer Buttons */}
                <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-8 mt-4 border-t border-border">
                  {selectedIssue.status === 'resolved' && (
                    <Button
                      onClick={() => window.open(`/receipt/${selectedIssue.id}`, '_blank')}
                      className="w-full sm:w-auto bg-sun hover:bg-sun-deep text-[#17140f] font-bold text-xs h-10 px-6 rounded-xl flex items-center gap-2"
                    >
                      <Share2 className="w-4 h-4" />
                      Share Impact Receipt
                    </Button>
                  )}
                  <Button
                    onClick={() => setSelectedIssue(null)}
                    className="w-full sm:w-auto bg-card border border-border hover:bg-muted text-foreground text-xs h-10 px-6 rounded-xl"
                  >
                    Close Details
                  </Button>
                </div>

              </div>
            </DialogContent>
          )
        })()}
      </Dialog>

      {/* City-Wide Issue Map Panel */}
      <IssueMapPanel
        isOpen={isMapOpen}
        onClose={() => setIsMapOpen(false)}
        userLocation={userLocation}
      />

      {/* Citizen Leaderboard Panel */}
      <CitizenLeaderboardPanel
        userId={user.id}
        isOpen={isLeaderboardOpen}
        onClose={() => setIsLeaderboardOpen(false)}
      />
    </div>
  )
}