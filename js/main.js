/* BzR Technology — interações do site */
(function () {
  "use strict";

  document.documentElement.classList.add("js");
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Ano no rodapé
  var ano = document.getElementById("ano");
  if (ano) ano.textContent = new Date().getFullYear();

  // Borda da navegação ao rolar
  var nav = document.querySelector(".nav");
  function onScroll() { nav.classList.toggle("is-scrolled", window.scrollY > 8); }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  // Revelar ao rolar
  var reveals = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window && !reduceMotion) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        e.target.classList.add("is-in");
        io.unobserve(e.target);
      });
    }, { rootMargin: "0px 0px -8% 0px" });
    reveals.forEach(function (el, i) {
      el.style.transitionDelay = (i % 4) * 70 + "ms";
      io.observe(el);
    });
  } else {
    reveals.forEach(function (el) { el.classList.add("is-in"); });
  }

  // Contagem dos números da tese
  var counters = document.querySelectorAll("[data-count]");
  if ("IntersectionObserver" in window && !reduceMotion) {
    var co = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        co.unobserve(e.target);
        var el = e.target, end = +el.dataset.count, t0 = null;
        function tick(t) {
          if (!t0) t0 = t;
          var p = Math.min((t - t0) / 1200, 1);
          el.textContent = Math.round(end * (1 - Math.pow(1 - p, 3))) + "%";
          if (p < 1) requestAnimationFrame(tick);
        }
        requestAnimationFrame(tick);
      });
    }, { threshold: 0.6 });
    counters.forEach(function (el) { co.observe(el); });
  }

  initMap();

  // ---------- Mapa WebGIS ilustrativo: curvas de nível + ativos (Blocos) ----------
  function initMap() {
    var canvas = document.getElementById("mapa");
    if (!canvas || !canvas.getContext) return;
    var ctx = canvas.getContext("2d");
    var coordsEl = document.getElementById("coords");
    var layers = { relevo: true, ativos: true, grade: false };

    // Recorte fictício (lon/lat) usado só para exibir coordenadas
    var bbox = { w: -48.12, e: -47.72, n: -15.62, s: -15.92 };

    var ativos = [
      { x: 0.18, y: 0.30, id: "PT-01" }, { x: 0.34, y: 0.62, id: "PT-02" },
      { x: 0.47, y: 0.24, id: "PT-03" }, { x: 0.58, y: 0.48, id: "PT-04" },
      { x: 0.71, y: 0.72, id: "PT-05" }, { x: 0.80, y: 0.33, id: "PT-06" },
      { x: 0.26, y: 0.82, id: "PT-07" }, { x: 0.90, y: 0.58, id: "PT-08" }
    ];
    var ativo = 3; // o Bloco que pisca
    var hover = null, mouse = null;
    var W = 0, H = 0, dpr = 1, contours = null, indexContours = null;

    // Ruído de valor suave e determinístico
    var perm = [];
    (function () {
      var s = 7, i;
      for (i = 0; i < 256; i++) perm[i] = i;
      for (i = 255; i > 0; i--) {
        s = (s * 16807) % 2147483647;
        var j = s % (i + 1), t = perm[i];
        perm[i] = perm[j]; perm[j] = t;
      }
      for (i = 0; i < 256; i++) perm[256 + i] = perm[i];
    })();
    function hash(x, y) { return perm[(perm[x & 255] + y) & 255] / 255; }
    function smooth(t) { return t * t * (3 - 2 * t); }
    function noise(x, y) {
      var xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
      var a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
      var u = smooth(xf), v = smooth(yf);
      return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
    }
    function field(nx, ny) {
      var x = nx * 3.2, y = ny * 2.4;
      return noise(x, y) * 0.6 + noise(x * 2.1 + 5, y * 2.1 + 3) * 0.28 + noise(x * 4.3 + 11, y * 4.3 + 7) * 0.12;
    }

    // Marching squares: segmentos por aresta para cada caso
    var CASES = [[], [[3, 2]], [[2, 1]], [[3, 1]], [[0, 1]], [[3, 0], [2, 1]], [[0, 2]], [[3, 0]],
      [[3, 0]], [[0, 2]], [[3, 2], [0, 1]], [[0, 1]], [[3, 1]], [[2, 1]], [[3, 2]], []];

    function buildContours() {
      var cs = Math.max(6, Math.round(W / 90));
      var cols = Math.ceil(W / cs) + 1, rows = Math.ceil(H / cs) + 1;
      var g = new Float32Array(cols * rows);
      for (var r = 0; r < rows; r++)
        for (var c = 0; c < cols; c++) g[r * cols + c] = field(c * cs / W, r * cs / H);

      contours = new Path2D();
      indexContours = new Path2D();
      var levels = 16;
      for (var k = 1; k < levels; k++) {
        var L = 0.18 + (k / levels) * 0.64;
        var path = k % 5 === 0 ? indexContours : contours;
        for (r = 0; r < rows - 1; r++) {
          for (c = 0; c < cols - 1; c++) {
            var a = g[r * cols + c], b = g[r * cols + c + 1];
            var cc = g[(r + 1) * cols + c + 1], d = g[(r + 1) * cols + c];
            var idx = (a > L ? 8 : 0) | (b > L ? 4 : 0) | (cc > L ? 2 : 0) | (d > L ? 1 : 0);
            var segs = CASES[idx];
            if (!segs.length) continue;
            var x0 = c * cs, y0 = r * cs;
            for (var s = 0; s < segs.length; s++) {
              var p1 = edge(segs[s][0]), p2 = edge(segs[s][1]);
              path.moveTo(p1[0], p1[1]);
              path.lineTo(p2[0], p2[1]);
            }
          }
        }
      }
      function edge(e) {
        switch (e) {
          case 0: return [x0 + cs * (L - a) / (b - a), y0];
          case 1: return [x0 + cs, y0 + cs * (L - b) / (cc - b)];
          case 2: return [x0 + cs * (L - d) / (cc - d), y0 + cs];
          default: return [x0, y0 + cs * (L - a) / (d - a)];
        }
      }
    }

    function resize() {
      var rect = canvas.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = rect.width; H = rect.height;
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      buildContours();
      draw(performance.now());
    }

    function bloco(x, y, s, color) {
      var r = s * 0.36;
      ctx.beginPath();
      ctx.moveTo(x - s / 2, y - s / 2);
      ctx.lineTo(x + s / 2 - r, y - s / 2);
      ctx.arcTo(x + s / 2, y - s / 2, x + s / 2, y - s / 2 + r, r);
      ctx.lineTo(x + s / 2, y + s / 2);
      ctx.lineTo(x - s / 2, y + s / 2);
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();
    }

    function draw(t) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);

      if (layers.grade) {
        ctx.strokeStyle = "rgba(10,11,10,0.08)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (var gx = 1; gx < 8; gx++) { var x = Math.round(W * gx / 8) + 0.5; ctx.moveTo(x, 0); ctx.lineTo(x, H); }
        for (var gy = 1; gy < 6; gy++) { var y = Math.round(H * gy / 6) + 0.5; ctx.moveTo(0, y); ctx.lineTo(W, y); }
        ctx.stroke();
      }

      if (layers.relevo) {
        ctx.lineWidth = 1;
        ctx.strokeStyle = "rgba(0,128,55,0.32)";
        ctx.stroke(contours);
        ctx.lineWidth = 1.6;
        ctx.strokeStyle = "rgba(0,128,55,0.7)";
        ctx.stroke(indexContours);
      }

      if (layers.ativos) {
        var s = Math.max(10, W / 48);
        // rota entre ativos
        ctx.setLineDash([3, 5]);
        ctx.strokeStyle = "rgba(10,11,10,0.35)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        [0, 2, 3, 5, 7, 4, 1, 6].forEach(function (i, n) {
          var p = ativos[i];
          n ? ctx.lineTo(p.x * W, p.y * H) : ctx.moveTo(p.x * W, p.y * H);
        });
        ctx.stroke();
        ctx.setLineDash([]);

        ativos.forEach(function (p, i) {
          var on = i === ativo;
          var visible = !on || reduceMotion || Math.floor(t / 550) % 2 === 0;
          if (i === hover || on) {
            ctx.strokeStyle = on ? "rgba(0,128,55,0.5)" : "rgba(10,11,10,0.4)";
            ctx.lineWidth = 1;
            ctx.strokeRect(p.x * W - s, p.y * H - s, s * 2, s * 2);
          }
          if (visible) bloco(p.x * W, p.y * H, s, on ? "#008037" : "#0A0B0A");
        });

        if (hover !== null) {
          var h = ativos[hover], label = h.id;
          ctx.font = "500 12px 'JetBrains Mono', monospace";
          var tw = ctx.measureText(label).width + 16;
          var lx = Math.min(h.x * W + s, W - tw - 4), ly = h.y * H - s - 26;
          ctx.fillStyle = "#0A0B0A";
          ctx.fillRect(lx, ly, tw, 22);
          ctx.fillStyle = "#fff";
          ctx.fillText(label, lx + 8, ly + 15);
        }
      }

      if (mouse) {
        ctx.strokeStyle = "rgba(10,11,10,0.18)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(Math.round(mouse.x) + 0.5, 0); ctx.lineTo(Math.round(mouse.x) + 0.5, H);
        ctx.moveTo(0, Math.round(mouse.y) + 0.5); ctx.lineTo(W, Math.round(mouse.y) + 0.5);
        ctx.stroke();
      }
    }

    function toCoords(x, y) {
      var lon = bbox.w + (x / W) * (bbox.e - bbox.w);
      var lat = bbox.n + (y / H) * (bbox.s - bbox.n);
      return "lat " + lat.toFixed(4) + "  lon " + lon.toFixed(4);
    }

    function pointer(ev) {
      var rect = canvas.getBoundingClientRect();
      mouse = { x: ev.clientX - rect.left, y: ev.clientY - rect.top };
      hover = null;
      var s = Math.max(10, W / 48);
      ativos.forEach(function (p, i) {
        if (Math.abs(p.x * W - mouse.x) < s && Math.abs(p.y * H - mouse.y) < s) hover = i;
      });
      coordsEl.textContent = (hover !== null ? ativos[hover].id + " · " : "") + toCoords(mouse.x, mouse.y);
      if (reduceMotion) draw(0);
    }
    canvas.addEventListener("pointermove", pointer);
    canvas.addEventListener("pointerleave", function () {
      mouse = null; hover = null;
      coordsEl.textContent = "passe o mouse no mapa";
      if (reduceMotion) draw(0);
    });
    canvas.addEventListener("click", function () {
      if (hover !== null) { ativo = hover; if (reduceMotion) draw(0); }
    });

    document.querySelectorAll(".chip[data-layer]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var k = btn.dataset.layer;
        layers[k] = !layers[k];
        btn.classList.toggle("is-on", layers[k]);
        btn.setAttribute("aria-pressed", String(layers[k]));
        draw(performance.now());
      });
    });

    var resizeTimer;
    window.addEventListener("resize", function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(resize, 120);
    });
    resize();

    // Anima só enquanto o mapa está visível
    if (!reduceMotion) {
      var running = false, raf;
      function loop(t) { draw(t); raf = requestAnimationFrame(loop); }
      new IntersectionObserver(function (entries) {
        var vis = entries[0].isIntersecting;
        if (vis && !running) { running = true; raf = requestAnimationFrame(loop); }
        if (!vis && running) { running = false; cancelAnimationFrame(raf); }
      }).observe(canvas);
    }
  }
})();
