import { test, expect } from '@playwright/test'

test.describe('Knowledge Base', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/learn')
    await page.waitForLoadState('networkidle')
  })

  test('page loads with Knowledge Base heading', async ({ page }) => {
    await expect(page.locator('h1, h2').filter({ hasText: 'Knowledge Base' }).first()).toBeVisible()
  })

  test('SCA section is shown by default', async ({ page }) => {
    await expect(page.locator('h2, h3').filter({ hasText: /What is SCA/i }).first()).toBeVisible()
  })

  test('clicking EPSS + KEV sidebar button shows that section', async ({ page, isMobile }) => {
    test.skip(isMobile, 'Desktop only — mobile uses select picker')
    await page.locator('.learn-sidebar button', { hasText: 'EPSS + KEV' }).click()
    await expect(page.locator('h2, h3').filter({ hasText: /EPSS/i }).first()).toBeVisible()
  })

  test('clicking Risk Score Explained shows that section', async ({ page, isMobile }) => {
    test.skip(isMobile, 'Desktop only — mobile uses select picker')
    await page.locator('.learn-sidebar button', { hasText: 'Risk Score Explained' }).click()
    await expect(page.locator('h2, h3').filter({ hasText: /Risk Score/i }).first()).toBeVisible()
  })

  test('clicking Dependency Mediation shows that section', async ({ page, isMobile }) => {
    test.skip(isMobile, 'Desktop only — mobile uses select picker')
    await page.locator('.learn-sidebar button', { hasText: 'Dependency Mediation' }).click()
    await expect(page.locator('h2, h3').filter({ hasText: /Mediation/i }).first()).toBeVisible()
  })

  test('clicking Transitive CVE Paths shows that section', async ({ page, isMobile }) => {
    test.skip(isMobile, 'Desktop only — mobile uses select picker')
    await page.locator('.learn-sidebar button', { hasText: 'Transitive CVE Paths' }).click()
    await expect(page.locator('h2, h3').filter({ hasText: /Transitive/i }).first()).toBeVisible()
  })

  test('mobile: select picker replaces sidebar', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'Mobile only')
    await expect(page.locator('select')).toBeVisible()
    // Sidebar should be hidden on mobile
    await expect(page.locator('.learn-sidebar')).not.toBeVisible()
  })
})
