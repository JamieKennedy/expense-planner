import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Button } from '~/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '~/components/ui/popover'
import { cn } from '~/lib/utils'

const dateFormatter = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: 'long',
  year: 'numeric',
})
const monthFormatter = new Intl.DateTimeFormat('en-GB', {
  month: 'long',
  year: 'numeric',
})
const weekdays = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']

export function DatePicker({
  value,
  onValueChange,
  label = 'Date',
  invalid,
  disabled,
}: {
  value: string
  onValueChange: (value: string) => void
  label?: string
  invalid?: boolean
  disabled?: boolean
}) {
  const selected = parseDate(value)
  const [open, setOpen] = useState(false)
  const [visibleMonth, setVisibleMonth] = useState(
    () => selected ?? startOfMonth(new Date()),
  )
  const days = useMemo(() => calendarDays(visibleMonth), [visibleMonth])

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen)
        if (nextOpen) setVisibleMonth(selected ?? startOfMonth(new Date()))
      }}
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="secondary"
          disabled={disabled}
          aria-invalid={invalid || undefined}
          aria-label={`${label}: ${selected ? dateFormatter.format(selected) : 'not selected'}`}
          className="w-full justify-start px-3 font-medium"
        >
          <CalendarDays size={17} className="text-slate-400" />
          {selected ? dateFormatter.format(selected) : `Choose ${label.toLowerCase()}`}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 p-4">
        <div className="mb-4 flex items-center justify-between">
          <Button
            type="button"
            size="icon"
            variant="ghost"
            aria-label="Previous month"
            onClick={() =>
              setVisibleMonth(
                (current) => new Date(current.getFullYear(), current.getMonth() - 1, 1),
              )
            }
          >
            <ChevronLeft size={17} />
          </Button>
          <span className="font-semibold">{monthFormatter.format(visibleMonth)}</span>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            aria-label="Next month"
            onClick={() =>
              setVisibleMonth(
                (current) => new Date(current.getFullYear(), current.getMonth() + 1, 1),
              )
            }
          >
            <ChevronRight size={17} />
          </Button>
        </div>
        <div className="grid grid-cols-7 text-center text-xs text-slate-500">
          {weekdays.map((weekday) => (
            <span key={weekday} className="py-2">
              {weekday}
            </span>
          ))}
          {days.map((day) => {
            const active = value === toIsoDate(day)
            const inMonth = day.getMonth() === visibleMonth.getMonth()
            return (
              <Button
                key={toIsoDate(day)}
                type="button"
                size="icon"
                variant={active ? 'primary' : 'ghost'}
                className={cn('size-9', !inMonth && 'text-slate-600')}
                aria-pressed={active}
                aria-label={dateFormatter.format(day)}
                onClick={() => {
                  onValueChange(toIsoDate(day))
                  setOpen(false)
                }}
              >
                {day.getDate()}
              </Button>
            )
          })}
        </div>
      </PopoverContent>
    </Popover>
  )
}

function calendarDays(month: Date) {
  const first = startOfMonth(month)
  const mondayOffset = (first.getDay() + 6) % 7
  const start = new Date(first.getFullYear(), first.getMonth(), 1 - mondayOffset)
  return Array.from(
    { length: 42 },
    (_, index) =>
      new Date(start.getFullYear(), start.getMonth(), start.getDate() + index),
  )
}

function parseDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return undefined
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  return Number.isNaN(date.valueOf()) ? undefined : date
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function toIsoDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate(),
  ).padStart(2, '0')}`
}
