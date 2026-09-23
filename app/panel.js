/* Panel de registros ICARO.
   Lee apps/icaro/consultas solo con sesión de Firebase Auth.
   No guarda pacientes en localStorage. */

(function () {
  var LIMIT = 300;
  var TZ = "America/El_Salvador";

  var rows = [];
  var selectedId = null;
  var nivel = "TODOS";
  var atencion = "TODOS";
  var query = "";
  var stopListen = null;
  var savingId = null;
  var preview = false;
  var userEmail = "";
  var loadError = false;

  function $(id) { return document.getElementById(id); }

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null && text !== "") n.textContent = text;
    return n;
  }

  function localPreview() {
    var host = location.hostname;
    if (host !== "localhost" && host !== "127.0.0.1") return false;
    return location.hash === "#preview";
  }

  function normNivel(v) {
    var s = String(v || "").trim().toUpperCase();
    if (s === "ROJO" || s === "RED" || s.indexOf("ROJ") === 0) return "ROJO";
    if (s === "AMARILLO" || s === "YELLOW" || s.indexOf("AMA") === 0 || s.indexOf("YEL") === 0) return "AMARILLO";
    if (s === "VERDE" || s === "GREEN" || s.indexOf("VER") === 0) return "VERDE";
    return s || "SIN NIVEL";
  }

  function nivelClass(v) {
    var n = normNivel(v);
    if (n === "ROJO" || n === "AMARILLO" || n === "VERDE") return "n-" + n;
    return "";
  }

  function isAtendido(v) {
    return v === true || v === 1 || v === "1";
  }

  function digits(s) {
    return String(s || "").replace(/\D/g, "");
  }

  function showText(v) {
    if (v == null || v === "") return "";
    if (typeof v === "boolean") return v ? "Sí" : "No";
    if (typeof v === "number" && isFinite(v)) return String(v);
    return String(v);
  }

  function formatWhen(ms) {
    var n = Number(ms);
    if (!isFinite(n) || n < 1577836800000) return "";
    try {
      return new Intl.DateTimeFormat("es-SV", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: TZ
      }).format(new Date(n));
    } catch (e) {
      return "";
    }
  }

  function fechaLabel(row) {
    if (row.fecha) return String(row.fecha);
    return formatWhen(row.fecha_ms) || "Sin fecha";
  }

  function edadLabel(v) {
    if (v == null || v === "") return "";
    if (typeof v === "number") return v + " años";
    return String(v);
  }

  function vitalLabel(v, unit) {
    if (v == null || v === "") return "";
    if (typeof v === "number") {
      var n = Math.round(v * 10) / 10;
      return String(n) + (unit ? " " + unit : "");
    }
    return String(v);
  }

  function matchesQuery(row, q) {
    if (!q) return true;
    var blob = [row.nombre, row.dui, row.motivos, row.molestia, row.observacion, row.otros]
      .join(" ")
      .toLowerCase();
    if (blob.indexOf(q.toLowerCase()) !== -1) return true;
    var qDigits = digits(q);
    return qDigits.length >= 3 && digits(row.dui).indexOf(qDigits) !== -1;
  }

  function filtered() {
    return rows.filter(function (row) {
      var n = normNivel(row.nivel);
      if (nivel !== "TODOS" && n !== nivel) return false;
      var done = isAtendido(row.atendido);
      if (atencion === "PENDIENTES" && done) return false;
      if (atencion === "ATENDIDOS" && !done) return false;
      return matchesQuery(row, query);
    });
  }

  function setLoginError(msg, ok) {
    var node = $("login-error");
    if (!node) return;
    node.textContent = msg || "";
    node.classList.toggle("is-ok", !!ok);
  }

  function authMessage(code) {
    if (code === "auth/invalid-credential" || code === "auth/wrong-password" || code === "auth/user-not-found" || code === "auth/invalid-email") {
      return "Correo o contraseña incorrectos.";
    }
    if (code === "auth/too-many-requests") return "Demasiados intentos. Espera un momento.";
    if (code === "auth/network-request-failed") return "Sin conexión con Firebase.";
    if (code === "auth/unauthorized-domain") return "Agrega viam.es en Firebase Authentication → Settings → Authorized domains.";
    if (code === "auth/operation-not-allowed") return "Activa el proveedor Correo/contraseña en Firebase Authentication.";
    if (code === "auth/user-disabled") return "Esta cuenta está desactivada.";
    return "No se pudo entrar. Revisa el correo y la contraseña.";
  }

  function showLoginForm() {
    $("boot").hidden = true;
    $("login").hidden = false;
    $("who").hidden = true;
    $("who").textContent = "";
    $("logout").hidden = true;
    $("gate").hidden = false;
    $("panel").hidden = true;
  }

  function clearListen() {
    if (stopListen) {
      stopListen();
      stopListen = null;
    }
  }

  function clearPatientView() {
    clearListen();
    rows = [];
    selectedId = null;
    savingId = null;
    userEmail = "";
    loadError = false;
    var list = $("list");
    var detail = $("detail");
    var stats = $("stats");
    if (list) list.replaceChildren();
    if (detail) detail.replaceChildren();
    if (stats) stats.replaceChildren();
    var banner = $("banner");
    if (banner) {
      banner.hidden = true;
      banner.textContent = "";
    }
  }

  function showBanner(msg, ok) {
    var banner = $("banner");
    if (!banner) return;
    banner.hidden = !msg;
    banner.textContent = msg || "";
    banner.className = ok ? "banner ok" : "banner";
  }

  function bindLogin() {
    $("login").addEventListener("submit", function (e) {
      e.preventDefault();
      var auth = window.ViamFirebase && ViamFirebase.auth && ViamFirebase.auth();
      if (!auth) {
        setLoginError("Firebase no está listo en esta página.");
        return;
      }
      var email = $("email").value.trim();
      var password = $("password").value;
      var btn = $("login").querySelector("button[type=submit]");
      btn.disabled = true;
      setLoginError("");
      auth.signInWithEmailAndPassword(email, password).then(function () {
        btn.disabled = false;
        $("password").value = "";
      }).catch(function (err) {
        btn.disabled = false;
        setLoginError(authMessage(err && err.code));
      });
    });

    $("forgot").addEventListener("click", function () {
      var auth = window.ViamFirebase && ViamFirebase.auth && ViamFirebase.auth();
      var email = $("email").value.trim();
      if (!email) {
        setLoginError("Escribe el correo para enviar el enlace.");
        return;
      }
      if (!auth) return;
      auth.sendPasswordResetEmail(email).then(function () {
        setLoginError("Si esa cuenta existe, Firebase envió el enlace para restablecer la contraseña.", true);
      }).catch(function (err) {
        setLoginError(authMessage(err && err.code));
      });
    });

    $("logout").addEventListener("click", function () {
      if (preview) {
        location.hash = "";
        location.reload();
        return;
      }
      clearPatientView();
      var auth = ViamFirebase.auth && ViamFirebase.auth();
      if (auth) auth.signOut();
    });
  }

  function bindFilters() {
    $("q").addEventListener("input", function () {
      query = this.value.trim();
      renderStats();
      renderList();
    });

    document.querySelectorAll("[data-nivel]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        nivel = btn.getAttribute("data-nivel");
        syncSegs();
        renderStats();
        renderList();
      });
    });

    document.querySelectorAll("[data-atencion]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        atencion = btn.getAttribute("data-atencion");
        syncSegs();
        renderStats();
        renderList();
      });
    });
  }

  function syncSegs() {
    document.querySelectorAll("[data-nivel]").forEach(function (btn) {
      btn.classList.toggle("is-on", btn.getAttribute("data-nivel") === nivel);
    });
    document.querySelectorAll("[data-atencion]").forEach(function (btn) {
      btn.classList.toggle("is-on", btn.getAttribute("data-atencion") === atencion);
    });
  }

  function renderStats() {
    var box = $("stats");
    box.replaceChildren();
    var counts = { TODOS: rows.length, PENDIENTES: 0, ROJO: 0, AMARILLO: 0, VERDE: 0 };
    rows.forEach(function (row) {
      if (!isAtendido(row.atendido)) counts.PENDIENTES += 1;
      var n = normNivel(row.nivel);
      if (counts[n] != null && n !== "TODOS" && n !== "PENDIENTES") counts[n] += 1;
    });
    [
      ["TODOS", "Registros", ""],
      ["PENDIENTES", "Pendientes", ""],
      ["ROJO", "Rojo", "n-ROJO"],
      ["AMARILLO", "Amarillo", "n-AMARILLO"],
      ["VERDE", "Verde", "n-VERDE"]
    ].forEach(function (item) {
      var btn = el("button", "stat " + item[2]);
      btn.type = "button";
      btn.appendChild(el("b", "", String(counts[item[0]] || 0)));
      btn.appendChild(el("span", "", item[1]));
      btn.addEventListener("click", function () {
        if (item[0] === "PENDIENTES") {
          atencion = "PENDIENTES";
          nivel = "TODOS";
        } else if (item[0] === "TODOS") {
          atencion = "TODOS";
          nivel = "TODOS";
        } else {
          nivel = item[0];
        }
        syncSegs();
        renderList();
      });
      box.appendChild(btn);
    });
  }

  function renderList() {
    var list = $("list");
    var scroll = list.scrollTop;
    var view = filtered();
    $("count").textContent = view.length === rows.length
      ? String(rows.length)
      : view.length + " de " + rows.length;
    list.replaceChildren();
    if (!rows.length) {
      list.appendChild(el("p", "empty", loadError
        ? "No se mostraron registros."
        : (preview
          ? "Vista previa sin filas."
          : "Todavía no hay registros. Cuando Icaro suba una consulta, aparece aquí.")));
      return;
    }
    if (!view.length) {
      list.appendChild(el("p", "empty", "Ningún registro coincide con el filtro."));
      return;
    }
    view.forEach(function (row) {
      var n = normNivel(row.nivel);
      var btn = el("button", "row " + nivelClass(row.nivel) + (row.id === selectedId ? " is-on" : ""));
      btn.type = "button";
      if (row.id === selectedId) btn.setAttribute("aria-current", "true");
      var name = el("span", "row-name", row.nombre ? String(row.nombre) : "Sin nombre");
      var badge = el("span", "badge " + nivelClass(row.nivel), n);
      var metaBits = [];
      if (row.dui) metaBits.push(String(row.dui));
      if (row.edad != null && row.edad !== "") metaBits.push(edadLabel(row.edad));
      metaBits.push(fechaLabel(row));
      if (isAtendido(row.atendido)) metaBits.push("Atendido");
      var meta = el("span", "row-meta", metaBits.join(" · "));
      btn.appendChild(name);
      btn.appendChild(badge);
      btn.appendChild(meta);
      btn.addEventListener("click", function () {
        selectedId = row.id;
        renderList();
        renderDetail();
        if (window.matchMedia("(max-width: 900px)").matches) {
          $("detail").scrollIntoView({ behavior: "smooth", block: "start" });
        }
      });
      list.appendChild(btn);
    });
    list.scrollTop = scroll;
  }

  function fieldValue(row, key) {
    if (key === "edad") return edadLabel(row.edad);
    if (key === "temperatura") return vitalLabel(row.temperatura, "°C");
    if (key === "pulso") return vitalLabel(row.pulso, "lpm");
    if (key === "nivel") return normNivel(row.nivel);
    if (key === "atendido" || key === "subido") {
      if (row[key] == null || row[key] === "") return "";
      return isAtendido(row[key]) || row[key] === true ? "Sí" : "No";
    }
    if (key === "fecha") return fechaLabel(row);
    if (key === "alarma" && typeof row.alarma === "boolean") return row.alarma ? "Sí" : "No";
    return showText(row[key]);
  }

  function addGroup(parent, title, fields, row, always) {
    var shown = fields.filter(function (f) {
      return always[f[0]] || fieldValue(row, f[0]);
    });
    if (!shown.length) return;
    parent.appendChild(el("h3", "group-title", title));
    shown.forEach(function (f) {
      var wrap = el("div", "kv2");
      wrap.appendChild(el("dt", "", f[1]));
      wrap.appendChild(el("dd", "", fieldValue(row, f[0]) || "—"));
      parent.appendChild(wrap);
    });
  }

  function fotoNode(row) {
    var raw = typeof row.foto === "string" ? row.foto.trim() : "";
    if (!raw) return null;
    var safe = "";
    if (/^https:\/\/\S+$/i.test(raw) && raw.length < 2000) safe = raw;
    else if (/^data:image\/(png|jpeg|jpg|webp);base64,[a-z0-9+/=\s]+$/i.test(raw) && raw.length < 120000) safe = raw;
    var box = el("div", "");
    box.appendChild(el("h3", "group-title", "Foto"));
    if (!safe) {
      box.appendChild(el("p", "foto-note", "Archivo local del robot. No se puede abrir desde la web."));
      box.appendChild(el("p", "foto-note", raw.length > 180 ? raw.slice(0, 180) + "…" : raw));
      return box;
    }
    var img = el("img", "foto");
    img.alt = "Foto registrada por ICARO";
    img.referrerPolicy = "no-referrer";
    img.src = safe;
    img.addEventListener("error", function () {
      img.remove();
      box.appendChild(el("p", "foto-note", "No se pudo cargar la foto."));
    });
    box.appendChild(img);
    return box;
  }

  function renderDetail() {
    var pane = $("detail");
    pane.replaceChildren();
    var row = null;
    for (var i = 0; i < rows.length; i++) {
      if (rows[i].id === selectedId) { row = rows[i]; break; }
    }
    if (!row) {
      pane.appendChild(el("p", "empty", "Elige una consulta para ver el detalle."));
      return;
    }

    var n = normNivel(row.nivel);
    pane.appendChild(el("p", "detail-kicker", "Consulta " + row.id));
    var titleRow = el("div", "");
    titleRow.appendChild(el("h2", "", row.nombre ? String(row.nombre) : "Sin nombre"));
    pane.appendChild(titleRow);
    var sub = el("p", "detail-sub");
    sub.appendChild(el("span", "badge " + nivelClass(row.nivel), n));
    sub.appendChild(document.createTextNode("  " + fechaLabel(row)));
    pane.appendChild(sub);

    var actions = el("div", "detail-actions");
    var mark = el("button", "btn primary", savingId === row.id
      ? "Guardando…"
      : (isAtendido(row.atendido) ? "Volver a pendiente" : "Marcar atendido"));
    mark.type = "button";
    mark.disabled = savingId === row.id;
    mark.addEventListener("click", function () { toggleAtendido(row); });
    actions.appendChild(mark);
    pane.appendChild(actions);

    var always = { nombre: 1, dui: 1, nivel: 1, fecha: 1, temperatura: 1, pulso: 1, atendido: 1 };
    addGroup(pane, "Identificación", [
      ["nombre", "Nombre"],
      ["dui", "DUI"],
      ["edad", "Edad"],
      ["fecha", "Fecha"]
    ], row, always);
    addGroup(pane, "Triage", [
      ["nivel", "Nivel"],
      ["alarma", "Alarma"],
      ["motivos", "Motivos"],
      ["molestia", "Molestia"],
      ["tiempo", "Tiempo"],
      ["intensidad", "Intensidad"],
      ["otros", "Otros"]
    ], row, always);
    addGroup(pane, "Clínico", [
      ["condiciones", "Condiciones"],
      ["alergias", "Alergias"],
      ["naturaleza", "Naturaleza"],
      ["observacion", "Observación"]
    ], row, always);
    addGroup(pane, "Signos", [
      ["temperatura", "Temperatura"],
      ["pulso", "Pulso"]
    ], row, always);
    addGroup(pane, "Seguimiento", [
      ["atendido", "Atendido"],
      ["atendido_en", "Atendido en"],
      ["atendido_por", "Marcado por"],
      ["subido", "Subido"],
      ["sqlite_id", "ID local"],
      ["origen", "Origen"]
    ], row, always);

    var foto = fotoNode(row);
    if (foto) pane.appendChild(foto);
  }

  function mapDoc(doc) {
    var data = doc.data() || {};
    var copy = {};
    Object.keys(data).forEach(function (k) { copy[k] = data[k]; });
    copy.id = doc.id;
    return copy;
  }

  function applyRows(next) {
    rows = next;
    var still = rows.some(function (r) { return r.id === selectedId; });
    if (!still) selectedId = rows.length ? rows[0].id : null;
    renderStats();
    renderList();
    renderDetail();
  }

  function listen() {
    clearListen();
    var db = ViamFirebase.db && ViamFirebase.db();
    if (!db) {
      showBanner("No hay conexión con Firestore.");
      return;
    }
    var ref = db.collection("apps").doc("icaro").collection("consultas");
    stopListen = ref.orderBy("fecha_ms", "desc").limit(LIMIT).onSnapshot(function (snap) {
      var next = [];
      snap.forEach(function (doc) { next.push(mapDoc(doc)); });
      loadError = false;
      showBanner("");
      applyRows(next);
      $("live").hidden = false;
    }, function (err) {
      var code = err && err.code;
      loadError = true;
      if (code === "permission-denied") {
        showBanner("Esta cuenta (" + (userEmail || "sin correo") + ") no puede leer los registros. Publica firebase/firestore.rules y agrega el correo a la lista de personal.");
      } else {
        showBanner("No se pudieron cargar los registros. " + ((err && err.message) || ""));
      }
      applyRows([]);
    });
  }

  function toggleAtendido(row) {
    var next = !isAtendido(row.atendido);
    if (preview) {
      row.atendido = next;
      row.atendido_en = next ? new Date().toISOString() : "";
      row.atendido_por = next ? "vista-previa" : "";
      renderStats();
      renderList();
      renderDetail();
      return;
    }
    var db = ViamFirebase.db && ViamFirebase.db();
    if (!db || savingId) return;
    savingId = row.id;
    renderDetail();
    db.collection("apps").doc("icaro").collection("consultas").doc(row.id).update({
      atendido: next,
      atendido_en: next ? new Date().toISOString() : "",
      atendido_por: next ? userEmail : "",
      actualizado_en: Date.now()
    }).then(function () {
      savingId = null;
    }).catch(function (err) {
      savingId = null;
      showBanner("No se pudo actualizar el registro. " + ((err && err.message) || ""));
      renderDetail();
    });
  }

  function enterApp(email) {
    userEmail = email || "";
    $("who").textContent = userEmail;
    $("who").hidden = false;
    $("logout").hidden = false;
    $("gate").hidden = true;
    $("panel").hidden = false;
    $("list").replaceChildren(el("p", "empty", "Cargando registros…"));
    $("detail").replaceChildren();
    listen();
  }

  function sampleRows() {
    var now = Date.now();
    return [
      {
        id: "3",
        sqlite_id: 3,
        origen: "icaro",
        nombre: "Paciente de ejemplo",
        dui: "00000000-0",
        edad: 34,
        nivel: "ROJO",
        alarma: "Dolor torácico",
        motivos: "Dolor de pecho desde hace una hora",
        molestia: "Pecho",
        tiempo: "1 hora",
        intensidad: "8/10",
        otros: "",
        condiciones: "Hipertensión",
        alergias: "Ninguna conocida",
        naturaleza: "Agudo",
        observacion: "Datos ficticios solo para revisar el diseño.",
        temperatura: 37.4,
        pulso: 96,
        atendido: false,
        fecha: "23/09/2026 08:10",
        fecha_ms: now - 3600000,
        subido: true
      },
      {
        id: "2",
        sqlite_id: 2,
        origen: "icaro",
        nombre: "Ejemplo Amarillo",
        dui: "00000000-1",
        edad: 12,
        nivel: "AMARILLO",
        motivos: "Fiebre y dolor de garganta",
        molestia: "Garganta",
        tiempo: "2 días",
        intensidad: "5/10",
        temperatura: 38.1,
        pulso: 88,
        atendido: false,
        fecha: "23/09/2026 07:40",
        fecha_ms: now - 7200000,
        subido: true
      },
      {
        id: "1",
        sqlite_id: 1,
        origen: "icaro",
        nombre: "Ejemplo Verde",
        dui: "00000000-2",
        edad: 67,
        nivel: "VERDE",
        motivos: "Control de presión",
        temperatura: 36.5,
        pulso: 72,
        atendido: true,
        atendido_en: new Date(now - 86400000).toISOString(),
        atendido_por: "vista-previa",
        fecha: "22/09/2026 16:05",
        fecha_ms: now - 86400000,
        subido: true
      }
    ];
  }

  function enterPreview() {
    preview = true;
    userEmail = "vista previa local";
    $("who").textContent = userEmail;
    $("who").hidden = false;
    $("logout").hidden = false;
    $("logout").textContent = "Cerrar vista";
    $("gate").hidden = true;
    $("panel").hidden = false;
    showBanner("Vista previa local. Estos datos no están en Firestore y no salen de este navegador.", true);
    $("live").hidden = true;
    applyRows(sampleRows());
  }

  function boot() {
    bindLogin();
    bindFilters();
    if (localPreview()) {
      enterPreview();
      return;
    }
    var auth = window.ViamFirebase && ViamFirebase.auth && ViamFirebase.auth();
    if (!auth) {
      $("boot").textContent = "Falta la configuración de Firebase.";
      return;
    }
    auth.languageCode = "es";
    auth.onAuthStateChanged(function (user) {
      if (user) enterApp(user.email || "");
      else {
        clearPatientView();
        showLoginForm();
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
