import { useForm } from '@tanstack/react-form'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { CalendarClock, Landmark, Pencil, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { z } from 'zod'
import { EmptyState } from '~/components/empty-state'
import { MonthPicker } from '~/components/month-picker'
import { PageHeading } from '~/components/page-heading'
import { ReferenceCreateButton } from '~/components/reference-create-button'
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
import { apiRequest, type IncomeItem, type ReferenceData } from '~/lib/api'
import { focusFirstInvalidField } from '~/lib/form'
import { currentMonth, displayMonth, formatMoney } from '~/lib/utils'

const searchSchema = z.object({
  month: z
    .string()
    .regex(/^\d{4}-\d{2}$/)
    .optional(),
})

export const Route = createFileRoute('/_app/income')({
  validateSearch: searchSchema,
  component: IncomePage,
})

function IncomePage() {
  const rawSearch = Route.useSearch()
  const month = rawSearch.month ?? currentMonth()
  const navigate = Route.useNavigate()
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState<IncomeItem | null | undefined>()
  const references = useQuery({
    queryKey: ['reference-data'],
    queryFn: () => apiRequest<ReferenceData>('/api/reference-data?includeArchived=false'),
  })
  const income = useQuery({
    queryKey: ['income-items', month],
    queryFn: () =>
      apiRequest<IncomeItem[]>(`/api/income-items?month=${encodeURIComponent(month)}`),
  })
  const remove = useMutation({
    mutationFn: (id: string) =>
      apiRequest(`/api/income-items/${id}`, { method: 'DELETE' }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['income-items'] })
      await queryClient.invalidateQueries({ queryKey: ['monthly-overview'] })
    },
  })
  const total = income.data?.reduce((sum, item) => sum + item.amountPence, 0) ?? 0

  return (
    <div className="animate-rise">
      <PageHeading
        eyebrow="Money in"
        title="Income"
        description="Recurring monthly income and the account each payment reaches."
        actions={
          <Button onClick={() => setEditing(null)}>
            <Plus size={18} /> Add income
          </Button>
        }
      />
      <div className="mb-5 flex flex-col justify-between gap-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-5 sm:flex-row sm:items-center">
        <div>
          <p className="text-sm text-slate-400">{displayMonth(month)} projected income</p>
          <p className="mt-1 text-2xl font-semibold">{formatMoney(total)}</p>
        </div>
        <MonthPicker
          value={month}
          className="sm:w-48"
          onValueChange={(selectedMonth) =>
            void navigate({ search: { ...rawSearch, month: selectedMonth } })
          }
        />
      </div>
      <Card>
        <CardContent>
          {income.isLoading ? (
            <div className="h-60 animate-pulse rounded-xl bg-slate-900" />
          ) : income.data?.length === 0 ? (
            <EmptyState
              icon={Landmark}
              title="No income items yet"
              description="Add salary, regular transfers, or any other monthly income."
              action={
                <Button size="sm" onClick={() => setEditing(null)}>
                  <Plus size={16} /> Add income
                </Button>
              }
            />
          ) : (
            <div className="divide-y divide-slate-800">
              {income.data?.map((item) => (
                <div
                  key={item.id}
                  className="flex flex-col justify-between gap-4 py-5 first:pt-0 last:pb-0 sm:flex-row sm:items-center"
                >
                  <div className="flex items-center gap-4">
                    <span className="grid size-11 place-items-center rounded-xl bg-teal-400/10 text-teal-300">
                      <Landmark size={20} />
                    </span>
                    <div>
                      <p className="font-medium">{item.name}</p>
                      <p className="mt-1 flex items-center gap-2 text-sm text-slate-500">
                        <CalendarClock size={14} />
                        {new Intl.DateTimeFormat('en-GB', {
                          day: 'numeric',
                          month: 'long',
                        }).format(new Date(`${item.dueDate}T12:00:00`))}
                        <span>·</span>
                        {item.accountName}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-4 sm:justify-end">
                    <span className="text-lg font-semibold">
                      {formatMoney(item.amountPence)}
                    </span>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => setEditing(item)}
                      aria-label={`Edit ${item.name}`}
                    >
                      <Pencil size={16} />
                    </Button>
                    <Button
                      size="icon"
                      variant="danger"
                      onClick={() => {
                        if (confirm(`Delete ${item.name}?`)) remove.mutate(item.id)
                      }}
                      aria-label={`Delete ${item.name}`}
                    >
                      <Trash2 size={16} />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      {editing !== undefined && (
        <IncomeDialog
          key={editing?.id ?? 'new'}
          item={editing}
          references={references.data}
          onClose={() => setEditing(undefined)}
        />
      )}
    </div>
  )
}

function IncomeDialog({
  item,
  references,
  onClose,
}: {
  item: IncomeItem | null
  references?: ReferenceData
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const [error, setError] = useState<string>()
  const form = useForm({
    defaultValues: {
      name: item?.name ?? '',
      amount: item ? String(item.amountPence / 100) : '',
      accountId: item?.accountId ?? '',
      dayOfMonth: item?.dayOfMonth ?? 1,
      moveToNextWorkingDay: item?.moveToNextWorkingDay ?? true,
    },
    onSubmit: async ({ value }) => {
      try {
        await apiRequest(item ? `/api/income-items/${item.id}` : '/api/income-items', {
          method: item ? 'PUT' : 'POST',
          body: JSON.stringify({
            ...value,
            amountPence: Math.round(Number(value.amount) * 100),
            dayOfMonth: Number(value.dayOfMonth),
          }),
        })
        await queryClient.invalidateQueries({ queryKey: ['income-items'] })
        await queryClient.invalidateQueries({ queryKey: ['monthly-overview'] })
        onClose()
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'Unable to save income.')
      }
    },
  })
  return (
    <Dialog
      open
      title={item ? 'Edit income' : 'Add income'}
      description="Choose the nominal day and whether non-working days move forward."
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
        {error && <p className="rounded-xl bg-rose-400/10 p-3 text-rose-200">{error}</p>}
        <div className="grid gap-5 sm:grid-cols-2">
          <form.Field
            name="name"
            validators={{
              onChange: ({ value }) =>
                value.trim() ? undefined : 'Enter an income name.',
            }}
          >
            {(field) => {
              const validationError = firstError(field.state.meta.errors)
              return (
                <Field invalid={Boolean(validationError)}>
                  <FieldLabel htmlFor={field.name}>Name</FieldLabel>
                  <Input
                    id={field.name}
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
            name="amount"
            validators={{
              onChange: ({ value }) =>
                Number(value) > 0 ? undefined : 'Enter an amount greater than £0.00.',
            }}
          >
            {(field) => {
              const validationError = firstError(field.state.meta.errors)
              return (
                <Field invalid={Boolean(validationError)}>
                  <FieldLabel htmlFor={field.name}>Amount (£)</FieldLabel>
                  <Input
                    id={field.name}
                    type="number"
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
          <form.Field
            name="accountId"
            validators={{
              onChange: ({ value }) =>
                value ? undefined : 'Choose the destination account.',
            }}
          >
            {(field) => {
              const validationError = firstError(field.state.meta.errors)
              return (
                <Field invalid={Boolean(validationError)}>
                  <div className="flex items-center justify-between gap-2">
                    <FieldLabel htmlFor={`${field.name}-trigger`}>
                      Destination account
                    </FieldLabel>
                    <ReferenceCreateButton
                      kind="accounts"
                      onCreated={(created) => field.handleChange(created.id)}
                    />
                  </div>
                  <Select value={field.state.value} onValueChange={field.handleChange}>
                    <SelectTrigger
                      id={`${field.name}-trigger`}
                      aria-invalid={Boolean(validationError) || undefined}
                      onBlur={field.handleBlur}
                    >
                      <SelectValue placeholder="Choose account" />
                    </SelectTrigger>
                    <SelectContent>
                      {references?.accounts.map((account) => (
                        <SelectItem key={account.id} value={account.id}>
                          {account.name}
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
            name="dayOfMonth"
            validators={{
              onChange: ({ value }) =>
                value >= 1 && value <= 31 ? undefined : 'Choose a day from 1 to 31.',
            }}
          >
            {(field) => {
              const validationError = firstError(field.state.meta.errors)
              return (
                <Field invalid={Boolean(validationError)}>
                  <FieldLabel htmlFor={field.name}>Day of month</FieldLabel>
                  <Input
                    id={field.name}
                    type="number"
                    min={1}
                    max={31}
                    value={field.state.value}
                    aria-invalid={Boolean(validationError) || undefined}
                    onBlur={field.handleBlur}
                    onChange={(event) => field.handleChange(Number(event.target.value))}
                  />
                  <FieldError>{validationError}</FieldError>
                </Field>
              )
            }}
          </form.Field>
        </div>
        <form.Field name="moveToNextWorkingDay">
          {(field) => (
            <label className="flex items-center gap-3 rounded-xl border border-slate-700 p-4 text-sm text-slate-300">
              <input
                type="checkbox"
                checked={field.state.value}
                className="accent-teal-400"
                onChange={(event) => field.handleChange(event.target.checked)}
              />
              Move to the next England/Wales working day
            </label>
          )}
        </form.Field>
        <form.Subscribe selector={(state) => state.isSubmitting}>
          {(submitting) => (
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Saving…' : 'Save income'}
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
