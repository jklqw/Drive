import { useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { ArrowRight, Eye, EyeOff, LockKeyhole, Mail } from 'lucide-react'
import { AuthShell } from '../components/auth/AuthShell'
import { errorMessage } from '../api/client'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'

export function LoginPage() {
  const { user, loading, login } = useAuth()
  const { notify } = useToast()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [visible, setVisible] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!loading && user) return <Navigate to="/drive" replace />

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await login({ email, password })
      notify('Signed in. Welcome back.', 'success')
      navigate('/drive', { replace: true })
    } catch (err) {
      setError(errorMessage(err, 'Unable to sign in'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthShell
      title="Sign in to your vault"
      subtitle="Access your private workspace with your account credentials."
      footer={
        <span>
          New to the platform?{' '}
          <Link to="/register" className="font-medium text-brand hover:underline">Create an account</Link>
        </span>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate={false}>
        <label className="block">
          <span className="mb-1.5 block text-[12px] font-medium text-ink-primary">Work email</span>
          <span className="relative block">
            <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-tertiary" />
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@company.com"
              className="h-11 w-full rounded-md border border-border bg-surface pl-10 pr-3 text-[13px] outline-none transition-colors placeholder:text-ink-tertiary focus:border-brand focus:ring-2 focus:ring-brand-100"
            />
          </span>
        </label>
        <label className="block">
          <span className="mb-1.5 block text-[12px] font-medium text-ink-primary">Password</span>
          <span className="relative block">
            <LockKeyhole size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-tertiary" />
            <input
              type={visible ? 'text' : 'password'}
              required
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Enter your password"
              className="h-11 w-full rounded-md border border-border bg-surface pl-10 pr-10 text-[13px] outline-none transition-colors placeholder:text-ink-tertiary focus:border-brand focus:ring-2 focus:ring-brand-100"
            />
            <button
              type="button"
              onClick={() => setVisible((value) => !value)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-tertiary hover:text-ink-primary"
              aria-label={visible ? 'Hide password' : 'Show password'}
            >
              {visible ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </span>
        </label>
        {error && (
          <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-status-danger">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={submitting}
          className="flex h-11 w-full items-center justify-center gap-2 rounded-md bg-brand text-[13px] font-medium text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? 'Signing in…' : 'Sign in'}
          {!submitting && <ArrowRight size={15} />}
        </button>
      </form>
      <p className="mt-4 font-mono text-[10px] uppercase tracking-wider text-ink-tertiary">
        Sessions expire after 15 minutes · Redis-backed revocation
      </p>
    </AuthShell>
  )
}
