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
import { useState } from 'react'
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { z } from 'zod'
import { EmptyState } from '~/components/empty-state'
import { PageHeading } from '~/components/page-heading'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import { Card, CardContent } from '~/components/ui/card'
import { Dialog } from '~/components/ui/dialog'
import { Field, Input, Select } from '~/components/ui/input'
import { apiRequest, type Expense, type PagedResult, type ReferenceData } from '~/lib/api'
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
    queryFn: () =>
      apiRequest<PagedResult<Expense>>(`/api/expenses?${parameters.toString()}`),
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
          <div className="mt-2 flex flex-wrap gap-1">
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
      cell: (info) => (
        <div className="flex items-center gap-2 text-slate-300">
          <CalendarClock size={16} className="text-slate-500" />
          {new Intl.DateTimeFormat('en-GB', {
            day: '2-digit',
            month: 'short',
          }).format(new Date(`${info.getValue()}T12:00:00`))}
        </div>
      ),
    }),
    column.accessor('amountPence', {
      header: () => <Sortable label="Amount" field="amount" />,
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
            onClick={() => setEditing(info.row.original)}
            aria-label={`Edit ${info.row.original.name}`}
          >
            <Pencil size={16} />
          </Button>
          <Button
            size="icon"
            variant="danger"
            onClick={() => {
              if (confirm(`Delete ${info.row.original.name}?`)) {
                remove.mutate(info.row.original.id)
              }
            }}
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
        description="Recurring monthly costs, projected onto the dates they will actually leave your accounts."
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
            <Input
              type="month"
              value={search.month}
              onChange={(event) =>
                void navigate({
                  search: { ...search, month: event.target.value, page: 1 },
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
                  : 'Add your first monthly commitment to start building the overview.'
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
                        <th key={header.id} className="px-3 py-4">
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
                        <td key={cell.id} className="px-3 py-4">
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {expenses.data && expenses.data.total > 0 && (
            <div className="mt-5 flex items-center justify-between border-t border-slate-800 pt-5 text-sm text-slate-400">
              <span>
                Page {expenses.data.page} · {expenses.data.total} expenses
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
                  disabled={search.page * 25 >= expenses.data.total}
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
          onClose={() => setEditing(undefined)}
        />
      )}
    </div>
  )
}

function splitFilter(value: string) {
  return value ? value.split(',').filter(Boolean) : []
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
    <Select value={value} onChange={(event) => onChange(event.target.value)}>
      <option value="">{label}</option>
      {items?.map((item) => (
        <option key={item.id} value={item.id}>
          {item.name}
        </option>
      ))}
    </Select>
  )
}

function ExpenseDialog({
  expense,
  references,
  onClose,
}: {
  expense: Expense | null
  references?: ReferenceData
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const [error, setError] = useState<string>()
  const form = useForm({
    defaultValues: {
      name: expense?.name ?? '',
      amount: expense ? String(expense.amountPence / 100) : '',
      accountId: expense?.accountId ?? '',
      dayOfMonth: expense?.dayOfMonth ?? 1,
      moveToNextWorkingDay: expense?.moveToNextWorkingDay ?? true,
      tagIds: expense?.tagIds ?? ([] as string[]),
      contributorIds:
        expense?.contributorShares.map((share) => share.contributorId) ??
        (references?.contributors[0] ? [references.contributors[0].id] : []),
    },
    onSubmit: async ({ value }) => {
      setError(undefined)
      const selected = value.contributorIds
      const base = Math.floor(10_000 / selected.length)
      const remainder = 10_000 - base * selected.length
      try {
        await apiRequest(expense ? `/api/expenses/${expense.id}` : '/api/expenses', {
          method: expense ? 'PUT' : 'POST',
          body: JSON.stringify({
            name: value.name,
            amountPence: Math.round(Number(value.amount) * 100),
            accountId: value.accountId,
            dayOfMonth: Number(value.dayOfMonth),
            moveToNextWorkingDay: value.moveToNextWorkingDay,
            tagIds: value.tagIds,
            contributorShares: selected.map((contributorId, index) => ({
              contributorId,
              basisPoints: base + (index < remainder ? 1 : 0),
            })),
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
        className="grid gap-5"
        onSubmit={(event) => {
          event.preventDefault()
          void form.handleSubmit()
        }}
      >
        {error && (
          <p className="rounded-xl bg-rose-400/10 p-3 text-sm text-rose-200">{error}</p>
        )}
        <div className="grid gap-5 sm:grid-cols-2">
          <form.Field name="name">
            {(field) => (
              <Field label="Name">
                <Input
                  required
                  value={field.state.value}
                  onChange={(event) => field.handleChange(event.target.value)}
                />
              </Field>
            )}
          </form.Field>
          <form.Field name="amount">
            {(field) => (
              <Field label="Amount (£)">
                <Input
                  required
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={field.state.value}
                  onChange={(event) => field.handleChange(event.target.value)}
                />
              </Field>
            )}
          </form.Field>
          <form.Field name="accountId">
            {(field) => (
              <Field label="Account">
                <Select
                  required
                  value={field.state.value}
                  onChange={(event) => field.handleChange(event.target.value)}
                >
                  <option value="">Choose account</option>
                  {references?.accounts.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </Select>
              </Field>
            )}
          </form.Field>
          <form.Field name="dayOfMonth">
            {(field) => (
              <Field label="Day of month">
                <Input
                  type="number"
                  min={1}
                  max={31}
                  required
                  value={field.state.value}
                  onChange={(event) => field.handleChange(Number(event.target.value))}
                />
              </Field>
            )}
          </form.Field>
        </div>
        <form.Field name="tagIds">
          {(field) => (
            <ChoiceGroup
              label="Tags"
              items={references?.tags ?? []}
              selected={field.state.value}
              onChange={field.handleChange}
            />
          )}
        </form.Field>
        <form.Field name="contributorIds">
          {(field) => (
            <ChoiceGroup
              label="Contributors (split evenly)"
              items={references?.contributors ?? []}
              selected={field.state.value}
              onChange={field.handleChange}
            />
          )}
        </form.Field>
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
                  Weekends and England/Wales bank holidays move forward. The expense
                  remains in its nominal month.
                </span>
              </span>
            </label>
          )}
        </form.Field>
        <form.Subscribe
          selector={(state) => [
            state.isSubmitting,
            state.values.tagIds.length,
            state.values.contributorIds.length,
          ]}
        >
          {([isSubmitting, tagCount, contributorCount]) => (
            <Button
              type="submit"
              disabled={
                Boolean(isSubmitting) ||
                Number(tagCount) === 0 ||
                Number(contributorCount) === 0
              }
            >
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
}: {
  label: string
  items: Array<{ id: string; name: string; colour?: string }>
  selected: string[]
  onChange: (value: string[]) => void
}) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-medium text-slate-300">{label}</legend>
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
    </fieldset>
  )
}
