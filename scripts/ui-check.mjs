/**
 * 交互冒烟测试：用 CDP 驱动真实浏览器验证页面里的 JS 逻辑。
 *   npm run check:ui
 *
 * 覆盖：灯箱打开 / 键盘翻页 / ESC 关闭 / 焦点还原、
 *       目的地轮播按钮 + 拖拽、移动端抽屉菜单、页面无 JS 报错。
 * 同时输出 shots/state-*.png 作为交互状态截图。
 */
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { launchBrowser, sleep } from './cdp.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const pageUrl = pathToFileURL(join(root, 'index.html')).href;
const shotsDir = join(root, 'shots');
mkdirSync(shotsDir, { recursive: true });

const results = [];
function check(name, condition, detail) {
  results.push({
    name,
    ok: Boolean(condition),
    detail: detail === undefined ? '' : String(detail),
  });
  console.log(`${condition ? '✓' : '✗'} ${name}${condition ? '' : '  → ' + detail}`);
}

async function pressKey(browser, key, code, windowsVirtualKeyCode) {
  const params = {
    key,
    code,
    windowsVirtualKeyCode,
    nativeVirtualKeyCode: windowsVirtualKeyCode,
  };
  await browser.send('Input.dispatchKeyEvent', { ...params, type: 'keyDown' });
  await browser.send('Input.dispatchKeyEvent', { ...params, type: 'keyUp' });
}

async function mouseDrag(browser, points) {
  const start = points[0];
  await browser.send('Input.dispatchMouseEvent', {
    type: 'mousePressed',
    x: start.x,
    y: start.y,
    button: 'left',
    buttons: 1,
    clickCount: 1,
  });
  for (let i = 1; i < points.length; i += 1) {
    await browser.send('Input.dispatchMouseEvent', {
      type: 'mouseMoved',
      x: points[i].x,
      y: points[i].y,
      button: 'left',
      buttons: 1,
    });
    await sleep(16);
  }
  const end = points[points.length - 1];
  await browser.send('Input.dispatchMouseEvent', {
    type: 'mouseReleased',
    x: end.x,
    y: end.y,
    button: 'left',
    buttons: 0,
    clickCount: 1,
  });
}

const browser = await launchBrowser();
const pageErrors = [];

try {
  browser.on('Runtime.exceptionThrown', (params) => {
    const detail =
      (params.exceptionDetails &&
        params.exceptionDetails.exception &&
        params.exceptionDetails.exception.description) ||
      (params.exceptionDetails && params.exceptionDetails.text) ||
      'unknown';
    pageErrors.push(detail);
  });
  browser.on('Log.entryAdded', (params) => {
    if (params.entry && params.entry.level === 'error') pageErrors.push(params.entry.text);
  });

  await browser.setViewport({ width: 1440, height: 900 });
  await browser.navigate(pageUrl);
  await browser.waitForImages();
  await sleep(1400);

  /* ---------- 1. 灯箱 ---------- */
  await browser.evaluate(`document.querySelector('[data-lightbox]').click(); true`);
  await sleep(450);

  const lightboxState = await browser.evaluate(`(function () {
    var lb = document.getElementById('lightbox');
    var img = lb.querySelector('[data-lightbox-img]');
    return {
      hidden: lb.hidden,
      open: lb.classList.contains('is-open'),
      ariaHidden: lb.getAttribute('aria-hidden'),
      locked: document.body.classList.contains('is-locked'),
      src: img.getAttribute('src') || '',
      count: lb.querySelector('[data-lightbox-count]').textContent,
      focusedInside: lb.contains(document.activeElement)
    };
  })()`);
  check('灯箱可以打开', !lightboxState.hidden && lightboxState.open, JSON.stringify(lightboxState));
  check('灯箱可访问性状态正确', lightboxState.ariaHidden === 'false' && lightboxState.locked);
  check('灯箱加载了正确的图片', /flower-white-silk\.jpg$/.test(lightboxState.src), lightboxState.src);
  check('灯箱焦点已移入弹层', lightboxState.focusedInside);
  check('灯箱计数正确（01 / 06）', lightboxState.count.trim() === '01 / 06', lightboxState.count);
  await browser.screenshot(join(shotsDir, 'state-lightbox.png'));

  await pressKey(browser, 'ArrowRight', 'ArrowRight', 39);
  await sleep(200);
  const nextCount = await browser.evaluate(
    `document.querySelector('[data-lightbox-count]').textContent`
  );
  check('方向键可以翻到下一张', nextCount.trim() === '02 / 06', nextCount);

  await pressKey(browser, 'Escape', 'Escape', 27);
  await sleep(520);
  const closed = await browser.evaluate(`(function () {
    var lb = document.getElementById('lightbox');
    return {
      hidden: lb.hidden,
      locked: document.body.classList.contains('is-locked'),
      focusBack: document.activeElement && document.activeElement.hasAttribute('data-lightbox')
    };
  })()`);
  check('ESC 关闭灯箱并解锁滚动', closed.hidden && !closed.locked, JSON.stringify(closed));
  check('关闭后焦点回到触发元素', closed.focusBack);

  /* ---------- 2. 目的地轮播 ---------- */
  await browser.evaluate(`(function () {
    document.getElementById('destinations').scrollIntoView({ block: 'start', behavior: 'instant' });
    return true;
  })()`);
  await sleep(500);
  await browser.screenshot(join(shotsDir, 'state-carousel.png'));

  const carouselStart = await browser.evaluate(`(function () {
    var vp = document.querySelector('[data-carousel-viewport]');
    return {
      scrollLeft: vp.scrollLeft,
      prevDisabled: document.querySelector('[data-carousel-prev]').disabled,
      nextDisabled: document.querySelector('[data-carousel-next]').disabled
    };
  })()`);
  check('轮播初始状态正确', carouselStart.scrollLeft === 0 && carouselStart.prevDisabled && !carouselStart.nextDisabled, JSON.stringify(carouselStart));

  await browser.evaluate(`document.querySelector('[data-carousel-next]').click(); true`);
  await sleep(1100);
  const afterNext = await browser.evaluate(`(function () {
    var vp = document.querySelector('[data-carousel-viewport]');
    return {
      scrollLeft: vp.scrollLeft,
      prevDisabled: document.querySelector('[data-carousel-prev]').disabled,
      lightboxHidden: document.getElementById('lightbox').hidden
    };
  })()`);
  check('“下一组”按钮可以翻页', afterNext.scrollLeft > 100, afterNext.scrollLeft);
  check('翻页后“上一组”按钮可用', !afterNext.prevDisabled);
  check('翻页不会意外打开灯箱', afterNext.lightboxHidden);

  await browser.evaluate(`document.querySelector('[data-carousel-prev]').click(); true`);
  await sleep(1100);
  const afterPrev = await browser.evaluate(
    `document.querySelector('[data-carousel-viewport]').scrollLeft`
  );
  check('“上一组”按钮可以回到开头', afterPrev < 50, afterPrev);

  const dragTarget = await browser.evaluate(`(function () {
    var el = document.querySelector('[data-carousel-viewport]');
    el.scrollIntoView({ block: 'center', behavior: 'instant' });
    var rect = el.getBoundingClientRect();
    return {
      x: rect.left + rect.width * 0.72,
      y: rect.top + rect.height * 0.55,
      before: el.scrollLeft
    };
  })()`);
  await sleep(300);
  const points = [];
  for (let i = 0; i <= 12; i += 1) {
    points.push({ x: dragTarget.x - i * 24, y: dragTarget.y });
  }
  await mouseDrag(browser, points);
  await sleep(250);
  const afterDrag = await browser.evaluate(`(function () {
    var vp = document.querySelector('[data-carousel-viewport]');
    return {
      scrollLeft: vp.scrollLeft,
      dragging: vp.classList.contains('is-dragging'),
      lightboxHidden: document.getElementById('lightbox').hidden
    };
  })()`);
  check(
    '拖拽轮播可以横向滚动',
    afterDrag.scrollLeft > dragTarget.before + 60,
    JSON.stringify({ before: dragTarget.before, after: afterDrag.scrollLeft })
  );
  check('拖拽结束没有误开灯箱', afterDrag.lightboxHidden && !afterDrag.dragging);

  /* ---------- 3. 移动端菜单 ---------- */
  await browser.setViewport({ width: 390, height: 844, mobile: true });
  await browser.navigate(pageUrl);
  await browser.waitForImages();
  await sleep(700);

  await browser.evaluate(`document.querySelector('[data-menu-toggle]').click(); true`);
  await sleep(500);
  const menuState = await browser.evaluate(`(function () {
    var menu = document.querySelector('[data-menu]');
    var toggle = document.querySelector('[data-menu-toggle]');
    return {
      open: menu.classList.contains('is-open'),
      ariaHidden: menu.getAttribute('aria-hidden'),
      expanded: toggle.getAttribute('aria-expanded'),
      locked: document.body.classList.contains('is-locked'),
      focusInside: document.querySelector('.menu__panel').contains(document.activeElement)
    };
  })()`);
  check('移动端菜单可以打开', menuState.open && menuState.ariaHidden === 'false');
  check('菜单按钮 aria-expanded 同步', menuState.expanded === 'true');
  check('菜单焦点在面板内', menuState.focusInside);
  await browser.screenshot(join(shotsDir, 'state-menu.png'));

  await pressKey(browser, 'Escape', 'Escape', 27);
  await sleep(600);
  const menuClosed = await browser.evaluate(
    `document.querySelector('[data-menu]').classList.contains('is-open')`
  );
  check('ESC 可以关闭菜单', !menuClosed);

  /* ---------- 4. 错误收集 ---------- */
  check('页面运行期间没有 JS 报错', pageErrors.length === 0, pageErrors.join(' | '));
} finally {
  await browser.close();
}

const failed = results.filter((item) => !item.ok);
console.log(`\n${results.length - failed.length}/${results.length} 项通过`);
if (failed.length > 0) {
  console.error('失败项：' + failed.map((item) => item.name).join('、'));
  process.exit(1);
}
