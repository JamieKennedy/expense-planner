import {
  BarChart3,
  CircleDollarSign,
  Landmark,
  LayoutDashboard,
  Menu,
  Settings,
  WalletCards,
  X,
} from 'lucide-react'
import { Link, Outlet, useRouter } from '@tanstack/react-router'
import type { Session } from '~/lib/api'
import { apiRequest } from '~/lib/api'
import { cn } from '~/lib/utils'
import { useUiStore } from '~/stores/ui'
import { Button } from './ui/button'

const navigation = [
  { to: '/dashboard', label: 'Overview', icon: LayoutDashboard },
  { to: '/expenses', label: 'Expenses', icon: WalletCards },
  { to: '/income', label: 'Income', icon: Landmark },
  { to: '/budget', label: 'Budget', icon: BarChart3 },
  { to: '/settings', label: 'Settings', icon: Settings },
] as const

export function AppShell({ session }: { session: Session }) {
  const sidebarOpen = useUiStore((state) => state.sidebarOpen)
  const setSidebarOpen = useUiStore((state) => state.setSidebarOpen)
  const router = useRouter()

  async function logout() {
    await apiRequest('/api/auth/logout', { method: 'POST' })
    await router.navigate({ to: '/login' })
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_25%_0%,rgba(45,212,191,0.10),transparent_36%),radial-gradient(circle_at_90%_70%,rgba(59,130,246,0.08),transparent_32%)]" />
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex w-72 -translate-x-full flex-col border-r border-slate-800 bg-slate-950/95 p-5 backdrop-blur transition md:translate-x-0',
          sidebarOpen && 'translate-x-0',
        )}
      >
        <div className="flex items-center justify-between">
          <Link to="/dashboard" className="flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-2xl bg-teal-400 text-slate-950 shadow-lg shadow-teal-400/20">
              <CircleDollarSign size={25} />
            </span>
            <span>
              <span className="block text-lg font-bold tracking-tight">
                Expense Planner
              </span>
              <span className="block text-xs text-slate-500">Monthly clarity</span>
            </span>
          </Link>
          <Button
            size="icon"
            variant="ghost"
            className="md:hidden"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close navigation"
          >
            <X />
          </Button>
        </div>
        <nav className="mt-10 grid gap-2" aria-label="Primary navigation">
          {navigation.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              onClick={() => setSidebarOpen(false)}
              className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-slate-400 transition hover:bg-slate-900 hover:text-white"
              activeProps={{
                className:
                  'flex items-center gap-3 rounded-xl bg-teal-400/10 px-4 py-3 text-sm font-semibold text-teal-300 ring-1 ring-inset ring-teal-400/15',
              }}
            >
              <item.icon size={19} />
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
          <p className="truncate text-sm font-medium">{session.email}</p>
          <p className="mt-1 text-xs text-slate-500">Private planner</p>
          <Button
            variant="ghost"
            size="sm"
            className="mt-3 w-full"
            onClick={() => void logout()}
          >
            Sign out
          </Button>
        </div>
      </aside>
      {sidebarOpen && (
        <button
          className="fixed inset-0 z-30 bg-slate-950/70 md:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-label="Close navigation"
        />
      )}
      <main className="relative md:pl-72">
        <header className="sticky top-0 z-20 flex h-16 items-center border-b border-slate-800/80 bg-slate-950/75 px-4 backdrop-blur md:hidden">
          <Button
            size="icon"
            variant="ghost"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open navigation"
          >
            <Menu />
          </Button>
          <span className="ml-3 font-semibold">Expense Planner</span>
        </header>
        <div className="mx-auto max-w-7xl p-4 sm:p-7 lg:p-10">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
