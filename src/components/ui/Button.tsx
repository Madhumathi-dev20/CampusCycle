import { forwardRef } from 'react'
import { cn } from '@/lib/utils'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', loading, disabled, children, ...props }, ref) => {
    const base = 'inline-flex items-center justify-center gap-2 font-medium rounded-lg transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none select-none'

    const variants = {
      primary: 'bg-emerald-600 text-white hover:bg-emerald-700 focus-visible:ring-emerald-500 shadow-sm',
      secondary: 'bg-slate-900 text-white hover:bg-slate-700 focus-visible:ring-slate-500 shadow-sm',
      outline: 'border border-slate-300 text-slate-700 bg-white hover:bg-slate-50 focus-visible:ring-slate-400',
      ghost: 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus-visible:ring-slate-400',
      danger: 'bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-500 shadow-sm',
    }

    const sizes = {
      sm: 'text-sm px-3 py-1.5 h-8',
      md: 'text-sm px-4 py-2 h-9',
      lg: 'text-base px-6 py-2.5 h-11',
    }

    return (
      <button
        ref={ref}
        className={cn(base, variants[variant], sizes[size], className)}
        disabled={disabled || loading}
        {...props}
      >
        {loading && (
          <span className="size-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
        )}
        {children}
      </button>
    )
  }
)
Button.displayName = 'Button'
