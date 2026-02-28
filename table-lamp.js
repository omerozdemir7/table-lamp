  const scene = document.getElementById("scene");
  const cord = document.getElementById("cord");
  const cordHit = document.getElementById("cordHit");
  const cordPathBack = document.getElementById("cordPathBack");
  const cordPathFront = document.getElementById("cordPathFront");
  const cordButton = document.getElementById("cordButton");
  const hudText = document.getElementById("hudText");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const CORD_WIDTH = 120;
  const ANCHOR_X = CORD_WIDTH / 2;
  const ANCHOR_Y = 8;
  const REST_LENGTH = reducedMotion ? 124 : 136;
  const MAX_PULL = reducedMotion ? 42 : 86;
  const MAX_ANGLE = reducedMotion ? 0.34 : 0.62;
  const TOGGLE_THRESHOLD = reducedMotion ? 18 : 42;

  let isLampOn = false;
  let isBusy = false;
  let suppressNextClick = false;
  let rafId = 0;
  let lastFrame = 0;

  const rope = {
    angle: 0,
    angularVelocity: 0,
    length: REST_LENGTH,
    lengthVelocity: 0,
    bend: 0,
    endX: ANCHOR_X,
    endY: ANCHOR_Y + REST_LENGTH
  };

  const dragState = {
    active: false,
    pointerId: null,
    startX: 0,
    startY: 0,
    lastX: 0,
    lastY: 0,
    pull: 0,
    moved: false,
    captureEl: null
  };

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function setLampState(nextState) {
    isLampOn = nextState;
    scene.classList.toggle("is-on", isLampOn);
    cordButton.setAttribute("aria-pressed", String(isLampOn));
    hudText.textContent = isLampOn ? "Acik - Warm 3000K" : "Kapali";
  }

  function createRipple(x, y) {
    if (reducedMotion) return;
    const ripple = document.createElement("span");
    ripple.className = "ripple";
    ripple.style.left = `${x}px`;
    ripple.style.top = `${y}px`;
    document.body.appendChild(ripple);
    window.setTimeout(() => ripple.remove(), 900);
  }

  function getInteractionPoint(event) {
    if (event && "clientX" in event && "clientY" in event) {
      return { x: event.clientX, y: event.clientY };
    }

    const rect = cordButton.getBoundingClientRect();
    return {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2
    };
  }

  function renderRope() {
    rope.endX = ANCHOR_X + Math.sin(rope.angle) * rope.length;
    rope.endY = ANCHOR_Y + Math.cos(rope.angle) * rope.length;

    const sag = (1 - Math.abs(Math.sin(rope.angle))) * Math.min(rope.length * 0.22, 28);
    const bendTarget = dragState.active
      ? clamp((dragState.lastX - dragState.startX) * 0.18, -22, 22)
      : clamp(-rope.angularVelocity * 20, -18, 18);
    rope.bend += (bendTarget - rope.bend) * (dragState.active ? 0.26 : 0.14);

    const cp1X = ANCHOR_X + Math.sin(rope.angle) * rope.length * 0.24 + rope.bend * 0.58;
    const cp1Y = ANCHOR_Y + rope.length * 0.28 + sag * 0.35;
    const cp2X = ANCHOR_X + Math.sin(rope.angle) * rope.length * 0.74 + rope.bend;
    const cp2Y = ANCHOR_Y + rope.length * 0.84 + sag;
    const ropePath = `M ${ANCHOR_X.toFixed(2)} ${ANCHOR_Y.toFixed(2)} C ${cp1X.toFixed(2)} ${cp1Y.toFixed(2)}, ${cp2X.toFixed(2)} ${cp2Y.toFixed(2)}, ${rope.endX.toFixed(2)} ${rope.endY.toFixed(2)}`;

    cordHit.setAttribute("d", ropePath);
    cordPathBack.setAttribute("d", ropePath);
    cordPathFront.setAttribute("d", ropePath);

    cordButton.style.left = `${rope.endX}px`;
    cordButton.style.top = `${rope.endY}px`;
  }

  function ropeIsMoving() {
    if (dragState.active) return true;
    return (
      Math.abs(rope.angularVelocity) > 0.01 ||
      Math.abs(rope.lengthVelocity) > 0.45 ||
      Math.abs(rope.angle) > 0.002 ||
      Math.abs(rope.length - REST_LENGTH) > 0.2 ||
      Math.abs(rope.bend) > 0.15
    );
  }

  function updatePhysics(dt) {
    if (dragState.active) return;

    const gravity = reducedMotion ? 14 : 25;
    const angularDamping = reducedMotion ? 7.4 : 4.3;
    const spring = reducedMotion ? 96 : 134;
    const stretchDamping = reducedMotion ? 17 : 13;

    const angularAcc = (-gravity * Math.sin(rope.angle)) - (angularDamping * rope.angularVelocity);
    rope.angularVelocity += angularAcc * dt;
    rope.angle += rope.angularVelocity * dt;
    rope.angle = clamp(rope.angle, -MAX_ANGLE, MAX_ANGLE);

    if (Math.abs(rope.angle) >= MAX_ANGLE) {
      rope.angularVelocity *= 0.72;
    }

    const stretch = rope.length - REST_LENGTH;
    const stretchAcc = (-spring * stretch) - (stretchDamping * rope.lengthVelocity);
    rope.lengthVelocity += stretchAcc * dt;
    rope.length += rope.lengthVelocity * dt;
    rope.length = clamp(rope.length, REST_LENGTH, REST_LENGTH + MAX_PULL);

    if (rope.length === REST_LENGTH && rope.lengthVelocity < 0) {
      rope.lengthVelocity = 0;
    }
  }

  function tick(timestamp) {
    if (!lastFrame) {
      lastFrame = timestamp;
    }

    const dt = Math.min(0.033, (timestamp - lastFrame) / 1000);
    lastFrame = timestamp;

    updatePhysics(dt);
    renderRope();

    if (ropeIsMoving()) {
      rafId = window.requestAnimationFrame(tick);
      return;
    }

    rafId = 0;
    lastFrame = 0;
  }

  function ensureAnimation() {
    if (rafId) return;
    rafId = window.requestAnimationFrame(tick);
  }

  function triggerLamp(eventPoint) {
    if (isBusy) return;
    isBusy = true;

    const stateDelay = reducedMotion ? 35 : 110;
    window.setTimeout(() => {
      setLampState(!isLampOn);
      createRipple(eventPoint.x, eventPoint.y);
    }, stateDelay);

    const unlockDelay = reducedMotion ? 220 : 520;
    window.setTimeout(() => { isBusy = false; }, unlockDelay);
  }

  function applyDragFromPointer(event) {
    const rect = cord.getBoundingClientRect();
    const pointerX = event.clientX - rect.left;
    const pointerY = event.clientY - rect.top;

    const dx = pointerX - ANCHOR_X;
    const dy = Math.max(24, pointerY - ANCHOR_Y);
    const desiredLength = clamp(Math.hypot(dx, dy), REST_LENGTH, REST_LENGTH + MAX_PULL);
    const desiredAngle = clamp(Math.atan2(dx, dy), -MAX_ANGLE, MAX_ANGLE);

    rope.length = desiredLength;
    rope.angle = desiredAngle;
    rope.angularVelocity = 0;
    rope.lengthVelocity = 0;

    dragState.pull = desiredLength - REST_LENGTH;
    dragState.lastX = event.clientX;
    dragState.lastY = event.clientY;

    if (dragState.pull > 2 || Math.abs(desiredAngle) > 0.03) {
      dragState.moved = true;
    }

    renderRope();
    ensureAnimation();
  }

  function onPointerDown(event) {
    if (isBusy) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;

    dragState.active = true;
    dragState.pointerId = event.pointerId;
    dragState.startX = event.clientX;
    dragState.startY = event.clientY;
    dragState.lastX = event.clientX;
    dragState.lastY = event.clientY;
    dragState.pull = 0;
    dragState.moved = false;
    dragState.captureEl = event.currentTarget;

    cord.classList.add("dragging");

    const captureEl = dragState.captureEl;
    if (captureEl && typeof captureEl.setPointerCapture === "function") {
      try {
        captureEl.setPointerCapture(event.pointerId);
      } catch (_) {
        // Ignore capture errors for unsupported environments.
      }
    }

    applyDragFromPointer(event);
    event.preventDefault();
  }

  function onPointerMove(event) {
    if (!dragState.active || event.pointerId !== dragState.pointerId) return;
    applyDragFromPointer(event);
    event.preventDefault();
  }

  function onPointerUp(event) {
    if (!dragState.active || event.pointerId !== dragState.pointerId) return;

    const captureEl = dragState.captureEl;
    if (captureEl && typeof captureEl.releasePointerCapture === "function") {
      try {
        captureEl.releasePointerCapture(event.pointerId);
      } catch (_) {
        // Ignore release errors for unsupported environments.
      }
    }

    const moved = dragState.moved;
    const pulledAmount = dragState.pull;
    const releaseDx = event.clientX - dragState.startX;
    const releaseDy = event.clientY - dragState.lastY;

    dragState.active = false;
    dragState.pointerId = null;
    dragState.captureEl = null;
    dragState.pull = 0;
    dragState.moved = false;

    cord.classList.remove("dragging");

    rope.angularVelocity += clamp(releaseDx * 0.009, -2.8, 2.8);
    rope.lengthVelocity += clamp(releaseDy * 1.8, -180, 180);
    rope.lengthVelocity -= clamp((rope.length - REST_LENGTH) * 10, 0, 280);
    ensureAnimation();

    if (!moved) return;

    suppressNextClick = true;
    window.setTimeout(() => { suppressNextClick = false; }, 360);

    if (pulledAmount >= TOGGLE_THRESHOLD) {
      triggerLamp(getInteractionPoint(event));
    }
  }

  function onButtonClick(event) {
    if (suppressNextClick) {
      event.preventDefault();
      suppressNextClick = false;
      return;
    }
    if (isBusy || dragState.active) return;

    rope.length = Math.min(REST_LENGTH + (reducedMotion ? 16 : 26), REST_LENGTH + MAX_PULL);
    rope.lengthVelocity = reducedMotion ? -120 : -170;
    rope.angularVelocity += reducedMotion ? 0.14 : 0.24;
    ensureAnimation();

    triggerLamp(getInteractionPoint(event));
  }

  function onButtonKeyDown(event) {
    if (event.code === "Space" || event.code === "Enter") {
      event.preventDefault();
      onButtonClick(event);
    }
  }

  cordButton.addEventListener("pointerdown", onPointerDown);
  cordHit.addEventListener("pointerdown", onPointerDown);
  window.addEventListener("pointermove", onPointerMove, { passive: false });
  window.addEventListener("pointerup", onPointerUp);
  window.addEventListener("pointercancel", onPointerUp);
  cordButton.addEventListener("click", onButtonClick);
  cordButton.addEventListener("keydown", onButtonKeyDown);
  cordButton.addEventListener("dragstart", (event) => event.preventDefault());

  setLampState(false);
  renderRope();
