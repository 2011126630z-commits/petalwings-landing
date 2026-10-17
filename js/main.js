/**
 * PETALWINGS — main.js
 * 原生 JS，无任何依赖。所有模块都先判断节点是否存在，其他页面复用也不会报错。
 *
 * 模块索引：
 *  00 环境与小工具          06 卡片 3D 微倾斜
 *  01 页头滚动状态          07 三步流程进度线
 *  02 移动端菜单（焦点管理）08 图库拖拽 / 按钮 / 进度
 *  03 滚动显现              09 灯箱（焦点陷阱 + 键盘 + 滚动锁）
 *  04 数字滚动              10 订阅表单校验
 *  05 视差（英雄区 / 横幅） 11 导航高亮 + 回到顶部 + 年份
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
  /* 截图脚本会加上 .no-anim：跳过视差、计数、进度线等动态逻辑，输出稳定帧 */
  var skipMotion = root.classList.contains('no-anim') || reduceMotion;

  /** 取容器内可聚焦且可见的元素（用于弹层焦点陷阱） */
  function getFocusable(container) {
    return qsa(
      'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])',
      container
    ).filter(function (el) {
      return el.getClientRects().length > 0;
    });
  }

  /**
   * 把 Tab 焦点锁在弹层内部（轻量版焦点陷阱）：
   * - Shift+Tab 在第一个元素上 → 跳到最后
   * - Tab 在最后一个元素上 → 跳回第一个
   * - 焦点意外落到弹层外 → 拉回第一个
   */
  function trapTab(container, event) {
    var items = getFocusable(container);
    if (!items.length) return;
    var first = items[0];
    var last = items[items.length - 1];
    if (!container.contains(document.activeElement)) {
      event.preventDefault();
      first.focus();
      return;
    }
    if (document.activeElement === container) {
      /* 弹层容器本身带 tabindex="-1" 时，第一次 Tab 要主动送进内容，
         否则 Shift+Tab 会跑到弹层外面去。 */
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

  /* ---------- 01 · 页头滚动状态 ----------------------------- */
  (function setupHeader() {
    var header = qs('[data-header]');
    if (!header) return;
    var update = function () {
      header.classList.toggle('is-scrolled', window.scrollY > 24);
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
      /* 焦点先放到面板本身（tabindex="-1"）：比直接聚焦第一个链接更安静，
         不会一打开菜单就在品牌名上出现一圈焦点描边；Tab 会从面板进入链接。 */
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

    /* 菜单里点锚点：先关闭菜单，再让浏览器完成默认跳转 */
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

    /* 同一父级里的元素按顺序错开 85ms，卡片 / 列表会依次浮上来 */
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
          observer.unobserve(entry.target); /* 触发一次即可，来回滚动不会重播 */
        });
      },
      { rootMargin: '0px 0px -10% 0px', threshold: 0.12 }
    );
    targets.forEach(function (el) {
      observer.observe(el);
    });
  })();

  /* ---------- 04 · 数字滚动 -------------------------------- */
  (function setupCounters() {
    var counters = qsa('[data-count]');
    if (!counters.length) return;

    function finalText(el) {
      var target = parseFloat(el.getAttribute('data-count')) || 0;
      var decimals = parseInt(el.getAttribute('data-decimals') || '0', 10);
      var prefix = el.getAttribute('data-prefix') || '';
      var suffix = el.getAttribute('data-suffix') || '';
      return prefix + target.toFixed(decimals) + suffix;
    }

    function animate(el) {
      var target = parseFloat(el.getAttribute('data-count')) || 0;
      var decimals = parseInt(el.getAttribute('data-decimals') || '0', 10);
      var prefix = el.getAttribute('data-prefix') || '';
      var suffix = el.getAttribute('data-suffix') || '';
      var duration = 1400;
      var started = null;

      /* 用 easeOutCubic 收敛：开头快、结尾慢，数字停得自然 */
      function frame(now) {
        if (started === null) started = now;
        var progress = clamp((now - started) / duration, 0, 1);
        var eased = 1 - Math.pow(1 - progress, 3);
        el.textContent = prefix + (target * eased).toFixed(decimals) + suffix;
        if (progress < 1) raf(frame);
        else el.textContent = finalText(el);
      }
      raf(frame);
    }

    if (skipMotion || !('IntersectionObserver' in window)) {
      counters.forEach(function (el) {
        el.textContent = finalText(el);
      });
      return;
    }

    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          observer.unobserve(entry.target);
          animate(entry.target);
        });
      },
      { threshold: 0.6 }
    );
    counters.forEach(function (el) {
      observer.observe(el);
    });
  })();

  /* ---------- 05 · 视差 ------------------------------------ */
  (function setupParallax() {
    if (skipMotion) return;

    /* 5.1 英雄区：鼠标 + 滚动。鼠标值做阻尼缓动，手感更“重”；
       滚动位移只改 transform，不触发重排。平板/手机只保留静态缩放。 */
    var hero = qs('.hero');
    var heroImg = qs('.hero__img');
    if (hero && heroImg) {
      var card = qs('.hero-card');
      var targetX = 0;
      var targetY = 0;
      var currentX = 0;
      var currentY = 0;
      var running = false;

      var apply = function () {
        var desktop = window.innerWidth > 1024;
        if (!desktop) {
          heroImg.style.transform = '';
          if (card) card.style.transform = '';
          return;
        }
        var scrollShift = clamp(window.scrollY * 0.1, 0, 110);
        heroImg.style.transform =
          'translate3d(' +
          (currentX * 14).toFixed(2) +
          'px,' +
          (scrollShift + currentY * 10).toFixed(2) +
          'px,0) scale(1.1)';
        if (card) {
          card.style.transform =
            'translate3d(' +
            (currentX * -8).toFixed(2) +
            'px,' +
            (currentY * -6 - scrollShift * 0.16).toFixed(2) +
            'px,0)';
        }
      };

      var loop = function () {
        running = false;
        currentX += (targetX - currentX) * 0.08;
        currentY += (targetY - currentY) * 0.08;
        apply();
        var settled =
          Math.abs(targetX - currentX) < 0.001 &&
          Math.abs(targetY - currentY) < 0.001;
        if (!settled) {
          running = true;
          raf(loop);
        }
      };

      var request = function () {
        if (running) return;
        running = true;
        raf(loop);
      };

      if (hoverCapable) {
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
      }

      window.addEventListener('scroll', request, { passive: true });
      window.addEventListener('resize', request);
    }

    /* 5.2 邀请横幅：跟随滚动做上下 ±23px 的缓慢位移 */
    var promo = qs('.promo');
    var promoImg = qs('.promo__media img');
    if (promo && promoImg) {
      var promoQueued = false;
      var updatePromo = function () {
        promoQueued = false;
        var rect = promo.getBoundingClientRect();
        var viewportH = window.innerHeight || 1;
        if (rect.bottom < -80 || rect.top > viewportH + 80) return;
        var progress = clamp(
          (viewportH - rect.top) / (viewportH + rect.height),
          0,
          1
        );
        var shift = (progress - 0.5) * 46;
        promoImg.style.transform =
          'translate3d(0,' + shift.toFixed(2) + 'px,0) scale(1.06)';
      };
      var requestPromo = function () {
        if (promoQueued) return;
        promoQueued = true;
        raf(updatePromo);
      };
      window.addEventListener('scroll', requestPromo, { passive: true });
      window.addEventListener('resize', requestPromo);
      updatePromo();
    }
  })();

  /* ---------- 06 · 卡片 3D 微倾斜 --------------------------- */
  (function setupTilt() {
    if (skipMotion || !hoverCapable) return;
    var strength = 5; /* 最大 ±5deg，再大就廉价了 */

    qsa('[data-tilt]').forEach(function (el) {
      el.addEventListener('pointerenter', function () {
        el.classList.add('is-tilting');
      });
      el.addEventListener(
        'pointermove',
        function (event) {
          if (event.pointerType !== 'mouse') return;
          var rect = el.getBoundingClientRect();
          var px = (event.clientX - rect.left) / rect.width - 0.5;
          var py = (event.clientY - rect.top) / rect.height - 0.5;
          el.style.setProperty('--ry', (px * strength).toFixed(2) + 'deg');
          el.style.setProperty('--rx', (-py * strength).toFixed(2) + 'deg');
        },
        { passive: true }
      );
      el.addEventListener('pointerleave', function () {
        el.classList.remove('is-tilting');
        el.style.setProperty('--rx', '0deg');
        el.style.setProperty('--ry', '0deg');
      });
    });
  })();

  /* ---------- 07 · 三步流程进度线 --------------------------- */
  (function setupSteps() {
    var steps = qs('[data-steps]');
    var fill = qs('[data-steps-fill]');
    if (!steps || !fill) return;

    if (skipMotion) {
      steps.style.setProperty('--steps-progress', '1');
      return;
    }

    var queued = false;
    var update = function () {
      queued = false;
      var rect = steps.getBoundingClientRect();
      var viewportH = window.innerHeight || 1;
      var start = viewportH * 0.86; /* 区块顶部到这条线：0% */
      var end = viewportH * 0.28; /* 区块底部到这条线：100% */
      var span = rect.height + (start - end);
      var progress = clamp((start - rect.top) / span, 0, 1);
      steps.style.setProperty('--steps-progress', progress.toFixed(3));
    };
    var request = function () {
      if (queued) return;
      queued = true;
      raf(update);
    };
    window.addEventListener('scroll', request, { passive: true });
    window.addEventListener('resize', request);
    update();
  })();

  /* ---------- 08 · 图库拖拽 / 按钮 / 进度 -------------------- */
  (function setupArchive() {
    var viewport = qs('[data-archive-viewport]');
    var track = qs('[data-archive-track]');
    if (!viewport || !track) return;

    var prevBtn = qs('[data-archive-prev]');
    var nextBtn = qs('[data-archive-next]');
    var progressBar = qs('[data-archive-progress]');
    var smoothBehavior = reduceMotion ? 'auto' : 'smooth';

    function maxScroll() {
      return Math.max(0, viewport.scrollWidth - viewport.clientWidth);
    }

    function sync() {
      var max = maxScroll();
      var ratio = max > 0 ? viewport.scrollLeft / max : 0;
      if (progressBar) {
        progressBar.style.transform = 'scaleX(' + clamp(ratio, 0.04, 1) + ')';
      }
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

    function stepSize() {
      var item = track.querySelector('.archive__item');
      var styles = window.getComputedStyle(track);
      var gap = parseFloat(styles.columnGap || styles.gap || '24') || 24;
      return (item ? item.getBoundingClientRect().width : viewport.clientWidth * 0.7) + gap;
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

    /* 拖拽 = Pointer Events + 原生横向滚动：
       - 起始 6px 内不动，避免“手一抖就当成拖动”；
       - 超过阈值才 setPointerCapture 并接管 scrollLeft；
       - 松手后短暂吞掉一次 click，否则会误触发图片灯箱。 */
    var pointerDown = false;
    var activeId = null;
    var startX = 0;
    var startScroll = 0;
    var moved = 0;
    var suppressClick = false;
    var DRAG_THRESHOLD = 6;

    /* 关键：阻止浏览器原生的链接/图片拖拽。
       否则按住图片往左拖时，第一次移动就被 HTML5 drag 接管，
       pointermove 中断，图库只能挪一小段，松手还会尝试打开链接。 */
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
            /* 某些浏览器在 pointerdown 之外捕获会抛错，忽略即可 */
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

  /* ---------- 09 · 灯箱 ------------------------------------ */
  (function setupLightbox() {
    var lightbox = qs('#lightbox');
    var triggers = qsa('[data-lightbox]');
    if (!lightbox || !triggers.length) return;

    var imgEl = qs('[data-lightbox-img]', lightbox);
    var captionEl = qs('[data-lightbox-text]', lightbox);
    var countEl = qs('[data-lightbox-count]', lightbox);
    var prevBtn = qs('[data-lightbox-prev]', lightbox);
    var nextBtn = qs('[data-lightbox-next]', lightbox);

    /* 统一收集数据：src 取 data-src，没有就用内部 <img>；caption 取 data-caption */
    var items = triggers.map(function (trigger) {
      var img = trigger.querySelector('img');
      return {
        src:
          trigger.getAttribute('data-src') ||
          (img ? img.getAttribute('src') : ''),
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
      /* 预加载前后各一张，按方向键翻页不闪白 */
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
      /* 先移除 hidden 再在下一帧加 .is-open，opacity 过渡才会生效 */
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
      }, 400);
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

  /* ---------- 10 · 订阅表单 -------------------------------- */
  (function setupSignup() {
    var form = qs('[data-signup]');
    if (!form) return;

    var fields = qs('[data-signup-fields]', form);
    var done = qs('[data-signup-done]', form);
    var input = qs('input[type="email"]', form);
    var message = qs('.form-msg', form);
    var submit = qs('button[type="submit"]', form);
    var emailOut = qs('[data-signup-email]', form);
    if (!input || !message || !submit) return;

    var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

    function setMessage(text, isError) {
      message.textContent = text;
      message.classList.toggle('is-error', Boolean(isError));
      if (isError) {
        input.setAttribute('aria-invalid', 'true');
        input.focus();
      } else {
        input.removeAttribute('aria-invalid');
      }
    }

    /* 用户开始修改时立刻清掉错误态，不要让红字一直挂着 */
    input.addEventListener('input', function () {
      if (input.getAttribute('aria-invalid') === 'true') setMessage('', false);
    });

    form.addEventListener('submit', function (event) {
      event.preventDefault();
      var value = input.value.trim();

      if (!value) {
        setMessage('Please add an email address.', true);
        return;
      }
      if (!EMAIL_RE.test(value)) {
        setMessage('That email looks incomplete — mind checking it?', true);
        return;
      }

      setMessage('', false);
      submit.disabled = true;
      submit.textContent = 'Joining…';

      /* 演示用假异步；接真实接口时换成 fetch('/api/subscribe', …) */
      window.setTimeout(function () {
        if (fields) fields.hidden = true;
        if (done) {
          done.hidden = false;
          if (emailOut) emailOut.textContent = value;
          done.focus();
        }
        submit.disabled = false;
        submit.textContent = 'Join the bloom list';
      }, 750);
    });
  })();

  /* ---------- 11 · 导航高亮 / 回到顶部 / 年份 --------------- */
  (function setupNavSpy() {
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

    /* 只留视口中段一条“视线带”，穿过它的 section 才高亮 */
    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          pairs.forEach(function (pair) {
            pair.link.classList.toggle(
              'is-active',
              pair.section === entry.target
            );
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
      window.scrollTo({
        top: 0,
        behavior: reduceMotion ? 'auto' : 'smooth',
      });
    });
  })();

  (function setupYear() {
    var year = String(new Date().getFullYear());
    qsa('[data-year]').forEach(function (el) {
      el.textContent = year;
    });
  })();
})();
