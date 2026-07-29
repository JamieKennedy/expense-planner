import { useForm } from '@tanstack/react-form'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, useRouter } from '@tanstack/react-router'
import {
  Archive,
  AtSign,
  Copy,
  Landmark,
  Pencil,
  Plus,
  ShieldCheck,
  Tags,
  Users,
} from 'lucide-react'
import { useState } from 'react'
import { ColourPicker, randomTagColour } from '~/components/colour-picker'
import { PageHeading } from '~/components/page-heading'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import { Card, CardContent, CardHeader } from '~/components/ui/card'
import { Dialog } from '~/components/ui/dialog'
import { Field, FieldError, FieldLabel } from '~/components/ui/field'
import { Input } from '~/components/ui/input'
import {
  ApiError,
  apiRequest,
  type MfaEnrollment,
  type ReferenceData,
  type ReferenceItem,
  type SecurityStatus,
} from '~/lib/api'
import { focusFirstInvalidField } from '~/lib/form'

export const Route = createFileRoute('/_app/settings')({
  component: SettingsPage,
})

type ReferenceKind = 'accounts' | 'contributors' | 'tags'

function SettingsPage() {
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState<{
    kind: ReferenceKind
    item?: ReferenceItem
  }>()
  const [inviteCode, setInviteCode] = useState<string>()
  const [securityDialogOpen, setSecurityDialogOpen] = useState(false)
  const references = useQuery({
    queryKey: ['reference-data', 'all'],
    queryFn: () => apiRequest<ReferenceData>('/api/reference-data?includeArchived=true'),
  })
  const security = useQuery({
    queryKey: ['security-status'],
    queryFn: () => apiRequest<SecurityStatus>('/api/auth/security'),
  })
  const archive = useMutation({
    mutationFn: ({ kind, id }: { kind: ReferenceKind; id: string }) =>
      apiRequest(`/api/${kind}/${id}`, { method: 'DELETE' }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['reference-data'] })
    },
  })

  return (
    <div className="animate-rise">
      <PageHeading
        eyebrow="Planner configuration"
        title="Settings"
        description="Manage the names and categories that belong only to your planner."
      />
      <section className="grid gap-6 xl:grid-cols-3">
        <ReferenceCard
          title="Accounts"
          description="Where money leaves and arrives."
          icon={Landmark}
          kind="accounts"
          items={references.data?.accounts ?? []}
          onEdit={(item) => setEditing({ kind: 'accounts', item })}
          onAdd={() => setEditing({ kind: 'accounts' })}
          onArchive={(id) => archive.mutate({ kind: 'accounts', id })}
        />
        <ReferenceCard
          title="Contributors"
          description="People who share expenses and budgets."
          icon={Users}
          kind="contributors"
          items={references.data?.contributors ?? []}
          onEdit={(item) => setEditing({ kind: 'contributors', item })}
          onAdd={() => setEditing({ kind: 'contributors' })}
          onArchive={(id) => archive.mutate({ kind: 'contributors', id })}
        />
        <ReferenceCard
          title="Tags"
          description="Categories used for filtering and reports."
          icon={Tags}
          kind="tags"
          items={references.data?.tags ?? []}
          onEdit={(item) => setEditing({ kind: 'tags', item })}
          onAdd={() => setEditing({ kind: 'tags' })}
          onArchive={(id) => archive.mutate({ kind: 'tags', id })}
        />
      </section>
      <section className="mt-6 grid gap-6 lg:grid-cols-2">
        <InvitationCard code={inviteCode} onCreated={setInviteCode} />
        <SecurityCard
          status={security.data}
          isLoading={security.isLoading}
          onManage={() => setSecurityDialogOpen(true)}
        />
      </section>
      {editing && (
        <ReferenceDialog
          key={`${editing.kind}-${editing.item?.id ?? 'new'}`}
          kind={editing.kind}
          item={editing.item}
          onClose={() => setEditing(undefined)}
        />
      )}
      {securityDialogOpen && security.data && (
        <SecurityDialog
          enabled={security.data.mfaEnabled}
          onClose={() => setSecurityDialogOpen(false)}
        />
      )}
    </div>
  )
}

function SecurityCard({
  status,
  isLoading,
  onManage,
}: {
  status?: SecurityStatus
  isLoading: boolean
  onManage: () => void
}) {
  return (
    <Card>
      <CardHeader>
        <span className="grid size-10 place-items-center rounded-xl bg-teal-400/10 text-teal-300">
          <ShieldCheck size={19} />
        </span>
        <h2 className="mt-4 font-semibold">Security</h2>
        <p className="mt-1 text-sm leading-6 text-slate-500">
          Authenticator MFA is optional and configured for this account. Refresh sessions
          rotate automatically and are revoked if a used token appears again.
        </p>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 text-sm">
          <Status
            label="Multi-factor authentication"
            value={isLoading ? 'Checking…' : status?.mfaEnabled ? 'Enabled' : 'Disabled'}
          />
          <Status label="Access session" value="15 minutes" />
          <Status label="Refresh session" value="30 days" />
          <Status label="Cookie policy" value="HttpOnly · Strict" />
        </div>
        <Button
          className="mt-5 w-full"
          variant={status?.mfaEnabled ? 'secondary' : 'primary'}
          disabled={!status}
          onClick={onManage}
        >
          {status?.mfaEnabled ? 'Disable authenticator MFA' : 'Enable authenticator MFA'}
        </Button>
        <p className="mt-4 text-xs leading-5 text-slate-500">
          Changing MFA signs this browser out and revokes every refresh session. If you
          lose access to MFA, an administrator can issue a recovery setup code with the
          CLI.
        </p>
      </CardContent>
    </Card>
  )
}

function SecurityDialog({ enabled, onClose }: { enabled: boolean; onClose: () => void }) {
  const router = useRouter()
  const [enrollment, setEnrollment] = useState<MfaEnrollment>()
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>()
  const [error, setError] = useState<string>()
  const [copied, setCopied] = useState(false)

  const prepareForm = useForm({
    defaultValues: { password: '' },
    onSubmit: ({ value }) => prepare.mutate(value.password),
  })
  const enableForm = useForm({
    defaultValues: { code: '' },
    onSubmit: ({ value }) => {
      if (enrollment)
        enable.mutate({ challengeId: enrollment.challengeId, code: value.code })
    },
  })
  const disableForm = useForm({
    defaultValues: { password: '', code: '' },
    onSubmit: ({ value }) => disable.mutate(value),
  })
  const prepare = useMutation({
    mutationFn: (password: string) =>
      apiRequest<MfaEnrollment>('/api/auth/security/mfa/prepare', {
        method: 'POST',
        body: JSON.stringify({ password }),
      }),
    onSuccess: (result) => {
      setEnrollment(result)
      setError(undefined)
    },
    onError: (caught) => setError(securityError(caught)),
  })
  const enable = useMutation({
    mutationFn: (value: { challengeId: string; code: string }) =>
      apiRequest<{ recoveryCodes: string[] }>('/api/auth/security/mfa/enable', {
        method: 'POST',
        body: JSON.stringify(value),
      }),
    onSuccess: (result) => {
      setRecoveryCodes(result.recoveryCodes)
      setError(undefined)
    },
    onError: (caught) => setError(securityError(caught)),
  })
  const disable = useMutation({
    mutationFn: (value: { password: string; code: string }) =>
      apiRequest<void>('/api/auth/security/mfa/disable', {
        method: 'POST',
        body: JSON.stringify(value),
      }),
    onSuccess: () => void router.navigate({ to: '/login' }),
    onError: (caught) => setError(securityError(caught)),
  })
  const isPending = prepare.isPending || enable.isPending || disable.isPending

  return (
    <Dialog
      open
      title={
        recoveryCodes
          ? 'Save your recovery codes'
          : enabled
            ? 'Disable authenticator MFA'
            : 'Enable authenticator MFA'
      }
      description={
        recoveryCodes
          ? 'Each code works once. Store them somewhere separate from your authenticator.'
          : enabled
            ? 'This removes the authenticator requirement from future sign-ins.'
            : 'Verify your password, then connect an authenticator app.'
      }
      closeDisabled={isPending}
      onClose={() => {
        if (recoveryCodes) {
          void router.navigate({ to: '/login' })
        } else {
          onClose()
        }
      }}
    >
      {error && (
        <p role="alert" className="mb-5 rounded-xl bg-rose-400/10 p-3 text-rose-200">
          {error}
        </p>
      )}
      {recoveryCodes ? (
        <div>
          <pre className="grid grid-cols-2 gap-3 rounded-2xl border border-slate-700 bg-slate-950 p-5 text-center font-mono text-sm text-slate-200">
            {recoveryCodes.map((code) => (
              <span key={code}>{code}</span>
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
            <Button onClick={() => void router.navigate({ to: '/login' })}>
              I’ve saved them
            </Button>
          </div>
        </div>
      ) : enabled ? (
        <form
          noValidate
          className="grid gap-5"
          onSubmit={(event) => {
            event.preventDefault()
            void disableForm.handleSubmit().then(focusFirstInvalidField)
          }}
        >
          <disableForm.Field
            name="password"
            validators={{
              onChange: ({ value }) =>
                value ? undefined : 'Enter your current password.',
            }}
          >
            {(field) => {
              const validationError = firstError(field.state.meta.errors)
              return (
                <Field invalid={Boolean(validationError)}>
                  <FieldLabel htmlFor="disable-mfa-password">Current password</FieldLabel>
                  <Input
                    id="disable-mfa-password"
                    type="password"
                    autoComplete="current-password"
                    value={field.state.value}
                    aria-invalid={Boolean(validationError) || undefined}
                    onBlur={field.handleBlur}
                    onChange={(event) => field.handleChange(event.target.value)}
                  />
                  <FieldError>{validationError}</FieldError>
                </Field>
              )
            }}
          </disableForm.Field>
          <disableForm.Field
            name="code"
            validators={{
              onChange: ({ value }) =>
                value.trim() ? undefined : 'Enter an authenticator or recovery code.',
            }}
          >
            {(field) => {
              const validationError = firstError(field.state.meta.errors)
              return (
                <Field invalid={Boolean(validationError)}>
                  <FieldLabel htmlFor="disable-mfa-code">
                    Authenticator or recovery code
                  </FieldLabel>
                  <Input
                    id="disable-mfa-code"
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
          </disableForm.Field>
          <Button type="submit" variant="danger" disabled={disable.isPending}>
            {disable.isPending ? 'Disabling…' : 'Disable MFA and sign out'}
          </Button>
        </form>
      ) : enrollment ? (
        <form
          noValidate
          className="grid gap-5"
          onSubmit={(event) => {
            event.preventDefault()
            void enableForm.handleSubmit().then(focusFirstInvalidField)
          }}
        >
          <div className="rounded-2xl border border-slate-700 bg-slate-950/60 p-5">
            <p className="text-sm text-slate-400">
              Add this key to your authenticator app:
            </p>
            <code className="mt-4 block break-all rounded-xl bg-slate-900 p-3 text-center text-teal-300">
              {enrollment.sharedKey}
            </code>
            <details className="mt-3 text-sm text-slate-500">
              <summary>Show authenticator URI</summary>
              <p className="mt-2 break-all">{enrollment.authenticatorUri}</p>
            </details>
          </div>
          <enableForm.Field
            name="code"
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
                  <FieldLabel htmlFor="enable-mfa-code">Six-digit code</FieldLabel>
                  <Input
                    id="enable-mfa-code"
                    autoFocus
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
          </enableForm.Field>
          <Button type="submit" disabled={enable.isPending}>
            {enable.isPending ? 'Enabling…' : 'Enable MFA and sign out'}
          </Button>
        </form>
      ) : (
        <form
          noValidate
          className="grid gap-5"
          onSubmit={(event) => {
            event.preventDefault()
            void prepareForm.handleSubmit().then(focusFirstInvalidField)
          }}
        >
          <prepareForm.Field
            name="password"
            validators={{
              onChange: ({ value }) =>
                value ? undefined : 'Enter your current password.',
            }}
          >
            {(field) => {
              const validationError = firstError(field.state.meta.errors)
              return (
                <Field invalid={Boolean(validationError)}>
                  <FieldLabel htmlFor="enable-mfa-password">Current password</FieldLabel>
                  <Input
                    id="enable-mfa-password"
                    type="password"
                    autoComplete="current-password"
                    value={field.state.value}
                    aria-invalid={Boolean(validationError) || undefined}
                    onBlur={field.handleBlur}
                    onChange={(event) => field.handleChange(event.target.value)}
                  />
                  <FieldError>{validationError}</FieldError>
                </Field>
              )
            }}
          </prepareForm.Field>
          <Button type="submit" disabled={prepare.isPending}>
            {prepare.isPending ? 'Checking…' : 'Continue'}
          </Button>
        </form>
      )}
    </Dialog>
  )
}

function securityError(caught: unknown) {
  return caught instanceof ApiError
    ? caught.message
    : 'The security change could not be completed.'
}

function ReferenceCard({
  title,
  description,
  icon: Icon,
  kind,
  items,
  onAdd,
  onEdit,
  onArchive,
}: {
  title: string
  description: string
  icon: typeof Landmark
  kind: ReferenceKind
  items: ReferenceItem[]
  onAdd: () => void
  onEdit: (item: ReferenceItem) => void
  onArchive: (id: string) => void
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <span className="grid size-10 place-items-center rounded-xl bg-slate-800 text-teal-300">
            <Icon size={19} />
          </span>
          <Button
            size="icon"
            variant="secondary"
            onClick={onAdd}
            aria-label={`Add ${kind}`}
          >
            <Plus size={17} />
          </Button>
        </div>
        <h2 className="mt-4 font-semibold">{title}</h2>
        <p className="mt-1 text-sm text-slate-500">{description}</p>
      </CardHeader>
      <CardContent>
        <div className="grid gap-2">
          {items.length === 0 && (
            <p className="rounded-xl border border-dashed border-slate-700 p-4 text-center text-sm text-slate-500">
              None added yet.
            </p>
          )}
          {items.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/30 p-3"
            >
              <div className="flex min-w-0 items-center gap-2">
                {item.colour && (
                  <span
                    className="size-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: item.colour }}
                  />
                )}
                <span
                  className={
                    item.isArchived
                      ? 'truncate text-sm text-slate-500 line-through'
                      : 'truncate text-sm text-slate-200'
                  }
                >
                  {item.name}
                </span>
                {item.isArchived && <Badge>Archived</Badge>}
                {item.isOwner && !item.isArchived && <Badge>You</Badge>}
              </div>
              {!item.isArchived && (
                <div className="flex">
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => onEdit(item)}
                    aria-label={`Edit ${item.name}`}
                  >
                    <Pencil size={15} />
                  </Button>
                  {!item.isOwner && (
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => onArchive(item.id)}
                      aria-label={`Archive ${item.name}`}
                    >
                      <Archive size={15} />
                    </Button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

function ReferenceDialog({
  kind,
  item,
  onClose,
}: {
  kind: ReferenceKind
  item?: ReferenceItem
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const [initialColour] = useState(() => item?.colour ?? randomTagColour())
  const [error, setError] = useState<string>()
  const form = useForm({
    defaultValues: {
      name: item?.name ?? '',
      colour: initialColour,
    },
    onSubmit: ({ value }) => save.mutate(value),
  })
  const save = useMutation({
    mutationFn: (value: { name: string; colour: string }) =>
      apiRequest(item ? `/api/${kind}/${item.id}` : `/api/${kind}`, {
        method: item ? 'PUT' : 'POST',
        body: JSON.stringify(
          kind === 'tags'
            ? { name: value.name, colour: value.colour }
            : { name: value.name },
        ),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['reference-data'] })
      onClose()
    },
    onError: (caught) =>
      setError(caught instanceof Error ? caught.message : 'Unable to save.'),
  })
  const singular = kind === 'contributors' ? 'contributor' : kind.slice(0, -1)
  return (
    <Dialog
      open
      title={`${item ? 'Edit' : 'Add'} ${singular}`}
      description="Names must be unique among active items in your planner."
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
        <form.Field
          name="name"
          validators={{
            onChange: ({ value }) =>
              value.trim() ? undefined : `Enter a ${singular} name.`,
          }}
        >
          {(field) => {
            const validationError = firstError(field.state.meta.errors)
            return (
              <Field invalid={Boolean(validationError)}>
                <FieldLabel htmlFor={field.name}>Name</FieldLabel>
                <Input
                  id={field.name}
                  autoFocus
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
        {kind === 'tags' && (
          <form.Field
            name="colour"
            validators={{
              onChange: ({ value }) =>
                /^#[0-9a-fA-F]{6}$/.test(value)
                  ? undefined
                  : 'Enter a six-digit hex colour.',
            }}
          >
            {(field) => {
              const validationError = firstError(field.state.meta.errors)
              return (
                <Field invalid={Boolean(validationError)}>
                  <FieldLabel>Display colour</FieldLabel>
                  <ColourPicker
                    value={field.state.value}
                    invalid={Boolean(validationError)}
                    onValueChange={field.handleChange}
                  />
                  <FieldError>{validationError}</FieldError>
                </Field>
              )
            }}
          </form.Field>
        )}
        <Button type="submit" disabled={save.isPending}>
          {save.isPending ? 'Saving…' : `Save ${singular}`}
        </Button>
      </form>
    </Dialog>
  )
}

function InvitationCard({
  code,
  onCreated,
}: {
  code?: string
  onCreated: (code: string) => void
}) {
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string>()
  const form = useForm({
    defaultValues: { email: '' },
    onSubmit: ({ value }) => invite.mutate(value.email),
  })
  const invite = useMutation({
    mutationFn: (email: string) =>
      apiRequest<{ email: string; code: string; expiresAt: string }>(
        '/api/auth/invitations',
        {
          method: 'POST',
          body: JSON.stringify({ email }),
        },
      ),
    onSuccess: (result) => {
      onCreated(result.code)
      setError(undefined)
    },
    onError: (caught) =>
      setError(caught instanceof Error ? caught.message : 'Unable to create invite.'),
  })
  const inviteUrl =
    code && typeof window !== 'undefined'
      ? `${window.location.origin}/setup?code=${encodeURIComponent(code)}`
      : undefined

  return (
    <Card>
      <CardHeader>
        <span className="grid size-10 place-items-center rounded-xl bg-blue-400/10 text-blue-300">
          <AtSign size={19} />
        </span>
        <h2 className="mt-4 font-semibold">Invite someone</h2>
        <p className="mt-1 text-sm leading-6 text-slate-500">
          Creates an email-bound, single-use setup link valid for 24 hours. Their planner
          will be completely isolated from yours.
        </p>
      </CardHeader>
      <CardContent>
        {error && (
          <p className="mb-3 rounded-xl bg-rose-400/10 p-3 text-rose-200">{error}</p>
        )}
        <form
          noValidate
          className="flex items-start gap-3"
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
                <Field className="min-w-0 flex-1" invalid={Boolean(validationError)}>
                  <FieldLabel className="sr-only" htmlFor="invite-email">
                    Email address
                  </FieldLabel>
                  <Input
                    id="invite-email"
                    type="email"
                    placeholder="person@example.com"
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
          <Button type="submit" disabled={invite.isPending}>
            Invite
          </Button>
        </form>
        {inviteUrl && (
          <div className="mt-4 rounded-xl border border-teal-400/20 bg-teal-400/5 p-3">
            <p className="break-all text-xs leading-5 text-teal-200">{inviteUrl}</p>
            <Button
              size="sm"
              variant="ghost"
              className="mt-2"
              onClick={() => {
                void navigator.clipboard.writeText(inviteUrl)
                setCopied(true)
              }}
            >
              <Copy size={15} /> {copied ? 'Copied' : 'Copy link'}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function Status({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 rounded-xl border border-slate-800 bg-slate-950/30 p-3">
      <span className="text-slate-400">{label}</span>
      <span className="font-medium text-slate-200">{value}</span>
    </div>
  )
}

function firstError(errors: unknown[]) {
  return errors.find(
    (error): error is string => typeof error === 'string' && error.length > 0,
  )
}
