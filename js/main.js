
/**
 * PETALWINGS · 交互脚本
 * 无第三方依赖，模块依次为：
 *   1 页头滚动状态      2 移动端菜单（焦点管理）
 *   3 滚动显现          4 首屏视差
 *   5 目的地轮播（按钮 + 拖拽 + 吸附）
 *   6 图片灯箱（焦点陷阱 / 键盘 / 滚动锁）
 *   7 导航高亮 / 回到顶部 / 年份
 */
(function () {
  'use strict';

  
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
  
  /* 地址栏带 no-anim=1 时关闭动效，方便静态预览和检查 */
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
   * 弹层焦点陷阱：Tab / Shift+Tab 只在弹层内部循环。
   * 容器本身获得焦点时把焦点送进内容；焦点在最后一个元素上时回到第一个。
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

  
  /* ---------- 01 页头滚动状态 ---------- */
  (function setupHeader() {
    var header = qs('[data-header]');
    if (!header) return;
    var update = function () {
      header.classList.toggle('is-scrolled', window.scrollY > 16);
    };
    window.addEventListener('scroll', update, { passive: true });
    update();
  })();

  
  /* ---------- 02 移动端菜单 ---------- */
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
      
      /* 焦点先放在面板本身，避免一打开菜单就给品牌名描上焦点框 */
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

    
    qsa('[data-menu-link]', menu).forEach(function (link) {
      link.addEventListener('click', closeMenu);
    });
  })();

  
  /* ---------- 03 滚动显现 ---------- */
  (function setupReveal() {
    var targets = qsa('.reveal');
    if (!targets.length) return;

    if (skipMotion || !('IntersectionObserver' in window)) {
      targets.forEach(function (el) {
        el.classList.add('is-in');
      });
      return;
    }

    
    var groups = new Map();
    targets.forEach(function (el) {
      var parent = el.parentElement;
      if (!groups.has(parent)) groups.set(parent, []);
      groups.get(parent).push(el);
    });
    /* 同一父级里的元素按顺序错开，卡片和列表会依次浮上来 */
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
          
          /* 只触发一次，来回滚动不会重播 */
          observer.unobserve(entry.target);
        });
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.1 }
    );
    targets.forEach(function (el) {
      observer.observe(el);
    });
  })();

  
  /* ---------- 04 首屏视差 ---------- */
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

    
    /* 只改 transform，不触发重排；鼠标位置用缓动逐帧逼近，手感更柔和 */
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

  
  /* ---------- 05 目的地轮播 ---------- */
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

    
    /* 按钮禁用状态根据实际滚动位置计算，键盘和脚本滚动也能同步 */
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

    
    /* 翻页步长 = 一张卡片宽 + 间距，直接从页面量，改版式不用动脚本 */
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

    
    /* 拖拽逻辑：
       - 移动不超过 6px 不算拖拽，仍然可以正常点击卡片；
       - 超过阈值才接管 scrollLeft；
       - 松手后吞掉紧随的一次点击，避免拖完误开灯箱；
       - 拖拽时临时关闭吸附，松手再恢复。 */
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

  
  /* ---------- 06 图片灯箱 ---------- */
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
      
      /* 预加载前后两张，按方向键翻页时不会闪白 */
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
      
      /* 先移除 hidden，下一帧再加 is-open，透明度过渡才会生效 */
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
      
      /* 380ms 和 CSS 里 .lightbox 的过渡时间保持一致 */
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

  
  /* ---------- 07 导航高亮 / 回到顶部 / 年份 ---------- */
  (function setupNavSpy() {
    
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
