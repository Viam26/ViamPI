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
      cfg.apiKey.indexOf("PEGA_AQUI") === -1 &&
      cfg.projectId.indexOf("TU_PROYECTO") === -1
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
    console.info("[Viam Firebase] listo · proyecto", cfg.projectId);
    return db;
  }

  function auth() {
    if (!configured()) return null;
    if (typeof firebase === "undefined" || typeof firebase.auth !== "function") return null;
    init();
    return firebase.auth();
  }

  global.ViamFirebase = {
    configured: configured,
    init: init,
    db: function () {
      return init();
    },
    auth: auth,
    /* Colecciones:
       leaderboards/icaro-climb/scores/{id}   ranking público
       apps/icaro/consultas/{sqliteId}        registros clínicos (solo personal) */
    paths: {
      climbScores: "leaderboards/icaro-climb/scores",
      icaroConsultas: "apps/icaro/consultas",
    },
  };
})(window);
