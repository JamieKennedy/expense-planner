import { useForm } from '@tanstack/react-form'
import { createFileRoute, Link, redirect, useRouter } from '@tanstack/react-router'
import { CircleDollarSign, ShieldCheck, UserRoundPlus } from 'lucide-react'
import { useState } from 'react'
import { Button } from '~/components/ui/button'
import { Card, CardContent } from '~/components/ui/card'
import { Field, FieldError, FieldLabel } from '~/components/ui/field'
import { Input } from '~/components/ui/input'
import { ApiError, apiRequest, getRegistrationStatus } from '~/lib/api'
import { focusFirstInvalidField } from '~/lib/form'

export const Route = createFileRoute('/register')({
  beforeLoad: async () => {
    if (!(await getRegistrationStatus()).available) {
      throw redirect({ to: '/login' })
    }
  },
  component: RegisterPage,
})

function RegisterPage() {
  const router = useRouter()
  const [error, setError] = useState<string>()
  const form = useForm({
    defaultValues: { email: '' },
    onSubmit: async ({ value }) => {
      setError(undefined)
      try {
        const result = await apiRequest<{ setupCode: string }>('/api/auth/registration', {
          method: 'POST',
          body: JSON.stringify(value),
        })
        await router.navigate({
          to: '/setup',
          search: { code: result.setupCode },
        })
      } catch (caught) {
        if (caught instanceof ApiError && caught.status === 409) {
          await router.navigate({ to: '/login' })
          return
        }
        setError(
          caught instanceof ApiError
            ? caught.message
            : 'Registration is temporarily unavailable.',
        )
      }
    },
  })

  return (
    <main className="relative grid min-h-screen place-items-center overflow-x-hidden bg-slate-950 p-5 text-slate-100">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_15%,rgba(45,212,191,0.18),transparent_32%),radial-gradient(circle_at_80%_85%,rgba(59,130,246,0.12),transparent_34%)]" />
      <div className="relative grid w-full max-w-5xl overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/70 shadow-2xl shadow-black/40 backdrop-blur lg:grid-cols-[1.1fr_0.9fr]">
        <section className="hidden min-h-[600px] flex-col justify-between border-r border-slate-800 bg-slate-950/30 p-12 lg:flex">
          <Link to="/" className="flex items-center gap-3">
            <span className="grid size-12 place-items-center rounded-2xl bg-teal-400 text-slate-950">
              <CircleDollarSign size={28} />
            </span>
            <span className="text-xl font-bold">Expense Planner</span>
          </Link>
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-teal-300">
              First-run setup
            </p>
            <h1 className="mt-5 max-w-lg text-5xl font-semibold leading-[1.08] tracking-tight">
              Create the owner of this planner.
            </h1>
            <p className="mt-6 max-w-md text-lg leading-8 text-slate-400">
              Registration closes permanently after this account is created. Future
              accounts require an invitation from inside the planner.
            </p>
          </div>
          <p className="flex items-center gap-2 text-sm text-slate-400">
            <ShieldCheck className="text-teal-300" size={18} />
            Password and optional authenticator setup comes next
          </p>
        </section>
        <section className="flex items-center p-6 sm:p-12">
          <Card className="w-full border-0 bg-transparent shadow-none">
            <CardContent className="p-0">
              <span className="grid size-12 place-items-center rounded-2xl bg-teal-400/15 text-teal-300">
                <UserRoundPlus />
              </span>
              <p className="mt-8 text-sm font-semibold text-teal-300">Private instance</p>
              <h2 className="mt-2 text-3xl font-semibold tracking-tight">
                Register the first owner
              </h2>
              <p className="mt-3 text-slate-400">
                Enter your email, then set your password and choose whether to use an
                authenticator.
              </p>
              {error && (
                <div
                  role="alert"
                  className="mt-6 rounded-xl border border-rose-400/30 bg-rose-400/10 p-3 text-sm text-rose-200"
                >
                  {error}
                </div>
              )}
              <form
                noValidate
                className="mt-8 grid gap-5"
                onSubmit={(event) => {
                  event.preventDefault()
                  void form.handleSubmit().then(focusFirstInvalidField)
                }}
              >
                <form.Field
                  name="email"
                  validators={{
                    onChange: ({ value }) =>
                      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
                        ? undefined
                        : 'Enter a valid email address.',
                  }}
                >
                  {(field) => {
                    const validationError = firstError(field.state.meta.errors)
                    return (
                      <Field invalid={Boolean(validationError)}>
                        <FieldLabel htmlFor={field.name}>Email address</FieldLabel>
                        <Input
                          id={field.name}
                          autoFocus
                          type="email"
                          autoComplete="email"
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
                <form.Subscribe selector={(state) => state.isSubmitting}>
                  {(isSubmitting) => (
                    <Button type="submit" disabled={isSubmitting}>
                      {isSubmitting ? 'Creating owner…' : 'Continue securely'}
                    </Button>
                  )}
                </form.Subscribe>
              </form>
            </CardContent>
          </Card>
        </section>
      </div>
    </main>
  )
}

function firstError(errors: unknown[]) {
  return errors.find(
    (error): error is string => typeof error === 'string' && error.length > 0,
  )
}
