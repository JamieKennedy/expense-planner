import { expect, test } from '@playwright/test'

test.describe.configure({ mode: 'serial' })

test('shows first-owner registration on an empty database', async ({ page }) => {
  await page.goto('/')
  await expect(
    page.getByRole('heading', { name: 'Register the first owner' }),
  ).toBeVisible()
  await expect(page.getByLabel('Email address')).toBeVisible()
  await expect(page.getByText('First-run setup')).toBeVisible()
})

test('redirects sign-in to registration while there are no users', async ({ page }) => {
  await page.goto('/login')
  await expect(page).toHaveURL(/\/register/)
  await expect(
    page.getByRole('heading', { name: 'Register the first owner' }),
  ).toBeVisible()
})

test('creates the first owner without MFA and opens the dashboard', async ({ page }) => {
  await page.goto('/register')
  await page.waitForLoadState('networkidle')
  await page.getByLabel('Email address').fill('password-only@example.com')
  await page.getByRole('button', { name: 'Continue securely' }).click()

  await expect(page.getByRole('heading', { name: 'Secure your planner' })).toBeVisible()
  const mfaChoice = page.getByRole('checkbox', {
    name: 'Enable authenticator MFA',
  })
  await expect(mfaChoice).toBeChecked()
  await mfaChoice.click()
  await expect(
    page.getByText('This account will use password-only sign-in.'),
  ).toBeVisible()
  await expect(page.getByLabel('Six-digit code')).toHaveCount(0)

  await page.getByLabel('New password').fill('a sufficiently long password')
  await page.getByLabel('Confirm password').fill('a sufficiently long password')
  await page.getByRole('button', { name: 'Complete setup' }).click()

  await expect(page).toHaveURL(/\/dashboard/)
  await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible()
})
