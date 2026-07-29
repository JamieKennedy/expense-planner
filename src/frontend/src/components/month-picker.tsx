import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Button } from '~/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '~/components/ui/popover'
import { cn } from '~/lib/utils'

const monthFormatter = new Intl.DateTimeFormat('en-GB', {
  month: 'long',
  year: 'numeric',
})
const shortMonthFormatter = new Intl.DateTimeFormat('en-GB', { month: 'short' })

export function MonthPicker({
  value,
  onValueChange,
  className,
  label = 'Projection month',
}: {
  value: string
  onValueChange: (value: string) => void
  className?: string
  label?: string
}) {
  const selected = parseMonth(value)
  const [open, setOpen] = useState(false)
  const [year, setYear] = useState(selected.year)

  const months = useMemo(
    () =>
      Array.from({ length: 12 }, (_, month) => ({
        month: month + 1,
        label: shortMonthFormatter.format(new Date(Date.UTC(year, month, 1))),
      })),
    [year],
  )

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen)
        if (nextOpen) setYear(selected.year)
      }}
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="secondary"
          className={cn('w-full justify-start px-3 font-medium', className)}
          aria-label={`${label}: ${monthFormatter.format(
            new Date(Date.UTC(selected.year, selected.month - 1, 1)),
          )}`}
        >
          <CalendarDays size={17} className="text-slate-400" />
          {monthFormatter.format(
            new Date(Date.UTC(selected.year, selected.month - 1, 1)),
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-4">
        <div className="mb-4 flex items-center justify-between">
          <Button
            type="button"
            size="icon"
            variant="ghost"
            aria-label="Previous year"
            onClick={() => setYear((current) => current - 1)}
          >
            <ChevronLeft size={17} />
          </Button>
          <span className="font-semibold">{year}</span>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            aria-label="Next year"
            onClick={() => setYear((current) => current + 1)}
          >
            <ChevronRight size={17} />
          </Button>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {months.map((item) => {
            const active = selected.year === year && selected.month === item.month
            return (
              <Button
                key={item.month}
                type="button"
                size="sm"
                variant={active ? 'primary' : 'ghost'}
                aria-pressed={active}
                onClick={() => {
                  onValueChange(`${year}-${String(item.month).padStart(2, '0')}`)
                  setOpen(false)
                }}
              >
                {item.label}
              </Button>
            )
          })}
        </div>
      </PopoverContent>
    </Popover>
  )
}

function parseMonth(value: string) {
  const match = /^(\d{4})-(\d{2})$/.exec(value)
  if (!match) {
    const now = new Date()
    return { year: now.getFullYear(), month: now.getMonth() + 1 }
  }

  return { year: Number(match[1]), month: Number(match[2]) }
}
