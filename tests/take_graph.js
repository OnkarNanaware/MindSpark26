const { chromium } = require('playwright')

const NPM_MANIFEST = `{"name":"test-app","version":"1.0.0","dependencies":{"lodash":"4.17.11","express":"4.17.1","axios":"0.21.1"}}`

;(async () => {
  const browser = await chromium.launch()
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await ctx.newPage()

  await page.goto('https://www.depanalyzer.com/scan', { waitUntil: 'networkidle' })
  await page.waitForTimeout(1000)
  const textarea = page.locator('textarea').first()
  await textarea.fill(NPM_MANIFEST)
  await page.locator('button:has-text("Scan")').first().click()
  await page.waitForURL('**/results**', { timeout: 60000 }).catch(() => {})
  await page.waitForTimeout(3000)

  // Click Dependency Graph tab
  await page.getByText('Dependency Graph').click()
  await page.waitForTimeout(2000)
  await page.screenshot({ path: '/tmp/da_screenshots/07_graph.png' })
  console.log('✓ Dependency Graph')

  await browser.close()
})()
