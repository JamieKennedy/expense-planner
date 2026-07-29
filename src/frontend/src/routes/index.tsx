import { createFileRoute, redirect } from '@tanstack/react-router'
import { getRegistrationStatus } from '~/lib/api'

export const Route = createFileRoute('/')({
  beforeLoad: async () => {
    const registration = await getRegistrationStatus()
    throw redirect({ to: registration.available ? '/register' : '/dashboard' })
  },
})
