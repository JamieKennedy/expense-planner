import { describe, expect, it } from 'vitest'
import type { ReferenceItem } from './api'
import { evenContributorShares } from './contributor-split'

const contributors: ReferenceItem[] = [
  {
    id: 'chloe',
    name: 'Chloe',
    isArchived: false,
    isOwner: false,
  },
  {
    id: 'owner',
    name: 'Jamie',
    isArchived: false,
    isOwner: true,
  },
  {
    id: 'skye',
    name: 'Skye',
    isArchived: false,
    isOwner: false,
  },
]

describe('evenContributorShares', () => {
  it('assigns the odd basis point to the owner regardless of selection order', () => {
    const shares = evenContributorShares(contributors, ['chloe', 'skye', 'owner'])

    expect(shares).toEqual([
      { contributorId: 'chloe', basisPoints: 3333 },
      { contributorId: 'skye', basisPoints: 3333 },
      { contributorId: 'owner', basisPoints: 3334 },
    ])
    expect(shares.reduce((total, share) => total + share.basisPoints, 0)).toBe(10_000)
  })

  it('falls back to displayed contributor order when the owner is not selected', () => {
    expect(evenContributorShares(contributors, ['skye', 'chloe', 'other'])).toEqual([
      { contributorId: 'skye', basisPoints: 3333 },
      { contributorId: 'chloe', basisPoints: 3334 },
      { contributorId: 'other', basisPoints: 3333 },
    ])
  })

  it('keeps one and two-person splits exact', () => {
    expect(evenContributorShares(contributors, ['owner'])).toEqual([
      { contributorId: 'owner', basisPoints: 10_000 },
    ])
    expect(evenContributorShares(contributors, ['owner', 'chloe'])).toEqual([
      { contributorId: 'owner', basisPoints: 5_000 },
      { contributorId: 'chloe', basisPoints: 5_000 },
    ])
  })
})
