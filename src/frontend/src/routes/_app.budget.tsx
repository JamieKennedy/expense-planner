import { useForm } from '@tanstack/react-form'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { BarChart3, Pencil, Plus, Trash2, Users } from 'lucide-react'
import { useMemo, useState } from 'react'
import { ContributorSharesEditor } from '~/components/contributor-shares-editor'
import { EmptyState } from '~/components/empty-state'
import { PageHeading } from '~/components/page-heading'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import { Card, CardContent } from '~/components/ui/card'
import { Dialog } from '~/components/ui/dialog'
import { Field, FieldError, FieldLabel } from '~/components/ui/field'
import { Input } from '~/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select'
import {
  apiRequest,
  type BudgetLine,
  type BudgetTemplate,
  type ReferenceData,
} from '~/lib/api'
import {
  removeBudgetLine,
  replaceBudgetTemplate,
  upsertBudgetLine,
} from '~/lib/budget-template'
import { evenContributorShares } from '~/lib/contributor-split'
import { focusFirstInvalidField } from '~/lib/form'
import { formatMoney } from '~/lib/utils'

export const Route = createFileRoute('/_app/budget')({
  component: BudgetPage,
})

function BudgetPage() {
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState<BudgetLine | null | undefined>()
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState<string>()
  const references = useQuery({
    queryKey: ['reference-data'],
    queryFn: () => apiRequest<ReferenceData>('/api/reference-data?includeArchived=false'),
  })
  const budget = useQuery({
    queryKey: ['budget-template'],
    queryFn: () => apiRequest<BudgetTemplate>('/api/budget-template'),
  })
  const lines = useMemo(() => budget.data?.lines ?? [], [budget.data?.lines])

  const save = useMutation({
    mutationFn: replaceBudgetTemplate,
    onMutate: () => {
      setSaveError(undefined)
      setSaved(false)
    },
    onSuccess: async (result) => {
      queryClient.setQueryData<BudgetTemplate>(['budget-template'], result)
      setSaved(true)
      window.setTimeout(() => setSaved(false), 2500)
      await queryClient.invalidateQueries({ queryKey: ['monthly-overview'] })
    },
    onError: (error) => {
      setSaveError(error instanceof Error ? error.message : 'Unable to save the budget.')
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
        description="Set one allowance per tag and decide how each line is shared. Changes save automatically."
        actions={
          <div className="flex flex-wrap items-center justify-end gap-3">
            <p className="text-sm text-slate-400" role="status" aria-live="polite">
              {save.isPending
                ? 'Saving…'
                : saved
                  ? 'Saved'
                  : 'Changes save automatically'}
            </p>
            <Button
              variant="secondary"
              disabled={save.isPending}
              onClick={() => setEditing(null)}
            >
              <Plus size={18} /> Add line
            </Button>
          </div>
        }
      />
      {saveError && (
        <div
          role="alert"
          className="mb-6 rounded-xl border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-sm text-rose-200"
        >
          {saveError}
        </div>
      )}
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
                <Button
                  size="sm"
                  disabled={save.isPending}
                  onClick={() => setEditing(null)}
                >
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
                        disabled={save.isPending}
                        onClick={() => setEditing(line)}
                        aria-label={`Edit ${line.name}`}
                      >
                        <Pencil size={16} />
                      </Button>
                      <Button
                        size="icon"
                        variant="danger"
                        disabled={save.isPending}
                        onClick={() => save.mutate(removeBudgetLine(lines, line.id))}
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
          onSave={async (line) => {
            await save.mutateAsync(upsertBudgetLine(lines, line))
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
  onSave: (line: BudgetLine) => Promise<void>
}) {
  const [saveError, setSaveError] = useState<string>()
  const [isSaving, setIsSaving] = useState(false)
  const defaultContributor =
    references?.contributors.find((contributor) => contributor.isOwner) ??
    references?.contributors[0]
  const form = useForm({
    defaultValues: {
      name: line?.name ?? '',
      allowance: line ? String(line.allowancePence / 100) : '',
      tagId: line?.tagId ?? '',
      shares:
        line?.contributorShares ??
        evenContributorShares(
          references?.contributors ?? [],
          defaultContributor ? [defaultContributor.id] : [],
        ),
    },
    onSubmit: async ({ value }) => {
      setSaveError(undefined)
      setIsSaving(true)
      try {
        await onSave({
          id: line?.id ?? crypto.randomUUID(),
          name: value.name,
          allowancePence: Math.round(Number(value.allowance) * 100),
          tagId: value.tagId,
          contributorShares: value.shares,
        })
      } catch (error) {
        setSaveError(error instanceof Error ? error.message : 'Unable to save this line.')
      } finally {
        setIsSaving(false)
      }
    },
  })

  return (
    <Dialog
      open
      title={line ? 'Edit budget line' : 'Add budget line'}
      description="Each tag can appear once. Contributor percentages must total 100%."
      closeDisabled={isSaving}
      onClose={onClose}
    >
      <form
        noValidate
        className="grid gap-5"
        onSubmit={(event) => {
          event.preventDefault()
          void form.handleSubmit().then(focusFirstInvalidField)
        }}
      >
        <div className="grid gap-5 sm:grid-cols-2">
          <form.Field
            name="name"
            validators={{
              onChange: ({ value }) =>
                value.trim() ? undefined : 'Enter a budget line name.',
            }}
          >
            {(field) => {
              const validationError = firstError(field.state.meta.errors)
              return (
                <Field invalid={Boolean(validationError)}>
                  <FieldLabel htmlFor={field.name}>Line name</FieldLabel>
                  <Input
                    id={field.name}
                    disabled={isSaving}
                    value={field.state.value}
                    aria-invalid={Boolean(validationError) || undefined}
                    onBlur={field.handleBlur}
                    onChange={(event) => field.handleChange(event.target.value)}
                  />
                  <FieldError>{validationError}</FieldError>
                </Field>
              )
            }}
          </form.Field>
          <form.Field
            name="allowance"
            validators={{
              onChange: ({ value }) =>
                Number(value) > 0 ? undefined : 'Enter an allowance greater than £0.00.',
            }}
          >
            {(field) => {
              const validationError = firstError(field.state.meta.errors)
              return (
                <Field invalid={Boolean(validationError)}>
                  <FieldLabel htmlFor={field.name}>Allowance (£)</FieldLabel>
                  <Input
                    id={field.name}
                    type="number"
                    disabled={isSaving}
                    min="0.01"
                    step="0.01"
                    value={field.state.value}
                    aria-invalid={Boolean(validationError) || undefined}
                    onBlur={field.handleBlur}
                    onChange={(event) => field.handleChange(event.target.value)}
                  />
                  <FieldError>{validationError}</FieldError>
                </Field>
              )
            }}
          </form.Field>
        </div>
        <form.Field
          name="tagId"
          validators={{
            onChange: ({ value }) => (value ? undefined : 'Choose a budget tag.'),
          }}
        >
          {(field) => {
            const validationError = firstError(field.state.meta.errors)
            return (
              <Field invalid={Boolean(validationError)}>
                <FieldLabel htmlFor={`${field.name}-trigger`}>Budget tag</FieldLabel>
                <Select
                  value={field.state.value}
                  disabled={isSaving}
                  onValueChange={field.handleChange}
                >
                  <SelectTrigger
                    id={`${field.name}-trigger`}
                    aria-invalid={Boolean(validationError) || undefined}
                    onBlur={field.handleBlur}
                  >
                    <SelectValue placeholder="Choose tag" />
                  </SelectTrigger>
                  <SelectContent>
                    {references?.tags
                      .filter(
                        (tag) => tag.id === line?.tagId || !usedTagIds.includes(tag.id),
                      )
                      .map((tag) => (
                        <SelectItem key={tag.id} value={tag.id}>
                          {tag.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                <FieldError>{validationError}</FieldError>
              </Field>
            )
          }}
        </form.Field>
        <form.Field
          name="shares"
          validators={{
            onChange: ({ value }) =>
              value.length === 0
                ? 'Select at least one contributor.'
                : value.reduce((sum, share) => sum + share.basisPoints, 0) === 10_000
                  ? undefined
                  : 'Contributor percentages must total 100%.',
          }}
        >
          {(field) => (
            <ContributorSharesEditor
              contributors={references?.contributors ?? []}
              shares={field.state.value}
              disabled={isSaving}
              onChange={field.handleChange}
              error={firstError(field.state.meta.errors)}
            />
          )}
        </form.Field>
        {saveError && (
          <div
            role="alert"
            className="rounded-xl border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-sm text-rose-200"
          >
            {saveError}
          </div>
        )}
        <form.Subscribe selector={(state) => state.isSubmitting}>
          {(isSubmitting) => (
            <Button type="submit" disabled={isSubmitting || isSaving}>
              {isSubmitting || isSaving ? 'Saving…' : 'Save line'}
            </Button>
          )}
        </form.Subscribe>
      </form>
    </Dialog>
  )
}

function firstError(errors: unknown[]) {
  return errors.find(
    (error): error is string => typeof error === 'string' && error.length > 0,
  )
}
