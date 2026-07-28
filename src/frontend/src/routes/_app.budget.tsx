import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { BarChart3, Pencil, Plus, Save, Trash2, Users } from 'lucide-react'
import { useMemo, useState } from 'react'
import { EmptyState } from '~/components/empty-state'
import { PageHeading } from '~/components/page-heading'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import { Card, CardContent } from '~/components/ui/card'
import { Dialog } from '~/components/ui/dialog'
import { Field, Input, Select } from '~/components/ui/input'
import {
  apiRequest,
  type BudgetLine,
  type BudgetTemplate,
  type ContributorShare,
  type ReferenceData,
} from '~/lib/api'
import { formatMoney } from '~/lib/utils'

export const Route = createFileRoute('/_app/budget')({
  component: BudgetPage,
})

function BudgetPage() {
  const queryClient = useQueryClient()
  const [draftLines, setLines] = useState<BudgetLine[]>()
  const [editing, setEditing] = useState<BudgetLine | null | undefined>()
  const [saved, setSaved] = useState(false)
  const references = useQuery({
    queryKey: ['reference-data'],
    queryFn: () => apiRequest<ReferenceData>('/api/reference-data?includeArchived=false'),
  })
  const budget = useQuery({
    queryKey: ['budget-template'],
    queryFn: () => apiRequest<BudgetTemplate>('/api/budget-template'),
  })
  const lines = useMemo(
    () => draftLines ?? budget.data?.lines ?? [],
    [budget.data?.lines, draftLines],
  )

  const save = useMutation({
    mutationFn: () =>
      apiRequest<BudgetTemplate>('/api/budget-template', {
        method: 'PUT',
        body: JSON.stringify({
          lines: lines.map(({ name, allowancePence, tagId, contributorShares }) => ({
            name,
            allowancePence,
            tagId,
            contributorShares,
          })),
        }),
      }),
    onSuccess: async (result) => {
      setLines(result.lines)
      setSaved(true)
      window.setTimeout(() => setSaved(false), 2500)
      await queryClient.invalidateQueries({ queryKey: ['budget-template'] })
      await queryClient.invalidateQueries({ queryKey: ['monthly-overview'] })
    },
  })

  const total = lines.reduce((sum, line) => sum + line.allowancePence, 0)
  const contributions = useMemo(() => {
    const result = new Map<string, number>()
    for (const line of lines) {
      let allocated = 0
      line.contributorShares.forEach((share, index) => {
        const amount =
          index === line.contributorShares.length - 1
            ? line.allowancePence - allocated
            : Math.floor((line.allowancePence * share.basisPoints) / 10_000)
        allocated += amount
        result.set(share.contributorId, (result.get(share.contributorId) ?? 0) + amount)
      })
    }
    return [...result.entries()]
  }, [lines])

  return (
    <div className="animate-rise">
      <PageHeading
        eyebrow="Recurring template"
        title="Monthly budget"
        description="Set one allowance per tag and decide how each line is shared."
        actions={
          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => setEditing(null)}>
              <Plus size={18} /> Add line
            </Button>
            <Button
              onClick={() => save.mutate()}
              disabled={save.isPending || lines.length === 0}
            >
              <Save size={18} />
              {save.isPending ? 'Saving…' : saved ? 'Saved' : 'Save budget'}
            </Button>
          </div>
        }
      />
      <section className="mb-6 grid gap-4 md:grid-cols-[1fr_2fr]">
        <Card>
          <CardContent className="py-6">
            <p className="text-sm text-slate-400">Total monthly allowance</p>
            <p className="mt-2 text-3xl font-semibold">{formatMoney(total)}</p>
            <p className="mt-3 text-xs text-slate-500">
              Changes apply to every report month, including earlier months.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-6">
            <p className="mb-4 flex items-center gap-2 text-sm font-medium text-slate-300">
              <Users size={17} className="text-teal-300" /> Planned contributions
            </p>
            <div className="flex flex-wrap gap-3">
              {contributions.length === 0 ? (
                <p className="text-sm text-slate-500">Add lines to see the split.</p>
              ) : (
                contributions.map(([id, amount]) => (
                  <div
                    key={id}
                    className="rounded-xl border border-slate-700 bg-slate-950/40 px-4 py-3"
                  >
                    <p className="text-xs text-slate-500">
                      {references.data?.contributors.find((item) => item.id === id)
                        ?.name ?? 'Archived'}
                    </p>
                    <p className="mt-1 font-semibold">{formatMoney(amount)}</p>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </section>
      <Card>
        <CardContent>
          {budget.isLoading ? (
            <div className="h-60 animate-pulse rounded-xl bg-slate-900" />
          ) : lines.length === 0 ? (
            <EmptyState
              icon={BarChart3}
              title="Build your monthly budget"
              description="Each line connects one tag to an allowance and a contributor split."
              action={
                <Button size="sm" onClick={() => setEditing(null)}>
                  <Plus size={16} /> Add first line
                </Button>
              }
            />
          ) : (
            <div className="divide-y divide-slate-800">
              {lines.map((line) => {
                const tag = references.data?.tags.find((item) => item.id === line.tagId)
                return (
                  <div
                    key={line.id}
                    className="flex flex-col justify-between gap-4 py-5 first:pt-0 last:pb-0 md:flex-row md:items-center"
                  >
                    <div>
                      <div className="flex items-center gap-3">
                        <p className="font-medium">{line.name}</p>
                        {tag && (
                          <Badge>
                            <span
                              className="mr-1.5 size-1.5 rounded-full"
                              style={{ backgroundColor: tag.colour }}
                            />
                            {tag.name}
                          </Badge>
                        )}
                      </div>
                      <p className="mt-2 text-sm text-slate-500">
                        {line.contributorShares
                          .map((share) => {
                            const contributor = references.data?.contributors.find(
                              (item) => item.id === share.contributorId,
                            )
                            return `${contributor?.name ?? 'Archived'} ${share.basisPoints / 100}%`
                          })
                          .join(' · ')}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="mr-2 text-lg font-semibold">
                        {formatMoney(line.allowancePence)}
                      </span>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => setEditing(line)}
                        aria-label={`Edit ${line.name}`}
                      >
                        <Pencil size={16} />
                      </Button>
                      <Button
                        size="icon"
                        variant="danger"
                        onClick={() =>
                          setLines((current) =>
                            (current ?? lines).filter((item) => item.id !== line.id),
                          )
                        }
                        aria-label={`Remove ${line.name}`}
                      >
                        <Trash2 size={16} />
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
      {editing !== undefined && (
        <BudgetLineDialog
          key={editing?.id ?? 'new'}
          line={editing}
          references={references.data}
          usedTagIds={lines
            .filter((line) => line.id !== editing?.id)
            .map((line) => line.tagId)}
          onClose={() => setEditing(undefined)}
          onSave={(line) => {
            setLines((current) => {
              const values = current ?? lines
              const index = values.findIndex((item) => item.id === line.id)
              if (index < 0) return [...values, line]
              return values.map((item) => (item.id === line.id ? line : item))
            })
            setEditing(undefined)
          }}
        />
      )}
    </div>
  )
}

function BudgetLineDialog({
  line,
  references,
  usedTagIds,
  onClose,
  onSave,
}: {
  line: BudgetLine | null
  references?: ReferenceData
  usedTagIds: string[]
  onClose: () => void
  onSave: (line: BudgetLine) => void
}) {
  const [name, setName] = useState(line?.name ?? '')
  const [allowance, setAllowance] = useState(
    line ? String(line.allowancePence / 100) : '',
  )
  const [tagId, setTagId] = useState(line?.tagId ?? '')
  const [shares, setShares] = useState<ContributorShare[]>(
    line?.contributorShares ??
      (references?.contributors[0]
        ? [{ contributorId: references.contributors[0].id, basisPoints: 10_000 }]
        : []),
  )
  const totalBasisPoints = shares.reduce((sum, share) => sum + share.basisPoints, 0)

  return (
    <Dialog
      open
      title={line ? 'Edit budget line' : 'Add budget line'}
      description="Each tag can appear once. Contributor percentages must total 100%."
      onClose={onClose}
    >
      <form
        className="grid gap-5"
        onSubmit={(event) => {
          event.preventDefault()
          onSave({
            id: line?.id ?? crypto.randomUUID(),
            name,
            allowancePence: Math.round(Number(allowance) * 100),
            tagId,
            contributorShares: shares,
          })
        }}
      >
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Line name">
            <Input
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </Field>
          <Field label="Allowance (£)">
            <Input
              required
              type="number"
              min="0.01"
              step="0.01"
              value={allowance}
              onChange={(event) => setAllowance(event.target.value)}
            />
          </Field>
        </div>
        <Field label="Budget tag">
          <Select
            required
            value={tagId}
            onChange={(event) => setTagId(event.target.value)}
          >
            <option value="">Choose tag</option>
            {references?.tags
              .filter((tag) => !usedTagIds.includes(tag.id))
              .map((tag) => (
                <option key={tag.id} value={tag.id}>
                  {tag.name}
                </option>
              ))}
          </Select>
        </Field>
        <fieldset>
          <div className="mb-3 flex justify-between">
            <legend className="text-sm font-medium text-slate-300">
              Contributor split
            </legend>
            <span
              className={
                totalBasisPoints === 10_000
                  ? 'text-xs text-teal-300'
                  : 'text-xs text-rose-300'
              }
            >
              {(totalBasisPoints / 100).toFixed(2)}%
            </span>
          </div>
          <div className="grid gap-3">
            {references?.contributors.map((contributor) => {
              const share = shares.find((item) => item.contributorId === contributor.id)
              return (
                <div
                  key={contributor.id}
                  className="grid grid-cols-[1fr_8rem] items-center gap-4 rounded-xl border border-slate-700 p-3"
                >
                  <label className="flex items-center gap-3 text-sm">
                    <input
                      type="checkbox"
                      className="accent-teal-400"
                      checked={Boolean(share)}
                      onChange={(event) =>
                        setShares((current) =>
                          event.target.checked
                            ? [
                                ...current,
                                { contributorId: contributor.id, basisPoints: 0 },
                              ]
                            : current.filter(
                                (item) => item.contributorId !== contributor.id,
                              ),
                        )
                      }
                    />
                    {contributor.name}
                  </label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    step={0.01}
                    disabled={!share}
                    value={share ? share.basisPoints / 100 : ''}
                    onChange={(event) =>
                      setShares((current) =>
                        current.map((item) =>
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
                </div>
              )
            })}
          </div>
        </fieldset>
        <Button
          type="submit"
          disabled={
            totalBasisPoints !== 10_000 ||
            shares.length === 0 ||
            !tagId ||
            !name ||
            !allowance
          }
        >
          Save line
        </Button>
      </form>
    </Dialog>
  )
}
