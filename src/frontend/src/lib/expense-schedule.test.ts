import { describe, expect, it } from 'vitest'
import {
  defaultScheduleDate,
  expenseOccurrenceKey,
  moveMonth,
  scheduleRequestFields,
  weekdayName,
} from './expense-schedule'

describe('expense schedule form mapping', () => {
  it('maps a one-off to an exact date without working-day adjustment', () => {
    expect(
      scheduleRequestFields({
        isRecurring: false,
        frequency: 'monthly',
        scheduleDate: '2026-04-17',
        startMonth: '2026-04',
        dayOfMonth: 17,
        moveToNextWorkingDay: true,
      }),
    ).toEqual({
      frequency: null,
      scheduleAnchorDate: '2026-04-17',
      dayOfMonth: null,
      moveToNextWorkingDay: false,
    })
  })

  it('maps weekly and monthly schedules while preserving a legacy null start', () => {
    expect(
      scheduleRequestFields({
        isRecurring: true,
        frequency: 'weekly',
        scheduleDate: '2026-04-15',
        startMonth: '',
        dayOfMonth: 1,
        moveToNextWorkingDay: true,
      }),
    ).toEqual({
      frequency: 'weekly',
      scheduleAnchorDate: '2026-04-15',
      dayOfMonth: null,
      moveToNextWorkingDay: true,
    })
    expect(
      scheduleRequestFields({
        isRecurring: true,
        frequency: 'monthly',
        scheduleDate: '2026-04-15',
        startMonth: '',
        dayOfMonth: 31,
        moveToNextWorkingDay: false,
      }),
    ).toEqual({
      frequency: 'monthly',
      scheduleAnchorDate: null,
      dayOfMonth: 31,
      moveToNextWorkingDay: false,
    })
  })
})

describe('expense schedule navigation', () => {
  it('defaults to today in the current month and the first elsewhere', () => {
    const today = new Date(2026, 3, 17)

    expect(defaultScheduleDate('2026-04', today)).toBe('2026-04-17')
    expect(defaultScheduleDate('2026-05', today)).toBe('2026-05-01')
  })

  it('moves across year boundaries and names the weekly anchor weekday', () => {
    expect(moveMonth('2026-01', -1)).toBe('2025-12')
    expect(moveMonth('2026-12', 1)).toBe('2027-01')
    expect(weekdayName('2026-04-15')).toBe('Wednesday')
  })

  it('gives repeated weekly occurrences distinct row keys', () => {
    const id = '48d83c00-7b57-4215-b070-6395ed783e21'

    expect(expenseOccurrenceKey({ id, nominalDate: '2026-04-01' })).not.toBe(
      expenseOccurrenceKey({ id, nominalDate: '2026-04-08' }),
    )
  })
})
