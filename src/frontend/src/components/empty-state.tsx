import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon
  title: string
  description: string
  action?: ReactNode
}) {
  return (
    <div className="grid min-h-56 place-items-center rounded-2xl border border-dashed border-slate-700 p-8 text-center">
      <div>
        <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-slate-800 text-slate-400">
          <Icon />
        </span>
        <h3 className="mt-4 font-semibold">{title}</h3>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
          {description}
        </p>
        {action && <div className="mt-5">{action}</div>}
      </div>
    </div>
  )
}
