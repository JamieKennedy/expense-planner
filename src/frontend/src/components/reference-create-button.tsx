import { useForm } from '@tanstack/react-form'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Check, Plus } from 'lucide-react'
import { useState } from 'react'
import { ColourPicker, randomTagColour } from '~/components/colour-picker'
import { Button } from '~/components/ui/button'
import { Dialog } from '~/components/ui/dialog'
import { Field, FieldError, FieldLabel } from '~/components/ui/field'
import { Input } from '~/components/ui/input'
import { apiRequest, type ReferenceData, type ReferenceItem } from '~/lib/api'

export type ReferenceKind = 'accounts' | 'contributors' | 'tags'

export function ReferenceCreateButton({
  kind,
  onCreated,
}: {
  kind: ReferenceKind
  onCreated: (item: ReferenceItem) => void
}) {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string>()
  const singular = kind === 'contributors' ? 'contributor' : kind.slice(0, -1)
  const form = useForm({
    defaultValues: {
      name: '',
      colour: randomTagColour(),
    },
    onSubmit: ({ value }) => save.mutate(value),
  })
  const save = useMutation({
    mutationFn: (value: { name: string; colour: string }) =>
      apiRequest<ReferenceItem>(`/api/${kind}`, {
        method: 'POST',
        body: JSON.stringify(
          kind === 'tags'
            ? { name: value.name, colour: value.colour }
            : { name: value.name },
        ),
      }),
    onSuccess: (created) => {
      queryClient.setQueriesData<ReferenceData>(
        { queryKey: ['reference-data'] },
        (current) =>
          current
            ? {
                ...current,
                [kind]: [...current[kind], created],
              }
            : current,
      )
      onCreated(created)
      setError(undefined)
      setOpen(false)
      form.reset()
      form.setFieldValue('colour', randomTagColour())
      void queryClient.invalidateQueries({ queryKey: ['reference-data'] })
    },
    onError: (caught) =>
      setError(
        caught instanceof Error ? caught.message : `Unable to create ${singular}.`,
      ),
  })

  if (!open) {
    return (
      <Button
        type="button"
        size="sm"
        variant="ghost"
        className="h-8 px-2 text-xs text-teal-300"
        onClick={() => setOpen(true)}
      >
        <Plus size={14} /> New {singular}
      </Button>
    )
  }

  function close() {
    setOpen(false)
    setError(undefined)
    form.reset()
    form.setFieldValue('colour', randomTagColour())
  }

  const fields = (
    <>
      {error && (
        <p role="alert" className="rounded-lg bg-rose-400/10 p-2 text-xs text-rose-200">
          {error}
        </p>
      )}
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
              <FieldLabel htmlFor={`inline-${kind}-name`}>Name</FieldLabel>
              <Input
                id={`inline-${kind}-name`}
                autoFocus
                value={field.state.value}
                aria-invalid={Boolean(validationError) || undefined}
                onBlur={field.handleBlur}
                onChange={(event) => field.handleChange(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    void form.handleSubmit()
                  }
                }}
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
      <Button
        type="button"
        size="sm"
        disabled={save.isPending}
        onClick={() => void form.handleSubmit()}
      >
        <Check size={15} />
        {save.isPending ? 'Adding…' : `Add ${singular}`}
      </Button>
    </>
  )

  return (
    <Dialog
      open
      title={`Add ${singular}`}
      description={
        kind === 'tags'
          ? 'Create a category and choose how it appears throughout your planner.'
          : 'Names must be unique among active items in your planner.'
      }
      onClose={close}
    >
      <div className="grid gap-5">{fields}</div>
    </Dialog>
  )
}

function firstError(errors: unknown[]) {
  return errors.find(
    (error): error is string => typeof error === 'string' && error.length > 0,
  )
}
