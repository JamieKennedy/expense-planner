import type { HTMLAttributes, LabelHTMLAttributes, ReactNode } from 'react'
import { cn } from '~/lib/utils'

export function Field({
  className,
  invalid,
  ...props
}: HTMLAttributes<HTMLDivElement> & { invalid?: boolean }) {
  return (
    <div
      role="group"
      data-invalid={invalid || undefined}
      className={cn('grid gap-2', className)}
      {...props}
    />
  )
}

export function FieldLabel({
  className,
  ...props
}: LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label className={cn('text-sm font-medium text-slate-300', className)} {...props} />
  )
}

export function FieldDescription({
  className,
  ...props
}: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn('text-xs leading-5 text-slate-500', className)} {...props} />
}

export function FieldError({
  children,
  className,
  ...props
}: HTMLAttributes<HTMLParagraphElement> & {
  children?: ReactNode
}) {
  if (!children) return null
  return (
    <p
      role="alert"
      className={cn('text-xs leading-5 text-rose-300', className)}
      {...props}
    >
      {children}
    </p>
  )
}

export function fieldError(errors: Array<string | undefined>) {
  return errors.find((error): error is string => Boolean(error))
}
