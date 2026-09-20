/* Viam · Firebase bootstrap compartido
   Uso desde cualquier página del monorepo (y más adelante desde otras webs
   del mismo proyecto Firebase). */

(function (global) {
  var cfg = global.VIAM_FIREBASE;
  var ready = false;
  var db = null;

  function configured() {
    return !!(
      cfg &&
      cfg.apiKey &&
      cfg.projectId &&
      cfg.apiKey.indexOf("AIzaSyA4p_Y8dHIbfFyML4xqc8GLwG-yhqbiCHc") === -1 &&
      cfg.projectId.indexOf("viam-e93e0") === -1
    );
  }

  function init() {
    if (ready) return db;
    if (!configured()) {
      console.warn("[Viam Firebase] Falta rellenar firebase/config.js — se usará fallback local.");
      return null;
    }
    if (typeof firebase === "undefined") {
      console.warn("[Viam Firebase] SDK no cargado.");
      return null;
    }
    if (!firebase.apps.length) {
      firebase.initializeApp(cfg);
    }
    db = firebase.firestore();
    ready = true;
    return db;
  }

  global.ViamFirebase = {
    configured: configured,
    init: init,
    db: function () {
      return init();
    },
    /* Colecciones pensadas para crecer:
       leaderboards/{gameId}/scores/{id}
       apps/{appId}/...  (futuras webs) */
    paths: {
      climbScores: "leaderboards/icaro-climb/scores",
    },
  };
})(window);
