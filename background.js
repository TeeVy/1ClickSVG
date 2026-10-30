// Reçoit l'image (SVG en texte, octets ou URL) depuis le content script et ouvre la fenêtre "Enregistrer sous".

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
  if (!msg || msg.type !== "save-image") return;
  const base = msg.filename || "image";

  if (msg.svg != null) return saveSvg(msg.svg, base);
  if (msg.bytes) return saveBlob(new Blob([msg.bytes], { type: msg.mime }), base, extFor(msg.mime, msg.hint));

  if (msg.url) {
    // Récupéré depuis le background, qui n'est pas soumis aux restrictions CORS de la page.
    try {
      const res = await fetch(msg.url, { credentials: "include" });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const blob = await res.blob();
      const ext = extFor(blob.type, msg.hint, msg.url);
      if (ext === "svg") return saveSvg(await blob.text(), base);
      return saveBlob(blob, base, ext);
    } catch (e) {
      // Dernier recours : laisser le gestionnaire de téléchargements récupérer l'URL lui-même.
      return download(msg.url, `${base}.${extFor(null, msg.hint, msg.url)}`);
    }
  }
  return { ok: false, error: "empty" };
});

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
