import type { InputHTMLAttributes } from 'react'
import { cn } from '~/lib/utils'

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        'h-11 w-full rounded-xl border border-slate-700 bg-slate-950/60 px-3 text-slate-100 outline-none placeholder:text-slate-500 focus:border-teal-400 focus:ring-2 focus:ring-teal-400/20',
        className,
      )}
      {...props}
    />
  )
}
