const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { chromium } = require('playwright-core');
const Module = require('node:module');

async function main() {
  const vault = fs.mkdtempSync(path.join(os.tmpdir(), 'print-browser-'));
  let browser;
  try {
    fs.writeFileSync(path.join(vault, 'A.md'), '# Long equation\n\n$$' + Array(45).fill('x_{n}^{2}').join('+') + '$$\n\n![[pixel.png]]\n\n| A | B |\n|---|---|\n| 1 | 2 |\n\n```js\nconsole.log("hello");\n```');
    fs.writeFileSync(path.join(vault, 'B.md'), 'SECOND_NOTE_CONTENT');
    fs.writeFileSync(path.join(vault, 'pixel.png'), Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64'));
    const original = fs.readFileSync(path.join(vault, 'A.md'), 'utf8');
    const source = path.join(vault, 'preview.html');
    // Exercise the distributed Obsidian bundle through its export service.
    const originalLoad = Module._load;
    class Plugin {
      async loadData() { return {}; }
      addCommand() {} addRibbonIcon() {} registerEvent() {}
    }
    Module._load = function(id, ...args) {
      if (id === 'obsidian') return { Plugin, Modal: class {} };
      if (id === 'electron') return { shell: { openPath: async () => '' } };
      return originalLoad.call(this, id, ...args);
    };
    let PrintPlugin;
    try { PrintPlugin = require('../main.js'); } finally { Module._load = originalLoad; }
    const plugin = new PrintPlugin();
    plugin.app = { workspace: { getActiveFile: () => null, on() {} } };
    await plugin.onload();
    plugin.exportService.write({ vault, files: ['A.md', 'B.md'], compact: false, noteBreaks: true }, source);
    browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || (fs.existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : chromium.executablePath()), headless: true, args: ['--no-sandbox'] });
    const context = await browser.newContext({ offline: true, viewport: { width: 1280, height: 960 } });
    const page = await context.newPage();
    const errors = [], external = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    await page.route(/^https?:/, route => { external.push(route.request().url()); return route.abort(); });
    await page.setContent(fs.readFileSync(source, 'utf8'));
    await page.waitForFunction(() => document.body.dataset.ready === 'true');
    assert.equal(await page.locator('.note').count(), 2);
    assert.equal(await page.inputValue('#format-fontSize'), '11');
    assert.equal(await page.locator('#format-noteBreaks').isChecked(), true);
    assert.equal(await page.locator('table').count(), 1);
    assert.equal(await page.locator('pre').count(), 1);
    assert.equal(await page.locator('img').evaluate(e => e.complete && e.naturalWidth > 0), true);
    const equationSize = () => page.locator('.katex-display').evaluate(e => parseFloat(e.style.fontSize));
    const narrow = await equationSize();
    assert.ok(narrow > 0 && narrow < 100);
    await page.selectOption('#format-orientation', 'landscape');
    await page.waitForFunction(() => document.body.dataset.ready === 'true');
    assert.ok(await equationSize() > narrow);
    await page.selectOption('#preset', 'academic');
    assert.equal(await page.inputValue('#format-fontSize'), '12');
    await page.fill('#format-fontSize', '14');
    assert.equal(await page.inputValue('#preset'), '');
    assert.ok(Math.abs(await page.locator('.print-document').evaluate(e => parseFloat(getComputedStyle(e).fontSize)) - 18.6667) < 0.1);
    const lastAppliedStyles = await page.textContent('#document-styles');
    await page.fill('#format-fontSize', '');
    assert.equal(await page.inputValue('#format-fontSize'), '');
    assert.equal(await page.textContent('#document-styles'), lastAppliedStyles);
    assert.match(await page.textContent('#format-status'), /between 8 and 24/);
    await page.fill('#format-fontSize', '14');
    await page.fill('#format-fontSize', '99');
    assert.match(await page.textContent('#format-status'), /between 8 and 24/);
    await page.fill('#format-fontSize', '14');
    for (const [key, value] of Object.entries({ lineHeight: '1.8', marginTop: '18', marginRight: '19', marginBottom: '20', marginLeft: '21', headingScale: '1.2', imageHeight: '100' })) await page.fill('#format-' + key, value);
    await page.selectOption('#format-font', 'sans');
    await page.selectOption('#format-paper', 'Letter');
    await page.selectOption('#format-orientation', 'landscape');
    await page.uncheck('#format-noteBreaks');
    const css = await page.textContent('#document-styles');
    assert.match(css, /size:Letter landscape;margin:18mm 19mm 20mm 21mm/);
    assert.match(css, /font:14pt\/1.8 Arial/);
    assert.match(css, /font-size:25.2pt/);
    assert.match(css, /max-height:100mm/);
    await page.click('#reset-format');
    assert.equal(await page.inputValue('#format-fontSize'), '11');
    assert.equal(await page.inputValue('#format-orientation'), 'portrait');
    assert.equal(await page.locator('#format-noteBreaks').isChecked(), true);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForFunction(() => document.body.dataset.ready === 'true');
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
    await page.emulateMedia({ media: 'print' });
    await page.evaluate(() => window.dispatchEvent(new Event('beforeprint')));
    await page.emulateMedia({ media: 'screen' });
    await page.evaluate(() => {
      // Force a stale print-sized equation to verify the afterprint lifecycle.
      document.querySelector('.katex-display').style.fontSize = '100%';
      window.dispatchEvent(new Event('afterprint'));
    });
    await page.waitForFunction(() => document.body.dataset.ready === 'true');
    assert.ok(await equationSize() < 100);
    await page.setViewportSize({ width: 1280, height: 960 });
    await page.selectOption('#preset', 'academic');
    await page.waitForFunction(() => document.body.dataset.ready === 'true');
    if (process.env.PRINT_SCREENSHOT) await page.screenshot({ path: process.env.PRINT_SCREENSHOT, fullPage: true });
    await page.evaluate(() => { window.print = () => { window.__prints = (window.__prints || 0) + 1; window.__printReady = document.body.dataset.ready; }; });
    await page.locator('#print').evaluate(button => { button.click(); button.click(); });
    await page.waitForFunction(() => window.__prints === 1);
    assert.equal(await page.evaluate(() => window.__printReady), 'true');
    await page.emulateMedia({ media: 'print' });
    assert.equal(await page.locator('.toolbar').evaluate(e => getComputedStyle(e).display), 'none');
    assert.equal(await page.locator('.note + .note').evaluate(e => getComputedStyle(e).breakBefore), 'page');
    const pdf = await page.pdf({ preferCSSPageSize: true, printBackground: true });
    assert.ok(pdf.length > 1000);
    if (process.env.PRINT_PDF) fs.writeFileSync(process.env.PRINT_PDF, pdf);
    assert.deepEqual(external, []);
    assert.deepEqual(errors, []);
    const cli = path.join(vault, 'cli.html');
    execFileSync(process.execPath, ['convert.cjs', '--vault', vault, '--out', cli]);
    await page.emulateMedia({ media: 'screen' });
    await page.setContent(fs.readFileSync(cli, 'utf8'));
    await page.waitForFunction(() => document.body.dataset.ready === 'true');
    await page.selectOption('#preset', 'comfortable');
    assert.equal(await page.inputValue('#format-fontSize'), '11');
    assert.equal(fs.readFileSync(path.join(vault, 'A.md'), 'utf8'), original);
    assert.equal(fs.readFileSync(source, 'utf8').includes('Changes apply to this open preview only'), true);
    console.log('PASS: offline Chromium controls, presets, reset, validation, math refitting, responsive layout, print/PDF and distributed Obsidian/CLI bundles');
  } finally {
    if (browser) await browser.close();
    fs.rmSync(vault, { recursive: true, force: true });
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
