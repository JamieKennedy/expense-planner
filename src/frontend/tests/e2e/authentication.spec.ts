import { expect, test } from '@playwright/test'

test('shows the invite-only two-step sign-in', async ({ page }) => {
  await page.goto('/login')
  await expect(
    page.getByRole('heading', { name: 'Sign in to your planner' }),
  ).toBeVisible()
  await expect(page.getByLabel('Email address')).toBeVisible()
  await expect(page.getByLabel('Password')).toBeVisible()
  await expect(page.getByText('Invite only')).toBeVisible()
})

test('redirects an anonymous dashboard request to sign-in', async ({ page }) => {
  await page.goto('/dashboard')
  await expect(page).toHaveURL(/\/login/)
  await expect(
    page.getByRole('heading', { name: 'Sign in to your planner' }),
  ).toBeVisible()
})
