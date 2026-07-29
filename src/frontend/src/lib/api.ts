import { createServerFn } from '@tanstack/react-start'
import { getRequest, setResponseHeaders } from '@tanstack/react-start/server'

export type Session = {
  userId: string
  plannerId: string
  email: string
}

export type RegistrationStatus = {
  available: boolean
}

export type SecurityStatus = {
  mfaEnabled: boolean
}

export type MfaEnrollment = {
  challengeId: string
  sharedKey: string
  authenticatorUri: string
}

export type ReferenceItem = {
  id: string
  name: string
  isArchived: boolean
  colour?: string
  isOwner: boolean
}

export type ReferenceData = {
  accounts: ReferenceItem[]
  contributors: ReferenceItem[]
  tags: ReferenceItem[]
}

export type ContributorShare = {
  contributorId: string
  basisPoints: number
  allocatedPence?: number
}

export type Expense = {
  id: string
  name: string
  amountPence: number
  attributedAmountPence: number
  accountId: string
  accountName: string
  frequency: 'monthly' | 'weekly' | null
  scheduleAnchorDate: string | null
  dayOfMonth: number | null
  nominalDate: string
  dueDate: string
  moveToNextWorkingDay: boolean
  tagIds: string[]
  contributorShares: ContributorShare[]
}

export type IncomeItem = {
  id: string
  name: string
  amountPence: number
  accountId: string
  accountName: string
  dayOfMonth: number
  dueDate: string
  moveToNextWorkingDay: boolean
}

export type BudgetLine = {
  id: string
  name: string
  allowancePence: number
  tagId: string
  contributorShares: ContributorShare[]
}

export type BudgetTemplate = {
  id: string
  lines: BudgetLine[]
}

export type ExpensePage = {
  items: Expense[]
  page: number
  pageSize: number
  totalCount: number
  totalAmountPence: number
}

export type MonthlyOverview = {
  month: string
  projectedIncomePence: number
  projectedExpensesPence: number
  projectedNetPence: number
  contributorCosts: Array<{
    id: string
    name: string
    amountPence: number
  }>
  accountCosts: Array<{
    id: string
    name: string
    amountPence: number
  }>
  tagCosts: Array<{
    id: string
    name: string
    amountPence: number
  }>
  budgetLines: Array<{
    id: string
    name: string
    tagId: string
    tagName: string
    allowancePence: number
    projectedExpensesPence: number
    remainingPence: number
  }>
  budgetContributions: Array<{
    id: string
    name: string
    amountPence: number
  }>
}

type ProblemDetails = {
  title?: string
  detail?: string
  status?: number
  errors?: Record<string, string[]>
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly problem?: ProblemDetails,
  ) {
    super(message)
  }
}

function csrfToken() {
  if (typeof document === 'undefined') return undefined
  return document.cookie
    .split('; ')
    .find((part) => part.startsWith('expense-csrf='))
    ?.split('=')
    .slice(1)
    .join('=')
}

async function parseResponse<T>(response: Response): Promise<T> {
  if (response.ok) {
    if (response.status === 204) return undefined as T
    return (await response.json()) as T
  }

  let problem: ProblemDetails | undefined
  try {
    problem = (await response.json()) as ProblemDetails
  } catch {
    problem = undefined
  }
  throw new ApiError(
    problem?.detail ?? problem?.title ?? `Request failed (${response.status})`,
    response.status,
    problem,
  )
}

export async function apiRequest<T>(
  path: string,
  init: RequestInit = {},
  retry = true,
): Promise<T> {
  const method = (init.method ?? 'GET').toUpperCase()
  const headers = new Headers(init.headers)
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    const csrf = csrfToken()
    if (csrf) headers.set('X-CSRF-Token', decodeURIComponent(csrf))
  }

  const response = await fetch(path, {
    ...init,
    headers,
    credentials: 'include',
  })
  if (
    response.status === 401 &&
    retry &&
    !path.startsWith('/api/auth/login') &&
    !path.startsWith('/api/auth/mfa') &&
    !path.startsWith('/api/auth/setup')
  ) {
    const refreshed = await fetch('/api/auth/refresh', {
      method: 'POST',
      credentials: 'include',
    })
    if (refreshed.ok) return apiRequest<T>(path, init, false)
  }
  return parseResponse<T>(response)
}

async function forwardSessionRequest() {
  const request = getRequest()
  const internalUrl = process.env.API_INTERNAL_URL ?? 'http://localhost:5080'
  const cookie = request.headers.get('cookie') ?? ''
  let response = await fetch(`${internalUrl}/api/auth/session`, {
    headers: { cookie },
  })

  if (response.status === 401 && cookie.includes('expense_refresh=')) {
    const refreshed = await fetch(`${internalUrl}/api/auth/refresh`, {
      method: 'POST',
      headers: { cookie },
    })
    if (refreshed.ok) {
      const responseHeaders = new Headers()
      const headersWithCookies = refreshed.headers as Headers & {
        getSetCookie?: () => string[]
      }
      const setCookies = headersWithCookies.getSetCookie?.() ?? []
      for (const value of setCookies) {
        responseHeaders.append('Set-Cookie', value)
      }
      if ([...responseHeaders].length > 0) setResponseHeaders(responseHeaders)
      const rotatedCookie =
        setCookies.map((value) => value.split(';', 1)[0]).join('; ') || cookie
      response = await fetch(`${internalUrl}/api/auth/session`, {
        headers: { cookie: rotatedCookie },
      })
    }
  }

  return response.ok ? ((await response.json()) as Session) : null
}

export const getSession = createServerFn({ method: 'GET' }).handler(forwardSessionRequest)

async function registrationStatusRequest() {
  const internalUrl = process.env.API_INTERNAL_URL ?? 'http://localhost:5080'
  const response = await fetch(`${internalUrl}/api/auth/registration`)
  return response.ok
    ? ((await response.json()) as RegistrationStatus)
    : { available: false }
}

export const getRegistrationStatus = createServerFn({ method: 'GET' }).handler(
  registrationStatusRequest,
)
