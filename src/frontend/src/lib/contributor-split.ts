import type { ContributorShare, ReferenceItem } from './api'

export function evenContributorShares(
  contributors: ReferenceItem[],
  contributorIds: string[],
): ContributorShare[] {
  const ids = contributorIds.filter((id, index) => contributorIds.indexOf(id) === index)
  if (ids.length === 0) return []

  const base = Math.floor(10_000 / ids.length)
  const remainder = 10_000 - base * ids.length
  const ownerId = contributors.find(
    (contributor) => contributor.isOwner && ids.includes(contributor.id),
  )?.id
  const remainderOrder = [
    ...(ownerId ? [ownerId] : []),
    ...contributors
      .map((contributor) => contributor.id)
      .filter((id) => ids.includes(id) && id !== ownerId),
    ...ids.filter(
      (id) =>
        id !== ownerId && !contributors.some((contributor) => contributor.id === id),
    ),
  ]
  const receivesRemainder = new Set(remainderOrder.slice(0, remainder))

  return ids.map((contributorId) => ({
    contributorId,
    basisPoints: base + (receivesRemainder.has(contributorId) ? 1 : 0),
  }))
}
