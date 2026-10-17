/**
 * 交互冒烟测试：用 CDP 直接驱动真实浏览器，验证页面里“看不见的 JS 逻辑”。
 *   npm run check:ui
 *
 * 覆盖：灯箱打开 / 键盘翻页 / ESC 关闭 / 焦点还原、移动端抽屉菜单、
 *       图库按钮与拖拽、订阅表单校验与成功态、计数器、页面无 JS 报错。
 * 同时输出 state-*.png 作为交互状态截图。
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
  results.push({ name, ok: Boolean(condition), detail: detail === undefined ? '' : String(detail) });
  console.log(`${condition ? '✓' : '✗'} ${name}${condition ? '' : '  → ' + detail}`);
}

async function pressKey(browser, key, code, windowsVirtualKeyCode) {
  await browser.send('Input.dispatchKeyEvent', {
    type: 'keyDown',
    key,
    code,
    windowsVirtualKeyCode,
    nativeVirtualKeyCode: windowsVirtualKeyCode,
  });
  await browser.send('Input.dispatchKeyEvent', {
    type: 'keyUp',
    key,
    code,
    windowsVirtualKeyCode,
    nativeVirtualKeyCode: windowsVirtualKeyCode,
  });
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
      (params.exceptionDetails && params.exceptionDetails.exception && params.exceptionDetails.exception.description) ||
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
  await sleep(1600); /* 等英雄区入场动画与计数器跑完 */

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
  check('灯箱正文可访问性状态正确', lightboxState.ariaHidden === 'false' && lightboxState.locked);
  check('灯箱加载了正确的图片', /col-spotted\.jpg$/.test(lightboxState.src), lightboxState.src);
  check('灯箱焦点已移入弹层', lightboxState.focusedInside);
  await browser.screenshot(join(shotsDir, 'state-lightbox.png'));

  await pressKey(browser, 'ArrowRight', 'ArrowRight', 39);
  await sleep(220);
  const nextCount = await browser.evaluate(
    `document.querySelector('[data-lightbox-count]').textContent`
  );
  check('方向键可以翻到下一张', nextCount.trim() === '02 / 09', nextCount);

  await pressKey(browser, 'Escape', 'Escape', 27);
  await sleep(550);
  const closed = await browser.evaluate(`(function () {
    var lb = document.getElementById('lightbox');
    return {
      hidden: lb.hidden,
      locked: document.body.classList.contains('is-locked'),
      focusBack: document.activeElement && document.activeElement.hasAttribute('data-lightbox')
    };
  })()`);
  check('ESC 可以关闭灯箱并解锁滚动', closed.hidden && !closed.locked, JSON.stringify(closed));
  check('关闭后焦点回到触发元素', closed.focusBack);

  /* ---------- 2. 移动端菜单 ---------- */
  await browser.setViewport({ width: 390, height: 844, mobile: true });
  await browser.navigate(pageUrl);
  await browser.waitForImages();
  await sleep(600);
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
  check('菜单焦点锁定在面板内', menuState.focusInside);
  await browser.screenshot(join(shotsDir, 'state-menu.png'));

  await pressKey(browser, 'Escape', 'Escape', 27);
  await sleep(650);
  const menuClosed = await browser.evaluate(
    `document.querySelector('[data-menu]').classList.contains('is-open')`
  );
  check('ESC 可以关闭菜单', !menuClosed);

  /* ---------- 3. 订阅表单 ---------- */
  await browser.setViewport({ width: 1440, height: 900 });
  await browser.navigate(pageUrl);
  await browser.waitForImages();
  await sleep(500);

  await browser.evaluate(`(function () {
    var form = document.querySelector('[data-signup]');
    var input = form.querySelector('input[type="email"]');
    form.requestSubmit();
    return true;
  })()`);
  await sleep(200);
  const invalidMsg = await browser.evaluate(
    `document.querySelector('.form-msg').textContent`
  );
  check('空邮箱会被拦截', invalidMsg.length > 0, invalidMsg);

  await browser.evaluate(`(function () {
    var form = document.querySelector('[data-signup]');
    var input = form.querySelector('input[type="email"]');
    input.value = 'not-an-email';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    form.requestSubmit();
    return true;
  })()`);
  await sleep(200);
  const invalidMsg2 = await browser.evaluate(
    `document.querySelector('.form-msg').textContent`
  );
  check('错误邮箱会给出提示', /incomplete|email/i.test(invalidMsg2), invalidMsg2);

  await browser.evaluate(`(function () {
    var form = document.querySelector('[data-signup]');
    var input = form.querySelector('input[type="email"]');
    input.value = 'petal@example.com';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    form.requestSubmit();
    document.getElementById('signup').scrollIntoView({ block: 'center', behavior: 'instant' });
    return true;
  })()`);
  await sleep(1100);
  const signupState = await browser.evaluate(`(function () {
    var form = document.querySelector('[data-signup]');
    return {
      doneHidden: form.querySelector('[data-signup-done]').hidden,
      fieldsHidden: form.querySelector('[data-signup-fields]').hidden,
      email: form.querySelector('[data-signup-email]').textContent,
      fineprint: Boolean(form.querySelector('.signup__fineprint'))
    };
  })()`);
  check('合法邮箱提交成功', !signupState.doneHidden && signupState.fieldsHidden, JSON.stringify(signupState));
  check('成功态显示了填写的邮箱', signupState.email === 'petal@example.com', signupState.email);
  await sleep(300);
  await browser.screenshot(join(shotsDir, 'state-signup.png'));

  /* ---------- 4. 图库按钮与拖拽 ---------- */
  await browser.evaluate(`(function () {
    var section = document.getElementById('archive');
    section.scrollIntoView({ block: 'center', behavior: 'instant' });
    return true;
  })()`);
  await sleep(400);
  const beforeArchive = await browser.evaluate(
    `document.querySelector('[data-archive-viewport]').scrollLeft`
  );
  await browser.evaluate(`document.querySelector('[data-archive-next]').click(); true`);
  await sleep(1100);
  const afterButton = await browser.evaluate(
    `document.querySelector('[data-archive-viewport]').scrollLeft`
  );
  check('图库“下一张”按钮可以滚动', afterButton > beforeArchive, `${beforeArchive} → ${afterButton}`);

  const dragTarget = await browser.evaluate(`(function () {
    var el = document.querySelector('[data-archive-viewport]');
    el.scrollIntoView({ block: 'center', behavior: 'instant' });
    var rect = el.getBoundingClientRect();
    return {
      x: rect.left + rect.width * 0.68,
      y: rect.top + rect.height * 0.5,
      before: el.scrollLeft
    };
  })()`);
  await sleep(300);
  const points = [];
  for (let i = 0; i <= 10; i += 1) {
    points.push({ x: dragTarget.x - i * 22, y: dragTarget.y });
  }
  await mouseDrag(browser, points);
  await sleep(450);
  const afterDrag = await browser.evaluate(`(function () {
    var el = document.querySelector('[data-archive-viewport]');
    return {
      scrollLeft: el.scrollLeft,
      dragging: el.classList.contains('is-dragging'),
      lightboxOpen: !document.getElementById('lightbox').hidden
    };
  })()`);
  check(
    '拖拽图库会横向滚动',
    afterDrag.scrollLeft > dragTarget.before + 40,
    JSON.stringify({ before: dragTarget.before, after: afterDrag.scrollLeft })
  );
  check('拖拽后不会误开灯箱', !afterDrag.lightboxOpen && !afterDrag.dragging);

  /* ---------- 5. 计数器 & 错误 ---------- */
  await browser.evaluate('window.scrollTo(0, 0); true');
  await sleep(600);
  const facts = await browser.evaluate(
    `Array.prototype.map.call(document.querySelectorAll('.fact__value'), function (el) { return el.textContent.trim(); }).join('|')`
  );
  check('计数器显示最终值', /12\|48\|4\.9/.test(facts), facts);
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
