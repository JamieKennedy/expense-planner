import type { ButtonHTMLAttributes } from 'react'
import { cn } from '~/lib/utils'

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'default' | 'sm' | 'icon'
}

export function buttonClassName({
  variant = 'primary',
  size = 'default',
  className,
}: Pick<ButtonProps, 'variant' | 'size' | 'className'> = {}) {
  return cn(
    'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400 disabled:pointer-events-none disabled:opacity-50',
    variant === 'primary' && 'bg-teal-400 text-slate-950 hover:bg-teal-300',
    variant === 'secondary' &&
      'border border-slate-700 bg-slate-800 text-slate-100 hover:bg-slate-700',
    variant === 'ghost' && 'text-slate-300 hover:bg-slate-800 hover:text-white',
    variant === 'danger' && 'bg-rose-500/15 text-rose-300 hover:bg-rose-500/25',
    size === 'default' && 'h-11 px-5',
    size === 'sm' && 'h-9 px-3 text-sm',
    size === 'icon' && 'size-10',
    className,
  )
}

export function Button({
  className,
  variant = 'primary',
  size = 'default',
  ...props
}: ButtonProps) {
  return <button className={buttonClassName({ variant, size, className })} {...props} />
}
