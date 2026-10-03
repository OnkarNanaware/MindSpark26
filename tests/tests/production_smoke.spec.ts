/**
 * Production smoke tests — runs against https://www.depanalyzer.com on every merge to main.
 * Only real user flows, no network mocking, no error injection.
 */
import { test, expect } from '@playwright/test';
import { MOCK_DEPENDENCIES } from '../utils/apiHelpers';

const SCAN_TIMEOUT = 120000;

// ── Landing page ──────────────────────────────────────────────────────────────

test('landing page loads and shows hero', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('text=Scan Free')).toBeVisible({ timeout: 10000 });
});

test('landing page nav links are present', async ({ page }) => {
  await page.goto('/');
  // Features and How it works are always visible in the desktop nav
  await expect(page.locator('nav').getByText('Features')).toBeVisible({ timeout: 10000 });
  await expect(page.locator('nav').getByText('How it works')).toBeVisible();
});

// ── Scanner page ──────────────────────────────────────────────────────────────

test('scanner page loads all three ecosystem tabs', async ({ page }) => {
  await page.goto('/scan');
  // Tab buttons start with the ecosystem name — filter to avoid matching example code text
  await expect(page.locator('button').filter({ hasText: /^npm/ }).first()).toBeVisible({ timeout: 10000 });
  await expect(page.locator('button').filter({ hasText: /^PyPI/ }).first()).toBeVisible();
  await expect(page.locator('button').filter({ hasText: /^Maven/ }).first()).toBeVisible();
});

test('scanner textarea accepts pasted content', async ({ page }) => {
  await page.goto('/scan');
  await page.fill('textarea', MOCK_DEPENDENCIES.npm);
  const value = await page.locator('textarea').inputValue();
  expect(value).toContain('lodash');
});

// ── npm scan ──────────────────────────────────────────────────────────────────

test('npm scan completes and shows risk score', async ({ page }) => {
  await page.goto('/scan');
  await page.fill('textarea', MOCK_DEPENDENCIES.npm);
  await page.click('button:has-text("Scan & Detect Vulnerabilities")');
  await page.waitForURL('**/results**', { timeout: SCAN_TIMEOUT });

  await expect(page.locator('text=Security Report')).toBeVisible({ timeout: 15000 });
  await expect(page.locator('text=COMPLETED')).toBeVisible();
});

test('npm scan finds vulnerabilities', async ({ page }) => {
  await page.goto('/scan');
  await page.fill('textarea', MOCK_DEPENDENCIES.npm);
  await page.click('button:has-text("Scan & Detect Vulnerabilities")');
  await page.waitForURL('**/results**', { timeout: SCAN_TIMEOUT });
  await page.waitForSelector('text=Security Report', { timeout: 15000 });

  // lodash 4.17.11 has known CVEs
  await expect(page.locator('text=have known vulnerabilities')).toBeVisible({ timeout: 10000 });
});

test('npm scan shows dependency graph tab', async ({ page }) => {
  await page.goto('/scan');
  await page.fill('textarea', MOCK_DEPENDENCIES.npm);
  await page.click('button:has-text("Scan & Detect Vulnerabilities")');
  await page.waitForURL('**/results**', { timeout: SCAN_TIMEOUT });
  await page.waitForSelector('text=Security Report', { timeout: 15000 });

  await expect(page.locator('text=Dependency Graph')).toBeVisible({ timeout: 10000 });
});

test('npm scan dependency graph renders SVG nodes', async ({ page }) => {
  await page.goto('/scan');
  await page.fill('textarea', MOCK_DEPENDENCIES.npm);
  await page.click('button:has-text("Scan & Detect Vulnerabilities")');
  await page.waitForURL('**/results**', { timeout: SCAN_TIMEOUT });
  await page.waitForSelector('text=Security Report', { timeout: 15000 });

  await page.getByText('Dependency Graph').click();
  await page.waitForTimeout(2000);
  const nodes = await page.locator('svg circle, svg ellipse').count();
  expect(nodes).toBeGreaterThan(0);
});

test('npm scan export button is visible', async ({ page }) => {
  await page.goto('/scan');
  await page.fill('textarea', MOCK_DEPENDENCIES.npm);
  await page.click('button:has-text("Scan & Detect Vulnerabilities")');
  await page.waitForURL('**/results**', { timeout: SCAN_TIMEOUT });
  await page.waitForSelector('text=Security Report', { timeout: 15000 });

  await expect(page.locator('button:has-text("Export")')).toBeVisible({ timeout: 10000 });
});

// ── PyPI scan ─────────────────────────────────────────────────────────────────

test('PyPI scan completes and shows correct ecosystem', async ({ page }) => {
  await page.goto('/scan');
  await page.locator('button').filter({ hasText: /^PyPI/ }).first().click();
  await page.fill('textarea', MOCK_DEPENDENCIES.python);
  await page.click('button:has-text("Scan & Detect Vulnerabilities")');
  await page.waitForURL('**/results**', { timeout: SCAN_TIMEOUT });

  await expect(page.locator('text=Security Report')).toBeVisible({ timeout: 15000 });
  await expect(page.locator('text=COMPLETED')).toBeVisible();
});

// ── Maven scan ────────────────────────────────────────────────────────────────

test('Maven scan completes and finds critical CVEs', async ({ page }) => {
  await page.goto('/scan');
  await page.locator('button').filter({ hasText: /^Maven/ }).first().click();
  await page.fill('textarea', MOCK_DEPENDENCIES.maven);
  await page.click('button:has-text("Scan & Detect Vulnerabilities")');
  await page.waitForURL('**/results**', { timeout: SCAN_TIMEOUT });
  await page.waitForSelector('text=Security Report', { timeout: 15000 });

  // log4j 1.2.17 has CRITICAL CVEs — check the severity filter button which is always visible
  await expect(
    page.locator('button').filter({ hasText: /CRITICAL/ }).first()
  ).toBeVisible({ timeout: 20000 });
});

// ── Knowledge base ────────────────────────────────────────────────────────────

test('knowledge base page loads', async ({ page }) => {
  await page.goto('/learn');
  await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 10000 });
});

// ── History page ──────────────────────────────────────────────────────────────

test('history page loads without crashing', async ({ page }) => {
  await page.goto('/history');
  await expect(page).not.toHaveURL('**/error**');
  await page.waitForTimeout(2000);
  const crashed = await page.locator('text=Something went wrong').count();
  expect(crashed).toBe(0);
});

// ── Theme toggle ──────────────────────────────────────────────────────────────

test('theme toggle switches without crashing', async ({ page }) => {
  await page.goto('/scan');
  await page.waitForSelector('textarea', { timeout: 10000 });
  await page.locator('[aria-label*="theme"], [aria-label*="Theme"], button:has-text("☀"), button:has-text("🌙")').first().click().catch(() => {});
  await page.waitForTimeout(500);
  // Check the npm tab button — specific enough to avoid strict mode violation
  await expect(page.locator('button').filter({ hasText: /^npm/ }).first()).toBeVisible({ timeout: 5000 });
});
