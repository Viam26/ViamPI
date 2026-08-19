/* ==========================================================================
   Viam · Comportamiento del sitio
   ========================================================================== */
(function () {
  var root = document.documentElement;
  var lastFocus = null;

  function currentTheme() {
    return root.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
  }

  function applyTheme(theme, animate) {
    if (animate) {
      root.classList.add('theme-anim');
      window.setTimeout(function () { root.classList.remove('theme-anim'); }, 650);
    }
    root.setAttribute('data-theme', theme);
    try { localStorage.setItem('viam-theme', theme); } catch (e) {}
    var toggles = document.querySelectorAll('.theme-toggle');
    for (var i = 0; i < toggles.length; i++) {
      toggles[i].setAttribute('aria-checked', theme === 'light' ? 'true' : 'false');
    }
    window.dispatchEvent(new CustomEvent('viam:themechange', { detail: { theme: theme } }));
  }

  function initTheme() {
    var toggles = document.querySelectorAll('.theme-toggle');
    for (var i = 0; i < toggles.length; i++) {
      toggles[i].setAttribute('aria-checked', currentTheme() === 'light' ? 'true' : 'false');
      toggles[i].addEventListener('click', function () {
        applyTheme(currentTheme() === 'light' ? 'dark' : 'light', true);
      });
    }
  }

  function initReveal() {
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (!('IntersectionObserver' in window)) return;

    var selector = '.section-head,.feature,.block,.switch,.note,.credit-card,.foot-head,' +
      'footer#equipo .member,main .member,.phead-in,.thead .wrap,.bhead .wrap,.bit-entry,.bitacora-card,' +
      '.bit-project,.team-spotlight,.team-photo-btn';
    var els = document.querySelectorAll(selector);
    if (!els.length) return;

    root.classList.add('has-reveal');
    for (var i = 0; i < els.length; i++) els[i].classList.add('reveal-item');

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          e.target.classList.add('in');
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -7% 0px' });

    for (var j = 0; j < els.length; j++) io.observe(els[j]);
  }

  function ensureLightbox() {
    var box = document.getElementById('viam-lightbox');
    if (box) return box;
    box = document.createElement('div');
    box.id = 'viam-lightbox';
    box.className = 'viam-lightbox';
    box.hidden = true;
    box.innerHTML =
      '<button class="lightbox-backdrop" type="button" data-close-lightbox aria-label="Cerrar"></button>' +
      '<div class="lightbox-stage">' +
        '<button class="lightbox-close" type="button" data-close-lightbox aria-label="Cerrar">' +
          '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M18 6 6 18M6 6l12 12"/></svg>' +
        '</button>' +
        '<img class="lightbox-img" alt="">' +
      '</div>';
    document.body.appendChild(box);
    return box;
  }

  function openLightbox(src, alt) {
    var box = ensureLightbox();
    var img = box.querySelector('.lightbox-img');
    img.src = src;
    img.alt = alt || '';
    box.hidden = false;
    document.body.classList.add('modal-open');
    lastFocus = document.activeElement;
    box.querySelector('.lightbox-close').focus();
  }

  function closeLightbox() {
    var box = document.getElementById('viam-lightbox');
    if (!box || box.hidden) return;
    box.hidden = true;
    box.querySelector('.lightbox-img').removeAttribute('src');
    document.body.classList.remove('modal-open');
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  function initLightbox() {
    document.addEventListener('click', function (e) {
      var zoom = e.target.closest('[data-lightbox], .bit-zoom');
      if (zoom) {
        e.preventDefault();
        openLightbox(zoom.getAttribute('data-lightbox') || zoom.querySelector('img').src, zoom.getAttribute('data-alt') || '');
        return;
      }
      if (e.target.closest('[data-close-lightbox]')) closeLightbox();
    });
  }

  function openModal(id) {
    var modal = document.getElementById(id);
    if (!modal) return;
    modal.hidden = false;
    document.body.classList.add('modal-open');
    lastFocus = document.activeElement;
    var closeBtn = modal.querySelector('.modal-close');
    if (closeBtn) closeBtn.focus();
  }

  function closeModal(modal) {
    if (!modal) return;
    modal.hidden = true;
    var anyModal = document.querySelector('.viam-modal:not([hidden])');
    var lb = document.getElementById('viam-lightbox');
    if (!anyModal && (!lb || lb.hidden)) {
      document.body.classList.remove('modal-open');
    }
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  function initModals() {
    document.addEventListener('click', function (e) {
      var open = e.target.closest('[data-open-modal]');
      if (open) {
        e.preventDefault();
        openModal(open.getAttribute('data-open-modal'));
        return;
      }
      var close = e.target.closest('[data-close-modal]');
      if (close) {
        var modal = close.closest('.viam-modal');
        closeModal(modal);
      }
    });
  }

  function initKeyboard() {
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      closeLightbox();
      var openModalEl = document.querySelector('.viam-modal:not([hidden])');
      if (openModalEl) closeModal(openModalEl);
    });
  }

  function init() {
    initTheme();
    initReveal();
    initLightbox();
    initModals();
    initKeyboard();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
