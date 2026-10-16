// Joops.ai hero — orbit engine.
// Everything on the stage is positioned in "stage units": (0,0) is the orbit centre,
// numbers are taken 1:1 from the Figma frames (desktop 31:274, mobile 33:1164).
(function () {
  "use strict";

  var MODES = {
    desktop: {
      parallaxScale: 1, driftScale: 1,
      rings: { outer: 520, mid: 420, inner: 320, midOpacity: 1, innerOpacity: 0.5 },
      trail: { R: 520, head: -22.72, tail: 21.43, entry: 72, far: 66, grad: [500, -96.5, 559.44, -54.5] },
      dots: { a: [409, 95], b: [-289, -305] },
      slots: {
        s1:  { x: -598, y: -179, w: 140, h: 188.504, zoom: 1 },
        s2:  { x: 420,  y: -302, w: 160, h: 215.433, zoom: 1 },
        out: { x: -549, y: 190,  w: 170, h: 102,     zoom: 1 }
      }
    },
    mobile: {
      parallaxScale: 1.5, driftScale: 1.6,   // smaller orbits → a little more angle for a similar visible slide
      rings: { outer: 175, mid: 125, inner: 75, midOpacity: 0.5, innerOpacity: 1 },
      trail: { R: 125, head: 0, tail: 75.2, entry: 70, far: 108, grad: [29.18, -10, 29.18, 116.63] },
      dots: { a: [-90, -150], b: [-133, 113] },
      slots: {
        s1:  { x: -154, y: -80,  w: 78.75, h: 106.033, zoom: 0.5625 },
        s2:  { x: 46,   y: -150, w: 120,   h: 161.575, zoom: 0.75 },
        out: { x: -85,  y: 147,  w: 85,    h: 51,      zoom: 0.5 }
      }
    }
  };

  var $ = function (id) { return document.getElementById(id); };
  var stage = $("stage");
  if (!stage) return;
  var el = {
    lyrOuter: $("lyrOuter"), lyrMid: $("lyrMid"), lyrIn: $("lyrIn"), lyrTrail: $("lyrTrail"),
    ringOuter: $("ringOuter"), ringMid: $("ringMid"), ringIn: $("ringIn"),
    maskMid: $("maskMidC"), maskIn: $("maskInC"),
    trail: $("trail"), grad: $("trailGrad"),
    dotA: $("dotA"), dotB: $("dotB"),
    s1: $("slotS1"), s2: $("slotS2"), out: $("slotOut")
  };
  el.gMid = el.ringMid.parentNode;
  el.gIn = el.ringIn.parentNode;
  var cards = {
    s1: el.s1.firstElementChild, s2: el.s2.firstElementChild, out: el.out.firstElementChild
  };

  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var cfg, mode;

  /* ---------------- helpers ---------------- */
  var D2R = Math.PI / 180;
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function seg(t, start, dur) { return clamp((t - start) / dur, 0, 1); }
  function mix(a, b, k) { return a + (b - a) * k; }
  function easeOut3(x) { return 1 - Math.pow(1 - x, 3); }
  function easeOut4(x) { return 1 - Math.pow(1 - x, 4); }
  function easeInOut3(x) { return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; }
  function polar(x, y) { return { r: Math.hypot(x, y), a: Math.atan2(y, x) / D2R }; }
  function pt(r, deg) { return [r * Math.cos(deg * D2R), r * Math.sin(deg * D2R)]; }
  // write an attribute / style only when it really changes — identical writes still cost style + paint work
  function setA(node, name, v) {
    var c = node.__a || (node.__a = {});
    if (c[name] !== v) { c[name] = v; node.setAttribute(name, v); }
  }
  function setS(node, prop, v) {
    var c = node.__s || (node.__s = {});
    if (c[prop] !== v) { c[prop] = v; node.style[prop] = v; }
  }
  // size an SVG layer (or a div wrapping one) to a square of half-size `half` centred on the orbit centre
  function sizeLayer(box, half) {
    var svg = box.tagName.toLowerCase() === "svg" ? box : box.querySelector("svg");
    svg.setAttribute("viewBox", -half + " " + -half + " " + 2 * half + " " + 2 * half);
    box.style.left = box.style.top = -half + "px";
    box.style.width = box.style.height = 2 * half + "px";
  }
  function arc(R, a, b) { // clockwise arc on radius R from angle a to b (a < b)
    if (b - a < 0.25) return "";
    var p = pt(R, a), q = pt(R, b);
    return "M" + p[0].toFixed(2) + "," + p[1].toFixed(2) +
      " A" + R + "," + R + " 0 " + (b - a > 180 ? 1 : 0) + " 1 " + q[0].toFixed(2) + "," + q[1].toFixed(2);
  }

  /* ---------------- layout per breakpoint ---------------- */
  function applyMode() {
    var m = window.innerWidth <= 760 ? "mobile" : "desktop";
    var k = m === "mobile"
      ? clamp(window.innerWidth / 390, 0.8, 1.3)
      : clamp(window.innerWidth / 1360, 0.55, 1);
    stage.style.setProperty("--k", k.toFixed(4));
    if (m === mode) return;
    mode = m;
    cfg = MODES[m];

    var r = cfg.rings;
    // each layer box is sized to its own drawing, so nothing adds empty scroll below the hero
    sizeLayer(el.lyrOuter, r.outer + 2);
    sizeLayer(el.lyrMid, r.mid + 6);
    sizeLayer(el.lyrIn, r.inner + 6);
    sizeLayer(el.lyrTrail, r.outer + 12);
    el.ringOuter.setAttribute("r", r.outer);
    el.ringMid.setAttribute("r", r.mid);
    el.ringIn.setAttribute("r", r.inner);
    el.maskMid.setAttribute("r", r.mid);
    el.maskIn.setAttribute("r", r.inner);
    el.ringMid.setAttribute("opacity", r.midOpacity);
    el.ringIn.setAttribute("opacity", r.innerOpacity);
    // outer ring draws counter-clockwise from the point where the informer enters
    el.ringOuter.setAttribute("transform", "rotate(" + (cfg.trail.head + cfg.trail.entry) + ") scale(1 -1)");
    el.maskMid.setAttribute("transform", "rotate(-90)");
    el.maskIn.setAttribute("transform", "rotate(90) scale(1 -1)");
    el.ringOuter.setAttribute("stroke-dasharray", "1 1");
    el.maskMid.setAttribute("stroke-dasharray", "1 1");
    el.maskIn.setAttribute("stroke-dasharray", "1 1");

    var g = cfg.trail.grad;
    el.grad.setAttribute("x1", g[0]); el.grad.setAttribute("y1", g[1]);
    el.grad.setAttribute("x2", g[2]); el.grad.setAttribute("y2", g[3]);

    ["s1", "s2", "out"].forEach(function (key) {
      var s = cfg.slots[key], node = el[key];
      node.style.left = s.x + "px";
      node.style.top = s.y + "px";
      node.style.width = s.w + "px";
      node.style.height = s.h + "px";
      cards[key].style.zoom = s.zoom;
      s.c = polar(s.x + s.w / 2, s.y + s.h / 2);
    });
    cfg.dotPolar = { a: polar(cfg.dots.a[0], cfg.dots.a[1]), b: polar(cfg.dots.b[0], cfg.dots.b[1]) };
  }

  // move a card along its own orbit by `delta` degrees (stays upright).
  // `reveal` 0..1 opens the card with an opaque circular mask from its centre — never a fade.
  function placeCard(key, delta, reveal) {
    var s = cfg.slots[key];
    var p = pt(s.c.r, s.c.a + delta);
    var dx = p[0] - (s.x + s.w / 2), dy = p[1] - (s.y + s.h / 2);
    setS(el[key], "transform", "translate(" + dx.toFixed(2) + "px," + dy.toFixed(2) + "px)");
    setS(el[key], "clipPath", reveal >= 1 ? "none" : "circle(" + (reveal * 72).toFixed(2) + "% at 50% 50%)");
  }

  function placeDot(node, p, r, k) {
    setS(node, "transform", "translate(" + (p[0] - r).toFixed(2) + "px," + (p[1] - r).toFixed(2) + "px) scale(" + k.toFixed(3) + ")");
  }

  /* ---------------- timeline ---------------- */
  var LOOP_START = 3.3, LOOP = 9.6;   // in stage time
  // The background starts together with the header pill and its entrance plays FAST× faster;
  // once the entrance is over, stage time continues at normal speed (no jump in the loop).
  var FAST = 1.6;
  function stageTime(t) {
    var e = LOOP_START / FAST;
    return t < e ? t * FAST : t - e + LOOP_START;
  }

  // informer + trail state at time t → {card: delta°, head: abs°, tail: abs°}
  // `pa` = pointer offset along the orbit (deg): the card and the trail head slide, the tail stays
  function informer(t, pa) {
    var T = cfg.trail, head0 = T.head;
    if (t < LOOP_START) {
      // entrance: card travels CCW up the ring; the trail is the path it just drew
      var d = T.entry * (1 - easeOut4(seg(t, 0.55, 1.9))) + pa;
      var tail = mix(head0 + T.entry, T.tail, easeInOut3(seg(t, 1.8, 1.4)));
      return { card: d, head: head0 + d, tail: Math.max(tail, head0 + d) };
    }
    var u = t - LOOP_START, p = u % LOOP;
    var ramp = seg(u, 0, 2.5);
    var drift = ramp * cfg.driftScale * (2.8 * Math.sin(u * 2 * Math.PI / 9.5) + 0.9 * Math.sin(u * 2 * Math.PI / 4.3 + 1.3));
    var kick = 0;
    if (p > 7.25) { var q = p - 7.25; kick = -2.6 * Math.exp(-q * 3.2) * Math.sin(q * 7.5); }
    var c = drift + kick + pa, h = head0 + c;
    var far = head0 + T.far;

    if (p < 4) {                                   // hold — trail breathes slightly
      return { card: c, head: h, tail: T.tail + 1.6 * Math.sin(Math.PI * p / 4) };
    }
    if (p < 5.5) {                                 // trail is drawn back into the card
      return { card: c, head: h, tail: mix(T.tail, h, easeInOut3(seg(p, 4, 1.5))) };
    }
    if (p < 5.9) return { card: c, head: h, tail: h }; // empty beat
    // a new streak launches from below: head races CCW to the card, tail lags then follows
    var hh = mix(far, h, easeOut3(seg(p, 5.9, 1.35)));
    var tt = mix(far, T.tail, easeInOut3(seg(p, 6.3, 1.8)));
    return { card: c, head: hh, tail: Math.max(tt, hh) };
  }

  /* ---------------- pointer reaction ----------------
     Rings never move off the centre. The pointer only changes ANGLES: every widget slides
     along its own orbit (cards stay upright), dashed rings turn, dots slide along their ring.
     Values are degrees at full pointer deflection: [per pointer x, per pointer y]. */
  var PARALLAX = {
    rings: { mid: [7, 0], inner: [-10, 0] },
    dots:  { a: [8, 4], b: [-8, -5] },
    cards: { s1: [-1.2, 3.2], s2: [1.5, -3], out: [2.6, -1.6] }
  };
  var par = { x: 0, y: 0 }, parTarget = { x: 0, y: 0 };

  function turn(v) { return (v[0] * par.x + v[1] * par.y) * cfg.parallaxScale; }

  function frame(t) {
    var T = cfg.trail, P = PARALLAX;

    // rings: outer draws itself, dashed rings are revealed by drawn masks, then rotate forever
    setA(el.ringOuter, "stroke-dashoffset", (1 - easeInOut3(seg(t, 0.1, 1.9))).toFixed(4));
    var masked = t < 2.1;
    if (masked) {
      setA(el.maskMid, "stroke-dashoffset", (1 - easeInOut3(seg(t, 0.35, 1.6))).toFixed(4));
      setA(el.maskIn, "stroke-dashoffset", (1 - easeInOut3(seg(t, 0.5, 1.5))).toFixed(4));
    }
    // once the dashed rings are fully drawn, drop their masks — a mask re-renders the whole ring
    if (masked !== el.masked) {
      el.masked = masked;
      el.gMid[masked ? "setAttribute" : "removeAttribute"]("mask", "url(#maskMid)");
      el.gIn[masked ? "setAttribute" : "removeAttribute"]("mask", "url(#maskIn)");
    }
    // rotation is a CSS transform on the layer → composited, the dashes are never repainted
    setS(el.lyrMid, "transform", "rotate(" + (t * 3 + turn(P.rings.mid)).toFixed(3) + "deg)");    // CW, 120 s / turn
    setS(el.lyrIn, "transform", "rotate(" + (-t * 4 + turn(P.rings.inner)).toFixed(3) + "deg)");  // CCW, 90 s / turn

    // dots: swirl in, then orbit forever — opposite directions, different speeds
    var dp = cfg.dotPolar;
    var inA = easeOut3(seg(t, 0.8, 1.9)), inB = easeOut3(seg(t, 0.95, 1.9));
    var ph = t - LOOP_START;                           // dots sit exactly on their mockup spots at LOOP_START
    var aA = dp.a.a + ph * 4.5 - 150 * (1 - inA) + turn(P.dots.a);   // CW, 80 s / turn
    var aB = dp.b.a - ph * 6 + 150 * (1 - inB) + turn(P.dots.b);     // CCW, 60 s / turn
    placeDot(el.dotA, pt(dp.a.r, aA), 8, easeOut3(seg(t, 0.8, 0.5)));
    placeDot(el.dotB, pt(dp.b.r, aB), 6, easeOut3(seg(t, 0.95, 0.5)));

    // left + outcome informers glide in clockwise along the outer orbit, then drift
    var d1 = -40 * (1 - easeOut3(seg(t, 0.7, 1.6)));
    var d3 = -42 * (1 - easeOut3(seg(t, 0.95, 1.6)));
    var r1 = seg(t, 2.3, 2.5), r3 = seg(t, 2.55, 2.5);
    // automatic drift along the orbit (deg): two sines with unrelated periods so it never looks looped
    d1 += r1 * cfg.driftScale * (4.5 * Math.sin(t * 2 * Math.PI / 12) + 1.3 * Math.sin(t * 2 * Math.PI / 5.3 + 2));
    d3 += r3 * cfg.driftScale * (5 * Math.sin(t * 2 * Math.PI / 10.5 + 1) + 1.3 * Math.sin(t * 2 * Math.PI / 4.4));
    placeCard("s1", d1 + turn(P.cards.s1), easeOut3(seg(t, 0.7, 0.75)));
    placeCard("out", d3 + turn(P.cards.out), easeOut3(seg(t, 0.95, 0.75)));

    // outer informer + its trail (head follows the card along the ring, tail stays → trail stretches)
    var s = informer(t, turn(P.cards.s2));
    placeCard("s2", s.card, easeOut3(seg(t, 0.55, 0.7)));
    setA(el.trail, "d", arc(T.R, s.head, s.tail));
  }

  /* ---------------- count-ups inside the informers ---------------- */
  function countUps(t) {
    var nodes = document.querySelectorAll("[data-count]");
    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      var start = parseFloat(getComputedStyle(n.closest(".ad, .outcome")).getPropertyValue("--t")) + 0.1;
      var v = Math.round(+n.dataset.count * easeOut3(seg(t, start, 1.1)));
      n.textContent = (n.dataset.prefix || "") + v.toLocaleString("en-US") + (n.dataset.suffix || "");
    }
  }

  /* ---------------- run ---------------- */
  applyMode();
  window.addEventListener("resize", applyMode);

  var root = document.documentElement;
  if (reduce) {
    root.classList.add("go-stage", "go-header", "go-copy", "is-done");
    frame(LOOP_START);
    countUps(99);
    return;
  }

  var t0 = null, countsDone = false, frozen = null;
  // debug hook: joopsHero.seek(4) renders the stage at t = 4 s and freezes it; seek(null) resumes
  // joopsHero.point(1, -1) puts the virtual pointer at the top-right corner of the hero
  window.joopsHero = {
    seek: function (t) { frozen = t; if (t != null) { frame(stageTime(t)); countUps(t); } },
    point: function (x, y) { par.x = parTarget.x = x; par.y = parTarget.y = y; if (frozen != null) frame(stageTime(frozen)); },
    state: function () { return { pointer: { x: parTarget.x, y: parTarget.y }, smoothed: { x: par.x, y: par.y } }; }
  };
  // pointer → normalised [-1, 1] around the hero centre (mouse / pen only)
  var hero = document.getElementById("hero");
  hero.addEventListener("pointermove", function (e) {
    if (e.pointerType === "touch") return;
    var r = hero.getBoundingClientRect();
    parTarget.x = clamp((e.clientX - r.left) / r.width * 2 - 1, -1, 1);
    parTarget.y = clamp((e.clientY - r.top) / r.height * 2 - 1, -1, 1);
  });
  hero.addEventListener("pointerleave", function () { parTarget.x = 0; parTarget.y = 0; });

  function tick(now) {
    if (t0 == null) {                       // first painted frame: the stage starts right here
      t0 = now;
      root.classList.add("go-stage");
    }
    var t = frozen != null ? frozen : (now - t0) / 1000;
    par.x += (parTarget.x - par.x) * 0.06;
    par.y += (parTarget.y - par.y) * 0.06;
    frame(stageTime(t));
    if (!countsDone) { countUps(t); countsDone = t > 4; }
    requestAnimationFrame(tick);
  }

  // Three independent starts — nothing waits for anything else:
  // stage on the first frame, header when the logo is decoded, copy when the fonts are ready.
  function release(cls) { requestAnimationFrame(function () { root.classList.add(cls); }); }
  function once(fn) { var done = false; return function () { if (!done) { done = true; fn(); } }; }

  frame(0);
  countUps(0);
  requestAnimationFrame(tick);

  var goHeader = once(function () { release("go-header"); });
  var logo = document.querySelector(".logo img");
  (logo && logo.decode ? logo.decode() : Promise.resolve()).then(goHeader, goHeader);
  setTimeout(goHeader, 1200);

  var goCopy = once(function () { release("go-copy"); });
  (document.fonts ? document.fonts.ready : Promise.resolve()).then(goCopy, goCopy);
  setTimeout(goCopy, 2000);

  // the header's glass blur is switched on only after its intro (animating over a live backdrop-filter stutters)
  document.querySelector(".island").addEventListener("animationend", function (e) {
    if (e.animationName === "islandWidth") root.classList.add("is-done");
  });
})();
