import type { ComponentProps } from 'react'
import { AlertDialog as AlertDialogPrimitive } from 'radix-ui'
import { cn } from '~/lib/utils'
import { buttonClassName } from './button'

export const AlertDialog = AlertDialogPrimitive.Root
export const AlertDialogTrigger = AlertDialogPrimitive.Trigger

export function AlertDialogContent({
  className,
  ...props
}: ComponentProps<typeof AlertDialogPrimitive.Content>) {
  return (
    <AlertDialogPrimitive.Portal>
      <AlertDialogPrimitive.Overlay className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm" />
      <AlertDialogPrimitive.Content
        className={cn(
          'fixed left-1/2 top-1/2 z-[60] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-3xl border border-slate-700 bg-slate-900 p-6 shadow-2xl shadow-black/50 outline-none',
          className,
        )}
        {...props}
      />
    </AlertDialogPrimitive.Portal>
  )
}

export function AlertDialogTitle(
  props: ComponentProps<typeof AlertDialogPrimitive.Title>,
) {
  return (
    <AlertDialogPrimitive.Title
      className="text-lg font-semibold text-slate-100"
      {...props}
    />
  )
}

export function AlertDialogDescription(
  props: ComponentProps<typeof AlertDialogPrimitive.Description>,
) {
  return (
    <AlertDialogPrimitive.Description
      className="mt-2 text-sm leading-6 text-slate-400"
      {...props}
    />
  )
}

export function AlertDialogActions({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('mt-6 flex justify-end gap-3', className)} {...props} />
}

export function AlertDialogCancel(
  props: ComponentProps<typeof AlertDialogPrimitive.Cancel>,
) {
  return (
    <AlertDialogPrimitive.Cancel
      className={buttonClassName({ variant: 'secondary' })}
      {...props}
    />
  )
}

export function AlertDialogAction(
  props: ComponentProps<typeof AlertDialogPrimitive.Action>,
) {
  return (
    <AlertDialogPrimitive.Action
      className={buttonClassName({ variant: 'danger' })}
      {...props}
    />
  )
}
