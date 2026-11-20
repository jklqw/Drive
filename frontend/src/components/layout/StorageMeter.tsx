import clsx from 'clsx'
import { formatBytes } from '../../lib/format'

interface StorageMeterProps {
  used: number
  quota: number
}

export function StorageMeter({ used, quota }: StorageMeterProps) {
  const ratio = quota > 0 ? Math.min(used / quota, 1) : 0
  const percent = Math.round(ratio * 100)
  const color = percent >= 90 ? 'bg-status-danger' : percent >= 80 ? 'bg-status-warning' : 'bg-brand'
  const segments = 20
  const filled = Math.round(ratio * segments)

  return (
    <div className="border-t border-border px-4 py-4">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium uppercase tracking-wider text-ink-tertiary">Storage</span>
        <span className="font-mono text-[10px] text-ink-secondary">{percent}%</span>
      </div>
      <div className="mt-2.5 flex gap-[3px]" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
        {Array.from({ length: segments }, (_, index) => (
          <span
            key={index}
            className={clsx('h-1.5 flex-1 rounded-[1px]', index < filled ? color : 'bg-border')}
          />
        ))}
      </div>
      <p className="mt-2 font-mono text-[10.5px] text-ink-secondary">
        {formatBytes(used)} <span className="text-ink-tertiary">/</span> {formatBytes(quota)}
      </p>
    </div>
  )
}
