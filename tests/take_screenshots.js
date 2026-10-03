const { chromium } = require('playwright')
const fs = require('fs')

const OUT = '/tmp/da_screenshots'
fs.mkdirSync(OUT, { recursive: true })

const NPM_MANIFEST = `{
  "name": "test-app",
  "version": "1.0.0",
  "dependencies": {
    "lodash": "4.17.11",
    "express": "4.17.1",
    "axios": "0.21.1"
  }
}`

const PYPI_MANIFEST = `Django==3.2.0\nrequests==2.27.0\nPillow==9.0.0\nFlask==2.0.1`

const MAVEN_MANIFEST = `<project>
  <modelVersion>4.0.0</modelVersion>
  <groupId>com.example</groupId>
  <artifactId>demo-app</artifactId>
  <version>1.0.0</version>
  <dependencies>
    <dependency>
      <groupId>log4j</groupId>
      <artifactId>log4j</artifactId>
      <version>1.2.17</version>
    </dependency>
    <dependency>
      <groupId>commons-collections</groupId>
      <artifactId>commons-collections</artifactId>
      <version>3.2.1</version>
    </dependency>
  </dependencies>
</project>`

async function runScan(page, manifest, tabText) {
  await page.goto('https://www.depanalyzer.com/scan', { waitUntil: 'networkidle' })
  await page.waitForTimeout(1000)
  // Click the correct ecosystem tab
  const tab = page.locator(`text=${tabText}`).first()
  if (await tab.isVisible()) await tab.click()
  await page.waitForTimeout(500)
  // Fill textarea
  const textarea = page.locator('textarea').first()
  await textarea.fill(manifest)
  await page.waitForTimeout(300)
  // Click scan button
  await page.locator('button:has-text("Scan")').first().click()
  // Wait for results (up to 60s)
  await page.waitForURL('**/results**', { timeout: 60000 }).catch(() => {})
  await page.waitForTimeout(3000)
}

;(async () => {
  const browser = await chromium.launch()
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await ctx.newPage()

  // 1. Landing page
  await page.goto('https://www.depanalyzer.com', { waitUntil: 'networkidle' })
  await page.waitForTimeout(1000)
  await page.screenshot({ path: `${OUT}/01_landing.png` })
  console.log('✓ Landing')

  // 2. Scanner page (npm tab)
  await page.goto('https://www.depanalyzer.com/scan', { waitUntil: 'networkidle' })
  await page.waitForTimeout(1000)
  await page.screenshot({ path: `${OUT}/02_scanner.png` })
  console.log('✓ Scanner')

  // 3. npm scan results
  await runScan(page, NPM_MANIFEST, 'npm')
  await page.screenshot({ path: `${OUT}/03_results_npm.png` })
  console.log('✓ npm Results')

  // 4. Scroll down to see CVE list
  await page.evaluate(() => window.scrollBy(0, 400))
  await page.waitForTimeout(500)
  await page.screenshot({ path: `${OUT}/04_results_npm_cve.png` })
  console.log('✓ npm CVE list')

  // 5. Maven scan — KEV + Critical CVEs
  await runScan(page, MAVEN_MANIFEST, 'Maven')
  await page.screenshot({ path: `${OUT}/05_results_maven.png` })
  console.log('✓ Maven Results (KEV)')

  // 6. PyPI scan
  await runScan(page, PYPI_MANIFEST, 'PyPI')
  await page.screenshot({ path: `${OUT}/06_results_pypi.png` })
  console.log('✓ PyPI Results')

  // 7. Graph tab — go back to npm scan
  await runScan(page, NPM_MANIFEST, 'npm')
  const graphBtn = page.locator('button:has-text("Graph"), [data-tab="graph"], text=Graph').first()
  if (await graphBtn.isVisible()) {
    await graphBtn.click()
    await page.waitForTimeout(1500)
  }
  await page.screenshot({ path: `${OUT}/07_graph.png` })
  console.log('✓ Dependency Graph')

  await browser.close()
  console.log(`\nAll screenshots saved to ${OUT}`)
})()
