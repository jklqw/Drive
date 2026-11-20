import { useMemo, useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { ArrowRight, Check, Eye, EyeOff, LockKeyhole, Mail, UserRound } from 'lucide-react'
import clsx from 'clsx'
import { AuthShell } from '../components/auth/AuthShell'
import { errorMessage } from '../api/client'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'

const rules = [
  { label: '12+ characters', test: (v: string) => v.length >= 12 },
  { label: 'Upper & lowercase', test: (v: string) => /[A-Z]/.test(v) && /[a-z]/.test(v) },
  { label: 'A number', test: (v: string) => /\d/.test(v) },
  { label: 'A symbol', test: (v: string) => /[^A-Za-z0-9]/.test(v) },
]

export function RegisterPage() {
  const { user, loading, register } = useAuth()
  const { notify } = useToast()
  const navigate = useNavigate()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [visible, setVisible] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const strength = useMemo(() => rules.filter((rule) => rule.test(password)).length, [password])

  if (!loading && user) return <Navigate to="/drive" replace />

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (strength < rules.length) {
      setError('Please satisfy every password requirement.')
      return
    }
    setError(null)
    setSubmitting(true)
    try {
      await register({ full_name: fullName, email, password })
      notify('Account created. Your vault is ready.', 'success')
      navigate('/drive', { replace: true })
    } catch (err) {
      setError(errorMessage(err, 'Unable to create account'))
    } finally {
      setSubmitting(false)
    }
  }

  const inputClass =
    'h-11 w-full rounded-md border border-border bg-surface pl-10 pr-3 text-[13px] outline-none transition-colors placeholder:text-ink-tertiary focus:border-brand focus:ring-2 focus:ring-brand-100'

  return (
    <AuthShell
      title="Create your workspace"
      subtitle="A private, isolated vault with 1 GB of storage to start."
      footer={
        <span>
          Already have an account?{' '}
          <Link to="/login" className="font-medium text-brand hover:underline">Sign in</Link>
        </span>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <label className="block">
          <span className="mb-1.5 block text-[12px] font-medium text-ink-primary">Full name</span>
          <span className="relative block">
            <UserRound size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-tertiary" />
            <input
              required
              maxLength={150}
              autoComplete="name"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              placeholder="Alex Morgan"
              className={inputClass}
            />
          </span>
        </label>
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
              className={inputClass}
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
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Create a strong password"
              className={clsx(inputClass, 'pr-10')}
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

        <div className="space-y-1.5 rounded-md border border-border bg-canvas px-3 py-2.5">
          {rules.map((rule) => {
            const met = rule.test(password)
            return (
              <div key={rule.label} className="flex items-center gap-2 text-[11px]">
                <span
                  className={clsx(
                    'flex h-3.5 w-3.5 items-center justify-center rounded-full border',
                    met ? 'border-status-success bg-status-success text-white' : 'border-border-strong bg-surface',
                  )}
                >
                  {met && <Check size={9} strokeWidth={3} />}
                </span>
                <span className={met ? 'text-status-success' : 'text-ink-secondary'}>{rule.label}</span>
              </div>
            )
          })}
        </div>
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
          {submitting ? 'Creating account…' : 'Create account'}
          {!submitting && <ArrowRight size={15} />}
        </button>
      </form>
    </AuthShell>
  )
}
