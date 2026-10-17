/**
 * 极简 CDP（Chrome DevTools Protocol）客户端，仅供开发脚本使用。
 * 不安装任何依赖：用 Node 22+ 内置的全局 WebSocket + fetch 直连无头浏览器。
 *
 * 为什么不用 `--screenshot`？
 *   headless=new 下 `--window-size` 会把窗口外框的 24×92px 也算进去，
 *   截出来的图会比真实视口大一圈（深色区块右侧/底部会露出纸色边）。
 *   走 CDP 的 Emulation.setDeviceMetricsOverride + Page.captureScreenshot
 *   才能拿到“视口即截图”的精确尺寸。
 */
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const BROWSER_CANDIDATES = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
];

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function findBrowser() {
  const found = process.env.PETALWINGS_BROWSER || BROWSER_CANDIDATES.find((path) => existsSync(path));
  if (!found) {
    throw new Error(
      '未找到 Edge / Chrome。可通过环境变量 PETALWINGS_BROWSER 指定浏览器可执行文件路径。'
    );
  }
  return found;
}

export async function launchBrowser() {
  const exe = findBrowser();
  const profileDir = mkdtempSync(join(tmpdir(), 'petalwings-cdp-'));
  const child = spawn(
    exe,
    [
      '--headless=new',
      '--disable-gpu',
      '--hide-scrollbars',
      '--no-first-run',
      '--no-default-browser-check',
      '--remote-debugging-port=0',
      '--allow-file-access-from-files',
      `--user-data-dir=${profileDir}`,
      'about:blank',
    ],
    { stdio: ['ignore', 'pipe', 'pipe'] }
  );

  let stderr = '';
  const browserWsUrl = await new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error('等待 DevTools 端口超时。\n' + stderr)),
      20000
    );
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
      const match = stderr.match(/DevTools listening on (ws:\/\/\S+)/);
      if (match) {
        clearTimeout(timer);
        resolve(match[1]);
      }
    });
    child.on('exit', (code) => {
      clearTimeout(timer);
      reject(new Error(`浏览器提前退出（exit ${code}）。\n${stderr}`));
    });
  });

  /* ws://127.0.0.1:PORT/devtools/browser/... → http://127.0.0.1:PORT */
  const browserUrl = new URL(browserWsUrl);
  const origin = `http://${browserUrl.host}`;
  const targets = await (await fetch(origin + '/json/list')).json();
  const target = targets.find((item) => item.type === 'page') || targets[0];
  if (!target) throw new Error('没有找到可控制的页面目标。');

  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true });
    ws.addEventListener('error', () => reject(new Error('CDP WebSocket 连接失败。')), { once: true });
  });

  let nextId = 0;
  const pending = new Map();
  const handlers = new Map();

  ws.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    if (typeof message.id === 'number') {
      const entry = pending.get(message.id);
      if (!entry) return;
      pending.delete(message.id);
      if (message.error) entry.reject(new Error(message.error.message || 'CDP 调用失败'));
      else entry.resolve(message.result);
      return;
    }
    if (!message.method) return;
    const list = handlers.get(message.method);
    if (!list) return;
    list.slice().forEach((handler) => handler(message.params));
  });

  function on(method, handler) {
    if (!handlers.has(method)) handlers.set(method, []);
    handlers.get(method).push(handler);
    return function off() {
      const list = handlers.get(method);
      if (!list) return;
      const index = list.indexOf(handler);
      if (index >= 0) list.splice(index, 1);
    };
  }

  function once(method, timeout = 20000) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        off();
        reject(new Error('等待事件超时：' + method));
      }, timeout);
      const off = on(method, (params) => {
        clearTimeout(timer);
        off();
        resolve(params);
      });
    });
  }

  async function send(method, params = {}) {
    const id = ++nextId;
    const promise = new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject });
    });
    ws.send(JSON.stringify({ id, method, params }));
    return promise;
  }

  async function evaluate(expression, awaitPromise = true) {
    const result = await send('Runtime.evaluate', {
      expression,
      awaitPromise,
      returnByValue: true,
      userGesture: true,
    });
    if (result.exceptionDetails) {
      const detail =
        (result.exceptionDetails.exception && result.exceptionDetails.exception.description) ||
        result.exceptionDetails.text;
      throw new Error('页面脚本执行失败：' + detail);
    }
    return result.result ? result.result.value : undefined;
  }

  async function setViewport({ width, height, mobile = false }) {
    await send('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor: 1,
      mobile,
      screenWidth: width,
      screenHeight: height,
      screenOrientation: { type: 'portraitPrimary', angle: 0 },
    });
  }

  async function navigate(url) {
    const loaded = once('Page.loadEventFired');
    await send('Page.navigate', { url });
    await loaded;
  }

  /** 等所有图片 decode + 字体就绪，避免截到半张图。
      注意跳过 src 为空的占位图（灯箱里那张），否则它的 load 事件永远不触发。 */
  async function waitForImages() {
    await evaluate(`(function () {
      var images = Array.prototype.slice.call(document.images).filter(function (img) {
        return img.getAttribute('src');
      });
      var ready = Promise.all(images.map(function (img) {
        if (img.complete) {
          return img.decode ? img.decode().catch(function () {}) : Promise.resolve();
        }
        return new Promise(function (resolve) {
          img.addEventListener('load', resolve, { once: true });
          img.addEventListener('error', resolve, { once: true });
        }).then(function () {
          return img.decode ? img.decode().catch(function () {}) : undefined;
        });
      }));
      var guard = new Promise(function (resolve) { setTimeout(resolve, 8000); });
      return Promise.race([ready, guard]).then(function () { return images.length; });
    })()`);
    await evaluate(
      'document.fonts && document.fonts.ready ? document.fonts.ready.then(function () { return true; }) : true'
    );
  }

  async function screenshot(file) {
    const result = await send('Page.captureScreenshot', {
      format: 'png',
      fromSurface: true,
      captureBeyondViewport: false,
    });
    writeFileSync(file, Buffer.from(result.data, 'base64'));
  }

  async function close() {
    try {
      ws.close();
    } catch (error) {
      /* ignore */
    }
    try {
      child.kill();
    } catch (error) {
      /* ignore */
    }
    await sleep(150);
    try {
      rmSync(profileDir, { recursive: true, force: true });
    } catch (error) {
      /* Windows 上偶尔有残留锁，忽略 */
    }
  }

  await send('Page.enable');
  await send('Runtime.enable');
  await send('Log.enable');

  return {
    send,
    on,
    once,
    evaluate,
    setViewport,
    navigate,
    waitForImages,
    screenshot,
    close,
  };
}
