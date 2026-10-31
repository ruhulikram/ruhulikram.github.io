# CLAUDE.md

Static portfolio for Ruhul Ikram, a product developer and educator. The copy is in Indonesian (`lang="id"`). It deploys to GitHub Pages from the repo root at `https://ruhulikram.github.io/porto-ruhul/`.

## Stack

- Plain HTML, CSS, and vanilla JS. No build step, no package.json, no framework, no tests.
- GSAP 3.13.0 from jsDelivr (`defer`). Every plugin has been free since 3.13, and these are used: ScrollTrigger, ScrollSmoother, DrawSVGPlugin, Draggable, InertiaPlugin. Case pages load only gsap + ScrollTrigger + ScrollSmoother.
- Fonts: self-hosted Geist (`assets/fonts/geist-latin.woff2`, OFL) for everything, and Nanum Pen Script from Google Fonts (`--hand`) only for handwritten bits: tape nav labels, chalk notes, captions, and the certificate.

## Preview & Desk Studio (CMS)

```powershell
python -m http.server 4173 --bind 127.0.0.1
```

- `admin.html` (`js/admin.js`, `css/admin.css`): Visual admin panel for GitHub Pages to edit all copy, toggle sections/items active or inactive, add completed or ongoing projects (`.project-card.is-ongoing` with `.project-badge` and `.project-progress`), upload photos (auto-converted to `.webp` quality 82 via `<canvas>`), and manage social stickers.
- `data/portfolio.json` is the structured state source. Clicking **Simpan & Publish** in `admin.html` bakes pure static HTML directly into `index.html`, `projects/<slug>.html`, and `sitemap.xml` and pushes a single atomic commit to GitHub Pages via the GitHub REST API.

## Design rule: one theme

Every page is a green cutting mat. The grid is on `.mat` (`#smooth-content`) so it scrolls with the objects. The fixed ruler ticks are on `body::before`, and the 45° guide is on `.hero::after`. Everything else is an object lying on the mat:

- Paper objects drawn in CSS: sticky notes, printed project sheets (`.project-card`), an index card, polaroids, paper slips, the steel ruler rail, and round social stickers.
- Photo props as `<img class="desk-prop">`, using files from `assets/images/desk/`.

New UI should also be an object on the mat. Don't add a separate background theme per section. Keep desk props at least 40px from the left edge so the ruler ticks stay visible; props may bleed off the right edge. Tokens are on `:root` in `css/style.css`. Shadows go by height: `--shadow-paper` and `--drop-low` for flat items, `--drop-high` for thick ones (keyboard, mug, clip).

## Motion (js/main.js)

- `setupNavigation` always runs. Everything else runs only when GSAP has loaded and `prefers-reduced-motion` is off. JS then adds `html.has-motion`, and on a fine pointer also `html.has-drag`. CSS that only works with motion (for example the horizontal project row) has to sit behind `.has-motion`. Without JS the page must still look finished, so animate with `gsap.from()` only and never hide anything in CSS.
- **Physical motion only.** Nothing on a desk appears out of thin air, so never fade with `opacity`/`autoAlpha`. Objects are pushed in from past the screen edge (`offLeft`/`offRight`, `slideOnto`), lowered, pressed (pins, clips), or pulled (tape `scaleX`). Text is printed on the mat and does not animate. Only chalk strokes get drawn (DrawSVG).
- One function per section: hero (folder slides in, files rise, pin), process (pin, notes dealt in from the right, pins pressed, chalk arrows drawn), projects (pin + horizontal track, clips snap shut), teaching (index card from the left, polaroids tossed in and taped), journey (slips slide in), contact (sketchbook slides up, clip snaps). Pins and the horizontal scroll only run at ≥981px, via `gsap.matchMedia`.
- When an element starts off-screen vertically, trigger on its section, not on the element; otherwise the trigger moves with it.
- `.desk-prop[data-speed]` gets parallax from ScrollSmoother and has no entrance animation (it was already on the desk). Never tween x/y on those elements.
- In-page `#` links go through `smoother.scrollTo` (`setupAnchorLinks`). Use the individual CSS properties `rotate` / `translate` on elements GSAP animates, so they don't collide with GSAP's `transform`.

## Files

- `index.html` sections, in order: `#home`, `#proses`, `#proyek`, `#mengajar`, `#perjalanan`, `#kontak`, all inside `#smooth-wrapper > #smooth-content`. The fixed header (tape nav) sits outside the wrapper.
- `projects/*.html`: one case-study page per project. `projects/ruhul-os.html` is the template: copy it, then link it from a `.project-folder` in `index.html`. The video goes in `.case-media` as a YouTube iframe.
- `css/style.css`: shared by every page. Breakpoints are 980px and 640px. On ≤640px, `.desk-prop` is hidden unless it has `.keep-mobile`.

## Placeholders

Search for `GANTI` in `index.html` to find: future project cards (`.is-pending`), teaching photos, mentoring entries, the CV at `assets/cv/Ruhul-Ikram-CV.pdf` (not added yet), and the commented-out Instagram/TikTok stickers (fill in the username, then uncomment).

## Assets

- `assets/desk/` holds the large original PNGs of the desk props (sources, ~31 MB). The runtime uses the WebP files in `assets/images/desk/`. To regenerate them, trim the transparent margin and resize to about 2× display size, quality 82. `eraser.webp` has had a stray "Tambahkan judul" text painted out of the source.
- Other runtime assets: `assets/images/folder-ui/` (hero folder + stamp), `butterfly/`, `projects/`. `assets/folder/`, `assets/butterfly/`, and `assets/photo-utama.jpg` are editable sources that are not referenced.
- `assets/images/projects/ruhul-os.jpg` is a 1440×900 screenshot of the home page (also the OG image). Retake it when the hero changes.
- When an image's dimensions change, update its `width`/`height` attributes. If the domain changes, update the canonical URLs, OG metadata, `robots.txt`, and `sitemap.xml` together.

## Privacy

`more.txt` (private resume notes) and `style_dump.json` are gitignored. Never commit them. Don't put addresses or the phone number on the site. Photos of underage students need consent or blurred faces.
