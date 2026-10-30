// 1ClickSVG — Option (Alt) + survol = sélection du SVG ou de l'image, Option + clic = enregistrer sous…
(() => {
  if (window.__oneClickSvgLoaded) return;
  window.__oneClickSvgLoaded = true;

  const SVG_NS = "http://www.w3.org/2000/svg";

  const T = /^fr\b/i.test(navigator.language)
    ? { click: "clic pour enregistrer", preparing: "Préparation…", saved: "Enregistré ✓",
        canceled: "Annulé", error: "Erreur : ", canvasLocked: "canvas protégé par le site" }
    : { click: "click to save", preparing: "Preparing…", saved: "Saved ✓",
        canceled: "Canceled", error: "Error: ", canvasLocked: "canvas is protected by the site" };
  const XLINK_NS = "http://www.w3.org/1999/xlink";

  let altDown = false;
  let lastX = -1;
  let lastY = -1;
  let current = null; // { kind: "inline" | "url", el, url? }

  // ---------------------------------------------------------------------------
  // Overlay (dans un shadow root pour ne pas subir le CSS de la page)
  // ---------------------------------------------------------------------------
  const host = document.createElement("div");
  host.setAttribute("data-1clicksvg", "");
  const shadow = host.attachShadow({ mode: "closed" });
  shadow.innerHTML = `
    <style>
      :host { all: initial; }
      .box {
        position: fixed; z-index: 2147483647; pointer-events: none;
        box-sizing: border-box; border: 2px solid #7c5cff; border-radius: 4px;
        background: rgba(124, 92, 255, 0.12);
        box-shadow: 0 0 0 1px rgba(255,255,255,.8), 0 0 0 4px rgba(124,92,255,.25);
        display: none;
      }
      .box.ok { border-color: #22c55e; background: rgba(34,197,94,.15); box-shadow: 0 0 0 4px rgba(34,197,94,.25); }
      .box.err { border-color: #ef4444; background: rgba(239,68,68,.15); box-shadow: 0 0 0 4px rgba(239,68,68,.25); }
      .tag {
        position: absolute; left: -2px; bottom: 100%; margin-bottom: 4px;
        font: 600 11px/1.2 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        color: #fff; background: #7c5cff; padding: 3px 6px; border-radius: 4px;
        white-space: nowrap;
      }
      .box.below .tag { bottom: auto; top: 100%; margin: 4px 0 0; }
      .box.ok .tag { background: #22c55e; }
      .box.err .tag { background: #ef4444; }
    </style>
    <div class="box"><div class="tag"></div></div>`;
  const box = shadow.querySelector(".box");
  const tag = shadow.querySelector(".tag");

  function mountOverlay() {
    if (!host.isConnected) document.documentElement.appendChild(host);
  }

  function showOverlay(target, label, state) {
    mountOverlay();
    const r = target.el.getBoundingClientRect();
    box.style.left = r.left - 3 + "px";
    box.style.top = r.top - 3 + "px";
    box.style.width = r.width + 6 + "px";
    box.style.height = r.height + 6 + "px";
    box.classList.toggle("below", r.top < 24);
    box.classList.toggle("ok", state === "ok");
    box.classList.toggle("err", state === "err");
    tag.textContent =
      label || `${target.label} · ${Math.round(r.width)}×${Math.round(r.height)} — ${T.click}`;
    box.style.display = "block";
  }

  function hideOverlay() {
    box.style.display = "none";
    current = null;
  }

  // ---------------------------------------------------------------------------
  // Détection du SVG sous le curseur
  // ---------------------------------------------------------------------------
  const SVG_URL_RE = /^data:image\/svg\+xml|\.svg(?:[?#]|$)/i;

  function isSvgUrl(url) {
    return !!url && SVG_URL_RE.test(url);
  }

  // Première image de fond CSS (SVG en priorité).
  function cssImageUrl(el) {
    const bg = getComputedStyle(el).backgroundImage;
    if (!bg || bg === "none") return null;
    const re = /url\(\s*(["']?)(.*?)\1\s*\)/g;
    const urls = [];
    let m;
    while ((m = re.exec(bg))) urls.push(m[2]);
    return urls.find(isSvgUrl) || urls[0] || null;
  }

  // Type affiché dans l'étiquette, deviné depuis l'URL (le vrai type est vérifié au téléchargement).
  function guessType(url) {
    const m = /^data:image\/([a-z0-9.+-]+)/i.exec(url) || /\.([a-z0-9]{2,5})(?:[?#]|$)/i.exec(url);
    if (!m) return "Image";
    const t = m[1].toLowerCase().replace("svg+xml", "svg").replace("jpeg", "jpg");
    return /^(svg|png|jpg|gif|webp|avif|bmp|ico|tiff?)$/.test(t) ? t.toUpperCase() : "Image";
  }

  function urlTarget(el, url) {
    url = new URL(url, document.baseURI).href;
    return { kind: "url", el, url, label: guessType(url) };
  }

  function outermostSvg(el) {
    let svg = el instanceof SVGSVGElement ? el : el.ownerSVGElement || el.closest("svg");
    while (svg && svg.ownerSVGElement) svg = svg.ownerSVGElement;
    return svg;
  }

  function findTarget(x, y) {
    if (x < 0 || y < 0) return null;
    const stack = document.elementsFromPoint(x, y);
    for (const el of stack) {
      if (el === host || el === document.body || el === document.documentElement) break;

      if (el instanceof SVGElement) {
        const svg = outermostSvg(el);
        if (svg) return { kind: "inline", el: svg, label: "SVG" };
      }
      if (el instanceof HTMLImageElement && (el.currentSrc || el.src)) {
        return urlTarget(el, el.currentSrc || el.src);
      }
      if (el instanceof HTMLObjectElement && isSvgUrl(el.data)) {
        return urlTarget(el, el.data);
      }
      if (el instanceof HTMLEmbedElement && isSvgUrl(el.src)) {
        return urlTarget(el, el.src);
      }
      if (el instanceof HTMLCanvasElement && el.width && el.height) {
        return { kind: "canvas", el, label: "PNG" };
      }
      if (el instanceof HTMLVideoElement && el.poster) {
        return urlTarget(el, el.poster);
      }
      const bg = cssImageUrl(el);
      if (bg) return urlTarget(el, bg);
    }
    return null;
  }

  function update() {
    if (!altDown) return hideOverlay();
    const t = findTarget(lastX, lastY);
    if (!t) return hideOverlay();
    current = t;
    showOverlay(t);
  }

  // ---------------------------------------------------------------------------
  // Sérialisation d'un <svg> inline en fichier autonome
  // ---------------------------------------------------------------------------
  // Propriétés de présentation recopiées depuis le style calculé (CSS de la page,
  // currentColor…), avec leur valeur par défaut pour ne pas alourdir le fichier.
  const STYLE_PROPS = {
    fill: "rgb(0, 0, 0)",
    "fill-opacity": "1",
    "fill-rule": "nonzero",
    stroke: "none",
    "stroke-width": "1px",
    "stroke-opacity": "1",
    "stroke-linecap": "butt",
    "stroke-linejoin": "miter",
    "stroke-dasharray": "none",
    "stroke-dashoffset": "0px",
    "stroke-miterlimit": "4",
    opacity: "1",
    "clip-rule": "nonzero",
    "stop-color": "rgb(0, 0, 0)",
    "stop-opacity": "1",
    "font-family": null,
    "font-size": null,
    "font-weight": "400",
    "font-style": "normal",
    "text-anchor": "start",
    "paint-order": "normal",
    "vector-effect": "none",
  };
  const TEXT_TAGS = new Set(["text", "tspan", "textPath"]);
  const SKIP_TAGS = new Set(["style", "script", "title", "desc", "metadata"]);

  function inlineStyles(orig, clone) {
    const origEls = [orig, ...orig.querySelectorAll("*")];
    const cloneEls = [clone, ...clone.querySelectorAll("*")];
    for (let i = 0; i < origEls.length; i++) {
      const o = origEls[i];
      const c = cloneEls[i];
      if (!c || !(o instanceof SVGElement) || SKIP_TAGS.has(o.localName)) continue;
      // Le contenu des <symbol>/<defs> hérite de son <use>, pas de son emplacement dans le DOM.
      if (o.localName !== "stop" && o.closest("symbol, defs") && o !== orig) continue;

      const cs = getComputedStyle(o);
      const decl = [];
      for (const [prop, def] of Object.entries(STYLE_PROPS)) {
        if (prop.startsWith("font") || prop === "text-anchor") {
          if (!TEXT_TAGS.has(o.localName)) continue;
        }
        // Le style calculé peut donner url("https://page/…#grad") : on garde la référence locale.
        const v = cs.getPropertyValue(prop).replace(/url\(\s*["']?[^"')#]*#([^"')]+)["']?\s*\)/g, "url(#$1)");
        if (!v || v === def) continue;
        decl.push(`${prop}:${v}`);
      }
      if (cs.display === "none") decl.push("display:none");
      if (cs.visibility === "hidden") decl.push("visibility:hidden");
      if (decl.length) {
        const prev = c.getAttribute("style");
        // Les valeurs calculées passent en dernier : elles reflètent le rendu réel de la page.
        c.setAttribute("style", (prev ? prev.replace(/;?\s*$/, ";") : "") + decl.join(";"));
      }
    }
  }

  function sanitize(root) {
    root.querySelectorAll("script").forEach((n) => n.remove());
    for (const el of [root, ...root.querySelectorAll("*")]) {
      for (const attr of [...el.attributes]) {
        if (/^on/i.test(attr.name)) el.removeAttribute(attr.name);
      }
    }
  }

  function getHref(el) {
    return el.getAttribute("href") || el.getAttributeNS(XLINK_NS, "href") || "";
  }

  function setHref(el, value) {
    if (el.hasAttribute("href")) el.setAttribute("href", value);
    if (el.hasAttributeNS(XLINK_NS, "href")) el.setAttributeNS(XLINK_NS, "xlink:href", value);
  }

  // Références locales (#id) utilisées par l'élément et ses descendants.
  function collectRefs(root) {
    const ids = new Set();
    const urlRe = /url\(\s*["']?#([^)"'\s]+)/g;
    for (const el of [root, ...root.querySelectorAll("*")]) {
      const href = getHref(el);
      if (href.startsWith("#")) ids.add(decodeURIComponent(href.slice(1)));
      for (const attr of el.attributes) {
        let m;
        urlRe.lastIndex = 0;
        while ((m = urlRe.exec(attr.value))) ids.add(decodeURIComponent(m[1]));
      }
    }
    return ids;
  }

  const spriteCache = new Map();
  async function loadSprite(url) {
    if (!spriteCache.has(url)) {
      spriteCache.set(
        url,
        fetch(url, { credentials: "include" })
          .then((r) => (r.ok ? r.text() : Promise.reject()))
          .then((t) => new DOMParser().parseFromString(t, "image/svg+xml"))
          .catch(() => null)
      );
    }
    return spriteCache.get(url);
  }

  // Copie dans un <defs> les éléments référencés en dehors du SVG
  // (sprites <use href="#icon">, dégradés définis ailleurs, sprites externes…).
  async function resolveExternalRefs(clone) {
    let defs = null;
    const ensureDefs = () => {
      if (!defs) {
        defs = document.createElementNS(SVG_NS, "defs");
        clone.insertBefore(defs, clone.firstChild);
      }
      return defs;
    };

    // Sprites externes : <use href="sprite.svg#icon">
    for (const use of clone.querySelectorAll("use")) {
      const href = getHref(use);
      if (!href || href.startsWith("#")) continue;
      let abs;
      try {
        abs = new URL(href, document.baseURI);
      } catch {
        continue;
      }
      const id = decodeURIComponent(abs.hash.slice(1));
      if (!id) continue;
      abs.hash = "";
      const doc = await loadSprite(abs.href);
      const src = doc && doc.getElementById(id);
      if (!src) continue;
      if (!clone.querySelector(`[id="${CSS.escape(id)}"]`)) {
        ensureDefs().appendChild(document.importNode(src, true));
      }
      setHref(use, "#" + id);
    }

    // Références #id vers le reste de la page (boucle jusqu'à stabilité).
    const done = new Set();
    for (let pass = 0; pass < 10; pass++) {
      let added = false;
      for (const id of collectRefs(clone)) {
        if (done.has(id)) continue;
        done.add(id);
        if (clone.querySelector(`[id="${CSS.escape(id)}"]`)) continue;
        const src = document.getElementById(id);
        if (!src) continue;
        ensureDefs().appendChild(src.cloneNode(true));
        added = true;
      }
      if (!added) break;
    }
  }

  function absolutizeImages(clone) {
    for (const img of clone.querySelectorAll("image, feImage")) {
      const href = getHref(img);
      if (!href || href.startsWith("data:") || href.startsWith("#")) continue;
      try {
        setHref(img, new URL(href, document.baseURI).href);
      } catch {}
    }
  }

  function fixSize(orig, clone) {
    const r = orig.getBoundingClientRect();
    const w = Math.round(r.width * 100) / 100;
    const h = Math.round(r.height * 100) / 100;
    const isAbs = (v) => v && /^\s*[\d.]+(px)?\s*$/.test(v);

    if (!clone.hasAttribute("viewBox")) {
      // Sans viewBox, on fige le système de coordonnées sur la taille affichée.
      const vw = parseFloat(orig.getAttribute("width")) || w;
      const vh = parseFloat(orig.getAttribute("height")) || h;
      if (vw && vh) clone.setAttribute("viewBox", `0 0 ${vw} ${vh}`);
    }
    if (!isAbs(clone.getAttribute("width")) && w) clone.setAttribute("width", w);
    if (!isAbs(clone.getAttribute("height")) && h) clone.setAttribute("height", h);
  }

  async function serializeInline(svg) {
    const clone = svg.cloneNode(true);
    inlineStyles(svg, clone);
    sanitize(clone);
    await resolveExternalRefs(clone);
    absolutizeImages(clone);
    fixSize(svg, clone);
    clone.removeAttribute("class");
    clone.removeAttribute("aria-hidden");
    clone.removeAttribute("focusable");
    let out = new XMLSerializer().serializeToString(clone);
    if (!/^<svg[^>]*\sxmlns=/.test(out)) out = out.replace(/^<svg/, `<svg xmlns="${SVG_NS}"`);
    return out;
  }

  // ---------------------------------------------------------------------------
  // Nom de fichier proposé (sans extension : le background l'ajoute selon le vrai type)
  // ---------------------------------------------------------------------------
  function cleanName(s) {
    return (s || "")
      .replace(/\.(svg|png|jpe?g|gif|webp|avif|bmp|ico|tiff?)$/i, "")
      .replace(/[\\/:*?"<>|#%&{}$!'`=@+]+/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .slice(0, 80);
  }

  function suggestName(target) {
    const el = target.el;
    const candidates = [];
    if (target.kind === "url" && !/^(data|blob):/.test(target.url)) {
      try {
        const last = new URL(target.url).pathname.split("/").pop();
        candidates.push(decodeURIComponent(last));
      } catch {}
    }
    candidates.push(el.getAttribute("aria-label"), el.getAttribute("alt"), el.getAttribute("title"));
    if (target.kind === "inline") {
      const title = el.querySelector(":scope > title");
      if (title) candidates.push(title.textContent);
      const use = el.querySelector("use");
      if (use) candidates.push(getHref(use).split("#").pop());
    }
    const parent = el.closest("a, button, [aria-label]");
    if (parent && parent !== el) {
      candidates.push(parent.getAttribute("aria-label"), parent.getAttribute("title"));
    }
    candidates.push(el.id);
    const cls = (el.getAttribute("class") || "").split(/\s+/).find((c) => /[a-z]{3,}/i.test(c));
    candidates.push(cls);

    const name = candidates.map(cleanName).find(Boolean);
    const site = location.hostname.replace(/^www\./, "") || "image";
    return name || `${site}-${target.label.toLowerCase()}`;
  }

  // ---------------------------------------------------------------------------
  // Enregistrement
  // ---------------------------------------------------------------------------
  async function blobToMessage(blob, msg) {
    if (/svg/.test(blob.type)) msg.svg = await blob.text();
    else {
      msg.bytes = await blob.arrayBuffer();
      msg.mime = blob.type;
    }
  }

  async function save(target) {
    showOverlay(target, T.preparing);
    const msg = { type: "save-image", filename: suggestName(target), hint: target.label };
    try {
      if (target.kind === "inline") {
        msg.svg = await serializeInline(target.el);
      } else if (target.kind === "canvas") {
        // Échoue si le canvas contient des images d'un autre site (canvas "tainted").
        const blob = await new Promise((resolve, reject) => {
          try {
            target.el.toBlob((b) => (b ? resolve(b) : reject(new Error(T.canvasLocked))), "image/png");
          } catch {
            reject(new Error(T.canvasLocked));
          }
        });
        await blobToMessage(blob, msg);
      } else if (/^(data|blob):/.test(target.url)) {
        // Le background ne peut pas lire les blob: de la page : on lit ici.
        await blobToMessage(await (await fetch(target.url)).blob(), msg);
      } else {
        msg.url = target.url;
      }
      const res = await browser.runtime.sendMessage(msg);
      const canceled = res && !res.ok && /cancel/i.test(res.error || "");
      if (res && !res.ok && !canceled) throw new Error(res.error);
      flash(target, canceled ? T.canceled : T.saved, canceled ? null : "ok");
    } catch (e) {
      console.error("[1ClickSVG]", e);
      flash(target, T.error + (e && e.message || e), "err");
    }
  }

  function flash(target, label, state) {
    showOverlay(target, label, state);
    setTimeout(() => {
      if (altDown) update();
      else hideOverlay();
    }, 1000);
  }

  // ---------------------------------------------------------------------------
  // Événements
  // ---------------------------------------------------------------------------
  const opts = { capture: true, passive: false };

  window.addEventListener("keydown", (e) => {
    if (e.key === "Alt") {
      altDown = true;
      update();
    }
  }, true);

  window.addEventListener("keyup", (e) => {
    if (e.key === "Alt") {
      altDown = false;
      hideOverlay();
    }
  }, true);

  window.addEventListener("mousemove", (e) => {
    lastX = e.clientX;
    lastY = e.clientY;
    altDown = e.altKey;
    update();
  }, true);

  const reset = () => {
    altDown = false;
    hideOverlay();
  };
  window.addEventListener("blur", reset);
  document.addEventListener("visibilitychange", reset);

  const reposition = () => {
    if (current) update();
  };
  window.addEventListener("scroll", reposition, true);
  window.addEventListener("resize", reposition);

  // On bloque l'action normale (lien, bouton…) quand Option+clic vise un SVG.
  const swallow = (e) => {
    if (!e.altKey || e.button !== 0) return false;
    const t = current || findTarget(e.clientX, e.clientY);
    if (!t) return false;
    e.preventDefault();
    e.stopImmediatePropagation();
    return t;
  };
  for (const type of ["pointerdown", "mousedown", "pointerup", "mouseup"]) {
    window.addEventListener(type, swallow, opts);
  }
  window.addEventListener("click", (e) => {
    const t = swallow(e);
    if (t) save(t);
  }, opts);
})();
