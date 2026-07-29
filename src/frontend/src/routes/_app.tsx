import { createFileRoute, redirect } from '@tanstack/react-router'
import { AppShell } from '~/components/app-shell'
import { getSession } from '~/lib/api'

export const Route = createFileRoute('/_app')({
  beforeLoad: async ({ location }) => {
    const session = await getSession()
    if (!session) {
      throw redirect({
        to: '/login',
        search: { redirect: location.href },
      })
    }
    return { session }
  },
  component: ProtectedLayout,
})

function ProtectedLayout() {
  const { session } = Route.useRouteContext()
  return <AppShell session={session} />
}
