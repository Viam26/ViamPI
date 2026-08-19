/* ==========================================================================
   Viam · Render de bitácora
   Datos en viampulse|viamvision|icaro/bitacora/entries.js
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

  function mediaUrl(basePath, src) {
    var path = (basePath || '') + (src || '');
    return path.split('/').filter(Boolean).map(function (part) {
      return encodeURIComponent(part);
    }).join('/');
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

  function mediaHtml(item, index, basePath) {
    var url = mediaUrl(basePath, item.src);
    var alt = esc(item.alt || '');
    var manual = item.forma || '';
    if (isVideo(item.src)) {
      var poster = item.poster ? ' poster="' + esc(mediaUrl(basePath, item.poster)) + '"' : '';
      return (
        '<figure class="bit-item is-video" data-index="' + index + '"' +
        (manual ? ' data-forma="' + manual + '"' : '') + '>' +
        '<video src="' + esc(url) + '"' + poster + ' controls playsinline preload="metadata"></video>' +
        (alt ? '<figcaption>' + alt + '</figcaption>' : '') +
        '</figure>'
      );
    }
    return (
      '<figure class="bit-item" data-index="' + index + '"' +
      (manual ? ' data-forma="' + manual + '"' : '') + '>' +
      '<button type="button" class="bit-zoom" data-lightbox="' + esc(url) + '" data-alt="' + alt + '" aria-label="Ampliar imagen">' +
      '<img src="' + esc(url) + '" alt="' + alt + '" loading="lazy" decoding="async">' +
      '</button>' +
      (alt ? '<figcaption>' + alt + '</figcaption>' : '') +
      '</figure>'
    );
  }

  function entryHtml(block, i, basePath) {
    var media = block.media || [];
    var items = media.map(function (m, j) { return mediaHtml(m, j, basePath); }).join('');
    var sub = block.subtitulo && block.subtitulo !== '/.' ? block.subtitulo : '';
    return (
      '<article class="bit-entry" id="bit-' + i + '">' +
        '<header class="bit-head">' +
          (block.fecha ? '<time class="bit-date">' + esc(block.fecha) + '</time>' : '') +
          '<h2 class="bit-title">' + esc(block.titulo) + '</h2>' +
          (sub ? '<p class="bit-sub">' + esc(sub) + '</p>' : '') +
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

  function renderInto(entries, root, basePath) {
    if (!root) return Promise.resolve();

    if (!entries || !entries.length) {
      root.innerHTML = '<p class="bit-empty">Sin entradas todavía.</p>';
      return Promise.resolve();
    }

    root.innerHTML = entries.map(function (b, i) { return entryHtml(b, i, basePath); }).join('');

    var containers = root.querySelectorAll('.bit-media');
    return Promise.all(Array.prototype.map.call(containers, applyLayout)).then(function () {
      root.classList.add('bit-ready');
    });
  }

  function renderBitacora(entries, root, basePath) {
    root = root || document.getElementById('bitacora');
    return renderInto(entries, root, basePath || '');
  }

  function renderGlobal(sections, root) {
    if (!root || !sections || !sections.length) return Promise.resolve();

    root.innerHTML = sections.map(function (section, si) {
      return (
        '<section class="bit-project proj-' + esc(section.slug) + '" id="bitacora-' + esc(section.slug) + '">' +
          '<div class="bit-project-head">' +
            '<div>' +
              '<span class="modality">' + esc(section.name) + '</span>' +
              '<h2 class="bit-project-title">Proceso · ' + esc(section.name) + '</h2>' +
            '</div>' +
            (section.href ? '<a class="bit-project-link" href="' + esc(section.href) + '">Ver bitácora completa<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M5 12h14M13 6l6 6-6 6"/></svg></a>' : '') +
          '</div>' +
          '<div class="bitacora-timeline" id="bit-timeline-' + si + '"></div>' +
        '</section>'
      );
    }).join('');

    return Promise.all(sections.map(function (section, si) {
      var sub = root.querySelector('#bit-timeline-' + si);
      var base = section.href || '';
      return renderInto(section.entries, sub, base);
    })).then(function () {
      root.classList.add('bit-ready');
    });
  }

  function initProjectPage() {
    var root = document.getElementById('bitacora');
    if (!root || !window.ViamBitacoraProject) return;
    renderBitacora(ViamBitacoraProject.entries, root, '');
  }

  window.ViamBitacora = {
    render: renderBitacora,
    renderGlobal: renderGlobal,
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initProjectPage);
  } else {
    initProjectPage();
  }
})();
