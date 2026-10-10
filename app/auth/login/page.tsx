'use client'

import { useState } from 'react'
import Link from 'next/link'
import { signInWithGoogle, signInWithEmail } from '@/lib/auth/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { motion } from 'framer-motion'
import { ArrowLeft, MailCheck, MapPin, ShieldCheck, Sparkles } from 'lucide-react'

import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

function LoginForm() {
  const searchParams = useSearchParams()
  const role = searchParams.get('role') || 'citizen'

  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  async function handleEmailLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const result = await signInWithEmail(email, role)

    if (result?.error) {
      setError(result.error)
    } else {
      setSent(true)
    }
    setLoading(false)
  }

  const isAdmin = role === 'admin'

  return (
    <div className="min-h-screen bg-background grid lg:grid-cols-2">
      {/* Form side */}
      <div className="flex flex-col px-6 py-8 sm:px-12">
        <div className="flex items-center justify-between">
          <Link href="/" className="font-heading text-xl font-semibold tracking-tight">
            civicpulse<span className="text-[#e898c6]">.</span>
          </Link>
          <Link href="/" className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-black/5 hover:text-foreground transition-colors">
            <ArrowLeft className="h-3.5 w-3.5" /> Back
          </Link>
        </div>

        <div className="flex flex-1 items-center justify-center py-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="w-full max-w-sm"
          >
            <span className={`inline-flex items-center rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider ${isAdmin ? 'bg-sky' : 'bg-sun'}`}>
              {isAdmin ? 'Municipal portal' : 'Citizen portal'}
            </span>
            <h1 className="mt-4 font-heading text-4xl font-semibold leading-[1.05] tracking-tight">Get started with CivicPulse</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {isAdmin ? 'Sign in to triage, route and resolve reports.' : 'Sign in to report issues and track their resolution.'}
            </p>

            <div className="mt-8 space-y-4">
              {sent ? (
                <div className="rounded-3xl bg-olive p-6 text-center">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#17140f] text-[#f5f0e1]">
                    <MailCheck className="h-5 w-5" />
                  </div>
                  <p className="mt-4 font-heading text-xl font-semibold">Check your email</p>
                  <p className="mt-1 text-sm text-black/70">
                    We sent a magic link to <span className="font-semibold">{email}</span>
                  </p>
                </div>
              ) : (
                <>
                  <form onSubmit={handleEmailLogin} className="space-y-3">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">Email address</label>
                      <Input
                        type="email"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        required
                        className="h-12 rounded-2xl bg-[#fbf8ef] border-black/15 text-foreground placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-[#17140f]/30"
                      />
                    </div>
                    {error && <p className="text-rose-700 text-xs font-medium">{error}</p>}
                    <Button
                      type="submit"
                      className="w-full h-12 text-sm bg-[#17140f] hover:bg-black text-[#f5f0e1] transition-all hover:-translate-y-0.5"
                      disabled={loading}
                    >
                      {loading ? 'Sending...' : 'Continue'}
                    </Button>
                  </form>

                  <div className="relative py-1">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t border-black/10" />
                    </div>
                    <div className="relative flex justify-center text-[10px] uppercase">
                      <span className="bg-background px-3 text-muted-foreground font-bold tracking-wider">or</span>
                    </div>
                  </div>

                  <form action={signInWithGoogle}>
                    <input type="hidden" name="role" value={role} />
                    <Button
                      type="submit"
                      variant="outline"
                      className="w-full h-12 text-sm bg-[#fbf8ef] border-black/15 hover:bg-white transition-all hover:-translate-y-0.5"
                    >
                      <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                      </svg>
                      Continue with Google
                    </Button>
                  </form>
                </>
              )}
            </div>
          </motion.div>
        </div>
      </div>

      {/* Art side */}
      <div className="relative hidden overflow-hidden bg-[#17140f] p-10 lg:flex lg:flex-col lg:justify-between lg:gap-6">
        <div className="grid w-full max-w-xl grid-cols-2 gap-3">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="col-span-2 rounded-3xl bg-sun p-6">
            <MapPin className="h-5 w-5" />
            <p className="mt-6 font-heading text-3xl font-semibold tracking-tight">Report in seconds</p>
            <p className="mt-1 text-sm font-medium text-black/65">Photo, voice or text. Any language.</p>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="rounded-3xl bg-blush p-5">
            <Sparkles className="h-5 w-5" />
            <p className="mt-6 font-heading text-xl font-semibold tracking-tight">AI triage</p>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="rounded-3xl bg-sky p-5">
            <ShieldCheck className="h-5 w-5" />
            <p className="mt-6 font-heading text-xl font-semibold tracking-tight">Verified fixes</p>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="w-full max-w-xl rounded-3xl bg-[#f5f0e1] p-6"
        >
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-bold uppercase tracking-wider text-black/50">Example report journey</p>
            <span className="rounded-full bg-olive px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider">Resolved</span>
          </div>
          <p className="mt-2 font-heading text-xl font-semibold tracking-tight">Pothole near the bus stop</p>
          <ol className="mt-5 space-y-3">
            {[
              { t: 'Reported', d: 'Photo + location captured', c: 'bg-sun' },
              { t: 'Classified', d: 'Road damage, severity scored by AI', c: 'bg-blush' },
              { t: 'Routed', d: 'Sent to the right department', c: 'bg-sky' },
              { t: 'Fixed', d: 'Closed with a shareable receipt', c: 'bg-olive' },
            ].map((step, i) => (
              <li key={step.t} className="flex items-center gap-3">
                <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${step.c}`}>{i + 1}</span>
                <div>
                  <p className="text-sm font-semibold leading-tight">{step.t}</p>
                  <p className="text-xs text-black/55">{step.d}</p>
                </div>
              </li>
            ))}
          </ol>
        </motion.div>

        <p className="relative max-w-sm font-heading text-3xl font-semibold leading-tight tracking-tight text-[#f5f0e1]">
          A better city starts with one report.
        </p>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-muted-foreground text-sm font-medium">Loading login...</div>
      </div>
    }>
      <LoginForm />
    </Suspense>
  )
}
