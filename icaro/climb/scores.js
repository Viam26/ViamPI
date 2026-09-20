/* ICARO Climb · ranking (Firestore + fallback localStorage) */

(function (global) {
  var LOCAL_BOARD = "icaro-climb-board";
  var LOCAL_NAME = "icaro-climb-name";
  var LOCAL_BEST = "icaro-climb-best";

  function loadLocalBoard() {
    try {
      return JSON.parse(localStorage.getItem(LOCAL_BOARD) || "[]");
    } catch (e) {
      return [];
    }
  }

  function saveLocalBoard(board) {
    localStorage.setItem(LOCAL_BOARD, JSON.stringify(board.slice(0, 12)));
  }

  function sortBoard(board) {
    return board.slice().sort(function (a, b) {
      return b.points - a.points || a.time - b.time;
    });
  }

  function db() {
    return global.ViamFirebase && global.ViamFirebase.db
      ? global.ViamFirebase.db()
      : null;
  }

  function remoteReady() {
    return !!(global.ViamFirebase && global.ViamFirebase.configured && global.ViamFirebase.configured() && db());
  }

  function dbRef() {
    var fire = db();
    if (!fire) return null;
    return fire.collection("leaderboards").doc("icaro-climb").collection("scores");
  }

  /** @returns {Promise<Array>} */
  function fetchBoard(limitN) {
    var lim = limitN || 8;
    var col = dbRef();
    if (!col) {
      return Promise.resolve(sortBoard(loadLocalBoard()).slice(0, lim));
    }
    return col
      .orderBy("points", "desc")
      .limit(Math.max(lim * 3, 24))
      .get()
      .then(function (snap) {
        var rows = [];
        snap.forEach(function (doc) {
          var d = doc.data();
          rows.push({
            id: doc.id,
            name: d.name,
            points: d.points,
            time: d.time,
            right: d.right,
            wrong: d.wrong,
            combo: d.combo,
            won: d.won,
            at: d.at,
          });
        });
        return sortBoard(rows).slice(0, lim);
      })
      .catch(function (err) {
        console.warn("[ICARO Climb] Firestore read falló, uso local:", err && err.message);
        return sortBoard(loadLocalBoard()).slice(0, lim);
      });
  }

  /** @returns {Promise<void>} */
  function submitScore(entry) {
    var row = {
      name: String(entry.name || "Anónimo").trim().slice(0, 18) || "Anónimo",
      points: Math.max(0, Math.round(Number(entry.points) || 0)),
      time: Math.max(0, Math.round(Number(entry.time) || 0)),
      right: Math.max(0, Math.round(Number(entry.right) || 0)),
      wrong: Math.max(0, Math.round(Number(entry.wrong) || 0)),
      combo: Math.max(0, Math.round(Number(entry.combo) || 0)),
      won: !!entry.won,
      at: Date.now(),
      source: "icaro-climb",
    };

    localStorage.setItem(LOCAL_NAME, row.name);

    // Siempre espejo local (offline / fallback)
    var local = loadLocalBoard();
    local.push(row);
    saveLocalBoard(sortBoard(local));

    var col = dbRef();
    if (!col) return Promise.resolve({ remote: false, row: row });

    return col
      .add(row)
      .then(function () {
        return { remote: true, row: row };
      })
      .catch(function (err) {
        console.warn("[ICARO Climb] Firestore write falló, quedó en local:", err && err.message);
        return { remote: false, row: row, error: err };
      });
  }

  global.IcaroClimbScores = {
    LOCAL_NAME: LOCAL_NAME,
    LOCAL_BEST: LOCAL_BEST,
    remoteReady: remoteReady,
    fetchBoard: fetchBoard,
    submitScore: submitScore,
    loadLocalBoard: loadLocalBoard,
  };
})(window);
