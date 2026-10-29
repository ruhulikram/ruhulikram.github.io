# CLAUDE.md

Static portfolio for Ruhul Ikram, a product developer and educator. The copy is in Indonesian (`lang="id"`). It deploys to GitHub Pages from the repo root at `https://ruhulikram.github.io/porto-ruhul/`.

## Stack

- Plain HTML, CSS, and vanilla JS. No build step, no package.json, no framework, no tests.
- GSAP 3.12.5 + ScrollTrigger loaded from jsDelivr (`defer`), used only on the home page.
- Self-hosted Geist variable font (`assets/fonts/geist-latin.woff2`, OFL).

## Preview

```powershell
python -m http.server 4173 --bind 127.0.0.1
```

## Design rule: one theme

Every page is a green cutting mat. The grid and ruler ticks are on `body`, and the 45° guide line is on `.hero::after`. Everything else is a physical object laid on the mat: the folder, sticky notes, kraft project folders, an index card, polaroids, a ruler with paper slips, and a letter. New UI should also be an object on the mat. Don't add new background themes per section. Tokens are on `:root` in `css/style.css`.

Motion is one orchestrated moment: the hero folder lands on the mat, then the paper butterflies take off as you scroll. Don't add scroll-reveal animations to each section.

## Files

- `index.html` sections, in order: `#home` (hero + folder), `#proses` (4-step sticky notes), `#proyek` (project folders), `#mengajar` (index card + polaroids), `#perjalanan` (ruler timeline), `#kontak` (letter).
- `projects/*.html`: one case-study page per project. `projects/ruhul-os.html` is the template: copy it, edit it, then link it from a `.project-folder` in `index.html`. The video slot takes a YouTube `iframe` inside `.case-media`.
- `css/style.css`: shared by every page. Breakpoints are 980px and 640px.
- `js/main.js`: `setupNavigation` (hide on scroll, `aria-current`), then `setupMotion` (GSAP hero intro, butterflies, folder parallax), which runs only when GSAP has loaded and reduced motion is off. The page must still work without it.

## Placeholders

Search for `GANTI` in `index.html` to find pending content: future project cards (`.is-pending`), teaching photos, mentoring entries, the CV at `assets/cv/Ruhul-Ikram-CV.pdf` (not added yet), and other social links.

## Assets

- The runtime uses WebP files under `assets/images/`. `assets/folder/`, `assets/butterfly/`, `assets/bg-desk.png`, and `assets/photo-utama.jpg` are editable sources and are not referenced. `assets/images/backgrounds/` (sky and grass) is no longer used.
- `assets/images/projects/ruhul-os.jpg` is a 1440×900 screenshot of the home page. Retake it whenever the hero changes.
- When an image's dimensions change, update its `width`/`height` attributes.
- If the domain changes, update the canonical URLs, OG metadata, `robots.txt`, and `sitemap.xml` together.

## Privacy

`more.txt` (private resume notes) and `style_dump.json` are gitignored. Never commit them. Don't put addresses or the phone number on the site. Photos of underage students need consent or blurred faces.
