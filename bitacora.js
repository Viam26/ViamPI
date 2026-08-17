/* ==========================================================================
   Viam · Render de bitácora
   Edita el array BITACORA en cada página bitacora/index.html
   ========================================================================== */
(function () {
  var VIDEO_EXT = /\.(mp4|webm|mov)(\?|$)/i;

  function esc(s) {
    if (!s) return '';
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function isVideo(src) {
    return VIDEO_EXT.test(src || '');
  }

  function classifyShape(ratio, manual) {
    if (manual === 'portrait' || manual === 'landscape' || manual === 'square') return manual;
    if (ratio > 1.25) return 'landscape';
    if (ratio < 0.8) return 'portrait';
    return 'square';
  }

  function pickLayoutClass(shapes) {
    var n = shapes.length;
    if (n === 0) return 'layout-empty';
    if (n === 1) return 'layout-1 layout-1-' + shapes[0];
    if (n === 2) {
      var sorted = shapes.slice().sort();
      return 'layout-2 layout-2-' + sorted.join('-');
    }
    if (n === 3) {
      var c = { portrait: 0, landscape: 0, square: 0 };
      shapes.forEach(function (s) { c[s]++; });
      if (c.landscape >= 2) return 'layout-3 layout-3-hero';
      if (c.portrait >= 2) return 'layout-3 layout-3-portraits';
      if (c.portrait === 1 && c.landscape === 1) return 'layout-3 layout-3-mixed';
      return 'layout-3 layout-3-grid';
    }
    return 'layout-4 layout-grid';
  }

  function mediaHtml(item, index) {
    var src = esc(item.src);
    var alt = esc(item.alt || '');
    var manual = item.forma || '';
    if (isVideo(item.src)) {
      var poster = item.poster ? ' poster="' + esc(item.poster) + '"' : '';
      return (
        '<figure class="bit-item is-video" data-index="' + index + '"' +
        (manual ? ' data-forma="' + manual + '"' : '') + '>' +
        '<video src="' + src + '"' + poster + ' controls playsinline preload="metadata"></video>' +
        (alt ? '<figcaption>' + alt + '</figcaption>' : '') +
        '</figure>'
      );
    }
    return (
      '<figure class="bit-item" data-index="' + index + '"' +
      (manual ? ' data-forma="' + manual + '"' : '') + '>' +
      '<img src="' + src + '" alt="' + alt + '" loading="lazy" decoding="async">' +
      (alt ? '<figcaption>' + alt + '</figcaption>' : '') +
      '</figure>'
    );
  }

  function entryHtml(block, i) {
    var media = block.media || [];
    var items = media.map(function (m, j) { return mediaHtml(m, j); }).join('');
    return (
      '<article class="bit-entry" id="bit-' + i + '">' +
        '<header class="bit-head">' +
          (block.fecha ? '<time class="bit-date" datetime="">' + esc(block.fecha) + '</time>' : '') +
          '<h2 class="bit-title">' + esc(block.titulo) + '</h2>' +
          (block.subtitulo ? '<p class="bit-sub">' + esc(block.subtitulo) + '</p>' : '') +
        '</header>' +
        (items ? '<div class="bit-media">' + items + '</div>' : '') +
      '</article>'
    );
  }

  function measureItem(el) {
    var manual = el.getAttribute('data-forma');
    if (manual) return Promise.resolve(manual);

    var img = el.querySelector('img');
    if (img) {
      if (img.complete && img.naturalWidth) {
        return Promise.resolve(classifyShape(img.naturalWidth / img.naturalHeight));
      }
      return new Promise(function (resolve) {
        img.addEventListener('load', function () {
          resolve(classifyShape(img.naturalWidth / img.naturalHeight));
        });
        img.addEventListener('error', function () { resolve('landscape'); });
      });
    }

    var video = el.querySelector('video');
    if (video) {
      if (video.videoWidth) {
        return Promise.resolve(classifyShape(video.videoWidth / video.videoHeight));
      }
      return new Promise(function (resolve) {
        video.addEventListener('loadedmetadata', function () {
          resolve(classifyShape(video.videoWidth / video.videoHeight));
        });
        video.addEventListener('error', function () { resolve('landscape'); });
      });
    }

    return Promise.resolve('square');
  }

  function applyLayout(container) {
    var items = container.querySelectorAll('.bit-item');
    if (!items.length) return Promise.resolve();

    return Promise.all(Array.prototype.map.call(items, measureItem)).then(function (shapes) {
      items.forEach(function (el, i) {
        el.classList.add('shape-' + shapes[i]);
      });
      container.className = 'bit-media ' + pickLayoutClass(shapes);
    });
  }

  function renderBitacora(entries) {
    var root = document.getElementById('bitacora');
    if (!root) return;

    if (!entries || !entries.length) {
      root.innerHTML = '<p class="bit-empty">Aún no hay entradas. Edita el array <code>BITACORA</code> en esta página.</p>';
      return;
    }

    root.innerHTML = entries.map(entryHtml).join('');

    var containers = root.querySelectorAll('.bit-media');
    Promise.all(Array.prototype.map.call(containers, applyLayout)).then(function () {
      root.classList.add('bit-ready');
    });
  }

  window.ViamBitacora = { render: renderBitacora };

  if (typeof BITACORA !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function () { renderBitacora(BITACORA); });
    } else {
      renderBitacora(BITACORA);
    }
  }
})();
