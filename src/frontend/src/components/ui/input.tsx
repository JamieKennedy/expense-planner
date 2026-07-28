import type { InputHTMLAttributes, SelectHTMLAttributes } from 'react'
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

export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        'h-11 w-full rounded-xl border border-slate-700 bg-slate-950/60 px-3 text-slate-100 outline-none focus:border-teal-400',
        className,
      )}
      {...props}
    />
  )
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-2 text-sm font-medium text-slate-300">
      {label}
      {children}
    </label>
  )
}
