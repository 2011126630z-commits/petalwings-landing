/**
 * PETALWINGS — main.js（v2）
 * 原生 JS，无依赖。按参考稿的交互重写：
 *   1 页头滚动态        2 移动端菜单（焦点管理）
 *   3 滚动显现          4 英雄区视差
 *   5 目的地轮播（按钮 + 拖拽 + 吸附）
 *   6 灯箱（焦点陷阱 / 键盘 / 滚动锁）
 *   7 导航高亮 / 回到顶部 / 年份
 */
(function () {
  'use strict';

  /* ---------- 00 · 环境与小工具 ----------------------------- */
  var root = document.documentElement;
  var qs = function (selector, scope) {
    return (scope || document).querySelector(selector);
  };
  var qsa = function (selector, scope) {
    return Array.prototype.slice.call(
      (scope || document).querySelectorAll(selector)
    );
  };
  var clamp = function (value, min, max) {
    return Math.min(Math.max(value, min), max);
  };
  var raf = window.requestAnimationFrame.bind(window);
  var reduceMotion = window.matchMedia(
    '(prefers-reduced-motion: reduce)'
  ).matches;
  var hoverCapable = window.matchMedia(
    '(hover: hover) and (pointer: fine)'
  ).matches;
  /* 截图模式会加 .no-anim：跳过视差等动态逻辑，输出稳定帧 */
  var skipMotion = root.classList.contains('no-anim') || reduceMotion;

  function getFocusable(container) {
    return qsa(
      'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])',
      container
    ).filter(function (el) {
      return el.getClientRects().length > 0;
    });
  }

  /**
   * 轻量焦点陷阱：Tab / Shift+Tab 在弹层内循环。
   * - 容器本身获得焦点（tabindex="-1"）时，Tab 主动送进第一个可聚焦元素；
   * - 焦点在最后一个元素上时 Tab 回到第一个；反向同理。
   */
  function trapTab(container, event) {
    var items = getFocusable(container);
    if (!items.length) return;
    var first = items[0];
    var last = items[items.length - 1];

    if (document.activeElement === container || !container.contains(document.activeElement)) {
      event.preventDefault();
      (event.shiftKey ? last : first).focus();
      return;
    }
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function padTwo(value) {
    return value < 10 ? '0' + value : String(value);
  }

  /* ---------- 01 · 页头滚动态 ------------------------------- */
  (function setupHeader() {
    var header = qs('[data-header]');
    if (!header) return;
    var update = function () {
      header.classList.toggle('is-scrolled', window.scrollY > 16);
    };
    window.addEventListener('scroll', update, { passive: true });
    update();
  })();

  /* ---------- 02 · 移动端菜单 ------------------------------- */
  (function setupMenu() {
    var menu = qs('[data-menu]');
    var toggle = qs('[data-menu-toggle]');
    if (!menu || !toggle) return;

    var panel = qs('.menu__panel', menu);
    var isOpen = false;
    var lastFocused = null;

    function onKeydown(event) {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeMenu();
        return;
      }
      if (event.key === 'Tab') trapTab(panel, event);
    }

    function openMenu() {
      if (isOpen) return;
      isOpen = true;
      lastFocused = document.activeElement;
      menu.classList.add('is-open');
      menu.setAttribute('aria-hidden', 'false');
      toggle.setAttribute('aria-expanded', 'true');
      toggle.setAttribute('aria-label', 'Close menu');
      document.body.classList.add('is-locked', 'menu-open');
      document.addEventListener('keydown', onKeydown);
      /* 焦点先给面板本身，避免一打开菜单就在品牌名上出现焦点描边 */
      window.setTimeout(function () {
        panel.focus();
      }, 80);
    }

    function closeMenu() {
      if (!isOpen) return;
      isOpen = false;
      menu.classList.remove('is-open');
      menu.setAttribute('aria-hidden', 'true');
      toggle.setAttribute('aria-expanded', 'false');
      toggle.setAttribute('aria-label', 'Open menu');
      document.body.classList.remove('is-locked', 'menu-open');
      document.removeEventListener('keydown', onKeydown);
      if (lastFocused && lastFocused.focus) lastFocused.focus();
    }

    toggle.addEventListener('click', function () {
      if (isOpen) closeMenu();
      else openMenu();
    });

    qsa('[data-menu-close]', menu).forEach(function (el) {
      el.addEventListener('click', closeMenu);
    });

    /* 点菜单里的锚点：先关菜单，再让浏览器完成默认跳转 */
    qsa('[data-menu-link]', menu).forEach(function (link) {
      link.addEventListener('click', closeMenu);
    });
  })();

  /* ---------- 03 · 滚动显现 -------------------------------- */
  (function setupReveal() {
    var targets = qsa('.reveal');
    if (!targets.length) return;

    if (skipMotion || !('IntersectionObserver' in window)) {
      targets.forEach(function (el) {
        el.classList.add('is-in');
      });
      return;
    }

    /* 同父级里的元素按顺序错开，卡片 / 列表会依次浮上来 */
    var groups = new Map();
    targets.forEach(function (el) {
      var parent = el.parentElement;
      if (!groups.has(parent)) groups.set(parent, []);
      groups.get(parent).push(el);
    });
    groups.forEach(function (list) {
      list.forEach(function (el, i) {
        el.style.setProperty('--reveal-delay', String(Math.min(i, 5)));
      });
    });

    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('is-in');
          observer.unobserve(entry.target);
        });
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.1 }
    );
    targets.forEach(function (el) {
      observer.observe(el);
    });
  })();

  /* ---------- 04 · 英雄区视差 ------------------------------- */
  (function setupHeroParallax() {
    if (skipMotion || !hoverCapable) return;
    var hero = qs('.hero__card');
    var img = qs('.hero__img');
    var card = qs('.know-card');
    if (!hero || !img) return;

    var targetX = 0;
    var targetY = 0;
    var currentX = 0;
    var currentY = 0;
    var running = false;

    var apply = function () {
      var desktop = window.innerWidth > 1024;
      if (!desktop) {
        img.style.transform = '';
        if (card) card.style.transform = '';
        return;
      }
      var scrollShift = clamp(window.scrollY * 0.06, 0, 36);
      img.style.transform =
        'translate3d(' +
        (currentX * 10).toFixed(2) +
        'px,' +
        (currentY * 7 + scrollShift).toFixed(2) +
        'px,0) scale(1.04)';
      if (card) {
        card.style.transform =
          'translate3d(' +
          (currentX * -6).toFixed(2) +
          'px,' +
          (currentY * -5 - scrollShift * 0.2).toFixed(2) +
          'px,0)';
      }
    };

    var loop = function () {
      running = false;
      currentX += (targetX - currentX) * 0.08;
      currentY += (targetY - currentY) * 0.08;
      apply();
      if (
        Math.abs(targetX - currentX) > 0.001 ||
        Math.abs(targetY - currentY) > 0.001
      ) {
        running = true;
        raf(loop);
      }
    };

    var request = function () {
      if (running) return;
      running = true;
      raf(loop);
    };

    hero.addEventListener(
      'pointermove',
      function (event) {
        if (event.pointerType !== 'mouse') return;
        var rect = hero.getBoundingClientRect();
        targetX = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
        targetY = ((event.clientY - rect.top) / rect.height - 0.5) * 2;
        request();
      },
      { passive: true }
    );
    hero.addEventListener('pointerleave', function () {
      targetX = 0;
      targetY = 0;
      request();
    });
    window.addEventListener('scroll', request, { passive: true });
    window.addEventListener('resize', request);
  })();

  /* ---------- 05 · 目的地轮播 ------------------------------- */
  (function setupCarousel() {
    var viewport = qs('[data-carousel-viewport]');
    var track = qs('[data-carousel-track]');
    if (!viewport || !track) return;

    var prevBtn = qs('[data-carousel-prev]');
    var nextBtn = qs('[data-carousel-next]');
    var smoothBehavior = reduceMotion ? 'auto' : 'smooth';

    function maxScroll() {
      return Math.max(0, viewport.scrollWidth - viewport.clientWidth);
    }

    function sync() {
      var max = maxScroll();
      if (prevBtn) prevBtn.disabled = viewport.scrollLeft <= 2;
      if (nextBtn) nextBtn.disabled = viewport.scrollLeft >= max - 2;
    }

    var syncQueued = false;
    function requestSync() {
      if (syncQueued) return;
      syncQueued = true;
      raf(function () {
        syncQueued = false;
        sync();
      });
    }

    viewport.addEventListener('scroll', requestSync, { passive: true });
    window.addEventListener('resize', requestSync);
    sync();

    /* 翻页步长 = 一张卡片宽 + gap，两块一起量，改版式不用改 JS */
    function stepSize() {
      var card = track.querySelector('.dest-card');
      var styles = window.getComputedStyle(track);
      var gap = parseFloat(styles.columnGap || styles.gap || '24') || 24;
      return (card ? card.getBoundingClientRect().width : viewport.clientWidth * 0.7) + gap;
    }

    if (prevBtn) {
      prevBtn.addEventListener('click', function () {
        viewport.scrollBy({ left: -stepSize(), behavior: smoothBehavior });
      });
    }
    if (nextBtn) {
      nextBtn.addEventListener('click', function () {
        viewport.scrollBy({ left: stepSize(), behavior: smoothBehavior });
      });
    }

    /* 拖拽：Pointer Events + 原生横向滚动。
       - 6px 阈值：手指轻微抖动不算拖拽，仍然可以点击卡片；
       - 超过阈值才 setPointerCapture 接管 scrollLeft；
       - 松手后吞掉一次 click，避免拖拽结束误开灯箱；
       - 拖拽期间临时关掉 scroll-snap，松手再恢复，不然会被吸附力拽回去。 */
    var pointerDown = false;
    var activeId = null;
    var startX = 0;
    var startScroll = 0;
    var moved = 0;
    var suppressClick = false;
    var DRAG_THRESHOLD = 6;

    viewport.addEventListener('dragstart', function (event) {
      event.preventDefault();
    });

    viewport.addEventListener('pointerdown', function (event) {
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      pointerDown = true;
      moved = 0;
      activeId = event.pointerId;
      startX = event.clientX;
      startScroll = viewport.scrollLeft;
    });

    viewport.addEventListener(
      'pointermove',
      function (event) {
        if (!pointerDown || event.pointerId !== activeId) return;
        var delta = event.clientX - startX;
        moved = Math.max(moved, Math.abs(delta));
        if (moved <= DRAG_THRESHOLD) return;
        viewport.classList.add('is-dragging');
        if (!viewport.hasPointerCapture(activeId)) {
          try {
            viewport.setPointerCapture(activeId);
          } catch (error) {
            /* 某些浏览器只允许在 pointerdown 里捕获，忽略即可 */
          }
        }
        viewport.scrollLeft = startScroll - delta;
        event.preventDefault();
      },
      { passive: false }
    );

    function endDrag() {
      if (!pointerDown) return;
      pointerDown = false;
      viewport.classList.remove('is-dragging');
      if (activeId !== null && viewport.hasPointerCapture(activeId)) {
        try {
          viewport.releasePointerCapture(activeId);
        } catch (error) {
          /* 同上 */
        }
      }
      activeId = null;
      if (moved > DRAG_THRESHOLD) {
        suppressClick = true;
        window.setTimeout(function () {
          suppressClick = false;
        }, 80);
      }
      requestSync();
    }

    viewport.addEventListener('pointerup', endDrag);
    viewport.addEventListener('pointercancel', endDrag);

    viewport.addEventListener(
      'click',
      function (event) {
        if (!suppressClick) return;
        suppressClick = false;
        event.preventDefault();
        event.stopPropagation();
      },
      true
    );
  })();

  /* ---------- 06 · 灯箱 ------------------------------------ */
  (function setupLightbox() {
    var lightbox = qs('#lightbox');
    var triggers = qsa('[data-lightbox]');
    if (!lightbox || !triggers.length) return;

    var imgEl = qs('[data-lightbox-img]', lightbox);
    var captionEl = qs('[data-lightbox-text]', lightbox);
    var countEl = qs('[data-lightbox-count]', lightbox);
    var prevBtn = qs('[data-lightbox-prev]', lightbox);
    var nextBtn = qs('[data-lightbox-next]', lightbox);

    var items = triggers.map(function (trigger) {
      var img = trigger.querySelector('img');
      return {
        src: trigger.getAttribute('data-src') || (img ? img.getAttribute('src') : ''),
        alt: img ? img.getAttribute('alt') || '' : '',
        caption: trigger.getAttribute('data-caption') || '',
      };
    });

    var index = 0;
    var isOpen = false;
    var lastFocused = null;
    var closeTimer = null;
    var preloaded = [];

    function preload(src) {
      if (!src || preloaded.indexOf(src) !== -1) return;
      preloaded.push(src);
      var image = new Image();
      image.src = src;
    }

    function render() {
      var item = items[index];
      if (!item) return;
      imgEl.src = item.src;
      imgEl.alt = item.alt;
      captionEl.textContent = item.caption;
      countEl.textContent = padTwo(index + 1) + ' / ' + padTwo(items.length);
      preload(items[(index + 1) % items.length].src);
      preload(items[(index - 1 + items.length) % items.length].src);
    }

    function onKeydown(event) {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeLightbox();
        return;
      }
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        index = (index + 1) % items.length;
        render();
        return;
      }
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        index = (index - 1 + items.length) % items.length;
        render();
        return;
      }
      if (event.key === 'Tab') trapTab(lightbox, event);
    }

    function openLightbox(itemIndex, trigger) {
      index = (itemIndex + items.length) % items.length;
      lastFocused = trigger || document.activeElement;
      isOpen = true;
      window.clearTimeout(closeTimer);
      render();
      lightbox.hidden = false;
      lightbox.setAttribute('aria-hidden', 'false');
      document.body.classList.add('is-locked');
      /* 先移除 hidden，下一帧再加 .is-open，透明度过渡才会生效 */
      raf(function () {
        lightbox.classList.add('is-open');
      });
      window.setTimeout(function () {
        var closeBtn = qs('.lightbox__close', lightbox);
        if (closeBtn) closeBtn.focus();
      }, 80);
      document.addEventListener('keydown', onKeydown);
    }

    function closeLightbox() {
      if (!isOpen) return;
      isOpen = false;
      lightbox.classList.remove('is-open');
      lightbox.setAttribute('aria-hidden', 'true');
      document.body.classList.remove('is-locked');
      document.removeEventListener('keydown', onKeydown);
      closeTimer = window.setTimeout(function () {
        lightbox.hidden = true;
        imgEl.removeAttribute('src');
      }, 380);
      if (lastFocused && lastFocused.focus) lastFocused.focus();
    }

    triggers.forEach(function (trigger, i) {
      trigger.addEventListener('click', function (event) {
        event.preventDefault();
        openLightbox(i, trigger);
      });
    });

    qsa('[data-lightbox-close]', lightbox).forEach(function (el) {
      el.addEventListener('click', closeLightbox);
    });

    if (prevBtn) {
      prevBtn.addEventListener('click', function () {
        index = (index - 1 + items.length) % items.length;
        render();
      });
    }
    if (nextBtn) {
      nextBtn.addEventListener('click', function () {
        index = (index + 1) % items.length;
        render();
      });
    }
  })();

  /* ---------- 07 · 导航高亮 / 回到顶部 / 年份 --------------- */
  (function setupNavSpy() {
    /* 截图模式关掉高亮，避免整页截图里随机某一条导航被下划线标出来 */
    if (root.classList.contains('no-anim')) return;
    var links = qsa('.nav__link');
    if (!links.length || !('IntersectionObserver' in window)) return;

    var pairs = [];
    links.forEach(function (link) {
      var href = link.getAttribute('href');
      if (!href || href.charAt(0) !== '#') return;
      var section = qs(href);
      if (section) pairs.push({ link: link, section: section });
    });
    if (!pairs.length) return;

    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          pairs.forEach(function (pair) {
            pair.link.classList.toggle('is-active', pair.section === entry.target);
          });
        });
      },
      { rootMargin: '-45% 0px -50% 0px', threshold: 0 }
    );
    pairs.forEach(function (pair) {
      observer.observe(pair.section);
    });
  })();

  (function setupBackTop() {
    var button = qs('[data-back-top]');
    if (!button) return;
    button.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
    });
  })();

  (function setupYear() {
    var year = String(new Date().getFullYear());
    qsa('[data-year]').forEach(function (el) {
      el.textContent = year;
    });
  })();
})();
