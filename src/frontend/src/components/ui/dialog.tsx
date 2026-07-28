import { X } from 'lucide-react'
import type { ReactNode } from 'react'
import { Button } from './button'

export function Dialog({
  open,
  title,
  description,
  onClose,
  children,
}: {
  open: boolean
  title: string
  description?: string
  onClose: () => void
  children: ReactNode
}) {
  if (!open) return null
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-950/80 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="my-8 w-full max-w-2xl rounded-3xl border border-slate-700 bg-slate-900 shadow-2xl shadow-black/50">
        <div className="flex items-start justify-between border-b border-slate-800 p-6">
          <div>
            <h2 className="text-xl font-semibold">{title}</h2>
            {description && <p className="mt-2 text-sm text-slate-400">{description}</p>}
          </div>
          <Button size="icon" variant="ghost" onClick={onClose} aria-label="Close">
            <X />
          </Button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  )
}
