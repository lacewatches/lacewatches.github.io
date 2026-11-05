/* ==========================================================
   LACE — movimento (rolagem suave, transições, zoom, carrosséis)
   Tudo é opcional: se o navegador não suporta ou a pessoa pediu
   "reduzir movimento" no aparelho, o site funciona normalmente.
   ========================================================== */
(() => {
  "use strict";
  const calmo = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const M = window.LaceMotion = { calmo, lenis: null };

  /* ---------- 1. Rolagem suave (Lenis) ---------- */
  function iniciarLenis() {
    if (calmo || !window.Lenis) return;
    const lenis = new Lenis({
      lerp: 0.1, smoothWheel: true, anchors: false,
      prevent: n => !!(n.closest && n.closest(".drawer, .side-menu, .lookbox, .rail-track, .chips, .pswp, [data-lenis-prevent]"))
    });
    M.lenis = lenis;
    const raf = t => { lenis.raf(t); requestAnimationFrame(raf); };
    requestAnimationFrame(raf);
    // pausa enquanto a sacola, o menu ou uma foto estão abertos
    new MutationObserver(() => document.body.classList.contains("locked") ? lenis.stop() : lenis.start())
      .observe(document.body, { attributes: true, attributeFilter: ["class"] });
  }
  M.topo = () => {
    if (M.lenis) M.lenis.scrollTo(0, { immediate: true, force: true });
    else window.scrollTo({ top: 0, behavior: "instant" });
  };

  /* ---------- 2. Transição entre páginas (View Transitions) ---------- */
  const vtOk = !calmo && typeof document.startViewTransition === "function";
  let fotoOrigem = null;
  // ao tocar num produto, a foto do card "voa" até a página do produto
  document.addEventListener("click", e => {
    const a = e.target.closest(".card-media, .card-name, .emb-tile, .pin-pop a, .look-item");
    if (!a || !vtOk) return;
    const card = a.closest(".card") || a;
    const im = $("img:not(.alt)", card);
    if (im && im.complete && im.naturalWidth) fotoOrigem = im;
  }, true);
  const esperarImg = (im, ms = 300) => !im ? Promise.resolve() : Promise.race([
    new Promise(r => { if (im.complete && im.naturalWidth) r(); else { im.addEventListener("load", r, { once: true }); im.addEventListener("error", r, { once: true }); } }),
    new Promise(r => setTimeout(r, ms))
  ]);
  M.navegar = (fazer, ehProduto) => {
    if (!vtOk || !M.pronto || document.hidden) { fazer(); return; }
    const origem = ehProduto ? fotoOrigem : null;
    fotoOrigem = null;
    if (origem) origem.style.viewTransitionName = "foto-produto";
    document.documentElement.classList.add("vt");
    let feito = false;
    const rodar = () => { if (feito) return false; feito = true; fazer(); return true; };
    const vt = document.startViewTransition(async () => {
      if (origem) origem.style.viewTransitionName = "";
      if (!rodar()) return;
      const destino = $("#galImg");
      if (origem && destino) { destino.style.viewTransitionName = "foto-produto"; await esperarImg(destino); }
    });
    // garantia: se o navegador não animar (aba em segundo plano etc.), troca a página mesmo assim
    vt.updateCallbackDone.catch(() => {});
    vt.ready.catch(() => {});
    setTimeout(() => { if (!feito) { try { vt.skipTransition(); } catch (e) {} if (origem) origem.style.viewTransitionName = ""; rodar(); } }, 450);
    vt.finished.catch(() => {}).finally(() => {
      document.documentElement.classList.remove("vt");
      const d = $("#galImg"); if (d) d.style.viewTransitionName = "";
    });
  };

  /* ---------- 3. Revelar ao rolar ---------- */
  let io;
  function revelar(raiz) {
    if (calmo || !("IntersectionObserver" in window)) return;
    if (!io) io = new IntersectionObserver(es => es.forEach(en => {
      if (!en.isIntersecting) return;
      en.target.classList.add("rv-on"); io.unobserve(en.target);
    }), { threshold: .15, rootMargin: "0px 0px -40px 0px" });
    $$(".sec-head, .cat, .perks > div, .emb-tile, .look, .insta", raiz).forEach((el, i) => {
      if (el.classList.contains("rv")) return;
      el.classList.add("rv"); el.style.setProperty("--rv-d", (i % 5) * 70 + "ms");
      io.observe(el);
    });
  }

  /* ---------- 4. Carrosséis de arrastar (rolagem nativa com encaixe) ---------- */
  function carrosseis(raiz) {
    $$(".rail", raiz).forEach(rail => {
      if (rail.dataset.ok) return; rail.dataset.ok = 1;
      const tr = $(".rail-track", rail), prev = $(".rail-prev", rail), next = $(".rail-next", rail);
      const passo = () => Math.max(tr.clientWidth * 0.8, 240);
      const att = () => {
        const fim = tr.scrollWidth - tr.clientWidth - 4;
        if (prev) prev.disabled = tr.scrollLeft <= 4;
        if (next) next.disabled = tr.scrollLeft >= fim;
        rail.classList.toggle("sem-setas", fim <= 0);
      };
      prev && prev.addEventListener("click", () => tr.scrollBy({ left: -passo(), behavior: calmo ? "auto" : "smooth" }));
      next && next.addEventListener("click", () => tr.scrollBy({ left: passo(), behavior: calmo ? "auto" : "smooth" }));
      tr.addEventListener("scroll", att, { passive: true });
      addEventListener("resize", att);
      setTimeout(att, 50);
      // arrastar com o mouse no computador (no celular o dedo já arrasta)
      let x0 = 0, s0 = 0, arrastou = false, down = false;
      tr.addEventListener("pointerdown", e => { if (e.pointerType !== "mouse" || e.button) return; down = true; arrastou = false; x0 = e.clientX; s0 = tr.scrollLeft; });
      addEventListener("pointermove", e => {
        if (!down) return; const dx = e.clientX - x0;
        if (Math.abs(dx) > 5 && !arrastou) { arrastou = true; tr.classList.add("arrastando"); }
        if (arrastou) tr.scrollLeft = s0 - dx;
      });
      addEventListener("pointerup", () => { if (!down) return; down = false; tr.classList.remove("arrastando"); });
      tr.addEventListener("click", e => { if (arrastou) { e.preventDefault(); e.stopPropagation(); arrastou = false; } }, true);
      tr.addEventListener("dragstart", e => e.preventDefault());
    });
  }

  /* ---------- 5. Banner: arrastar para o lado troca o slide ---------- */
  M.swipe = (el, onEsq, onDir) => {
    let x0 = null, y0 = 0;
    el.addEventListener("pointerdown", e => { x0 = e.clientX; y0 = e.clientY; }, { passive: true });
    el.addEventListener("pointerup", e => {
      if (x0 == null) return; const dx = e.clientX - x0, dy = e.clientY - y0; x0 = null;
      if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy)) { el._arrastou = Date.now(); (dx < 0 ? onEsq : onDir)(); }
    });
    el.addEventListener("pointercancel", () => { x0 = null; });
  };

  /* ---------- 6. Zoom nas fotos do produto (PhotoSwipe) ---------- */
  const PSW = "https://cdn.jsdelivr.net/npm/photoswipe@5.4.4/dist/";
  let pswCarregado;
  function carregarPSW() {
    if (pswCarregado) return pswCarregado;
    const css = document.createElement("link"); css.rel = "stylesheet"; css.href = PSW + "photoswipe.css"; document.head.appendChild(css);
    pswCarregado = new Promise((ok, fail) => {
      const s = document.createElement("script"); s.src = PSW + "umd/photoswipe.umd.min.js";
      s.onload = () => ok(window.PhotoSwipe); s.onerror = fail; document.head.appendChild(s);
    });
    return pswCarregado;
  }
  const tamanho = src => new Promise(r => { const i = new Image(); i.onload = () => r({ src, width: i.naturalWidth, height: i.naturalHeight }); i.onerror = () => r(null); i.src = src; });
  /** abre o zoom; fontes = lista de URLs já prontas */
  M.zoom = async (fontes, indice = 0) => {
    try {
      const [PS, itens] = await Promise.all([carregarPSW(), Promise.all(fontes.map(tamanho))]);
      const ds = itens.filter(Boolean); if (!ds.length) return;
      const pswp = new PS({
        dataSource: ds, index: Math.min(indice, ds.length - 1), bgOpacity: .94, showHideAnimationType: calmo ? "none" : "fade",
        wheelToZoom: true, initialZoomLevel: "fit", secondaryZoomLevel: 2, maxZoomLevel: 4,
        closeTitle: "Fechar", zoomTitle: "Ampliar", arrowPrevTitle: "Anterior", arrowNextTitle: "Próxima", errorMsg: "Não consegui abrir a foto."
      });
      pswp.on("openingAnimationStart", () => document.body.classList.add("locked"));
      pswp.on("destroy", () => document.body.classList.remove("locked"));
      pswp.init();
    } catch (e) { /* sem internet para o zoom: segue sem ele */ }
  };

  /** chamado depois de cada página desenhada */
  M.depois = raiz => { revelar(raiz); carrosseis(raiz); };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciarLenis); else iniciarLenis();
})();
