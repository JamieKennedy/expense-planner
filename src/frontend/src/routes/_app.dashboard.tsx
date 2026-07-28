import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import {
  ArrowDownRight,
  ArrowUpRight,
  CalendarDays,
  CircleDollarSign,
  PieChart,
  Users,
} from 'lucide-react'
import { z } from 'zod'
import { EmptyState } from '~/components/empty-state'
import { PageHeading } from '~/components/page-heading'
import { Card, CardContent, CardHeader } from '~/components/ui/card'
import { Input } from '~/components/ui/input'
import { apiRequest, type MonthlyOverview } from '~/lib/api'
import { currentMonth, displayMonth, formatMoney } from '~/lib/utils'

const searchSchema = z.object({
  month: z
    .string()
    .regex(/^\d{4}-\d{2}$/)
    .optional(),
})

export const Route = createFileRoute('/_app/dashboard')({
  validateSearch: searchSchema,
  component: Dashboard,
})

function Dashboard() {
  const navigate = Route.useNavigate()
  const rawSearch = Route.useSearch()
  const month = rawSearch.month ?? currentMonth()
  const overview = useQuery({
    queryKey: ['monthly-overview', month],
    queryFn: () =>
      apiRequest<MonthlyOverview>(
        `/api/reports/monthly-overview?month=${encodeURIComponent(month)}`,
      ),
  })

  const data = overview.data
  return (
    <div className="animate-rise">
      <PageHeading
        eyebrow="Monthly overview"
        title={displayMonth(month)}
        description="Your current commitments projected onto this month, including working-day adjustments."
        actions={
          <label className="flex items-center gap-3 rounded-xl border border-slate-700 bg-slate-900 px-3">
            <CalendarDays size={18} className="text-slate-400" />
            <Input
              type="month"
              value={month}
              className="border-0 bg-transparent px-0 focus:ring-0"
              onChange={(event) =>
                void navigate({
                  search: { ...rawSearch, month: event.target.value },
                  replace: true,
                })
              }
            />
          </label>
        }
      />
      {overview.isLoading && <DashboardSkeleton />}
      {overview.isError && (
        <div className="rounded-2xl border border-rose-400/30 bg-rose-400/10 p-5 text-rose-200">
          {overview.error.message}
        </div>
      )}
      {data && (
        <>
          <section className="grid gap-4 md:grid-cols-3">
            <MetricCard
              label="Income in"
              amount={data.projectedIncomePence}
              icon={ArrowDownRight}
              tone="teal"
            />
            <MetricCard
              label="Expenses out"
              amount={data.projectedExpensesPence}
              icon={ArrowUpRight}
              tone="blue"
            />
            <MetricCard
              label="Projected net"
              amount={data.projectedNetPence}
              icon={CircleDollarSign}
              tone={data.projectedNetPence >= 0 ? 'teal' : 'rose'}
            />
          </section>
          <section className="mt-6 grid gap-6 xl:grid-cols-2">
            <BreakdownCard
              title="Cost by contributor"
              description="Your share and everyone else’s share of recurring expenses."
              icon={Users}
              items={data.contributorCosts}
              total={data.projectedExpensesPence}
            />
            <BreakdownCard
              title="Cost by tag"
              description="An expense contributes its full cost to every tag it carries."
              icon={PieChart}
              items={data.tagCosts}
              total={Math.max(...data.tagCosts.map((item) => item.amountPence), 0)}
              warning
            />
          </section>
          <section className="mt-6 grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
            <Card>
              <CardHeader>
                <p className="text-sm font-semibold text-slate-100">Budget position</p>
                <p className="mt-1 text-sm text-slate-500">
                  Allowance compared with expenses matching each budget tag.
                </p>
              </CardHeader>
              <CardContent>
                {data.budgetLines.length === 0 ? (
                  <EmptyState
                    icon={PieChart}
                    title="No budget lines yet"
                    description="Create your budget template to see which categories are on track."
                  />
                ) : (
                  <div className="grid gap-5">
                    {data.budgetLines.map((line) => {
                      const used =
                        line.allowancePence > 0
                          ? Math.min(
                              (line.projectedExpensesPence / line.allowancePence) * 100,
                              100,
                            )
                          : 100
                      return (
                        <div key={line.id}>
                          <div className="flex items-end justify-between gap-4">
                            <div>
                              <p className="font-medium">{line.name}</p>
                              <p className="text-xs text-slate-500">{line.tagName}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-semibold">
                                {formatMoney(line.projectedExpensesPence)}
                                <span className="font-normal text-slate-500">
                                  {' '}
                                  / {formatMoney(line.allowancePence)}
                                </span>
                              </p>
                              <p
                                className={
                                  line.remainingPence >= 0
                                    ? 'text-xs text-teal-300'
                                    : 'text-xs text-rose-300'
                                }
                              >
                                {line.remainingPence >= 0
                                  ? `${formatMoney(line.remainingPence)} left`
                                  : `${formatMoney(Math.abs(line.remainingPence))} over`}
                              </p>
                            </div>
                          </div>
                          <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-800">
                            <div
                              className={
                                line.remainingPence >= 0
                                  ? 'h-full rounded-full bg-teal-400'
                                  : 'h-full rounded-full bg-rose-400'
                              }
                              style={{ width: `${used}%` }}
                            />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
            <BreakdownCard
              title="Budget contributions"
              description="What each person contributes to the full monthly allowance."
              icon={Users}
              items={data.budgetContributions}
              total={data.budgetContributions.reduce(
                (sum, item) => sum + item.amountPence,
                0,
              )}
            />
          </section>
        </>
      )}
    </div>
  )
}

function MetricCard({
  label,
  amount,
  icon: Icon,
  tone,
}: {
  label: string
  amount: number
  icon: typeof CircleDollarSign
  tone: 'teal' | 'blue' | 'rose'
}) {
  const toneClasses = {
    teal: 'bg-teal-400/10 text-teal-300',
    blue: 'bg-blue-400/10 text-blue-300',
    rose: 'bg-rose-400/10 text-rose-300',
  }
  return (
    <Card className="overflow-hidden">
      <CardContent className="flex items-center justify-between py-6">
        <div>
          <p className="text-sm font-medium text-slate-400">{label}</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight">
            {formatMoney(amount)}
          </p>
        </div>
        <span
          className={`grid size-12 place-items-center rounded-2xl ${toneClasses[tone]}`}
        >
          <Icon />
        </span>
      </CardContent>
    </Card>
  )
}

function BreakdownCard({
  title,
  description,
  icon: Icon,
  items,
  total,
  warning = false,
}: {
  title: string
  description: string
  icon: typeof Users
  items: Array<{ id: string; name: string; amountPence: number }>
  total: number
  warning?: boolean
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-slate-800 text-teal-300">
            <Icon size={19} />
          </span>
          <div>
            <p className="text-sm font-semibold text-slate-100">{title}</p>
            <p className="mt-1 text-sm text-slate-500">{description}</p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-500">
            Add commitments to populate this report.
          </p>
        ) : (
          <div className="grid gap-4">
            {items.map((item) => (
              <div key={item.id}>
                <div className="mb-2 flex justify-between gap-4 text-sm">
                  <span className="text-slate-300">{item.name}</span>
                  <span className="font-semibold">{formatMoney(item.amountPence)}</span>
                </div>
                <div className="h-1.5 rounded-full bg-slate-800">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-teal-400 to-blue-400"
                    style={{
                      width: `${total > 0 ? Math.max((item.amountPence / total) * 100, 2) : 0}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
        {warning && items.length > 1 && (
          <p className="mt-5 rounded-xl bg-amber-300/10 p-3 text-xs leading-5 text-amber-200">
            Tag totals are intentionally non-additive. A multi-tag expense appears in each
            tag’s total, so adding these values may exceed total expenses.
          </p>
        )}
      </CardContent>
    </Card>
  )
}

function DashboardSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {[0, 1, 2].map((item) => (
        <div
          key={item}
          className="h-32 animate-pulse rounded-2xl border border-slate-800 bg-slate-900"
        />
      ))}
    </div>
  )
}
