import { useForm } from '@tanstack/react-form'
import { createFileRoute, useRouter } from '@tanstack/react-router'
import { Check, Copy, ShieldCheck } from 'lucide-react'
import { useEffect, useState } from 'react'
import { z } from 'zod'
import { Button } from '~/components/ui/button'
import { Card, CardContent, CardHeader } from '~/components/ui/card'
import { Checkbox } from '~/components/ui/checkbox'
import { Field, FieldError, FieldLabel } from '~/components/ui/field'
import { Input } from '~/components/ui/input'
import { ApiError, apiRequest } from '~/lib/api'
import { focusFirstInvalidField } from '~/lib/form'

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
    let active = true

    void apiRequest<SetupDetails>('/api/auth/setup/prepare', {
      method: 'POST',
      body: JSON.stringify({ code }),
    })
      .then((result) => {
        if (active) {
          setDetails(result)
          setError(undefined)
        }
      })
      .catch((caught: unknown) => {
        if (active) {
          setError(
            caught instanceof ApiError
              ? caught.message
              : 'The setup service is unavailable. Restart the AppHost and try again.',
          )
        }
      })

    return () => {
      active = false
    }
  }, [code])

  const form = useForm({
    defaultValues: {
      password: '',
      confirmPassword: '',
      enableMfa: true,
      totpCode: '',
    },
    onSubmit: async ({ value }) => {
      setError(undefined)
      try {
        const result = await apiRequest<{
          email: string
          mfaEnabled: boolean
          recoveryCodes: string[]
        }>('/api/auth/setup/complete', {
          method: 'POST',
          body: JSON.stringify({
            code,
            password: value.password,
            enableMfa: value.enableMfa,
            totpCode: value.totpCode,
          }),
        })
        if (result.mfaEnabled) {
          setRecoveryCodes(result.recoveryCodes)
        } else {
          await router.navigate({ to: '/dashboard' })
        }
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
            Set a password and choose whether to protect this account with an
            authenticator.
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
              noValidate
              className="grid gap-6"
              onSubmit={(event) => {
                event.preventDefault()
                void form.handleSubmit().then(focusFirstInvalidField)
              }}
            >
              <form.Field name="enableMfa">
                {(field) => (
                  <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-700 bg-slate-950/40 p-4">
                    <Checkbox
                      className="mt-0.5"
                      checked={field.state.value}
                      onCheckedChange={(checked) => field.handleChange(checked === true)}
                    />
                    <span>
                      <span className="block text-sm font-medium text-slate-200">
                        Enable authenticator MFA
                      </span>
                      <span className="mt-1 block text-xs leading-5 text-slate-500">
                        Recommended. Require a code from an authenticator app after
                        entering your password.
                      </span>
                    </span>
                  </label>
                )}
              </form.Field>
              <form.Subscribe selector={(state) => state.values.enableMfa}>
                {(enableMfa) =>
                  enableMfa ? (
                    <div className="rounded-2xl border border-slate-700 bg-slate-950/60 p-5">
                      <p className="text-sm font-medium text-slate-200">
                        Authenticator setup
                      </p>
                      <p className="mt-2 text-sm text-slate-400">
                        Add a manual account for <strong>{details.email}</strong> using
                        this key:
                      </p>
                      <code className="mt-4 block break-all rounded-xl bg-slate-900 p-3 text-center text-teal-300">
                        {details.sharedKey}
                      </code>
                      <details className="mt-3 text-sm text-slate-500">
                        <summary>Show authenticator URI</summary>
                        <p className="mt-2 break-all">{details.authenticatorUri}</p>
                      </details>
                    </div>
                  ) : (
                    <p className="rounded-xl bg-amber-300/10 p-3 text-xs leading-5 text-amber-200">
                      This account will use password-only sign-in. You can enable MFA
                      later from Settings.
                    </p>
                  )
                }
              </form.Subscribe>
              <div className="grid gap-5 sm:grid-cols-2">
                <form.Field
                  name="password"
                  validators={{
                    onChange: ({ value }) =>
                      value.length >= 12 ? undefined : 'Use at least 12 characters.',
                  }}
                >
                  {(field) => {
                    const validationError = firstError(field.state.meta.errors)
                    return (
                      <Field invalid={Boolean(validationError)}>
                        <FieldLabel htmlFor={field.name}>New password</FieldLabel>
                        <Input
                          id={field.name}
                          type="password"
                          autoComplete="new-password"
                          minLength={12}
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
                  name="confirmPassword"
                  validators={{
                    onChangeListenTo: ['password'],
                    onChange: ({ value, fieldApi }) =>
                      value === fieldApi.form.getFieldValue('password')
                        ? undefined
                        : 'The passwords do not match.',
                  }}
                >
                  {(field) => {
                    const validationError = firstError(field.state.meta.errors)
                    return (
                      <Field invalid={Boolean(validationError)}>
                        <FieldLabel htmlFor={field.name}>Confirm password</FieldLabel>
                        <Input
                          id={field.name}
                          type="password"
                          autoComplete="new-password"
                          minLength={12}
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
              <form.Subscribe selector={(state) => state.values.enableMfa}>
                {(enableMfa) =>
                  enableMfa ? (
                    <form.Field
                      name="totpCode"
                      validators={{
                        onChange: ({ value }) =>
                          /^\d{6}$/.test(value.replace(/\s/g, ''))
                            ? undefined
                            : 'Enter the six-digit code from your authenticator.',
                      }}
                    >
                      {(field) => {
                        const validationError = firstError(field.state.meta.errors)
                        return (
                          <Field invalid={Boolean(validationError)}>
                            <FieldLabel htmlFor={field.name}>Six-digit code</FieldLabel>
                            <Input
                              id={field.name}
                              inputMode="numeric"
                              autoComplete="one-time-code"
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
                  ) : null
                }
              </form.Subscribe>
              <form.Subscribe selector={(state) => state.isSubmitting}>
                {(isSubmitting) => (
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? 'Completing setup…' : 'Complete setup'}
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
    <main className="relative grid min-h-screen place-items-center overflow-x-hidden bg-slate-950 p-5 text-slate-100">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(45,212,191,0.15),transparent_38%)]" />
      <div className="relative grid w-full place-items-center">{children}</div>
    </main>
  )
}

function firstError(errors: unknown[]) {
  return errors.find(
    (error): error is string => typeof error === 'string' && error.length > 0,
  )
}
