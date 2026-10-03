import { test, expect } from '@playwright/test'

test.describe('Landing page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
  })

  test('hero title visible', async ({ page }) => {
    await expect(page.locator('h1').first()).toContainText('dependencies')
  })

  test('primary CTA navigates to scanner', async ({ page }) => {
    // Hero CTA: class lp-btn-hero, text "Scan Free — No Signup"
    await page.locator('.lp-btn-hero').first().click()
    await expect(page).toHaveURL(/\/scan/)
  })

  test('ghost CTA navigates to KB', async ({ page }) => {
    // Ghost button: "Learn the concepts →"
    await page.locator('.lp-btn-hero-ghost').first().click()
    await expect(page).toHaveURL(/\/learn/)
  })

  test('nav Features link visible', async ({ page, isMobile }) => {
    test.skip(isMobile, 'Desktop only — nav links are in hamburger menu on mobile')
    await expect(page.locator('a[href="#features"]')).toBeVisible()
  })

  test('nav How it works link visible', async ({ page, isMobile }) => {
    test.skip(isMobile, 'Desktop only — nav links are in hamburger menu on mobile')
    await expect(page.locator('a[href="#how-it-works"]')).toBeVisible()
  })

  test('GitHub repo link present in hero', async ({ page }) => {
    await expect(page.locator('a[href*="github.com/sky2194"]').first()).toBeVisible()
  })

  test('footer NVD button present', async ({ page }) => {
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
    await expect(page.locator('button').filter({ hasText: 'NVD' }).first()).toBeVisible()
  })

  test('footer OSV button present', async ({ page }) => {
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
    await expect(page.locator('button').filter({ hasText: 'OSV' }).first()).toBeVisible()
  })

  test('CTA band scan button navigates to scanner', async ({ page }) => {
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
    await page.locator('.lp-cta-band .lp-btn-hero').click()
    await expect(page).toHaveURL(/\/scan/)
  })

  test('mobile: hamburger opens menu', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'Mobile only')
    await page.locator('.lp-hamburger').click()
    await expect(page.locator('.lp-mobile-menu')).toBeVisible()
  })

  test('mobile: hamburger menu links work', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'Mobile only')
    await page.locator('.lp-hamburger').click()
    await expect(page.locator('.lp-mobile-link').first()).toBeVisible()
  })
})
