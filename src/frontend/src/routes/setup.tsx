import { useForm } from '@tanstack/react-form'
import { createFileRoute, useRouter } from '@tanstack/react-router'
import { Check, Copy, ShieldCheck } from 'lucide-react'
import { useEffect, useState } from 'react'
import { z } from 'zod'
import { Button } from '~/components/ui/button'
import { Card, CardContent, CardHeader } from '~/components/ui/card'
import { Field, Input } from '~/components/ui/input'
import { ApiError, apiRequest } from '~/lib/api'

const searchSchema = z.object({ code: z.string().min(1) })

type SetupDetails = {
  email: string
  sharedKey: string
  authenticatorUri: string
}

export const Route = createFileRoute('/setup')({
  validateSearch: searchSchema,
  component: SetupPage,
})

function SetupPage() {
  const { code } = Route.useSearch()
  const router = useRouter()
  const [details, setDetails] = useState<SetupDetails>()
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>()
  const [error, setError] = useState<string>()
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    void apiRequest<SetupDetails>('/api/auth/setup/prepare', {
      method: 'POST',
      body: JSON.stringify({ code }),
    })
      .then(setDetails)
      .catch((caught: unknown) =>
        setError(
          caught instanceof ApiError ? caught.message : 'This setup link is invalid.',
        ),
      )
  }, [code])

  const form = useForm({
    defaultValues: { password: '', confirmPassword: '', totpCode: '' },
    onSubmit: async ({ value }) => {
      if (value.password !== value.confirmPassword) {
        setError('The passwords do not match.')
        return
      }
      setError(undefined)
      try {
        const result = await apiRequest<{
          email: string
          recoveryCodes: string[]
        }>('/api/auth/setup/complete', {
          method: 'POST',
          body: JSON.stringify({
            code,
            password: value.password,
            totpCode: value.totpCode,
          }),
        })
        setRecoveryCodes(result.recoveryCodes)
      } catch (caught) {
        setError(
          caught instanceof ApiError ? caught.message : 'Setup could not be completed.',
        )
      }
    },
  })

  if (recoveryCodes) {
    return (
      <SetupFrame>
        <Card className="w-full max-w-xl">
          <CardHeader>
            <span className="grid size-12 place-items-center rounded-2xl bg-teal-400/15 text-teal-300">
              <Check />
            </span>
            <h1 className="mt-5 text-3xl font-semibold">Save your recovery codes</h1>
            <p className="mt-2 text-slate-400">
              Each code works once. Store them somewhere separate from your authenticator.
            </p>
          </CardHeader>
          <CardContent>
            <pre className="grid grid-cols-2 gap-3 rounded-2xl border border-slate-700 bg-slate-950 p-5 text-center font-mono text-sm text-slate-200">
              {recoveryCodes.map((recoveryCode) => (
                <span key={recoveryCode}>{recoveryCode}</span>
              ))}
            </pre>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <Button
                variant="secondary"
                onClick={() => {
                  void navigator.clipboard.writeText(recoveryCodes.join('\n'))
                  setCopied(true)
                }}
              >
                <Copy size={17} /> {copied ? 'Copied' : 'Copy codes'}
              </Button>
              <Button onClick={() => void router.navigate({ to: '/dashboard' })}>
                I’ve saved them
              </Button>
            </div>
          </CardContent>
        </Card>
      </SetupFrame>
    )
  }

  return (
    <SetupFrame>
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <span className="grid size-12 place-items-center rounded-2xl bg-teal-400/15 text-teal-300">
            <ShieldCheck />
          </span>
          <h1 className="mt-5 text-3xl font-semibold">Secure your planner</h1>
          <p className="mt-2 text-slate-400">
            Set a password and connect an authenticator before the planner opens.
          </p>
        </CardHeader>
        <CardContent>
          {error && (
            <div
              role="alert"
              className="mb-5 rounded-xl border border-rose-400/30 bg-rose-400/10 p-3 text-sm text-rose-200"
            >
              {error}
            </div>
          )}
          {!details ? (
            <p className="py-8 text-center text-slate-400">Checking your setup link…</p>
          ) : (
            <form
              className="grid gap-6"
              onSubmit={(event) => {
                event.preventDefault()
                void form.handleSubmit()
              }}
            >
              <div className="rounded-2xl border border-slate-700 bg-slate-950/60 p-5">
                <p className="text-sm font-medium text-slate-200">Authenticator setup</p>
                <p className="mt-2 text-sm text-slate-400">
                  Add a manual account for <strong>{details.email}</strong> using this
                  key:
                </p>
                <code className="mt-4 block break-all rounded-xl bg-slate-900 p-3 text-center text-teal-300">
                  {details.sharedKey}
                </code>
                <details className="mt-3 text-sm text-slate-500">
                  <summary>Show authenticator URI</summary>
                  <p className="mt-2 break-all">{details.authenticatorUri}</p>
                </details>
              </div>
              <div className="grid gap-5 sm:grid-cols-2">
                <form.Field name="password">
                  {(field) => (
                    <Field label="New password">
                      <Input
                        type="password"
                        autoComplete="new-password"
                        minLength={12}
                        required
                        value={field.state.value}
                        onChange={(event) => field.handleChange(event.target.value)}
                      />
                    </Field>
                  )}
                </form.Field>
                <form.Field name="confirmPassword">
                  {(field) => (
                    <Field label="Confirm password">
                      <Input
                        type="password"
                        autoComplete="new-password"
                        minLength={12}
                        required
                        value={field.state.value}
                        onChange={(event) => field.handleChange(event.target.value)}
                      />
                    </Field>
                  )}
                </form.Field>
              </div>
              <form.Field name="totpCode">
                {(field) => (
                  <Field label="Six-digit code">
                    <Input
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      required
                      value={field.state.value}
                      onChange={(event) => field.handleChange(event.target.value)}
                    />
                  </Field>
                )}
              </form.Field>
              <form.Subscribe selector={(state) => state.isSubmitting}>
                {(isSubmitting) => (
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? 'Securing planner…' : 'Complete setup'}
                  </Button>
                )}
              </form.Subscribe>
            </form>
          )}
        </CardContent>
      </Card>
    </SetupFrame>
  )
}

function SetupFrame({ children }: { children: React.ReactNode }) {
  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden bg-slate-950 p-5 text-slate-100">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(45,212,191,0.15),transparent_38%)]" />
      <div className="relative w-full">{children}</div>
    </main>
  )
}
