import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
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
import { PageHeading } from '~/components/page-heading'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import { Card, CardContent, CardHeader } from '~/components/ui/card'
import { Dialog } from '~/components/ui/dialog'
import { Field, Input } from '~/components/ui/input'
import { apiRequest, type ReferenceData, type ReferenceItem } from '~/lib/api'

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
  const references = useQuery({
    queryKey: ['reference-data', 'all'],
    queryFn: () => apiRequest<ReferenceData>('/api/reference-data?includeArchived=true'),
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
        <Card>
          <CardHeader>
            <span className="grid size-10 place-items-center rounded-xl bg-teal-400/10 text-teal-300">
              <ShieldCheck size={19} />
            </span>
            <h2 className="mt-4 font-semibold">Security</h2>
            <p className="mt-1 text-sm leading-6 text-slate-500">
              This planner requires password and TOTP verification. Refresh sessions
              rotate automatically and are revoked if a used token appears again.
            </p>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 text-sm">
              <Status label="Multi-factor authentication" value="Required" />
              <Status label="Access session" value="15 minutes" />
              <Status label="Refresh session" value="30 days" />
              <Status label="Cookie policy" value="HttpOnly · Strict" />
            </div>
            <p className="mt-5 text-xs leading-5 text-slate-500">
              Account recovery is handled by the administrator CLI. It revokes all
              existing sessions before issuing a one-time setup code.
            </p>
          </CardContent>
        </Card>
      </section>
      {editing && (
        <ReferenceDialog
          key={`${editing.kind}-${editing.item?.id ?? 'new'}`}
          kind={editing.kind}
          item={editing.item}
          onClose={() => setEditing(undefined)}
        />
      )}
    </div>
  )
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
      <CardHeader className="flex-row items-start justify-between">
        <div>
          <span className="grid size-10 place-items-center rounded-xl bg-slate-800 text-teal-300">
            <Icon size={19} />
          </span>
          <h2 className="mt-4 font-semibold">{title}</h2>
          <p className="mt-1 text-sm text-slate-500">{description}</p>
        </div>
        <Button
          size="icon"
          variant="secondary"
          onClick={onAdd}
          aria-label={`Add ${kind}`}
        >
          <Plus size={17} />
        </Button>
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
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => onArchive(item.id)}
                    aria-label={`Archive ${item.name}`}
                  >
                    <Archive size={15} />
                  </Button>
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
  const [name, setName] = useState(item?.name ?? '')
  const [colour, setColour] = useState(item?.colour ?? '#2dd4bf')
  const [error, setError] = useState<string>()
  const save = useMutation({
    mutationFn: () =>
      apiRequest(item ? `/api/${kind}/${item.id}` : `/api/${kind}`, {
        method: item ? 'PUT' : 'POST',
        body: JSON.stringify(kind === 'tags' ? { name, colour } : { name }),
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
        className="grid gap-5"
        onSubmit={(event) => {
          event.preventDefault()
          save.mutate()
        }}
      >
        {error && <p className="rounded-xl bg-rose-400/10 p-3 text-rose-200">{error}</p>}
        <Field label="Name">
          <Input
            autoFocus
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </Field>
        {kind === 'tags' && (
          <Field label="Display colour">
            <div className="grid grid-cols-[4rem_1fr] gap-3">
              <Input
                type="color"
                value={colour}
                className="p-1"
                onChange={(event) => setColour(event.target.value)}
              />
              <Input
                value={colour}
                pattern="^#[0-9a-fA-F]{6}$"
                onChange={(event) => setColour(event.target.value)}
              />
            </div>
          </Field>
        )}
        <Button type="submit" disabled={save.isPending || !name.trim()}>
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
  const [email, setEmail] = useState('')
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string>()
  const invite = useMutation({
    mutationFn: () =>
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
          className="flex gap-3"
          onSubmit={(event) => {
            event.preventDefault()
            invite.mutate()
          }}
        >
          <Input
            type="email"
            required
            placeholder="person@example.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
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
