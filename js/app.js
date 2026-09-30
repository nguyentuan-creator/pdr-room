'use strict';

(function () {
  const ROOM = 10;
  const canvas = document.getElementById('room');
  const ctx = canvas.getContext('2d');
  const $ = function (id) { return document.getElementById(id); };

  const trail = [];
  const start = { x: 5, y: 5 };
  let running = false;
  let sensorsAttached = false;
  let hasAbsolute = false;
  let lastWallToast = 0;
  let pxPerM = 50;

  // ---------- vẽ ----------
  function resize() {
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth || 320;
    canvas.width = Math.round(w * dpr);
    canvas.height = canvas.width;
    pxPerM = canvas.width / ROOM;
    draw();
  }

  function draw() {
    const W = canvas.width;
    const st = PDR.st;
    ctx.clearRect(0, 0, W, W);

    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, W, W);

    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;
    for (let i = 1; i < ROOM; i++) {
      ctx.beginPath(); ctx.moveTo(i * pxPerM, 0); ctx.lineTo(i * pxPerM, W); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, i * pxPerM); ctx.lineTo(W, i * pxPerM); ctx.stroke();
    }

    ctx.fillStyle = '#94a3b8';
    ctx.font = 'bold ' + Math.max(10, Math.round(pxPerM * 0.3)) + 'px sans-serif';
    ctx.fillText('(0, 0)', 6, Math.max(16, pxPerM * 0.5));
    const north = 'Bắc';
    ctx.fillText(north, (W - ctx.measureText(north).width) / 2, Math.max(16, pxPerM * 0.5));

    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = Math.max(4, pxPerM * 0.12);
    ctx.strokeRect(0, 0, W, W);

    // điểm khởi tạo (mốc tham chiếu duy nhất, thay cho QR)
    ctx.strokeStyle = '#16a34a';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(start.x * pxPerM, start.y * pxPerM, pxPerM * 0.45, 0, Math.PI * 2); ctx.stroke();

    // vết đi
    if (trail.length > 1) {
      ctx.strokeStyle = 'rgba(37, 99, 235, 0.55)';
      ctx.lineWidth = Math.max(2, pxPerM * 0.06);
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(trail[0].x * pxPerM, trail[0].y * pxPerM);
      for (let i = 1; i < trail.length; i++) ctx.lineTo(trail[i].x * pxPerM, trail[i].y * pxPerM);
      ctx.stroke();
    }

    // vòng sai số tích luỹ (đứt nét)
    if (st.steps > 0) {
      ctx.setLineDash([6, 6]);
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.5)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(st.x * pxPerM, st.y * pxPerM, Math.min(st.driftR, ROOM / 2) * pxPerM, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // vị trí hiện tại
    ctx.fillStyle = '#ef4444';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(st.x * pxPerM, st.y * pxPerM, Math.max(6, pxPerM * 0.18), 0, Math.PI * 2); ctx.fill(); ctx.stroke();

    // mũi tên hướng đi
    if (st.headingValid) {
      const hd = (((st.headingDeg + st.headingOffset) % 360) + 360) % 360;
      const rad = hd * Math.PI / 180;
      const cx = st.x * pxPerM, cy = st.y * pxPerM;
      const L = pxPerM * 0.8;
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + L * Math.sin(rad), cy - L * Math.cos(rad));
      ctx.stroke();
    }
  }

  // ---------- trạng thái ----------
  const DIR_NAMES = ['B', 'BĐ', 'Đ', 'ĐN', 'N', 'TN', 'T', 'TB'];

  function updateCompassUI() {
    const st = PDR.st;
    if (!st.headingValid) { $('hdgText').textContent = 'hướng: —'; return; }
    const hd = Math.round((((st.headingDeg + st.headingOffset) % 360) + 360) % 360);
    $('needle').style.transform = 'rotate(' + hd + 'deg)';
    $('hdgText').textContent = 'hướng: ' + hd + '° (' + DIR_NAMES[Math.round(hd / 45) % 8] + ')';
    $('stHdg').textContent = hd + '°';
  }

  function updateStats() {
    const st = PDR.st;
    $('stSteps').textContent = st.steps;
    $('stDist').textContent = st.distance.toFixed(1) + ' m';
    $('stPos').textContent = st.x.toFixed(1) + ', ' + st.y.toFixed(1) + ' m';
    $('stDrift').textContent = '± ' + (st.steps > 0 ? st.driftR.toFixed(1) : '0') + ' m';
    $('stWall').textContent = st.wallHits;
  }

  let toastTimer = null;
  function toast(msg) {
    const el = $('toast');
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.hidden = true; }, 3500);
  }

  function setBadge(text, active) {
    const b = $('badge');
    b.textContent = text;
    b.classList.toggle('active', !!active);
  }

  // ---------- cảm biến ----------
  async function requestSensorPermission() {
    try {
      if (typeof DeviceOrientationEvent !== 'undefined' &&
          typeof DeviceOrientationEvent.requestPermission === 'function') {
        if (await DeviceOrientationEvent.requestPermission() !== 'granted') {
          toast('Bạn đã từ chối quyền cảm biến hướng');
          return false;
        }
      }
      if (typeof DeviceMotionEvent !== 'undefined' &&
          typeof DeviceMotionEvent.requestPermission === 'function') {
        if (await DeviceMotionEvent.requestPermission() !== 'granted') {
          toast('Bạn đã từ chối quyền cảm biến chuyển động');
          return false;
        }
      }
      return true;
    } catch (err) {
      toast('Không xin được quyền cảm biến: ' + err.message);
      return false;
    }
  }

  function attachSensors() {
    if (sensorsAttached) return;
    sensorsAttached = true;
    window.addEventListener('devicemotion', onMotion, true);
    window.addEventListener('deviceorientationabsolute', onOrient, true);
    window.addEventListener('deviceorientation', onOrient, true);
  }

  function onMotion(e) {
    if (!running) return;
    const a = e.accelerationIncludingGravity;
    if (!a || a.x == null) return;
    PDR.processMotion(a.x, a.y, a.z, e.timeStamp || performance.now());
  }

  function onOrient(e) {
    if (e.type === 'deviceorientationabsolute' || e.absolute === true) hasAbsolute = true;
    if (e.type === 'deviceorientation' && hasAbsolute && e.absolute !== true) return;
    let hd = null;
    if (typeof e.webkitCompassHeading === 'number' && isFinite(e.webkitCompassHeading)) {
      hd = e.webkitCompassHeading;
    } else if (e.alpha != null && isFinite(e.alpha)) {
      hd = 360 - e.alpha;
    }
    if (hd != null) {
      PDR.setHeading(hd);
      updateCompassUI();
      draw();
    }
  }

  // ---------- điều khiển ----------
  $('btnStart').addEventListener('click', async function () {
    if (running) return;
    if (typeof DeviceMotionEvent === 'undefined') {
      toast('Trình duyệt này không hỗ trợ cảm biến — dùng phím mũi tên để mô phỏng');
    }
    if (!(await requestSensorPermission())) return;
    attachSensors();
    running = true;
    PDR.st.running = true;
    $('btnStart').disabled = true;
    $('btnStop').disabled = false;
    setBadge('Đang theo dõi PDR', true);
    toast('Đi bộ! Mỗi bước chân được tự động đếm và định vị');
  });

  $('btnStop').addEventListener('click', function () {
    running = false;
    PDR.st.running = false;
    $('btnStart').disabled = false;
    $('btnStop').disabled = true;
    setBadge('Tạm dừng', false);
  });

  $('btnReset').addEventListener('click', function () {
    running = false;
    PDR.st.running = false;
    PDR.reset(start.x, start.y);
    trail.length = 0;
    $('btnStart').disabled = false;
    $('btnStop').disabled = true;
    setBadge('Chưa hoạt động', false);
    updateStats();
    updateCompassUI();
    draw();
    toast('Đã đặt lại về điểm khởi tạo');
  });

  canvas.addEventListener('click', function (e) {
    if (running) { toast('Dừng theo dõi trước khi đổi điểm khởi tạo'); return; }
    const r = canvas.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width * ROOM;
    const y = (e.clientY - r.top) / r.height * ROOM;
    start.x = Math.min(9.5, Math.max(0.5, x));
    start.y = Math.min(9.5, Math.max(0.5, y));
    PDR.reset(start.x, start.y);
    trail.length = 0;
    updateStats();
    draw();
    toast('Điểm khởi tạo: (' + start.x.toFixed(1) + ', ' + start.y.toFixed(1) + ') m');
  });

  $('stepLen').addEventListener('input', function () {
    const v = parseFloat(this.value);
    if (v >= 0.4 && v <= 1.0) PDR.st.stepLength = v;
  });

  $('btnLeft10').addEventListener('click', function () {
    PDR.st.headingOffset -= 10;
    updateCompassUI();
    draw();
  });
  $('btnRight10').addEventListener('click', function () {
    PDR.st.headingOffset += 10;
    updateCompassUI();
    draw();
  });

  // ---------- mô phỏng cho máy tính ----------
  // Mỗi lần gọi = 1 bước chân, bơm vào CHÍNH pipeline phát hiện bước
  // một chu kỳ dao động gia tốc quanh trọng lực (nửa âm + nửa dương).
  // Đồng hồ mô phỏng riêng, luôn tăng ≥ 620 ms mỗi bước, để các burst
  // không chồng lấn mốc thời gian của bộ đếm bước.
  let simT = null;

  function simStep(dirDeg) {
    PDR.setHeading(dirDeg);
    if (simT === null) simT = performance.now();
    const t0 = simT;
    simT += 620;
    for (let k = 0; k <= 14; k++) {
      const z = 9.81 + 2.8 * Math.sin(2 * Math.PI * k / 14);
      PDR.processMotion(0.2, 0.1, z, t0 + k * 40);
    }
    updateCompassUI();
  }

  window.addEventListener('keydown', function (e) {
    const dirs = { ArrowUp: 0, ArrowRight: 90, ArrowDown: 180, ArrowLeft: 270 };
    if (!(e.key in dirs)) return;
    e.preventDefault();
    simStep(dirs[e.key]);
  });

  $('btnSimStep').addEventListener('click', function () {
    if (!PDR.st.headingValid) PDR.setHeading(0);
    let n = 0;
    const iv = setInterval(function () {
      simStep(PDR.st.headingDeg);
      if (++n >= 10) clearInterval(iv);
    }, 450);
  });

  // ---------- callback từ PDR ----------
  PDR.st.onStep = function (info) {
    trail.push({ x: info.x, y: info.y });
    if (trail.length > 500) trail.shift();
    updateStats();
    updateCompassUI();
    draw();
    const now = Date.now();
    if (info.hitWall && now - lastWallToast > 5000) {
      lastWallToast = now;
      toast('Chạm tường! Hướng có thể bị lệch — bấm −10° / +10° để hiệu chỉnh la bàn');
    }
  };

  // API kiểm thử tự động
  window.__pdrTest = {
    simStep: simStep,
    setStart: function (x, y) {
      start.x = x; start.y = y;
      PDR.reset(x, y);
      trail.length = 0;
      draw();
    },
    state: function () {
      const st = PDR.st;
      return { x: st.x, y: st.y, steps: st.steps, distance: st.distance, wallHits: st.wallHits, driftR: st.driftR, heading: st.headingDeg, offset: st.headingOffset, trailLen: trail.length, running: running };
    },
  };

  // ---------- khởi tạo ----------
  PDR.reset(5, 5);
  window.addEventListener('resize', resize);
  resize();
  updateStats();
  updateCompassUI();
})();
