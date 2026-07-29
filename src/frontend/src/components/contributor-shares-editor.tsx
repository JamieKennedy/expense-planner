import { Button } from '~/components/ui/button'
import { FieldError } from '~/components/ui/field'
import { Input } from '~/components/ui/input'
import type { ContributorShare, ReferenceItem } from '~/lib/api'
import { evenContributorShares } from '~/lib/contributor-split'
import type { ReactNode } from 'react'

export function ContributorSharesEditor({
  contributors,
  shares,
  onChange,
  error,
  action,
  disabled = false,
}: {
  contributors: ReferenceItem[]
  shares: ContributorShare[]
  onChange: (shares: ContributorShare[]) => void
  error?: string
  action?: ReactNode
  disabled?: boolean
}) {
  const total = shares.reduce((sum, share) => sum + share.basisPoints, 0)
  return (
    <fieldset aria-invalid={Boolean(error) || undefined}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <legend className="text-sm font-medium text-slate-300">
            Contributor split
          </legend>
          {action}
        </div>
        <div className="flex items-center gap-3">
          <span
            className={
              total === 10_000 ? 'text-xs text-teal-300' : 'text-xs text-rose-300'
            }
          >
            {(total / 100).toFixed(2)}%
          </span>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={disabled || shares.length === 0}
            onClick={() =>
              onChange(
                evenContributorShares(
                  contributors,
                  shares.map((share) => share.contributorId),
                ),
              )
            }
          >
            Split evenly
          </Button>
        </div>
      </div>
      <div className="grid gap-2">
        {contributors.map((contributor) => {
          const share = shares.find((item) => item.contributorId === contributor.id)
          return (
            <div
              key={contributor.id}
              className="grid grid-cols-[1fr_8rem] items-center gap-4 rounded-xl border border-slate-700 p-3"
            >
              <label className="flex items-center gap-3 text-sm text-slate-300">
                <input
                  type="checkbox"
                  disabled={disabled}
                  className="accent-teal-400"
                  checked={Boolean(share)}
                  onChange={(event) => {
                    const ids = event.target.checked
                      ? [...shares.map((item) => item.contributorId), contributor.id]
                      : shares
                          .filter((item) => item.contributorId !== contributor.id)
                          .map((item) => item.contributorId)
                    onChange(evenContributorShares(contributors, ids))
                  }}
                />
                <span>{contributor.name}</span>
                {contributor.isOwner && (
                  <span className="rounded-full bg-teal-400/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-teal-300">
                    You
                  </span>
                )}
              </label>
              <div className="relative">
                <Input
                  type="number"
                  min={0}
                  max={100}
                  step={0.01}
                  disabled={disabled || !share}
                  value={share ? share.basisPoints / 100 : ''}
                  className="pr-8"
                  aria-label={`${contributor.name} percentage`}
                  onChange={(event) =>
                    onChange(
                      shares.map((item) =>
                        item.contributorId === contributor.id
                          ? {
                              ...item,
                              basisPoints: Math.round(Number(event.target.value) * 100),
                            }
                          : item,
                      ),
                    )
                  }
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500">
                  %
                </span>
              </div>
            </div>
          )
        })}
      </div>
      <FieldError className="mt-2">{error}</FieldError>
    </fieldset>
  )
}
