import { cn } from '@/lib/utils'

// ─── Card ─────────────────────────────────────────────────────────────────────

interface CardProps {
  children: React.ReactNode
  className?: string
  onClick?: () => void
  hoverable?: boolean
}

export function Card({ children, className, onClick, hoverable }: CardProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        'bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden',
        hoverable && 'cursor-pointer transition-shadow duration-200 hover:shadow-md hover:-translate-y-0.5',
        className
      )}
    >
      {children}
    </div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

export function Skeleton({ className }: { className?: string }) {
  return (
    <div className={cn('animate-pulse rounded-md bg-slate-200', className)} />
  )
}

export function ListingCardSkeleton() {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <Skeleton className="h-48 w-full rounded-none" />
      <div className="p-4 space-y-3">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
        <Skeleton className="h-4 w-1/4" />
      </div>
    </div>
  )
}

// ─── Empty State ──────────────────────────────────────────────────────────────

interface EmptyStateProps {
  icon?: React.ReactNode
  title: string
  description?: string
  action?: React.ReactNode
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      {icon && <div className="mb-4 text-slate-400">{icon}</div>}
      <h3 className="text-base font-semibold text-slate-800 mb-1">{title}</h3>
      {description && <p className="text-sm text-slate-500 max-w-sm">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

// ─── Section ──────────────────────────────────────────────────────────────────

interface SectionProps {
  title?: string
  subtitle?: string
  action?: React.ReactNode
  children: React.ReactNode
  className?: string
}

export function Section({ title, subtitle, action, children, className }: SectionProps) {
  return (
    <section className={cn('py-10', className)}>
      {(title || action) && (
        <div className="flex items-end justify-between mb-6">
          <div>
            {title && <h2 className="text-xl font-bold text-slate-900">{title}</h2>}
            {subtitle && <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>}
          </div>
          {action && <div>{action}</div>}
        </div>
      )}
      {children}
    </section>
  )
}
