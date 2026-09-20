(() => {
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const WORLD_W = 960;
  const ZONES = [
    { name: "Sala de espera", sub: "Ícaro registra datos", sky: ["#1b4d55", "#3d8a7a"], plat: "#1ad4a8" },
    { name: "ViamPulse", sub: "El corazón, en digital", sky: ["#14524c", "#3cb89a"], plat: "#5ee0c0" },
    { name: "ViamVision", sub: "Ultrasonido con IA", sky: ["#1a3a68", "#5b7cff"], plat: "#6d8cff" },
    { name: "IA local", sub: "Sin depender de internet", sky: ["#3a2a12", "#d4a24a"], plat: "#ffd56a" },
    { name: "Don Bosco", sub: "Soyapango · El Salvador", sky: ["#4a1e2e", "#e07a8a"], plat: "#ff8ba0" },
    { name: "CREA-J 2026", sub: "La cima del proyecto", sky: ["#3a2f10", "#f3c98a"], plat: "#ffe08a" },
  ];
  const ZONE_H = 780;
  const WORLD_H = 80 + ZONES.length * ZONE_H;

  const TIME_LIMIT = 180;
  const BEST_KEY = "icaro-climb-best";
  const NAME_KEY = "icaro-climb-name";
  const Scores = window.IcaroClimbScores;
  const keys = Object.create(null);
  const hud = {
    zone: document.getElementById("zone-name"),
    height: document.getElementById("height-num"),
    energy: document.getElementById("energy-num"),
    fill: document.getElementById("energy-fill"),
    combo: document.getElementById("combo-num"),
    score: document.getElementById("score-num"),
    time: document.getElementById("time-num"),
    rail: document.getElementById("rail"),
    hud: document.getElementById("hud"),
    menu: document.getElementById("screen-menu"),
    pause: document.getElementById("screen-pause"),
    end: document.getElementById("screen-end"),
    qmodal: document.getElementById("qmodal"),
    qtext: document.getElementById("q-text"),
    qans: document.getElementById("q-answers"),
    qfeed: document.getElementById("q-feed"),
    menuBest: document.getElementById("menu-best"),
  };

  const state = {
    mode: "menu",
    asking: false,
    askCool: 0,
    t: 0,
    time: 0,
    left: 180,
    won: false,
    energy: 100,
    combo: 1,
    maxCombo: 1,
    points: 0,
    savedRun: false,
    right: 0,
    wrong: 0,
    check: 0,
    deck: [],
    qi: 0,
    player: null,
    plats: [],
    bits: [],
    orbs: [],
    cam: WORLD_H,
    banner: "",
    bannerT: 0,
    best: Number(localStorage.getItem(BEST_KEY) || 0),
  };
  function loadBoard() {
    if (Scores && Scores.loadLocalBoard) return Scores.loadLocalBoard();
    try { return JSON.parse(localStorage.getItem("icaro-climb-board") || "[]"); }
    catch { return []; }
  }
  function pointsNow() {
    const sec = Math.round(state.time);
    return Math.max(0, state.right * 120 + state.maxCombo * 35 - state.wrong * 15 + Math.round(state.left));
  }
  function renderBoard(el, limit, rows) {
    const board = (rows || loadBoard()).slice(0, limit || 8);
    if (!board.length) {
      el.innerHTML = `<div class="row"><span></span><span>Aún no hay nombres. ¡Sé el primero!</span><span></span><span></span></div>`;
      return;
    }
    el.innerHTML = board.map((r, i) =>
      `<div class="row"><span class="n">${i + 1}</span><span>${r.name}</span><span class="pts">${r.points}</span><span class="tm">${r.time}s</span></div>`
    ).join("");
  }
  function refreshBoards() {
    const menu = document.getElementById("menu-board");
    const end = document.getElementById("end-board");
    if (!Scores || !Scores.fetchBoard) {
      renderBoard(menu, 5);
      if (end) renderBoard(end, 8);
      return Promise.resolve();
    }
    return Scores.fetchBoard(8).then((rows) => {
      renderBoard(menu, 5, rows);
      if (end && !end.closest(".hidden")) renderBoard(end, 8, rows);
    });
  }
  refreshBoards();
  const lastName = localStorage.getItem(NAME_KEY) || "";
  const nameInput = document.getElementById("score-name");
  if (lastName) nameInput.value = lastName;

  function resize() {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.floor(innerWidth * dpr);
    canvas.height = Math.floor(innerHeight * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  addEventListener("resize", resize);
  resize();

  function gy(fromGround) { return WORLD_H - fromGround; }
  function shuffle(list) {
    const a = list.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = (Math.random() * (i + 1)) | 0;
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function buildMap() {
    const plats = [{ x: 0, y: WORLD_H - 48, w: WORLD_W, h: 48, type: "ground", zone: 0 }];
    for (let s = 0; s < ZONES.length; s++) {
      const base = 48 + s * ZONE_H;
      plats.push({ x: 40, y: gy(base + 20), w: 200, h: 22, type: "check", zone: s });
      for (let i = 0; i < 7; i++) {
        const left = i % 2 === 0;
        plats.push({
          x: left ? 90 : 530,
          y: gy(base + 120 + i * 92),
          w: 300,
          h: 20,
          type: i === 3 ? "ask" : "plat",
          zone: s,
        });
      }
    }
    plats.push({ x: 330, y: 70, w: 300, h: 24, type: "goal", zone: 5 });
    return plats;
  }

  function reset() {
    state.t = 0; state.time = 0; state.left = TIME_LIMIT; state.won = false; state.energy = 100; state.combo = 1;
    state.maxCombo = 1; state.points = 0; state.savedRun = false;
    state.right = 0; state.wrong = 0; state.check = 0; state.qi = 0;
    state.deck = shuffle(QUESTIONS);
    state.asking = false;
    state.askCool = 0;
    state.bits = [];
    state.orbs = [];
    state.plats = buildMap();
    state.player = {
      x: 420, y: WORLD_H - 48 - 76, w: 46, h: 76,
      vx: 0, vy: 0, on: false, jumps: 2, face: 1, coyote: 0, buf: 0,
    };
    state.cam = state.player.y;
    state.plats.forEach((p) => {
      if (p.type === "plat" || p.type === "ask") {
        state.orbs.push({ x: p.x + p.w / 2, y: p.y - 22, got: false });
      }
    });
    updateHud();
  }

  function start() {
    reset();
    state.mode = "play";
    hud.menu.classList.add("hidden");
    hud.pause.classList.add("hidden");
    hud.end.classList.add("hidden");
    hud.qmodal.classList.add("hidden");
    hud.hud.classList.remove("hidden");
    hud.end.classList.remove("over");
    Music.play();
    const mb = document.getElementById("btn-music");
    if (mb) mb.textContent = "♪ ON";
  }

  function finish(won) {
    if (state.mode === "end") return;
    state.mode = "end";
    state.won = won;
    state.points = pointsNow();
    Music.stop();
    if (won) Music.win(); else Music.lose();
    hud.hud.classList.add("hidden");
    hud.qmodal.classList.add("hidden");
    state.asking = false;
    hud.end.classList.remove("hidden");
    hud.end.classList.toggle("over", !won);
    document.getElementById("saved-ok").classList.add("hidden");
    const sec = Math.round(state.time);
    if (won && (!state.best || sec < state.best)) {
      state.best = sec;
      localStorage.setItem(BEST_KEY, String(sec));
    }
    const stars = won ? (state.points >= 900 ? 3 : state.points >= 550 ? 2 : 1) : 0;
    document.getElementById("end-stars").textContent = won ? "★".repeat(stars) + "☆".repeat(3 - stars) : "GAME OVER";
    document.getElementById("end-kicker").textContent = won ? "STAGE CLEAR" : "TIME UP";
    document.getElementById("end-title").textContent = won ? "ÍCARO WINS" : "GAME OVER";
    document.getElementById("end-points").textContent = state.points.toLocaleString("es");
    document.getElementById("end-text").textContent = won
      ? `${fmtTime(state.left)} restantes · ${state.right} bien · combo x${state.maxCombo}`
      : "Se acabó el tiempo. Ícaro no llegó a la cima.";
    renderBoard(document.getElementById("end-board"), 8);
    refreshBoards();
    setTimeout(() => nameInput.focus(), 200);
  }
  function win() { finish(true); }
  function gameOver() { finish(false); }

  function fmtTime(sec) {
    const s = Math.max(0, Math.ceil(sec));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  }

  function saveScore(ev) {
    if (ev) ev.preventDefault();
    if (state.savedRun) return;
    const name = (nameInput.value || "").trim().slice(0, 18) || "Anónimo";
    nameInput.value = name;
    const entry = {
      name,
      points: state.points,
      time: Math.round(state.time),
      right: state.right,
      wrong: state.wrong,
      combo: state.maxCombo,
      won: !!state.won,
    };
    const ok = document.getElementById("saved-ok");
    const btn = document.getElementById("btn-save");
    if (btn) btn.disabled = true;
    const done = (remote) => {
      state.savedRun = true;
      ok.textContent = remote
        ? "Quedó en el mural global."
        : "Guardado en este dispositivo (Firebase no configurado o sin red).";
      ok.classList.remove("hidden");
      refreshBoards();
      if (btn) btn.disabled = false;
    };
    if (Scores && Scores.submitScore) {
      Scores.submitScore(entry).then((res) => done(!!res.remote));
      return;
    }
    localStorage.setItem(NAME_KEY, name);
    const board = loadBoard();
    board.push({ ...entry, at: Date.now() });
    board.sort((a, b) => b.points - a.points || a.time - b.time);
    localStorage.setItem("icaro-climb-board", JSON.stringify(board.slice(0, 12)));
    done(false);
  }

  document.getElementById("btn-play").onclick = start;
  document.getElementById("btn-again").onclick = start;
  document.getElementById("score-form").addEventListener("submit", saveScore);
  document.getElementById("btn-resume").onclick = () => { state.mode = "play"; hud.pause.classList.add("hidden"); };
  document.getElementById("btn-menu").onclick = () => {
    state.mode = "menu";
    hud.pause.classList.add("hidden");
    hud.end.classList.add("hidden");
    hud.hud.classList.add("hidden");
    hud.qmodal.classList.add("hidden");
    hud.menu.classList.remove("hidden");
    Music.stop();
  };
  document.getElementById("btn-ask").onclick = () => { if (state.mode === "play") openQ(); };
  const musicBtn = document.getElementById("btn-music");
  if (musicBtn) {
    musicBtn.onclick = () => {
      const on = Music.toggle();
      musicBtn.textContent = on ? "♪ ON" : "♪ OFF";
    };
  }

  addEventListener("keydown", (e) => {
    const typing = e.target && (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA");
    if (typing) return;
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(e.key)) e.preventDefault();
    keys[e.key] = true;
    if (e.key === "Enter" && state.mode === "menu") start();
    if (state.asking && ["1", "2", "3", "4"].includes(e.key)) {
      const btn = hud.qans.children[Number(e.key) - 1];
      if (btn) btn.click();
    }
    if (e.key === "Escape") {
      if (state.asking) return;
      if (state.mode === "play") { state.mode = "pause"; hud.pause.classList.remove("hidden"); }
      else if (state.mode === "pause") { state.mode = "play"; hud.pause.classList.add("hidden"); }
    }
    if ((e.key === "e" || e.key === "E" || e.key === "q" || e.key === "Q") && state.mode === "play" && !state.asking) openQ();
  });
  addEventListener("keyup", (e) => { keys[e.key] = false; });

  function zoneOf(y) {
    const fromG = WORLD_H - y;
    return Math.min(ZONES.length - 1, Math.max(0, Math.floor((fromG - 48) / ZONE_H)));
  }
  function meters() {
    return Math.max(0, Math.round((WORLD_H - (state.player.y + state.player.h) - 48) / 8));
  }

  function updateHud() {
    const z = zoneOf(state.player.y);
    hud.zone.textContent = ZONES[z].name;
    hud.height.textContent = `${meters()} m`;
    hud.energy.textContent = String(Math.round(state.energy));
    hud.fill.style.width = `${Math.max(0, state.energy)}%`;
    hud.combo.textContent = `x${state.combo}`;
    state.points = pointsNow();
    if (hud.score) hud.score.textContent = String(state.points);
    if (hud.time) {
      hud.time.textContent = fmtTime(state.left);
      hud.time.parentElement.classList.toggle("low", state.left <= 30);
    }
    if (hud.rail) {
      const pct = Math.min(1, meters() / 580);
      hud.rail.innerHTML = `<i style="top:${(1 - pct) * 100}%"></i>`;
    }
  }

  function nextQ() {
    if (state.qi >= state.deck.length) {
      state.deck = shuffle(QUESTIONS);
      state.qi = 0;
    }
    return state.deck[state.qi++];
  }

  function openQ() {
    if (state.asking) return;
    const raw = nextQ();
    const opts = raw.options.map((text, i) => ({ text, ok: i === raw.a }));
    state.current = { q: raw.q, explain: raw.explain, opts: shuffle(opts) };
    state.asking = true;
    hud.qtext.textContent = raw.q;
    hud.qfeed.classList.add("hidden");
    hud.qans.innerHTML = "";
    state.current.opts.forEach((o, i) => {
      const b = document.createElement("button");
      b.className = "qbtn";
      b.type = "button";
      b.textContent = `${i + 1}.  ${o.text}`;
      b.onclick = () => answer(o, b);
      hud.qans.appendChild(b);
    });
    hud.qmodal.classList.remove("hidden");
    blip(520, 0.06);
  }

  let audio;
  function blip(freq, dur) {
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      if (!audio) audio = new AC();
      const o = audio.createOscillator();
      const g = audio.createGain();
      o.type = "triangle";
      o.frequency.value = freq;
      g.gain.value = 0.04;
      o.connect(g).connect(audio.destination);
      o.start();
      g.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + dur);
      o.stop(audio.currentTime + dur);
    } catch (_) { /* ignore */ }
  }

  function answer(opt, btn) {
    if (!state.asking || state.locked) return;
    state.locked = true;
    [...hud.qans.children].forEach((el, i) => {
      if (state.current.opts[i].ok) el.classList.add("ok");
    });
    if (opt.ok) {
      btn.classList.add("ok");
      state.right += 1;
      state.combo = Math.min(12, state.combo + 1);
      state.maxCombo = Math.max(state.maxCombo, state.combo);
      state.energy = Math.min(100, state.energy + 22 + state.combo * 2);
      hud.qfeed.textContent = "✓  " + state.current.explain;
      burst(state.player.x + 20, state.player.y, "#1ad4a8");
      blip(720, 0.08);
    } else {
      btn.classList.add("bad");
      state.wrong += 1;
      state.combo = 1;
      state.energy = Math.min(100, state.energy + 8);
      hud.qfeed.textContent = state.current.explain;
      blip(180, 0.1);
    }
    hud.qfeed.classList.remove("hidden");
    setTimeout(() => {
      state.asking = false;
      state.locked = false;
      hud.qmodal.classList.add("hidden");
      if (opt.ok && state.player) state.player.vy = -420;
    }, 1100);
  }

  function burst(x, y, color) {
    for (let i = 0; i < 14; i++) {
      const a = Math.random() * Math.PI * 2, s = 80 + Math.random() * 160;
      state.bits.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.55, color });
    }
  }

  function spawnCheck(p, zone) {
    const c = state.plats.find((b) => b.type === "check" && b.zone === zone) || state.plats[0];
    p.x = c.x + 40;
    p.y = c.y - p.h;
    p.vx = 0; p.vy = 0;
  }

  function update(dt) {
    if (state.mode !== "play") return;
    state.left -= dt;
    if (state.left <= 0) {
      state.left = 0;
      gameOver();
      return;
    }
    if (state.asking) {
      updateHud();
      return;
    }
    state.t += dt;
    state.time += dt;
    state.bannerT = Math.max(0, state.bannerT - dt);
    state.askCool = Math.max(0, (state.askCool || 0) - dt);
    const p = state.player;
    const left = keys.ArrowLeft || keys.a || keys.A;
    const right = keys.ArrowRight || keys.d || keys.D;
    const jump = keys.ArrowUp || keys.w || keys.W || keys[" "];

    const acc = 2400, max = 290, fric = 1800;
    if (left) { p.vx -= acc * dt; p.face = -1; }
    if (right) { p.vx += acc * dt; p.face = 1; }
    if (!left && !right) {
      if (p.on) p.vx -= Math.sign(p.vx) * Math.min(Math.abs(p.vx), fric * dt);
    }
    p.vx = Math.max(-max, Math.min(max, p.vx));

    if (jump) p.buf = 0.12;
    else p.buf = Math.max(0, p.buf - dt);
    if (p.on) p.coyote = 0.1;
    else p.coyote = Math.max(0, p.coyote - dt);
    if (p.buf > 0 && (p.on || p.coyote > 0 || p.jumps > 0) && state.energy > 4) {
      const grounded = p.on || p.coyote > 0;
      p.vy = -700;
      p.on = false;
      p.buf = 0;
      p.coyote = 0;
      p.jumps = grounded ? 1 : p.jumps - 1;
      state.energy -= 3.2;
      burst(p.x + 20, p.y + 70, "#7ff6d4");
    }

    p.vy += 2050 * dt;
    if (p.vy > 980) p.vy = 980;

    p.x += p.vx * dt;
    p.y += p.vy * dt;
    if (p.x < 8) p.x = 8;
    if (p.x + p.w > WORLD_W - 8) p.x = WORLD_W - 8 - p.w;

    p.on = false;
    for (const b of state.plats) {
      if (p.x + p.w < b.x + 6 || p.x > b.x + b.w - 6) continue;
      const prevY = p.y - p.vy * dt;
      if (p.vy >= 0 && prevY + p.h <= b.y + 8 && p.y + p.h >= b.y && p.y + p.h <= b.y + 28) {
        p.y = b.y - p.h;
        p.vy = 0;
        if (!p.on && p.vy > 200) burst(p.x + 22, b.y, "rgba(255,255,255,0.7)");
        p.on = true;
        p.jumps = 2;
        if (b.type === "check") {
          if (b.zone > state.check) {
            state.check = b.zone;
            state.banner = ZONES[b.zone].name;
            state.bannerT = 1.6;
            state.energy = Math.min(100, state.energy + 10);
          }
        }
        if (b.type === "ask" && state.energy < 40 && state.askCool <= 0) {
          state.askCool = 1.2;
          openQ();
        }
        if (b.type === "goal") win();
      }
    }

    if (p.y > WORLD_H + 40) spawnCheck(p, state.check);

    const moving = left || right;
    state.energy -= (moving ? 3.2 : 0.8) * dt;
    if (state.energy <= 0) {
      state.energy = 0;
      openQ();
    }

    for (const o of state.orbs) {
      if (o.got) continue;
      if (Math.hypot(o.x - (p.x + 23), o.y - (p.y + 30)) < 28) {
        o.got = true;
        state.energy = Math.min(100, state.energy + 6);
        burst(o.x, o.y, "#ffd56a");
      }
    }
    for (let i = state.bits.length - 1; i >= 0; i--) {
      const b = state.bits[i];
      b.life -= dt; b.x += b.vx * dt; b.y += b.vy * dt;
      if (b.life <= 0) state.bits.splice(i, 1);
    }

    const target = p.y - innerHeight * 0.45;
    state.cam += (target - state.cam) * Math.min(1, dt * 6);
    updateHud();
  }

  function rr(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function drawIcaro(p) {
    const bob = p.on ? Math.sin(state.t * 8) * (Math.abs(p.vx) > 20 ? 2 : 0.4) : 0;
    ctx.save();
    ctx.translate(p.x + p.w / 2, p.y + p.h + bob);
    ctx.scale(p.face, 1);
    ctx.fillStyle = "rgba(10,20,24,0.2)";
    ctx.beginPath(); ctx.ellipse(0, -4, 16, 5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#f7fbff";
    ctx.beginPath();
    ctx.moveTo(-16, -28);
    ctx.quadraticCurveTo(-20, -8, 0, -4);
    ctx.quadraticCurveTo(20, -8, 16, -28);
    ctx.quadraticCurveTo(14, -40, 0, -44);
    ctx.quadraticCurveTo(-14, -40, -16, -28);
    ctx.fill();
    ctx.fillStyle = "#1f5bb5";
    ctx.beginPath(); ctx.arc(-9, -24, 3.4, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(9, -24, 3.4, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(0, -54, 15, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#d7efff";
    rr(-8.5, -61, 17, 13, 2.5); ctx.fill();
    ctx.fillStyle = "#1b4ea0";
    ctx.beginPath(); ctx.arc(-3, -56, 1.1, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(3, -56, 1.1, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath();
    ctx.arc(0, -52.5, 2.8, 0.15, Math.PI - 0.15);
    ctx.strokeStyle = "#1b4ea0"; ctx.lineWidth = 1.2; ctx.stroke();
    ctx.fillStyle = "#fff";
    ctx.beginPath(); ctx.ellipse(0, -70, 9.5, 4.5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#1ad4a8";
    ctx.font = "800 10px Outfit, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("+", 0, -67);
    ctx.restore();
  }

  function draw() {
    const z = state.player ? zoneOf(state.player.y) : 0;
    const sky = ctx.createLinearGradient(0, 0, 0, innerHeight);
    sky.addColorStop(0, ZONES[z].sky[0]);
    sky.addColorStop(1, ZONES[z].sky[1]);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, innerWidth, innerHeight);

    const viewW = innerWidth, viewH = innerHeight;
    const scale = Math.min(viewW / WORLD_W, 1);
    const ox = (viewW - WORLD_W * scale) / 2;
    ctx.save();
    ctx.translate(ox, -state.cam * scale + viewH * 0.08);
    ctx.scale(scale, scale);

    for (let c = 0; c < 8; c++) {
      const cx = (c * 140 + state.t * 12) % (WORLD_W + 80) - 40;
      const cy = (state.cam * 0.15 + c * 420) % WORLD_H;
      ctx.fillStyle = "rgba(255,255,255,0.08)";
      ctx.beginPath(); ctx.ellipse(cx, cy, 70, 22, 0, 0, Math.PI * 2); ctx.fill();
    }

    for (let i = 0; i < ZONES.length; i++) {
      const top = WORLD_H - 48 - (i + 1) * ZONE_H;
      ctx.fillStyle = "rgba(255,255,255,0.05)";
      ctx.fillRect(0, top, WORLD_W, ZONE_H);
      ctx.fillStyle = "rgba(255,255,255,0.22)";
      ctx.font = "800 42px Fraunces, serif";
      ctx.textAlign = "center";
      ctx.fillText(ZONES[i].name.toUpperCase(), WORLD_W / 2, top + 70);
      ctx.font = "700 16px Outfit, sans-serif";
      ctx.fillText(ZONES[i].sub, WORLD_W / 2, top + 96);
    }

    for (const b of state.plats) {
      if (b.type === "ground") {
        ctx.fillStyle = "#efe0c4";
        ctx.fillRect(b.x, b.y, b.w, b.h + 400);
        ctx.fillStyle = "#1ad4a8";
        ctx.fillRect(b.x, b.y, b.w, 8);
        continue;
      }
      ctx.fillStyle = "rgba(10,20,24,0.18)";
      rr(b.x + 4, b.y + 8, b.w, b.h, 8); ctx.fill();
      ctx.fillStyle = b.type === "goal" ? "#ffd56a" : b.type === "check" ? "#fff" : b.type === "ask" ? "#7ff6d4" : ZONES[b.zone].plat;
      rr(b.x, b.y, b.w, b.h, 8); ctx.fill();
      if (b.type === "ask") {
        ctx.fillStyle = "#123038";
        ctx.font = "800 11px Outfit, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("PREGUNTA", b.x + b.w / 2, b.y + 14);
      }
      if (b.type === "check") {
        ctx.fillStyle = "#1ad4a8";
        ctx.font = "800 11px Outfit, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("CHECKPOINT", b.x + b.w / 2, b.y + 14);
      }
      if (b.type === "goal") {
        ctx.fillStyle = "#123038";
        ctx.font = "800 12px Outfit, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("CIMA  ·  CREA-J", b.x + b.w / 2, b.y + 16);
      }
    }

    for (const o of state.orbs) {
      if (o.got) continue;
      const bob = Math.sin(state.t * 4 + o.x) * 4;
      ctx.fillStyle = "rgba(255,213,106,0.3)";
      ctx.beginPath(); ctx.arc(o.x, o.y + bob, 12, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#ffd56a";
      ctx.beginPath(); ctx.arc(o.x, o.y + bob, 5, 0, Math.PI * 2); ctx.fill();
    }

    if (state.player) drawIcaro(state.player);

    for (const b of state.bits) {
      ctx.globalAlpha = b.life / 0.55;
      ctx.fillStyle = b.color;
      ctx.beginPath(); ctx.arc(b.x, b.y, 3, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.restore();

    if (state.bannerT > 0) {
      ctx.globalAlpha = Math.min(1, state.bannerT);
      ctx.fillStyle = "#fffdf6";
      ctx.font = "800 40px Fraunces, serif";
      ctx.textAlign = "center";
      ctx.fillText(state.banner, innerWidth / 2, innerHeight * 0.28);
      ctx.globalAlpha = 1;
    }
  }

  let last = performance.now();
  function loop(now) {
    const dt = Math.min(0.033, (now - last) / 1000);
    last = now;
    update(dt);
    draw();
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
})();
