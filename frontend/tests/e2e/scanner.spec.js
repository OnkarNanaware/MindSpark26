import { test, expect } from '@playwright/test'

test.describe('Scanner page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/scan')
    await page.waitForLoadState('networkidle')
  })

  test('page loads with heading', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('Dependency Vulnerability Scanner')
  })

  test('npm tab is active by default showing package.json', async ({ page }) => {
    // eco.lang shows "JavaScript / Node.js selected" on default load
    await expect(page.locator('text=JavaScript / Node.js').first()).toBeVisible()
  })

  test('PyPI tab switches to Python ecosystem', async ({ page }) => {
    // Tab button text is exactly "PyPI" (e.label)
    await page.locator('button', { hasText: 'PyPI' }).first().click()
    await expect(page.locator('text=Python').first()).toBeVisible()
  })

  test('Maven tab switches to Java ecosystem', async ({ page }) => {
    await page.locator('button', { hasText: 'Maven' }).first().click()
    await expect(page.locator('text=Java').first()).toBeVisible()
  })

  test('Load example button fills textarea', async ({ page }) => {
    // Button text is "Load package.json example" (Load {eco.file} example)
    await page.locator('button', { hasText: 'Load package.json example' }).click()
    const textarea = page.locator('textarea')
    await expect(textarea).not.toBeEmpty()
    const val = await textarea.inputValue()
    expect(val).toContain('dependencies')
  })

  test('upload dropzone has correct role and tabindex', async ({ page }) => {
    const dropzone = page.locator('[role="button"][aria-label*="Upload dependency"]')
    await expect(dropzone).toBeVisible()
    await expect(dropzone).toHaveAttribute('tabindex', '0')
  })

  test('pasting JSON auto-detects npm and shows auto-detected badge', async ({ page }) => {
    await page.locator('textarea').fill('{"dependencies": {"express": "4.17.1", "lodash": "4.17.21"}}')
    // After paste, shows "auto-detected" badge
    await expect(page.locator('text=auto-detected')).toBeVisible()
    await expect(page.locator('text=JavaScript / Node.js detected').first()).toBeVisible()
  })

  test('severity guide shows all levels', async ({ page }) => {
    await expect(page.locator('text=SEVERITY GUIDE')).toBeVisible()
    await expect(page.locator('text=CRITICAL').first()).toBeVisible()
    await expect(page.locator('text=HIGH').first()).toBeVisible()
    await expect(page.locator('text=MEDIUM').first()).toBeVisible()
    await expect(page.locator('text=LOW').first()).toBeVisible()
  })

  test('trust microcopy is visible', async ({ page }) => {
    await expect(page.locator('text=never stored').first()).toBeVisible()
  })

  test('scan button is disabled when textarea is empty', async ({ page }) => {
    const btn = page.locator('button', { hasText: 'Scan & Detect Vulnerabilities' })
    await expect(btn).toBeDisabled()
  })

  test('scan button enables after pasting content', async ({ page }) => {
    await page.locator('textarea').fill('{"dependencies": {"express": "4.17.1"}}')
    const btn = page.locator('button', { hasText: 'Scan & Detect Vulnerabilities' })
    await expect(btn).toBeEnabled()
  })

  test('mobile: scanner stacks correctly', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'Mobile only')
    // On mobile scanner-right panel should be hidden
    await expect(page.locator('.scanner-right')).not.toBeVisible()
    // Scanner form should be visible
    await expect(page.locator('textarea')).toBeVisible()
  })
})
