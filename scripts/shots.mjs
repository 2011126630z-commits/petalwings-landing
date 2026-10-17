/**
 * 出多尺寸截图作为交付证据（Edge / Chrome 无头模式 + CDP，不安装依赖）。
 *   npm run shots
 *
 * 全页截图流程：
 *   1. 先按固定视口加载页面（截图模式 ?no-anim=1&shot=1 会把 vh 区块固定）；
 *   2. 量出 scrollHeight，把视口高度精确设置为内容高度；
 *   3. 等图片 decode / 字体就绪，再截“视口”就是整页。
 * 这样不会出现 --screenshot 那种多出来的 24×92px 浏览器边框。
 */
import { existsSync, mkdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { launchBrowser, sleep } from './cdp.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const pageUrl = pathToFileURL(join(root, 'index.html')).href;
const outDir = join(root, 'shots');

const SHOTS = [
  { name: 'desktop-hero-1440', width: 1440, height: 1000 },
  { name: 'desktop-full-1440', width: 1440, full: true },
  { name: 'tablet-full-834', width: 834, full: true },
  { name: 'mobile-hero-390', width: 390, height: 844, mobile: true },
  { name: 'mobile-full-390', width: 390, full: true, mobile: true },
];

function pngSize(file) {
  const buffer = readFileSync(file);
  if (buffer.length < 24 || buffer.toString('ascii', 1, 4) !== 'PNG') return null;
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

function contentHeight(browser) {
  return browser.evaluate(
    'Math.max(document.body.scrollHeight, document.documentElement.scrollHeight)'
  );
}

mkdirSync(outDir, { recursive: true });

const browser = await launchBrowser();
const failures = [];

try {
  for (const shot of SHOTS) {
    const file = join(outDir, `${shot.name}.png`);

    await browser.setViewport({
      width: shot.width,
      height: shot.height || 900,
      mobile: Boolean(shot.mobile),
    });
    await browser.navigate(pageUrl + '?no-anim=1&shot=1');
    await browser.waitForImages();
    await sleep(250);

    if (shot.full) {
      /* 视口先拉高到内容高度，让所有懒加载图和 IntersectionObserver 都稳定下来 */
      let height = await contentHeight(browser);
      for (let attempt = 0; attempt < 4; attempt += 1) {
        await browser.setViewport({ width: shot.width, height, mobile: Boolean(shot.mobile) });
        await sleep(300);
        await browser.waitForImages();
        const next = await contentHeight(browser);
        if (Math.abs(next - height) <= 2) break;
        height = next;
      }
      await browser.evaluate('window.scrollTo(0, 0); true');
      await sleep(200);
      await browser.screenshot(file);
      console.log(`· ${shot.name} 内容高度 ${height}px`);
    } else {
      await browser.screenshot(file);
    }

    if (!existsSync(file)) {
      failures.push(`${shot.name}: 没有生成截图`);
      continue;
    }
    const size = pngSize(file);
    const expected = shot.full ? null : shot.height;
    const okHeight = !shot.full || (size && Math.abs(size.height - (shot.height || size.height)) <= 0);
    if (!size) {
      failures.push(`${shot.name}: 不是有效的 PNG`);
      continue;
    }
    console.log(
      `✓ ${shot.name.padEnd(18)} ${size.width}x${size.height}  ` +
        `${(statSync(file).size / 1024).toFixed(0)} KB`
    );
    if (expected && size.height !== expected) {
      failures.push(`${shot.name}: 截图高度 ${size.height}，预期 ${expected}`);
    }
    if (okHeight && size.width !== shot.width) {
      failures.push(`${shot.name}: 截图宽度 ${size.width}，预期 ${shot.width}`);
    }
  }
} finally {
  await browser.close();
}

/* 清理失败时可能残留的临时帧文件 */
for (const shot of SHOTS) {
  rmSync(join(outDir, `.frame-${shot.name}.html`), { force: true });
}

if (failures.length > 0) {
  console.error('\n截图失败：');
  for (const line of failures) console.error('  ' + line);
  process.exit(1);
}

console.log(`\n完成：${SHOTS.length} 张截图已写入 shots/`);
