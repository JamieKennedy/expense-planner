import type { Expense } from './api'

export type ExpenseScheduleFormValue = {
  isRecurring: boolean
  frequency: 'monthly' | 'weekly'
  scheduleDate: string
  startMonth: string
  dayOfMonth: number
  moveToNextWorkingDay: boolean
}

export function scheduleRequestFields(value: ExpenseScheduleFormValue) {
  if (!value.isRecurring) {
    return {
      frequency: null,
      scheduleAnchorDate: value.scheduleDate,
      dayOfMonth: null,
      moveToNextWorkingDay: false,
    } as const
  }

  if (value.frequency === 'weekly') {
    return {
      frequency: 'weekly',
      scheduleAnchorDate: value.scheduleDate,
      dayOfMonth: null,
      moveToNextWorkingDay: value.moveToNextWorkingDay,
    } as const
  }

  return {
    frequency: 'monthly',
    scheduleAnchorDate: value.startMonth ? `${value.startMonth}-01` : null,
    dayOfMonth: value.dayOfMonth,
    moveToNextWorkingDay: value.moveToNextWorkingDay,
  } as const
}

export function expenseOccurrenceKey(expense: Pick<Expense, 'id' | 'nominalDate'>) {
  return `${expense.id}:${expense.nominalDate}`
}

export function frequencyLabel(frequency: Expense['frequency']) {
  return frequency === 'monthly'
    ? 'Monthly'
    : frequency === 'weekly'
      ? 'Weekly'
      : 'One-off'
}

export function defaultScheduleDate(month: string, today = new Date()) {
  const todayMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(
    2,
    '0',
  )}`
  return month === todayMonth
    ? `${todayMonth}-${String(today.getDate()).padStart(2, '0')}`
    : `${month}-01`
}

export function weekdayName(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return 'week'
  return new Intl.DateTimeFormat('en-GB', { weekday: 'long' }).format(
    new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])),
  )
}

export function moveMonth(value: string, delta: number) {
  const [year, month] = value.split('-').map(Number)
  const next = new Date(year, month - 1 + delta, 1)
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`
}
