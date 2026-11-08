<p align="center">
  <img src="icons/icon.svg" width="96" height="96" alt="1ClickSVG">
</p>

<h1 align="center">1ClickSVG</h1>

<p align="center">
  <b>Option/Alt + click to save any SVG or image. Add Shift to copy it.</b><br>
  Firefox · Zen Browser · any Firefox-based browser
</p>

<p align="center">
  <a href="https://addons.mozilla.org/firefox/addon/1clicksvg/"><img src="https://img.shields.io/amo/v/1clicksvg?label=Firefox%20Add-ons&logo=firefoxbrowser&color=7c5cff" alt="Get 1ClickSVG on Firefox Add-ons"></a>
</p>

<p align="center">
  <a href="#english">English</a> · <a href="#français">Français</a>
</p>

---

## English

Hold **⌥ Option** (**Alt** on Windows/Linux) and hover a logo, icon or picture: it gets outlined so you see exactly what you'll get.

| Shortcut | Action |
| --- | --- |
| **⌥ Option + click** | Save: the "Save as" dialog opens with the file ready |
| **⌥ Option + ⇧ Shift + click** | Copy: SVGs are copied as code, other images as a picture |

Copied SVG code can be pasted straight into Figma, Illustrator, a code editor or an HTML page. Copied images are PNG (or JPG), so WebP, GIF, AVIF… are converted to PNG when copied.

### What it can save or copy

| Element on the page | Saved as |
| --- | --- |
| Inline `<svg>` (logos, icons) | `.svg` |
| `<img>`: SVG, PNG, JPG, WebP, GIF, AVIF, ICO… | original format |
| CSS `background-image` | original format |
| `<object>` / `<embed>` SVG | `.svg` |
| `<canvas>` | `.png` |
| `<video>` poster | original format |

The file extension comes from the real file type, not from the URL. A `.jpg` URL that actually serves WebP is saved as `.webp`.

**Inline SVGs are made standalone**, so the saved file looks like it did on the page:
- colors coming from the page's CSS (including `currentColor`) are written into the file;
- sprites (`<use href="#icon">`, including external `sprite.svg#icon`) and gradients, masks or filters defined elsewhere in the page are copied into the file;
- missing `width`, `height` or `viewBox` are filled in;
- `<script>` tags and `on*=` attributes are removed.

Links and buttons are not triggered when you Option‑click an image inside them.

### Install

**[Get it on Firefox Add-ons](https://addons.mozilla.org/firefox/addon/1clicksvg/)**, it works in Zen and every Firefox-based browser.

**Temporary install, for development**
1. Open `about:debugging#/runtime/this-firefox`
2. Click **Load Temporary Add-on…** and pick `manifest.json`.

It is removed when the browser restarts.

### Development

```bash
npm install
npm start        # launches Firefox with the extension loaded
npm run lint
npm run build    # zip in web-ext-artifacts/
```

**Signing a permanent build.** Firefox and Zen only keep signed extensions. Signing is free and automatic on addons.mozilla.org ("unlisted" channel). Create API keys at <https://addons.mozilla.org/developers/addon/api/key/>, then run:

```bash
npm run sign -- --api-key=YOUR_JWT_ISSUER --api-secret=YOUR_JWT_SECRET
```

Bump `version` in `manifest.json` before each new signature.

### Limitations

- Browser pages (`about:*`, addons.mozilla.org) and local `file://` pages do not allow extensions.
- Web fonts used inside an SVG logo are not embedded.
- A `<canvas>` that contains images from another site cannot be exported, because the browser blocks it.

### License

[MIT](LICENSE)

---

## Français

Maintenez **⌥ Option** (**Alt** sous Windows/Linux) et survolez un logo, une icône ou une image : il est entouré, pour voir exactement ce que vous allez récupérer.

| Raccourci | Action |
| --- | --- |
| **⌥ Option + clic** | Enregistrer : la fenêtre « Enregistrer sous » s'ouvre avec le fichier prêt |
| **⌥ Option + ⇧ Maj + clic** | Copier : les SVG sont copiés en code, les autres images en image |

Le code SVG copié se colle directement dans Figma, Illustrator, un éditeur de code ou une page HTML. Les images sont copiées en PNG (ou JPG) : les WebP, GIF, AVIF… sont convertis en PNG à la copie.

### Ce qui peut être enregistré ou copié

| Élément de la page | Enregistré en |
| --- | --- |
| `<svg>` dans la page (logos, icônes) | `.svg` |
| `<img>` : SVG, PNG, JPG, WebP, GIF, AVIF, ICO… | format d'origine |
| `background-image` CSS | format d'origine |
| `<object>` / `<embed>` SVG | `.svg` |
| `<canvas>` | `.png` |
| Image d'aperçu d'une `<video>` | format d'origine |

L'extension du fichier vient du vrai type du fichier, pas de l'URL. Une URL en `.jpg` qui renvoie en réalité du WebP est enregistrée en `.webp`.

**Les SVG de la page deviennent des fichiers autonomes**, qui s'affichent comme sur le site :
- les couleurs venant du CSS du site (y compris `currentColor`) sont écrites dans le fichier ;
- les icônes de sprites (`<use href="#icone">`, y compris un `sprite.svg#icone` externe) et les dégradés, masques ou filtres définis ailleurs dans la page sont copiés dans le fichier ;
- `width`, `height` ou `viewBox` sont ajoutés s'ils manquent ;
- les `<script>` et attributs `on*=` sont retirés.

Option + clic sur une image placée dans un lien ou un bouton n'ouvre pas le lien.

### Installation

**[Installer depuis Firefox Add-ons](https://addons.mozilla.org/fr/firefox/addon/1clicksvg/)** : fonctionne dans Zen et tous les navigateurs basés sur Firefox.

**Installation temporaire, pour le développement**
1. Ouvrez `about:debugging#/runtime/this-firefox`
2. Cliquez sur **Charger un module complémentaire temporaire…** et choisissez `manifest.json`.

Elle disparaît au redémarrage du navigateur.

### Développement

```bash
npm install
npm start        # lance Firefox avec l'extension chargée
npm run lint
npm run build    # archive .zip dans web-ext-artifacts/
```

**Signer une version permanente.** Firefox et Zen ne gardent que les extensions signées. La signature est gratuite et automatique sur addons.mozilla.org (mode « non listé »). Créez des clés d'API sur <https://addons.mozilla.org/developers/addon/api/key/>, puis lancez :

```bash
npm run sign -- --api-key=VOTRE_JWT_ISSUER --api-secret=VOTRE_JWT_SECRET
```

Augmentez le numéro `version` de `manifest.json` avant chaque nouvelle signature.

### Limites

- Les pages internes du navigateur (`about:*`, addons.mozilla.org) et les fichiers locaux `file://` n'autorisent pas les extensions.
- Les polices web utilisées dans un logo SVG ne sont pas intégrées.
- Un `<canvas>` contenant des images d'un autre site ne peut pas être exporté : le navigateur le bloque.

### Licence

[MIT](LICENSE)
