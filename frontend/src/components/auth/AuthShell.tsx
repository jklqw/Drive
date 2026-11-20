import type { ReactNode } from 'react'
import { Check, FolderLock, Lock, ShieldCheck } from 'lucide-react'

interface AuthShellProps {
  title: string
  subtitle: string
  children: ReactNode
  footer: ReactNode
}

export function AuthShell({ title, subtitle, children, footer }: AuthShellProps) {
  return (
    <main className="grid min-h-screen w-full bg-canvas lg:grid-cols-[minmax(320px,42%)_1fr]">
      <section className="relative hidden overflow-hidden bg-ink-primary px-12 py-14 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="pointer-events-none absolute inset-0 opacity-[0.07] [background-image:linear-gradient(to_right,#fff_1px,transparent_1px),linear-gradient(to_bottom,#fff_1px,transparent_1px)] [background-size:44px_44px]" />
        <div className="relative flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-white text-ink-primary">
            <FolderLock size={17} strokeWidth={2} />
          </span>
          <span className="text-[15px] font-semibold tracking-tight">sfmp<span className="text-white/50">/vault</span></span>
        </div>
        <div className="relative max-w-sm">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-white/45">Private by architecture</p>
          <h2 className="mt-4 text-[34px] font-semibold leading-[1.14] tracking-[-0.03em]">
            Your files. Your rules. Nothing public by accident.
          </h2>
          <ul className="mt-8 space-y-3.5 text-[13px] text-white/70">
            {[
              'Encrypted sessions with short-lived access tokens',
              'Content-inspected uploads, isolated from the webroot',
              'Object-level ownership checks on every request',
            ].map((item) => (
              <li key={item} className="flex gap-3">
                <Check size={15} className="mt-0.5 shrink-0 text-white/90" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="relative flex items-center gap-5 border-t border-white/10 pt-6 font-mono text-[10px] uppercase tracking-wider text-white/35">
          <span className="flex items-center gap-1.5"><ShieldCheck size={13} /> OWASP ASVS</span>
          <span className="flex items-center gap-1.5"><Lock size={13} /> Argon2id</span>
        </div>
      </section>

      <section className="flex items-center justify-center px-6 py-12 sm:px-12">
        <div className="w-full max-w-[400px]">
          <div className="mb-8 flex items-center gap-2 lg:hidden">
            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-ink-primary text-white">
              <FolderLock size={17} />
            </span>
            <span className="text-[15px] font-semibold tracking-tight">sfmp<span className="text-ink-tertiary">/vault</span></span>
          </div>
          <h1 className="text-[26px] font-semibold tracking-[-0.03em] text-ink-primary">{title}</h1>
          <p className="mt-1.5 text-[13px] leading-5 text-ink-secondary">{subtitle}</p>
          <div className="mt-8">{children}</div>
          <div className="mt-6 border-t border-border pt-5 text-[13px] text-ink-secondary">{footer}</div>
        </div>
      </section>
    </main>
  )
}
