// Reçoit l'image (SVG en texte, octets ou URL) depuis le content script,
// puis ouvre la fenêtre "Enregistrer sous" ou la copie dans le presse-papiers.

const pendingBlobUrls = new Map(); // downloadId -> blob URL

const EXT_BY_MIME = {
  "image/svg+xml": "svg",
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/avif": "avif",
  "image/bmp": "bmp",
  "image/x-icon": "ico",
  "image/vnd.microsoft.icon": "ico",
  "image/tiff": "tiff",
};

function extFor(mime, hint, url) {
  const base = (mime || "").split(";")[0].trim().toLowerCase();
  if (EXT_BY_MIME[base]) return EXT_BY_MIME[base];
  const m = url && /\.([a-z0-9]{2,5})(?:[?#]|$)/i.exec(new URL(url).pathname);
  if (m) return m[1].toLowerCase().replace("jpeg", "jpg");
  return hint && hint !== "Image" ? hint.toLowerCase() : "png";
}

browser.runtime.onMessage.addListener(async (msg) => {
  if (!msg || (msg.type !== "save-image" && msg.type !== "copy-image")) return;
  const copy = msg.type === "copy-image";
  const base = msg.filename || "image";

  // Normalisation : { svg } pour du SVG, { blob, ext } pour une image matricielle.
  let image;
  if (msg.svg != null) {
    image = { svg: msg.svg };
  } else if (msg.bytes) {
    image = { blob: new Blob([msg.bytes], { type: msg.mime }), ext: extFor(msg.mime, msg.hint) };
  } else if (msg.url) {
    // Récupéré depuis le background, qui n'est pas soumis aux restrictions CORS de la page.
    try {
      const res = await fetch(msg.url, { credentials: "include" });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const blob = await res.blob();
      const ext = extFor(blob.type, msg.hint, msg.url);
      image = ext === "svg" ? { svg: await blob.text() } : { blob, ext };
    } catch (e) {
      if (copy) return { ok: false, error: String(e && e.message || e) };
      // Dernier recours : laisser le gestionnaire de téléchargements récupérer l'URL lui-même.
      return download(msg.url, `${base}.${extFor(null, msg.hint, msg.url)}`);
    }
  } else {
    return { ok: false, error: "empty" };
  }

  try {
    if (copy) {
      if (image.svg != null) await copyText(image.svg);
      else await copyImage(image.blob, image.ext);
      return { ok: true };
    }
    if (image.svg != null) return saveSvg(image.svg, base);
    return saveBlob(image.blob, base, image.ext);
  } catch (e) {
    return { ok: false, error: String(e && e.message || e) };
  }
});

// ---------------------------------------------------------------------------
// Presse-papiers (permission "clipboardWrite")
// ---------------------------------------------------------------------------
async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    // Repli : la page de fond n'a pas le focus, execCommand reste autorisé avec clipboardWrite.
    const ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    if (!ok) throw new Error("clipboard");
  }
}

// browser.clipboard.setImageData n'accepte que PNG et JPEG : le reste est converti en PNG.
async function copyImage(blob, ext) {
  if (ext === "png" || ext === "jpg") {
    return browser.clipboard.setImageData(await blob.arrayBuffer(), ext === "jpg" ? "jpeg" : "png");
  }
  const bitmap = await createImageBitmap(blob);
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  canvas.getContext("2d").drawImage(bitmap, 0, 0);
  const png = await canvas.convertToBlob({ type: "image/png" });
  return browser.clipboard.setImageData(await png.arrayBuffer(), "png");
}

// ---------------------------------------------------------------------------
// Enregistrement
// ---------------------------------------------------------------------------
function saveSvg(text, base) {
  if (!/^\s*<\?xml/.test(text)) {
    text = '<?xml version="1.0" encoding="UTF-8"?>\n' + text;
  }
  return saveBlob(new Blob([text], { type: "image/svg+xml" }), base, "svg");
}

function saveBlob(blob, base, ext) {
  return download(URL.createObjectURL(blob), `${base}.${ext}`, true);
}

async function download(url, filename, isBlob) {
  try {
    const id = await browser.downloads.download({ url, filename, saveAs: true });
    if (isBlob) pendingBlobUrls.set(id, url);
    return { ok: true };
  } catch (e) {
    // L'utilisateur a annulé la fenêtre, ou nom de fichier refusé.
    if (isBlob) URL.revokeObjectURL(url);
    return { ok: false, error: String(e && e.message || e) };
  }
}

browser.downloads.onChanged.addListener((delta) => {
  if (!delta.state || delta.state.current === "in_progress") return;
  const url = pendingBlobUrls.get(delta.id);
  if (url) {
    URL.revokeObjectURL(url);
    pendingBlobUrls.delete(delta.id);
  }
});
