import { describe, expect, it } from 'vitest'
import { displayMonth, formatMoney } from './utils'

describe('display helpers', () => {
  it('formats integer pence as GBP', () => {
    expect(formatMoney(123456)).toBe('£1,234.56')
  })

  it('formats an ISO month for the en-GB interface', () => {
    expect(displayMonth('2026-07')).toBe('July 2026')
  })
})
