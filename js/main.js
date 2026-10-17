/**
 * PETALWINGS — main.js (v2)
 * Vanilla JS, no dependencies. Modules, in order:
 *   1 header scroll state     2 mobile drawer (focus management)
 *   3 scroll reveal           4 hero parallax
 *   5 destination carousel (buttons + drag + snap paging)
 *   6 lightbox (focus trap / keyboard / scroll lock)
 *   7 nav highlight / back-to-top / copyright year
 */
(function () {
  'use strict';

  /* ---------- 00 · ENVIRONMENT & HELPERS ------------------------ */
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
  /* Screenshot mode adds .no-anim: skip motion-driven features so the capture
   is a stable frame. */
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
   * Lightweight focus trap: Tab / Shift+Tab cycle inside the dialog.
   * - tabindex="-1" container focused -> send Tab to the first focusable item;
   * - focus on the last item + Tab -> wrap to first; Shift+Tab wraps backwards.
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

  /* ---------- 01 · HEADER SCROLL STATE -------------------------- */
  (function setupHeader() {
    var header = qs('[data-header]');
    if (!header) return;
    var update = function () {
      header.classList.toggle('is-scrolled', window.scrollY > 16);
    };
    window.addEventListener('scroll', update, { passive: true });
    update();
  })();

  /* ---------- 02 · MOBILE DRAWER MENU --------------------------- */
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
      /* Focus the panel itself (tabindex="-1") instead of the first link, so opening
   the menu doesn't immediately draw a focus ring around the brand name. */
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

    /* Anchor inside the menu: close the menu first, then let the browser perform
   the default hash navigation. */
    qsa('[data-menu-link]', menu).forEach(function (link) {
      link.addEventListener('click', closeMenu);
    });
  })();

  /* ---------- 03 · SCROLL REVEAL -------------------------------- */
  (function setupReveal() {
    var targets = qsa('.reveal');
    if (!targets.length) return;

    if (skipMotion || !('IntersectionObserver' in window)) {
      targets.forEach(function (el) {
        el.classList.add('is-in');
      });
      return;
    }

    /* Stagger siblings under the same parent (0–5) so cards and lists rise one
   after another. */
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
          /* Unobserve after the first reveal: the animation plays once and
             never replays when the user scrolls back up. */
          observer.unobserve(entry.target);
        });
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.1 }
    );
    targets.forEach(function (el) {
      observer.observe(el);
    });
  })();

  /* ---------- 04 · HERO PARALLAX -------------------------------- */
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

    /* Transform-only updates (translate3d + scale) so parallax never triggers
       layout or paint; values are smoothed with a lerp inside the rAF loop. */
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

  /* ---------- 05 · DESTINATION CAROUSEL ------------------------- */
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

    /* Arrow disabled states are derived from the real scroll position, so
       keyboard users and programmatic scrolls always see the correct state. */
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

    /* Paging step = card width + gap, measured from the DOM so the layout can
   change without touching JS. */
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

    /* Drag-to-scroll: Pointer Events + the viewport's native horizontal scrolling.
       - 6px threshold: a tiny finger movement still counts as a click;
       - only past the threshold do we setPointerCapture and take over scrollLeft;
       - swallow one click after release so a drag does not open the lightbox;
       - disable scroll-snap while dragging and restore it after, otherwise the
         snap point pulls the strip back mid-gesture. */
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
            /* Some browsers only allow pointer capture during pointerdown; ignore the
   error otherwise. */
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
          /* Same as above. */
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

  /* ---------- 06 · LIGHTBOX ------------------------------------- */
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
      /* Preload the neighbours so arrow-key paging never shows a blank frame. */
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
      /* Remove hidden first, then add .is-open on the next frame; otherwise the
   opacity transition never starts. */
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
      /* 380ms matches the CSS opacity transition in .lightbox. Keep them
         together if the transition duration is changed. */
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

  /* ---------- 07 · NAV HIGHLIGHT / BACK-TO-TOP / YEAR ----------- */
  (function setupNavSpy() {
    /* Skip the scroll-spy in screenshot mode, otherwise a random nav item would be
   underlined in the full-page capture. */
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
