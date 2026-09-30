'use strict';

// Pedestrian Dead Reckoning (PDR):
//   - đầu vào: gia tốc tổng (bao gồm trọng lực) từ DeviceMotionEvent
//   - đếm bước chân: lọc EMA lấy dao động "nảy" khi bước, phát hiện đỉnh
//   - hướng đi: la bàn số từ DeviceOrientationEvent
//   - vị trí: mỗi bước dịch chuyển stepLength * (sin, -cos) của hướng
// Toạ độ mét, gốc (0,0) góc tây-bắc, x hướng đông, y hướng nam.
window.PDR = (function () {
  const ROOM = 10;
  const WALL_MARGIN = 0.25;

  const CFG = {
    gravityAlpha: 0.92,   // EMA ước lượng độ lớn trọng lực
    smoothAlpha: 0.25,    // EMA làm mượt biên độ dao động
    threshold: 1.15,      // m/s² — vào vùng đỉnh (thân nảy lên)
    exitThreshold: -0.5,  // m/s² — phải hạ xuống dưới ngưỡng này mới chốt 1 bước
    minPeak: 1.35,        // m/s² — biên độ tối thiểu của 1 bước hợp lệ
    minStepMs: 260,       // khoảng cách tối thiểu giữa 2 bước (~2,3 bước/giây)
  };

  const st = {
    running: false,
    x: 5, y: 5,
    steps: 0,
    distance: 0,
    wallHits: 0,
    driftR: 0,            // bán kính sai số ước tính (m), lớn dần theo √số bước
    headingDeg: null,     // hướng la bàn tuyệt đối (0 = bắc)
    headingOffset: 0,     // hiệu chỉnh do người dùng bấm ±10°
    headingValid: false,
    stepLength: 0.7,      // mét / bước
    gMag: 9.81,
    smooth: 0,
    above: false,
    peak: 0,
    lastStepT: 0,
    onStep: null,
  };

  function processMotion(ax, ay, az, t) {
    const mag = Math.hypot(ax, ay, az);
    if (!isFinite(mag) || mag === 0) return;
    st.gMag = CFG.gravityAlpha * st.gMag + (1 - CFG.gravityAlpha) * mag;
    // Độ lệch CÓ DẤU so với trọng lực: dương = thân nảy lên, âm = hạ xuống.
    // Một chu kỳ bước chân = một phần dương + một phần âm → đếm đúng 1 bước.
    const lin = mag - st.gMag;
    st.smooth = CFG.smoothAlpha * lin + (1 - CFG.smoothAlpha) * st.smooth;

    if (!st.above) {
      if (st.smooth > CFG.threshold) { st.above = true; st.peak = st.smooth; }
    } else {
      if (st.smooth > st.peak) st.peak = st.smooth;
      if (st.smooth < CFG.exitThreshold) {
        st.above = false;
        const peak = st.peak;
        st.peak = 0;
        if (t - st.lastStepT >= CFG.minStepMs && peak >= CFG.minPeak) registerStep(t);
      }
    }
  }

  function setHeading(deg) {
    if (deg == null || !isFinite(deg)) return;
    st.headingDeg = ((deg % 360) + 360) % 360;
    st.headingValid = true;
  }

  function registerStep(t) {
    st.lastStepT = t;
    st.steps += 1;
    st.distance += st.stepLength;
    st.driftR = 0.5 + 0.18 * Math.sqrt(st.steps);

    let hit = false;
    if (st.headingValid) {
      const hd = (((st.headingDeg + st.headingOffset) % 360) + 360) % 360;
      const rad = hd * Math.PI / 180;
      let nx = st.x + st.stepLength * Math.sin(rad);
      let ny = st.y - st.stepLength * Math.cos(rad);
      if (nx < WALL_MARGIN) { nx = WALL_MARGIN; hit = true; }
      if (nx > ROOM - WALL_MARGIN) { nx = ROOM - WALL_MARGIN; hit = true; }
      if (ny < WALL_MARGIN) { ny = WALL_MARGIN; hit = true; }
      if (ny > ROOM - WALL_MARGIN) { ny = ROOM - WALL_MARGIN; hit = true; }
      if (hit) st.wallHits += 1;
      st.x = nx;
      st.y = ny;
    }

    if (st.onStep) st.onStep({
      x: st.x, y: st.y,
      steps: st.steps,
      distance: st.distance,
      driftR: st.driftR,
      wallHits: st.wallHits,
      hitWall: hit,
    });
  }

  function reset(x, y) {
    st.steps = 0;
    st.distance = 0;
    st.wallHits = 0;
    st.driftR = 0;
    st.above = false;
    st.peak = 0;
    st.smooth = 0;
    st.gMag = 9.81;
    st.lastStepT = 0;
    st.x = x;
    st.y = y;
    if (st.onStep) st.onStep({ x: x, y: y, steps: 0, distance: 0, driftR: 0, wallHits: 0, hitWall: false });
  }

  return { st: st, processMotion: processMotion, setHeading: setHeading, reset: reset, ROOM: ROOM, CFG: CFG };
})();
