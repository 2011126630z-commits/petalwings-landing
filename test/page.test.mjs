import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const htmlPath = join(root, 'index.html');
const cssPath = join(root, 'css/style.css');
const jsPath = join(root, 'js/main.js');

const html = readFileSync(htmlPath, 'utf8');
const css = readFileSync(cssPath, 'utf8');
/* Structural assertions operate on markup with comments removed: the English
   documentation mentions attribute names like data-lightbox and href="#...". */
const markup = html.replace(/<!--[\s\S]*?-->/g, '');

function localPath(ref) {
  const clean = ref.split('?')[0].split('#')[0];
  return join(root, clean);
}

test('HTML 基本结构与页面骨架完整', () => {
  assert.match(html, /^<!doctype html>/i);
  assert.match(html, /<html[^>]+lang="en"/);
  assert.match(html, /<main id="main">/);

  for (const id of ['top', 'destinations', 'journey', 'visit', 'contact']) {
    assert.match(html, new RegExp(`id="${id}"`), `缺少 #${id} 区块`);
  }

  const h1 = html.match(/<h1\b/g) || [];
  assert.equal(h1.length, 1, '页面应该只有一个 h1');
  assert.match(html, /<title>[^<]{8,}<\/title>/);
  assert.match(html, /name="description"/);
});

test('所有本地资源引用都存在且非空', () => {
  const refs = [...html.matchAll(/\b(?:src|href)="([^"]+)"/g)].map((m) => m[1]);
  const local = refs.filter(
    (ref) =>
      ref &&
      !ref.startsWith('#') &&
      !ref.startsWith('mailto:') &&
      !ref.startsWith('http://') &&
      !ref.startsWith('https://') &&
      !ref.startsWith('data:')
  );
  assert.ok(local.length > 8, '本地资源引用数量看起来不对');

  for (const ref of local) {
    const path = localPath(ref);
    assert.ok(existsSync(path), `引用了不存在的文件：${ref}`);
    assert.ok(statSync(path).size > 0, `空文件：${ref}`);
  }
});

test('图片都带 alt / width / height，避免 CLS 与无障碍问题', () => {
  const images = [...html.matchAll(/<img\b[^>]*>/g)].map((m) => m[0]);
  assert.ok(images.length >= 10);

  for (const tag of images) {
    assert.match(tag, /\balt="/, `img 缺少 alt：${tag.slice(0, 90)}`);
    if (tag.includes('data-lightbox-img')) continue; /* 灯箱图运行时注入 src */
    assert.match(tag, /\bwidth="\d+"/, `img 缺少 width：${tag.slice(0, 90)}`);
    assert.match(tag, /\bheight="\d+"/, `img 缺少 height：${tag.slice(0, 90)}`);
  }
});

test('图片文件是有效的 JPG，且全部图片都有对应的本地文件', () => {
  const jpgs = [...html.matchAll(/<img\b[^>]*\bsrc="([^"]+\.jpg)"/g)].map((m) => m[1]);
  assert.ok(jpgs.length >= 10);

  for (const ref of jpgs) {
    const path = localPath(ref);
    assert.ok(existsSync(path), `缺少图片：${ref}`);
    const head = readFileSync(path).subarray(0, 3);
    assert.deepEqual([...head], [0xff, 0xd8, 0xff], `${ref} 不是 JPEG`);
  }
});

test('页面内锚点都有对应的 id', () => {
  const ids = new Set([...markup.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]));
  const anchors = [...markup.matchAll(/\bhref="#([^"]+)"/g)].map((m) => m[1]);

  for (const anchor of anchors) {
    assert.ok(ids.has(anchor), `锚点 #${anchor} 没有对应 id`);
  }
});

test('HTML 中的 id 不重复', () => {
  const ids = [...markup.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]);
  const seen = new Set();
  for (const id of ids) {
    assert.ok(!seen.has(id), `重复 id：${id}`);
    seen.add(id);
  }
});

test('目的地轮播与灯箱的结构完整（6 张卡片）', () => {
  /* Structural counts must ignore HTML comments, because comments also mention
     attribute names such as data-lightbox. */
  const markup = html.replace(/<!--[\s\S]*?-->/g, '');
  const cards = markup.match(/class="dest-card reveal"/g) || [];
  assert.equal(cards.length, 6, `目的地卡片数量为 ${cards.length}`);

  const triggers = markup.match(/data-lightbox(?=[ >])/g) || [];
  assert.equal(triggers.length, 6, `灯箱触发器数量为 ${triggers.length}`);

  const ratings = markup.match(/class="rating-pill"/g) || [];
  assert.equal(ratings.length, 6, `评分胶囊数量为 ${ratings.length}`);
  assert.equal((markup.match(/aria-label="Rated \d\.\d out of 5"/g) || []).length, 6);
  assert.match(markup, /id="i-star"/, '缺少星标图标');

  assert.match(markup, /data-carousel-viewport/);
  assert.match(markup, /data-carousel-track/);
  assert.match(markup, /data-carousel-prev/);
  assert.match(markup, /data-carousel-next/);
  assert.match(markup, /id="lightbox"/);
  assert.match(markup, /aria-modal="true"/);
});

test('参考稿对应的关键区块都在', () => {
  assert.equal(
    (html.match(/class="hero-step(?: is-active)?"/g) || []).length,
    3,
    '英雄区应有 3 个步骤点'
  );
  assert.match(html, /Know More/);
  assert.match(html, /class="proof__logos"/);
  assert.match(html, /class="step step--featured reveal"/);
  assert.match(html, /class="offer reveal"/);
  assert.match(html, /class="promo__cta reveal"/);
});

test('CSS 语法结构完整，且包含关键降级规则', () => {
  const open = (css.match(/{/g) || []).length;
  const close = (css.match(/}/g) || []).length;
  assert.equal(open, close, `CSS 花括号不配对：${open} / ${close}`);

  assert.match(css, /:root\s*{/);
  assert.match(css, /@media \(max-width: 720px\)/);
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.match(css, /\.no-anim\s+\*/);
  assert.match(css, /scroll-snap-type: x mandatory/);
});

test('JS 语法正确（node --check）', () => {
  const result = spawnSync(process.execPath, ['--check', jsPath], {
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr || 'JS 语法检查失败');
});

test('交付内容不依赖外部网络请求', () => {
  const externalAssets = [
    ...html.matchAll(/<(?:img|script)\b[^>]*\bsrc="(https?:\/\/[^"]+)"/g),
    ...html.matchAll(/<link\b[^>]*\bhref="(https?:\/\/[^"]+)"/g),
  ];
  assert.equal(externalAssets.length, 0, '存在外部图片/脚本/样式引用');
});

test('关键文案与参考设计逐项对应', () => {
  const copy = [
    'Experience',
    'The Magic Of',
    'Bloom!',
    'Know More',
    'Blooming Places',
    'Popular Destination',
    'Journey To The Blooms Made Simple!',
    'Unleash Wanderlust',
    '20% OFF',
    'Book A Trip Now',
  ];
  for (const text of copy) {
    assert.ok(html.includes(text), `缺少文案：${text}`);
  }
});
