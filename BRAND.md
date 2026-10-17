# Charlotte County Small Business Directory — Brand Guide

A free, no-login directory for Charlotte County small businesses, built and maintained by **DIYSEO**. Brand feel: hand-drawn carnival/sticker style — thick ink outlines, hard flat drop shadows (no blur), bright candy colors, playful copy. Never corporate, never minimal/flat-SaaS.

## Logo files

| File | Use |
|---|---|
| `diyseo-logo.png` | Footer "Built by DIYSEO" badge on `index.html` / `form.html` (circular, `object-fit:contain`, 44px) |
| `email-logo.png` | Email header banner (`BANNER_URL` in `form-receiver-v28.gs`) |
| `qr-logo.png` | QR code + badge, bottom of every email and page 1 of exported PDFs |
| `dummy-logos/*.png` | Initials-monogram placeholder logos for demo/test listings only — never use for real businesses |

Always link the DIYSEO logo to **`https://diyseosupport.gumroad.com`** (one word, no dot before "support" — `diyseo.support.gumroad.com` is NOT a real domain and will 404).

## Color palette

CSS variables, defined once in `index.html` `:root`:

| Variable | Hex | Use |
|---|---|---|
| `--ink` | `#1a1033` | Text, borders, shadows — the "outline" color on everything |
| `--purple` | `#5b2a86` | Primary brand purple (headers, email background) |
| `--magenta` | `#c2307a` | Accent / Search button |
| `--orange` | `#ff7a1a` | Primary CTA color (Filters button, "Add your business", PDF buttons) |
| `--yellow` | `#ffd23f` | Highlight / badge background (tagline sticker, "All" count pill) |
| `--teal` | `#1fb5c9` | Secondary icon button (mute/honk) |
| `--green` | `#1f8a4c` | Extra accent (filter accordion rotation) |
| `--red` | `#e5322d` | Warnings, "hidden" badge |
| `--cream` | `#fff6dc` | Page background / card background |

Rule of thumb: every interactive button gets **its own** color from this list — don't reuse the same color for two adjacent buttons. Hover = a soft colored glow (`box-shadow: 0 0 0 4px rgba(<color>,.35)`) layered on top of the normal hard shadow, not a color swap.

## Typography

- **Headers / display text:** `Bangers` (`--fh`) — the comic-shout font. Used for titles, badges, PDF page headings.
- **Body text:** `Walter Turncoat` (`--fb`) — the handwritten font, used for paragraphs and UI copy on the web pages and in HTML emails.
- **PDF exports:** `Oswald` — web fonts don't reliably rasterize to canvas, so PDFs use a clean condensed sans instead of the comic fonts.

Both `Bangers` and `Walter Turncoat` load from Google Fonts; `Oswald` is preloaded via `document.fonts.load()` before canvas PDF rendering starts.

## UI patterns (don't deviate)

- **Thick borders:** `3px solid var(--ink)` on almost every button/card/badge.
- **Hard shadows, no blur:** `box-shadow: 4px 4px 0 var(--ink)` (or smaller `2px 2px 0`) — never a soft/blurred shadow.
- **Press-down feedback:** on `:active`, translate the element toward its shadow and shrink the shadow (`transform:translate(2px,2px); box-shadow:2px 2px 0 var(--ink)`) — makes buttons feel physically pressed.
- **Pills:** fully-rounded (`border-radius:50px`), used for category tags and the "All X businesses" count.
- **Slight rotation:** sticker-style elements (the tagline badge, filter-panel title) get a `rotate(-1deg)`-ish tilt — never more than 2°.
- **Icon buttons:** square-ish with rounded corners (`border-radius:14px`), not circles (except the footer logo and the floating mute button).

## Voice & copy

- Address the reader as **"neighbor"** in alerts/popups ("Hold up, neighbor!").
- Short, plain sentences. No jargon, no "leverage/utilize/synergy."
- Milestone screens get one exclamation: "You're in!", "You're pending!", "One more step!"
- Never explain *how* to format an input (e.g. phone numbers) — just state the rule ("must be 10 digits").
- Confirmation/pending emails: don't mention a timeframe until the email is confirmed. After confirmation: "usually within a few hours."
- Every outbound email subject line includes the business name.
- Dummy/demo listings are always prefixed **"Dummy "** in the name and get obviously fake addresses (e.g. `123 Dummy St`) — never a real-looking address, so they can't be mistaken for a live business.

## Key URLs

- Directory: `https://diyseosupport.github.io/charlotte-directory/`
- Add/update form: `https://diyseosupport.github.io/charlotte-directory/form.html`
- DIYSEO / Gumroad: `https://diyseosupport.gumroad.com`
- Support email: `DIYSEO.support@gmail.com`

## Branding checklist for any new surface (email, PDF, page)

1. DIYSEO or directory logo visible somewhere on it.
2. Uses the palette above — no off-brand colors.
3. Headers in Bangers (or Oswald for canvas/PDF), body in Walter Turncoat.
4. Hard-shadow, thick-border sticker styling on buttons/badges.
5. Footer/closing line links to the correct `diyseosupport.gumroad.com` domain.
