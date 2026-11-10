#!/usr/bin/env node
// A browser for the first-time-user walkthrough (gate/walkthrough.md): the walker sees what a person would see
// (the visible text and a numbered list of things to press), never the code.
//
//   node walk.mjs start <page.html|url> [--width 390]   open the page, print what's on screen
//   node walk.mjs look                                  print it again
//   node walk.mjs click <n> | type <n> <text> | select <n> <option> | press <key> | back
//   node walk.mjs stop                                  close, print how many steps it took
import { spawn } from 'node:child_process';
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const STATE = join(tmpdir(), 'frontend-rails-walk.json');
const [cmd, ...rest] = process.argv.slice(2);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Runs inside the page: numbers every control a person could use and returns the screen as text.
function screen() {
  const visible = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden'; };
  for (const el of document.querySelectorAll('[data-walk]')) el.removeAttribute('data-walk');
  const modal = document.querySelector('dialog:modal'); // a modal blocks everything behind it
  const scope = modal || document.body;
  const controls = [...scope.querySelectorAll('a[href], button, input:not([type="hidden"]), select, textarea, summary, [role="button"], [role="tab"], [role="menuitem"], [role="option"], [role="switch"], [tabindex]:not([tabindex="-1"])')]
    .filter((el) => visible(el) && !el.disabled);
  const lines = controls.map((el, i) => {
    el.setAttribute('data-walk', i + 1);
    const kind = el.tagName === 'A' ? 'link' : el.getAttribute('role') || (el.tagName === 'INPUT' ? `input ${el.type}` : el.tagName.toLowerCase());
    const label = (el.getAttribute('aria-label') || el.labels?.[0]?.innerText || el.innerText || el.placeholder || el.querySelector('img[alt]')?.alt || el.title || '').trim().replace(/\s+/g, ' ').slice(0, 60);
    const value = 'value' in el && el.value && !/button|submit|checkbox|radio/.test(el.type) ? ` = "${String(el.value).slice(0, 40)}"` : '';
    const on = el.checked || el.getAttribute('aria-selected') === 'true' || el.getAttribute('aria-expanded') === 'true' ? ' (on)' : '';
    return `[${i + 1}] ${kind} ${label ? `"${label}"` : '(no label)'}${value}${on}`;
  });
  return `${document.title} — ${location.href}\n\nON SCREEN${modal ? ' (dialog)' : ''}\n${scope.innerText.trim().replace(/\n{2,}/g, '\n').slice(0, 2500)}\n\nYOU CAN USE\n${lines.join('\n') || '(nothing)'}`;
}

if (cmd === 'serve') {
  const [target, width] = rest;
  const { chromium } = await import('playwright');
  let browser;
  try { browser = await chromium.launch(); } catch { browser = await chromium.launch({ channel: 'chrome' }); }
  const page = await browser.newPage({ viewport: { width: +width, height: 900 } });
  await page.goto(/^https?:\/\//.test(target) ? target : pathToFileURL(resolve(target)).href);
  let steps = 0, idle;
  const quit = async () => { rmSync(STATE, { force: true }); await browser.close(); process.exit(0); };
  const act = async ([name, n, ...words]) => {
    const el = page.locator(`[data-walk="${n}"]`);
    if (name === 'click') await el.click({ timeout: 3000 });
    else if (name === 'type') await el.fill(words.join(' '), { timeout: 3000 });
    else if (name === 'select') await el.selectOption({ label: words.join(' ') }, { timeout: 3000 });
    else if (name === 'press') await page.keyboard.press(n);
    else if (name === 'back') await page.goBack();
    else if (name !== 'look') return `unknown command: ${name}`;
    if (name !== 'look') { steps++; await page.waitForTimeout(400); }
    return `${name === 'look' ? '' : `step ${steps}: ${[name, n, ...words].filter(Boolean).join(' ')}\n\n`}${await page.evaluate(screen)}`;
  };
  const server = createServer(async (req, res) => {
    let body = '';
    for await (const chunk of req) body += chunk;
    clearTimeout(idle);
    idle = setTimeout(quit, 15 * 60 * 1000);
    const args = JSON.parse(body);
    if (args[0] === 'stop') { res.end(`walk ended after ${steps} steps`); return quit(); }
    try { res.end(await act(args)); } catch (e) { res.end(`COULD NOT ${args.join(' ')}: ${e.message.split('\n')[0]}\n\n${await page.evaluate(screen)}`); }
  });
  server.listen(0, '127.0.0.1', () => writeFileSync(STATE, JSON.stringify({ port: server.address().port })));
} else {
  const send = async (args) => {
    if (!existsSync(STATE)) { console.log('no walk in progress. Start one: node walk.mjs start <page.html|url>'); process.exit(2); }
    const { port } = JSON.parse(readFileSync(STATE, 'utf8'));
    const res = await fetch(`http://127.0.0.1:${port}`, { method: 'POST', body: JSON.stringify(args) });
    console.log(await res.text());
  };
  if (cmd === 'start') {
    const w = rest.indexOf('--width');
    const width = w >= 0 ? rest[w + 1] : '1280';
    const target = rest.find((a, i) => !a.startsWith('--') && rest[i - 1] !== '--width');
    if (!target) { console.log('usage: node walk.mjs start <page.html|url> [--width 390]'); process.exit(2); }
    rmSync(STATE, { force: true });
    spawn(process.execPath, [fileURLToPath(import.meta.url), 'serve', target, width], { detached: true, stdio: 'ignore' }).unref();
    for (let i = 0; i < 100 && !existsSync(STATE); i++) await sleep(200);
    await send(['look']);
  } else if (['look', 'click', 'type', 'select', 'press', 'back', 'stop'].includes(cmd)) await send([cmd, ...rest]);
  else console.log('usage: node walk.mjs start <page.html|url> [--width 390] | look | click <n> | type <n> <text> | select <n> <option> | press <key> | back | stop');
}
