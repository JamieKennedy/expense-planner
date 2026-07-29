import { useForm } from '@tanstack/react-form'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import {
  ArrowDown,
  ArrowUp,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Plus,
  Search,
  Trash2,
  WalletCards,
} from 'lucide-react'
import { useState, type ReactNode } from 'react'
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { z } from 'zod'
import { ContributorSharesEditor } from '~/components/contributor-shares-editor'
import { DatePicker } from '~/components/date-picker'
import { EmptyState } from '~/components/empty-state'
import { MonthPicker } from '~/components/month-picker'
import { PageHeading } from '~/components/page-heading'
import { ReferenceCreateButton } from '~/components/reference-create-button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogActions,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from '~/components/ui/alert-dialog'
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
import { apiRequest, type Expense, type ExpensePage, type ReferenceData } from '~/lib/api'
import { evenContributorShares } from '~/lib/contributor-split'
import {
  defaultScheduleDate,
  expenseOccurrenceKey,
  frequencyLabel,
  scheduleRequestFields,
  weekdayName,
} from '~/lib/expense-schedule'
import { focusFirstInvalidField } from '~/lib/form'
import { currentMonth, formatMoney } from '~/lib/utils'

const searchSchema = z.object({
  month: z
    .string()
    .regex(/^\d{4}-\d{2}$/)
    .optional(),
  q: z.string().optional(),
  account: z.string().optional(),
  contributor: z.string().optional(),
  tag: z.string().optional(),
  sort: z.enum(['dueDate', 'name', 'amount']).optional(),
  desc: z.boolean().optional(),
  page: z.number().int().positive().optional(),
})

export const Route = createFileRoute('/_app/expenses')({
  validateSearch: searchSchema,
  component: ExpensesPage,
})

const column = createColumnHelper<Expense>()

function ExpensesPage() {
  const rawSearch = Route.useSearch()
  const search = {
    month: rawSearch.month ?? currentMonth(),
    q: rawSearch.q ?? '',
    account: rawSearch.account ?? '',
    contributor: rawSearch.contributor ?? '',
    tag: rawSearch.tag ?? '',
    sort: rawSearch.sort ?? ('dueDate' as const),
    desc: rawSearch.desc ?? false,
    page: rawSearch.page ?? 1,
  }
  const navigate = Route.useNavigate()
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState<Expense | null | undefined>()
  const [deleting, setDeleting] = useState<Expense>()
  const references = useQuery({
    queryKey: ['reference-data'],
    queryFn: () => apiRequest<ReferenceData>('/api/reference-data?includeArchived=false'),
  })

  const parameters = new URLSearchParams({
    month: search.month,
    search: search.q,
    sort: search.sort,
    descending: String(search.desc),
    page: String(search.page),
    pageSize: '25',
  })
  for (const id of splitFilter(search.account)) parameters.append('accountIds', id)
  for (const id of splitFilter(search.contributor)) {
    parameters.append('contributorIds', id)
  }
  for (const id of splitFilter(search.tag)) parameters.append('tagIds', id)

  const expenses = useQuery({
    queryKey: ['expenses', search],
    queryFn: () => apiRequest<ExpensePage>(`/api/expenses?${parameters.toString()}`),
  })

  const remove = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/expenses/${id}`, { method: 'DELETE' }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['expenses'] })
      await queryClient.invalidateQueries({ queryKey: ['monthly-overview'] })
    },
  })

  const columns = [
    column.accessor('name', {
      header: () => <Sortable label="Expense" field="name" />,
      cell: (info) => (
        <div>
          <p className="font-medium text-slate-100">{info.getValue()}</p>
          <div className="mt-1.5 flex flex-wrap gap-1">
            <Badge>{frequencyLabel(info.row.original.frequency)}</Badge>
            {info.row.original.tagIds.map((id) => {
              const tag = references.data?.tags.find((item) => item.id === id)
              return tag ? (
                <Badge key={id}>
                  <span
                    className="mr-1.5 size-1.5 rounded-full"
                    style={{ background: tag.colour }}
                  />
                  {tag.name}
                </Badge>
              ) : null
            })}
          </div>
        </div>
      ),
    }),
    column.accessor('accountName', {
      header: 'Account',
      cell: (info) => <span className="text-slate-300">{info.getValue()}</span>,
    }),
    column.accessor('dueDate', {
      header: () => <Sortable label="Due" field="dueDate" />,
      cell: (info) => {
        const dueDate = formatShortDate(info.getValue())
        const nominalDate = info.row.original.nominalDate
        return (
          <div className="flex items-start gap-2 text-slate-300">
            <CalendarClock size={16} className="mt-0.5 text-slate-500" />
            <div>
              <p>{dueDate}</p>
              {nominalDate !== info.getValue() && (
                <p className="mt-0.5 text-xs text-slate-500">
                  Nominally {formatShortDate(nominalDate)}
                </p>
              )}
            </div>
          </div>
        )
      },
    }),
    column.accessor('attributedAmountPence', {
      header: () => (
        <Sortable label={search.contributor ? 'Share' : 'Amount'} field="amount" />
      ),
      cell: (info) => (
        <span className="font-semibold">{formatMoney(info.getValue())}</span>
      ),
    }),
    column.display({
      id: 'actions',
      cell: (info) => (
        <div className="flex justify-end gap-1">
          <Button
            size="icon"
            variant="ghost"
            className="size-8"
            onClick={() => setEditing(info.row.original)}
            aria-label={`Edit ${info.row.original.name}`}
          >
            <Pencil size={16} />
          </Button>
          <Button
            size="icon"
            variant="danger"
            className="size-8"
            onClick={() => setDeleting(info.row.original)}
            aria-label={`Delete ${info.row.original.name}`}
          >
            <Trash2 size={16} />
          </Button>
        </div>
      ),
    }),
  ]

  const table = useReactTable({
    data: expenses.data?.items ?? [],
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualSorting: true,
    manualPagination: true,
    getRowId: expenseOccurrenceKey,
  })

  function Sortable({
    label,
    field,
  }: {
    label: string
    field: 'name' | 'amount' | 'dueDate'
  }) {
    return (
      <button
        className="flex items-center gap-1.5 font-medium hover:text-white"
        onClick={() =>
          void navigate({
            search: {
              ...search,
              sort: field,
              desc: search.sort === field ? !search.desc : false,
              page: 1,
            },
          })
        }
      >
        {label}
        {search.sort === field &&
          (search.desc ? <ArrowDown size={14} /> : <ArrowUp size={14} />)}
      </button>
    )
  }

  return (
    <div className="animate-rise">
      <PageHeading
        eyebrow="Monthly commitments"
        title="Expenses"
        description="One-off and recurring costs projected onto the dates they leave your accounts."
        actions={
          <Button onClick={() => setEditing(null)}>
            <Plus size={18} /> Add expense
          </Button>
        }
      />
      <Card>
        <CardContent>
          <div className="grid gap-3 border-b border-slate-800 pb-5 lg:grid-cols-[1.6fr_repeat(4,1fr)]">
            <label className="relative">
              <Search
                size={17}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
              />
              <Input
                value={search.q}
                className="pl-10"
                placeholder="Search expenses"
                onChange={(event) =>
                  void navigate({
                    search: { ...search, q: event.target.value, page: 1 },
                    replace: true,
                  })
                }
              />
            </label>
            <MonthPicker
              value={search.month}
              onValueChange={(month) =>
                void navigate({
                  search: { ...search, month, page: 1 },
                })
              }
            />
            <FilterSelect
              label="All accounts"
              value={search.account}
              items={references.data?.accounts}
              onChange={(account) =>
                void navigate({ search: { ...search, account, page: 1 } })
              }
            />
            <FilterSelect
              label="All contributors"
              value={search.contributor}
              items={references.data?.contributors}
              onChange={(contributor) =>
                void navigate({ search: { ...search, contributor, page: 1 } })
              }
            />
            <FilterSelect
              label="All tags"
              value={search.tag}
              items={references.data?.tags}
              onChange={(tag) => void navigate({ search: { ...search, tag, page: 1 } })}
            />
          </div>
          {expenses.isLoading ? (
            <div className="h-72 animate-pulse rounded-xl bg-slate-900" />
          ) : expenses.data?.items.length === 0 ? (
            <EmptyState
              icon={WalletCards}
              title="No expenses found"
              description={
                search.q || search.account || search.contributor || search.tag
                  ? 'Try clearing one or more filters.'
                  : 'Add an expense scheduled for this month to start building the overview.'
              }
              action={
                <Button size="sm" onClick={() => setEditing(null)}>
                  <Plus size={16} /> Add expense
                </Button>
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] border-collapse text-left text-sm">
                <thead className="text-xs uppercase tracking-wider text-slate-500">
                  {table.getHeaderGroups().map((headerGroup) => (
                    <tr key={headerGroup.id}>
                      {headerGroup.headers.map((header) => (
                        <th key={header.id} className="px-3 py-3">
                          {header.isPlaceholder
                            ? null
                            : flexRender(
                                header.column.columnDef.header,
                                header.getContext(),
                              )}
                        </th>
                      ))}
                    </tr>
                  ))}
                </thead>
                <tbody>
                  {table.getRowModel().rows.map((row) => (
                    <tr
                      key={row.id}
                      className="border-t border-slate-800/80 transition hover:bg-slate-800/30"
                    >
                      {row.getVisibleCells().map((cell) => (
                        <td key={cell.id} className="px-3 py-3">
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t border-slate-700 bg-slate-950/30">
                  <tr>
                    <td colSpan={3} className="px-3 py-3 font-medium text-slate-300">
                      {search.contributor
                        ? 'Filtered contributor total'
                        : 'Filtered total'}
                      <span className="ml-2 text-xs font-normal text-slate-500">
                        {expenses.data?.totalCount ?? 0} occurrences
                      </span>
                    </td>
                    <td className="px-3 py-3 font-semibold text-slate-100">
                      {formatMoney(expenses.data?.totalAmountPence ?? 0)}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
          {expenses.data && expenses.data.totalCount > 0 && (
            <div className="mt-5 flex items-center justify-between border-t border-slate-800 pt-5 text-sm text-slate-400">
              <span>
                Page {expenses.data.page} · {expenses.data.totalCount} occurrences
              </span>
              <div className="flex gap-2">
                <Button
                  size="icon"
                  variant="secondary"
                  disabled={search.page <= 1}
                  onClick={() =>
                    void navigate({ search: { ...search, page: search.page - 1 } })
                  }
                >
                  <ChevronLeft size={17} />
                </Button>
                <Button
                  size="icon"
                  variant="secondary"
                  disabled={search.page * 25 >= expenses.data.totalCount}
                  onClick={() =>
                    void navigate({ search: { ...search, page: search.page + 1 } })
                  }
                >
                  <ChevronRight size={17} />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      {editing !== undefined && (
        <ExpenseDialog
          key={editing?.id ?? 'new'}
          expense={editing}
          references={references.data}
          selectedMonth={search.month}
          onClose={() => setEditing(undefined)}
        />
      )}
      <AlertDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => {
          if (!open) setDeleting(undefined)
        }}
      >
        <AlertDialogContent>
          <AlertDialogTitle>Delete {deleting?.name}?</AlertDialogTitle>
          <AlertDialogDescription>
            {deleting?.frequency
              ? 'This removes the recurring definition and all of its recalculated occurrences, including earlier months.'
              : 'This removes this one-off expense from its month.'}
          </AlertDialogDescription>
          {remove.isError && (
            <p className="mt-4 rounded-xl bg-rose-400/10 p-3 text-sm text-rose-200">
              {remove.error.message}
            </p>
          )}
          <AlertDialogActions>
            <AlertDialogCancel disabled={remove.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={remove.isPending}
              onClick={(event) => {
                event.preventDefault()
                if (deleting) {
                  void remove
                    .mutateAsync(deleting.id)
                    .then(() => setDeleting(undefined))
                    .catch(() => undefined)
                }
              }}
            >
              {remove.isPending ? 'Deleting…' : 'Delete expense'}
            </AlertDialogAction>
          </AlertDialogActions>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function splitFilter(value: string) {
  return value ? value.split(',').filter(Boolean) : []
}

function formatShortDate(value: string) {
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
  }).format(new Date(`${value}T12:00:00`))
}

function FilterSelect({
  label,
  value,
  items,
  onChange,
}: {
  label: string
  value: string
  items?: Array<{ id: string; name: string }>
  onChange: (value: string) => void
}) {
  return (
    <Select
      value={value || 'all'}
      onValueChange={(selected) => onChange(selected === 'all' ? '' : selected)}
    >
      <SelectTrigger aria-label={label}>
        <SelectValue placeholder={label} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">{label}</SelectItem>
        {items?.map((item) => (
          <SelectItem key={item.id} value={item.id}>
            {item.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

function ExpenseDialog({
  expense,
  references,
  selectedMonth,
  onClose,
}: {
  expense: Expense | null
  references?: ReferenceData
  selectedMonth: string
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const [error, setError] = useState<string>()
  const defaultContributor =
    references?.contributors.find((contributor) => contributor.isOwner) ??
    references?.contributors[0]
  const form = useForm({
    defaultValues: {
      name: expense?.name ?? '',
      amount: expense ? String(expense.amountPence / 100) : '',
      accountId: expense?.accountId ?? '',
      isRecurring: expense ? expense.frequency !== null : true,
      frequency: expense?.frequency ?? ('monthly' as const),
      scheduleDate: expense?.scheduleAnchorDate ?? defaultScheduleDate(selectedMonth),
      startMonth:
        expense?.frequency === 'monthly' && expense.scheduleAnchorDate
          ? expense.scheduleAnchorDate.slice(0, 7)
          : expense?.frequency === 'monthly'
            ? ''
            : selectedMonth,
      dayOfMonth: expense?.dayOfMonth ?? 1,
      moveToNextWorkingDay: expense?.moveToNextWorkingDay ?? true,
      tagIds: expense?.tagIds ?? ([] as string[]),
      contributorShares:
        expense?.contributorShares.map(({ contributorId, basisPoints }) => ({
          contributorId,
          basisPoints,
        })) ??
        evenContributorShares(
          references?.contributors ?? [],
          defaultContributor ? [defaultContributor.id] : [],
        ),
    },
    onSubmit: async ({ value }) => {
      setError(undefined)
      try {
        const schedule = scheduleRequestFields(value)
        await apiRequest(expense ? `/api/expenses/${expense.id}` : '/api/expenses', {
          method: expense ? 'PUT' : 'POST',
          body: JSON.stringify({
            name: value.name,
            amountPence: Math.round(Number(value.amount) * 100),
            accountId: value.accountId,
            ...schedule,
            tagIds: value.tagIds,
            contributorShares: value.contributorShares,
          }),
        })
        await queryClient.invalidateQueries({ queryKey: ['expenses'] })
        await queryClient.invalidateQueries({ queryKey: ['monthly-overview'] })
        onClose()
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'Unable to save the expense.')
      }
    },
  })

  return (
    <Dialog
      open
      title={expense ? 'Edit expense' : 'Add expense'}
      description="Amounts are stored as exact pence and contributor shares always total 100%."
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
        {error && (
          <p className="rounded-xl bg-rose-400/10 p-3 text-sm text-rose-200">{error}</p>
        )}
        <div className="grid gap-5 sm:grid-cols-2">
          <form.Field
            name="name"
            validators={{
              onChange: ({ value }) =>
                value.trim() ? undefined : 'Enter an expense name.',
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
                value ? undefined : 'Choose the account this expense leaves.',
            }}
          >
            {(field) => {
              const validationError = firstError(field.state.meta.errors)
              return (
                <Field invalid={Boolean(validationError)}>
                  <div className="flex items-center justify-between gap-2">
                    <FieldLabel htmlFor={`${field.name}-trigger`}>Account</FieldLabel>
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
                      {references?.accounts.map((item) => (
                        <SelectItem key={item.id} value={item.id}>
                          {item.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FieldError>{validationError}</FieldError>
                </Field>
              )
            }}
          </form.Field>
        </div>
        <form.Subscribe
          selector={(state) =>
            [state.values.isRecurring, state.values.frequency] as const
          }
        >
          {([isRecurring, frequency]) => (
            <div className="grid gap-5">
              <form.Field name="isRecurring">
                {(field) => (
                  <label className="flex items-start gap-3 rounded-xl border border-slate-700 p-4">
                    <input
                      type="checkbox"
                      className="mt-1 accent-teal-400"
                      checked={field.state.value}
                      onChange={(event) => field.handleChange(event.target.checked)}
                    />
                    <span>
                      <span className="block text-sm font-medium">Recurring expense</span>
                      <span className="mt-1 block text-xs leading-5 text-slate-500">
                        Turn this off for an expense that occurs on one exact date.
                      </span>
                    </span>
                  </label>
                )}
              </form.Field>
              {isRecurring && (
                <form.Field name="frequency">
                  {(field) => (
                    <Field>
                      <FieldLabel htmlFor={`${field.name}-trigger`}>Frequency</FieldLabel>
                      <Select
                        value={field.state.value}
                        onValueChange={(value) =>
                          field.handleChange(value as 'monthly' | 'weekly')
                        }
                      >
                        <SelectTrigger id={`${field.name}-trigger`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="monthly">Monthly</SelectItem>
                          <SelectItem value="weekly">Weekly</SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>
                  )}
                </form.Field>
              )}
              {!isRecurring || frequency === 'weekly' ? (
                <form.Field
                  name="scheduleDate"
                  validators={{
                    onChange: ({ value }) =>
                      /^\d{4}-\d{2}-\d{2}$/.test(value) ? undefined : 'Choose a date.',
                  }}
                >
                  {(field) => {
                    const validationError = firstError(field.state.meta.errors)
                    return (
                      <Field invalid={Boolean(validationError)}>
                        <FieldLabel>
                          {isRecurring ? 'First charge' : 'Payment date'}
                        </FieldLabel>
                        <DatePicker
                          value={field.state.value}
                          label={isRecurring ? 'First charge' : 'Payment date'}
                          invalid={Boolean(validationError)}
                          onValueChange={field.handleChange}
                        />
                        {isRecurring && (
                          <p className="text-xs text-slate-500">
                            Repeats every {weekdayName(field.state.value)} from this date.
                          </p>
                        )}
                        <FieldError>{validationError}</FieldError>
                      </Field>
                    )
                  }}
                </form.Field>
              ) : (
                <div className="grid gap-5 sm:grid-cols-2">
                  <form.Field name="startMonth">
                    {(field) => (
                      <Field>
                        <FieldLabel>Starting month</FieldLabel>
                        {field.state.value ? (
                          <MonthPicker
                            value={field.state.value}
                            label="Starting month"
                            onValueChange={field.handleChange}
                          />
                        ) : (
                          <>
                            <Button
                              type="button"
                              variant="secondary"
                              onClick={() => field.handleChange(selectedMonth)}
                            >
                              Set a starting month
                            </Button>
                            <p className="text-xs leading-5 text-slate-500">
                              This existing expense currently applies to all historical
                              months.
                            </p>
                          </>
                        )}
                      </Field>
                    )}
                  </form.Field>
                  <form.Field
                    name="dayOfMonth"
                    validators={{
                      onChange: ({ value }) =>
                        value >= 1 && value <= 31
                          ? undefined
                          : 'Choose a day from 1 to 31.',
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
                            onChange={(event) =>
                              field.handleChange(Number(event.target.value))
                            }
                          />
                          <FieldError>{validationError}</FieldError>
                        </Field>
                      )
                    }}
                  </form.Field>
                </div>
              )}
              {isRecurring && (
                <form.Field name="moveToNextWorkingDay">
                  {(field) => (
                    <label className="flex items-start gap-3 rounded-xl border border-slate-700 p-4">
                      <input
                        type="checkbox"
                        className="mt-1 accent-teal-400"
                        checked={field.state.value}
                        onChange={(event) => field.handleChange(event.target.checked)}
                      />
                      <span>
                        <span className="block text-sm font-medium">
                          Move to next working day
                        </span>
                        <span className="mt-1 block text-xs leading-5 text-slate-500">
                          Weekends and England/Wales bank holidays move forward. The
                          expense remains in its nominal month.
                        </span>
                      </span>
                    </label>
                  )}
                </form.Field>
              )}
            </div>
          )}
        </form.Subscribe>
        <form.Field
          name="tagIds"
          validators={{
            onChange: ({ value }) =>
              value.length > 0 ? undefined : 'Select at least one tag.',
          }}
        >
          {(field) => {
            const validationError = firstError(field.state.meta.errors)
            return (
              <ChoiceGroup
                label="Tags"
                items={references?.tags ?? []}
                selected={field.state.value}
                onChange={field.handleChange}
                error={validationError}
                action={
                  <ReferenceCreateButton
                    kind="tags"
                    onCreated={(created) =>
                      field.handleChange([...field.state.value, created.id])
                    }
                  />
                }
              />
            )
          }}
        </form.Field>
        <form.Field
          name="contributorShares"
          validators={{
            onChange: ({ value }) =>
              value.length === 0
                ? 'Select at least one contributor.'
                : value.reduce((sum, share) => sum + share.basisPoints, 0) === 10_000
                  ? undefined
                  : 'Contributor percentages must total 100%.',
          }}
        >
          {(field) => {
            const validationError = firstError(field.state.meta.errors)
            return (
              <ContributorSharesEditor
                contributors={references?.contributors ?? []}
                shares={field.state.value}
                onChange={field.handleChange}
                error={validationError}
                action={
                  <ReferenceCreateButton
                    kind="contributors"
                    onCreated={(created) =>
                      field.handleChange(
                        evenContributorShares(
                          [...(references?.contributors ?? []), created],
                          [
                            ...field.state.value.map((share) => share.contributorId),
                            created.id,
                          ],
                        ),
                      )
                    }
                  />
                }
              />
            )
          }}
        </form.Field>
        <form.Subscribe selector={(state) => state.isSubmitting}>
          {(isSubmitting) => (
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Saving…' : 'Save expense'}
            </Button>
          )}
        </form.Subscribe>
      </form>
    </Dialog>
  )
}

function ChoiceGroup({
  label,
  items,
  selected,
  onChange,
  error,
  action,
}: {
  label: string
  items: Array<{ id: string; name: string; colour?: string }>
  selected: string[]
  onChange: (value: string[]) => void
  error?: string
  action?: ReactNode
}) {
  return (
    <fieldset aria-invalid={Boolean(error) || undefined}>
      <div className="mb-2 flex items-center gap-2">
        <legend className="text-sm font-medium text-slate-300">{label}</legend>
        {action}
      </div>
      <div className="flex flex-wrap gap-2">
        {items.map((item) => {
          const checked = selected.includes(item.id)
          return (
            <label
              key={item.id}
              className={
                checked
                  ? 'cursor-pointer rounded-xl border border-teal-400/50 bg-teal-400/10 px-3 py-2 text-sm text-teal-200'
                  : 'cursor-pointer rounded-xl border border-slate-700 px-3 py-2 text-sm text-slate-400 hover:border-slate-600'
              }
            >
              <input
                type="checkbox"
                className="sr-only"
                checked={checked}
                onChange={() =>
                  onChange(
                    checked
                      ? selected.filter((id) => id !== item.id)
                      : [...selected, item.id],
                  )
                }
              />
              {item.name}
            </label>
          )
        })}
      </div>
      <FieldError className="mt-2">{error}</FieldError>
    </fieldset>
  )
}

function firstError(errors: unknown[]) {
  return errors.find(
    (error): error is string => typeof error === 'string' && error.length > 0,
  )
}
