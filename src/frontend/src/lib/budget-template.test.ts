import { afterEach, describe, expect, it, vi } from 'vitest'
import type { BudgetLine, BudgetTemplate } from './api'
import {
  removeBudgetLine,
  replaceBudgetTemplate,
  upsertBudgetLine,
} from './budget-template'

const firstLine: BudgetLine = {
  id: 'line-one',
  name: 'Household',
  allowancePence: 20_000,
  tagId: 'tag-one',
  contributorShares: [{ contributorId: 'owner', basisPoints: 10_000 }],
}

const secondLine: BudgetLine = {
  id: 'line-two',
  name: 'Personal',
  allowancePence: 5_000,
  tagId: 'tag-two',
  contributorShares: [{ contributorId: 'owner', basisPoints: 10_000 }],
}

describe('budget template persistence', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('builds complete proposed templates for add, edit, and delete', () => {
    expect(upsertBudgetLine([firstLine], secondLine)).toEqual([firstLine, secondLine])

    const edited = { ...firstLine, name: 'Shared household', allowancePence: 25_000 }
    expect(upsertBudgetLine([firstLine, secondLine], edited)).toEqual([
      edited,
      secondLine,
    ])
    expect(removeBudgetLine([edited, secondLine], secondLine.id)).toEqual([edited])
    expect(removeBudgetLine([edited], edited.id)).toEqual([])
  })

  it('sends the full template and accepts the canonical response', async () => {
    const response: BudgetTemplate = {
      id: 'template',
      lines: [firstLine, secondLine],
    }
    const fetchMock = vi.fn().mockResolvedValue(Response.json(response, { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(replaceBudgetTemplate([firstLine, secondLine])).resolves.toEqual(
      response,
    )

    const init = fetchMock.mock.calls[0]?.[1] as RequestInit
    expect(init.method).toBe('PUT')
    const body = typeof init.body === 'string' ? init.body : ''
    expect(JSON.parse(body)).toEqual({
      lines: [
        {
          name: 'Household',
          allowancePence: 20_000,
          tagId: 'tag-one',
          contributorShares: [{ contributorId: 'owner', basisPoints: 10_000 }],
        },
        {
          name: 'Personal',
          allowancePence: 5_000,
          tagId: 'tag-two',
          contributorShares: [{ contributorId: 'owner', basisPoints: 10_000 }],
        },
      ],
    })
  })

  it('persists an empty template when the final line is deleted', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(Response.json({ id: 'template', lines: [] }, { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    await replaceBudgetTemplate([])

    const init = fetchMock.mock.calls[0]?.[1] as RequestInit
    const body = typeof init.body === 'string' ? init.body : ''
    expect(JSON.parse(body)).toEqual({ lines: [] })
  })

  it('rejects failed saves without mutating the proposed lines', async () => {
    const proposed = [firstLine]
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        Response.json(
          { title: 'Budget could not be saved', status: 409 },
          { status: 409 },
        ),
      )
    vi.stubGlobal('fetch', fetchMock)

    await expect(replaceBudgetTemplate(proposed)).rejects.toThrow(
      'Budget could not be saved',
    )
    expect(proposed).toEqual([firstLine])
  })
})
