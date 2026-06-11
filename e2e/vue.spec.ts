import { test, expect } from '@playwright/test'

test('shows the scoreboard header', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('h1')).toContainText('Matchday')
})
