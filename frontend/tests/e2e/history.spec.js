import { test, expect } from '@playwright/test'

test.describe('History page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/history')
    await page.waitForLoadState('networkidle')
  })

  test('page loads with Scan History heading', async ({ page }) => {
    await expect(page.locator('h1').filter({ hasText: 'Scan History' })).toBeVisible()
  })

  test('empty state shown when localStorage is empty', async ({ page }) => {
    await page.evaluate(() => localStorage.removeItem('depanalyzer_projects'))
    await page.reload()
    await page.waitForLoadState('networkidle')
    await expect(page.locator('text=No scan history yet')).toBeVisible()
  })

  test('page does not crash on delete', async ({ page }) => {
    // Inject a realistic scan into localStorage matching the app's data structure
    await page.evaluate(() => {
      const scan = {
        id: 'test-' + Date.now(),
        project_name: 'test-app',
        scanned_at: new Date().toISOString(),
        ecosystem: 'npm',
        summary: {
          total_packages: 10,
          vulnerable_packages: 2,
          critical: 1,
          high: 1,
          medium: 0,
          low: 0,
          risk_score: 55
        },
        vulnerabilities: []
      }
      const projects = [{ name: 'test-app', scans: [scan] }]
      localStorage.setItem('depanalyzer_projects', JSON.stringify(projects))
    })
    await page.reload()
    await page.waitForLoadState('networkidle')

    // Find and click delete button (×)
    const deleteBtn = page.locator('button').filter({ hasText: '×' }).first()
    if (await deleteBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await deleteBtn.click()
      // Confirm if dialog appears
      const confirm = page.locator('button').filter({ hasText: 'Delete' }).first()
      if (await confirm.isVisible({ timeout: 2000 }).catch(() => false)) {
        await confirm.click()
      }
    }

    // Page must not crash
    await expect(page.locator('text=Something went wrong')).not.toBeVisible()
    await expect(page.locator('h1').filter({ hasText: 'Scan History' })).toBeVisible()
  })
})
