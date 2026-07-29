import { useQuery } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import {
  ArrowDownRight,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Landmark,
  PieChart,
  Users,
} from 'lucide-react'
import { z } from 'zod'
import { EmptyState } from '~/components/empty-state'
import { MonthPicker } from '~/components/month-picker'
import { PageHeading } from '~/components/page-heading'
import { Button } from '~/components/ui/button'
import { Card, CardContent, CardHeader } from '~/components/ui/card'
import { apiRequest, type MonthlyOverview } from '~/lib/api'
import { moveMonth } from '~/lib/expense-schedule'
import { currentMonth, displayMonth, formatMoney } from '~/lib/utils'

export const Route = createFileRoute('/_app/dashboard')({
  validateSearch: z.object({
    month: z
      .string()
      .regex(/^\d{4}-\d{2}$/)
      .optional(),
  }),
  component: Dashboard,
})

function Dashboard() {
  const rawSearch = Route.useSearch()
  const month = rawSearch.month ?? currentMonth()
  const navigate = Route.useNavigate()
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
        eyebrow="Monthly planner"
        title="Overview"
        description={`Income, scheduled expenses, and budget position for ${displayMonth(month)}.`}
        actions={
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="icon"
              variant="secondary"
              aria-label="Previous month"
              onClick={() => void navigate({ search: { month: moveMonth(month, -1) } })}
            >
              <ChevronLeft size={17} />
            </Button>
            <MonthPicker
              value={month}
              className="w-52"
              label="Dashboard month"
              onValueChange={(selectedMonth) =>
                void navigate({ search: { month: selectedMonth } })
              }
            />
            <Button
              type="button"
              size="icon"
              variant="secondary"
              aria-label="Next month"
              onClick={() => void navigate({ search: { month: moveMonth(month, 1) } })}
            >
              <ChevronRight size={17} />
            </Button>
          </div>
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
              to="/income"
              month={month}
            />
            <MetricCard
              label="Expenses out"
              amount={data.projectedExpensesPence}
              icon={ArrowUpRight}
              tone="blue"
              to="/expenses"
              month={month}
            />
            <MetricCard
              label="Projected net"
              amount={data.projectedNetPence}
              icon={CircleDollarSign}
              tone={data.projectedNetPence >= 0 ? 'teal' : 'rose'}
            />
          </section>
          <section className="mt-6 grid gap-6 xl:grid-cols-3">
            <BreakdownCard
              title="Cost by contributor"
              description="Your share and everyone else’s share of scheduled expenses."
              icon={Users}
              items={data.contributorCosts}
              total={data.projectedExpensesPence}
            />
            <BreakdownCard
              title="Cost by account"
              description="Scheduled expenses grouped by the account they leave."
              icon={Landmark}
              items={data.accountCosts}
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
                            {used > 0 && (
                              <div
                                className={
                                  line.remainingPence >= 0
                                    ? 'h-full rounded-full bg-teal-400'
                                    : 'h-full rounded-full bg-rose-400'
                                }
                                style={{ width: `${used}%` }}
                              />
                            )}
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
  to,
  month,
}: {
  label: string
  amount: number
  icon: typeof CircleDollarSign
  tone: 'teal' | 'blue' | 'rose'
  to?: '/income' | '/expenses'
  month?: string
}) {
  const toneClasses = {
    teal: 'bg-teal-400/10 text-teal-300',
    blue: 'bg-blue-400/10 text-blue-300',
    rose: 'bg-rose-400/10 text-rose-300',
  }
  const card = (
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
  return to ? (
    <Link
      to={to}
      search={month ? { month } : undefined}
      className="rounded-2xl outline-none transition hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-teal-400"
      aria-label={`${label}: ${formatMoney(amount)}. View details.`}
    >
      {card}
    </Link>
  ) : (
    card
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
                  {item.amountPence > 0 && total > 0 && (
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-teal-400 to-blue-400"
                      style={{
                        width: `${Math.max((item.amountPence / total) * 100, 2)}%`,
                      }}
                    />
                  )}
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
