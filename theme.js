/* ==========================================================================
   Viam · Lógica del tema claro / oscuro
   El tema inicial ya se aplica con el script anti-parpadeo del <head>.
   Aquí solo conectamos el botón, guardamos la preferencia y avisamos a la
   animación de la onda ECG del hero.
   ========================================================================== */
(function () {
  var root = document.documentElement;

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

  function init() {
    var toggles = document.querySelectorAll('.theme-toggle');
    for (var i = 0; i < toggles.length; i++) {
      toggles[i].setAttribute('aria-checked', currentTheme() === 'light' ? 'true' : 'false');
      toggles[i].addEventListener('click', function () {
        applyTheme(currentTheme() === 'light' ? 'dark' : 'light', true);
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
