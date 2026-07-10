/* ==========================================================================
   Viam · Comportamiento del sitio
   - Interruptor de tema claro / oscuro (con persistencia)
   - Animaciones de entrada al hacer scroll (IntersectionObserver)
   El tema inicial se aplica con el script anti-parpadeo del <head>.
   ========================================================================== */
(function () {
  var root = document.documentElement;

  /* ---------- Tema ---------- */
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

  /* ---------- Reveal al hacer scroll ---------- */
  function initReveal() {
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (!('IntersectionObserver' in window)) return;

    var selector = '.section-head,.feature,.block,.switch,.note,.credit-card,.foot-head,' +
                   'footer#equipo .member,main .member,.phead-in,.thead .wrap';
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

  function init() { initTheme(); initReveal(); }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
