import { useForm } from '@tanstack/react-form'
import { createFileRoute, Link, useRouter } from '@tanstack/react-router'
import { CircleDollarSign, KeyRound, ShieldCheck } from 'lucide-react'
import { useState } from 'react'
import { z } from 'zod'
import { Button } from '~/components/ui/button'
import { Card, CardContent } from '~/components/ui/card'
import { Field, Input } from '~/components/ui/input'
import { ApiError, apiRequest } from '~/lib/api'

const searchSchema = z.object({
  redirect: z.string().optional(),
})

export const Route = createFileRoute('/login')({
  validateSearch: searchSchema,
  component: LoginPage,
})

function LoginPage() {
  const router = useRouter()
  const { redirect } = Route.useSearch()
  const [challengeId, setChallengeId] = useState<string>()
  const [error, setError] = useState<string>()

  const loginForm = useForm({
    defaultValues: { email: '', password: '' },
    onSubmit: async ({ value }) => {
      setError(undefined)
      try {
        const result = await apiRequest<{
          requiresMfa: boolean
          challengeId: string
        }>('/api/auth/login', {
          method: 'POST',
          body: JSON.stringify(value),
        })
        setChallengeId(result.challengeId)
      } catch (caught) {
        setError(caught instanceof ApiError ? caught.message : 'Unable to sign in.')
      }
    },
  })

  const mfaForm = useForm({
    defaultValues: { code: '' },
    onSubmit: async ({ value }) => {
      if (!challengeId) return
      setError(undefined)
      try {
        await apiRequest('/api/auth/mfa', {
          method: 'POST',
          body: JSON.stringify({ challengeId, code: value.code }),
        })
        await router.navigate({ href: redirect ?? '/dashboard' })
      } catch (caught) {
        setError(
          caught instanceof ApiError
            ? caught.message
            : 'The verification code was rejected.',
        )
      }
    },
  })

  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden bg-slate-950 p-5 text-slate-100">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,rgba(45,212,191,0.16),transparent_30%),radial-gradient(circle_at_85%_80%,rgba(59,130,246,0.12),transparent_35%)]" />
      <div className="relative grid w-full max-w-5xl overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/70 shadow-2xl shadow-black/40 backdrop-blur lg:grid-cols-[1.1fr_0.9fr]">
        <section className="hidden min-h-[640px] flex-col justify-between border-r border-slate-800 bg-slate-950/30 p-12 lg:flex">
          <Link to="/" className="flex items-center gap-3">
            <span className="grid size-12 place-items-center rounded-2xl bg-teal-400 text-slate-950">
              <CircleDollarSign size={28} />
            </span>
            <span className="text-xl font-bold">Expense Planner</span>
          </Link>
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-teal-300">
              See the whole month
            </p>
            <h1 className="mt-5 max-w-lg text-5xl font-semibold leading-[1.08] tracking-tight">
              Plan the money before the month plans it for you.
            </h1>
            <p className="mt-6 max-w-md text-lg leading-8 text-slate-400">
              One private place for recurring expenses, shared contributions, income,
              budgets and the dates they really reach your account.
            </p>
          </div>
          <div className="flex gap-7 text-sm text-slate-400">
            <span className="flex items-center gap-2">
              <ShieldCheck className="text-teal-300" size={18} /> MFA protected
            </span>
            <span className="flex items-center gap-2">
              <KeyRound className="text-teal-300" size={18} /> Invite only
            </span>
          </div>
        </section>
        <section className="flex items-center p-6 sm:p-12">
          <Card className="w-full border-0 bg-transparent shadow-none">
            <CardContent className="p-0">
              <div className="mb-10 flex items-center gap-3 lg:hidden">
                <span className="grid size-10 place-items-center rounded-xl bg-teal-400 text-slate-950">
                  <CircleDollarSign size={23} />
                </span>
                <span className="font-bold">Expense Planner</span>
              </div>
              <p className="text-sm font-semibold text-teal-300">
                {challengeId ? 'Second step' : 'Welcome back'}
              </p>
              <h2 className="mt-2 text-3xl font-semibold tracking-tight">
                {challengeId ? 'Verify it’s you' : 'Sign in to your planner'}
              </h2>
              <p className="mt-3 text-slate-400">
                {challengeId
                  ? 'Enter the six-digit code from your authenticator, or a recovery code.'
                  : 'There is no public registration. Use your invited or bootstrapped account.'}
              </p>
              {error && (
                <div
                  role="alert"
                  className="mt-6 rounded-xl border border-rose-400/30 bg-rose-400/10 p-3 text-sm text-rose-200"
                >
                  {error}
                </div>
              )}
              {challengeId ? (
                <form
                  className="mt-8 grid gap-5"
                  onSubmit={(event) => {
                    event.preventDefault()
                    void mfaForm.handleSubmit()
                  }}
                >
                  <mfaForm.Field name="code">
                    {(field) => (
                      <Field label="Authenticator or recovery code">
                        <Input
                          autoFocus
                          autoComplete="one-time-code"
                          inputMode="numeric"
                          value={field.state.value}
                          onChange={(event) => field.handleChange(event.target.value)}
                        />
                      </Field>
                    )}
                  </mfaForm.Field>
                  <mfaForm.Subscribe selector={(state) => state.isSubmitting}>
                    {(isSubmitting) => (
                      <Button type="submit" disabled={isSubmitting}>
                        {isSubmitting ? 'Verifying…' : 'Verify and continue'}
                      </Button>
                    )}
                  </mfaForm.Subscribe>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setChallengeId(undefined)}
                  >
                    Use a different account
                  </Button>
                </form>
              ) : (
                <form
                  className="mt-8 grid gap-5"
                  onSubmit={(event) => {
                    event.preventDefault()
                    void loginForm.handleSubmit()
                  }}
                >
                  <loginForm.Field name="email">
                    {(field) => (
                      <Field label="Email address">
                        <Input
                          type="email"
                          autoComplete="email"
                          required
                          value={field.state.value}
                          onChange={(event) => field.handleChange(event.target.value)}
                        />
                      </Field>
                    )}
                  </loginForm.Field>
                  <loginForm.Field name="password">
                    {(field) => (
                      <Field label="Password">
                        <Input
                          type="password"
                          autoComplete="current-password"
                          required
                          value={field.state.value}
                          onChange={(event) => field.handleChange(event.target.value)}
                        />
                      </Field>
                    )}
                  </loginForm.Field>
                  <loginForm.Subscribe selector={(state) => state.isSubmitting}>
                    {(isSubmitting) => (
                      <Button type="submit" disabled={isSubmitting}>
                        {isSubmitting ? 'Signing in…' : 'Continue'}
                      </Button>
                    )}
                  </loginForm.Subscribe>
                </form>
              )}
            </CardContent>
          </Card>
        </section>
      </div>
    </main>
  )
}
