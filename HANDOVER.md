# HANDOVER — Charlotte County Directory (updated Nov 13, 2026)

Read this first. Then do "NEXT STEPS" in order.

---

## 0. UPDATE Nov 13 (newest — read first)
- **Save as App picture** (`assets/save-as-app.png`, rebuilt):
  - Top right = **CC Directory app icon** (not DIYSEO).
  - QR smaller (box 184px) + "SCAN TO OPEN IT!".
  - Bottom footer = small DIYSEO logo + `DIYSEO.support@gmail.com` • `diyseosupport.gumroad.com` (Walter Turncoat font, npm `@fontsource/walter-turncoat`).
  - QR remade sturdier: error correction **Q**, **RoundedModuleDrawer** (not circles), app icon 20% width, 900×900. Scans at 50% size.
- **Email script `form-receiver-v39.gs`** (copy of v38 + footer change). NOT in repo yet unless user pushed it.
  - New vars: `BRAND_URL` (gumroad), `BRAND_URL_TEXT`, `BRAND_EMAIL`.
  - `brandFooterInner_()` + `footerRow_()`: DIYSEO GIF logo (44px, links to gumroad) + brand email (mailto) • gumroad website. Used in every HTML email + confirm page.
  - `sendMail_` adds plain-text footer (DIYSEO / email / website) to every text email. Old `SITE_TEXT + SITE_URL` text lines removed so no double.
  - **User must paste v39 into script.google.com + deploy new version.**
- Rule: DIYSEO logo/website always = `https://diyseosupport.gumroad.com`.

## 1. What this project is

A free local business directory for Charlotte County, shared on Nextdoor.

- **Directory (live):** https://diyseosupport.github.io/charlotte-directory/
- **Sign-up form (live):** https://diyseosupport.github.io/charlotte-directory/form.html
- **Repo:** github.com/diyseosupport/charlotte-directory, branch `main`
  - The website **auto-deploys** when you push to `main` (GitHub Pages, about 1–2 min).
- **Email/backend script:** `form-receiver-v28.gs` (in the repo)
  - It does **NOT** auto-deploy.
  - To deploy: copy the whole file into script.google.com → Save → Deploy → Manage deployments → pencil icon → Version: **New version** → Deploy.
- **Google Sheet:** "Charlotte County Directory"
  - Tabs: Full Form, Pending, Rejected, Removed, Saves

### Key files in repo
| File | What it is |
|---|---|
| `index.html` | Directory page (everything inline: HTML/CSS/JS) |
| `form.html` | Sign-up / update / remove form |
| `manifest.webmanifest` | Home-screen app name + icons (short name "CC Directory") |
| `logos/app-icon-180.png` | iPhone home-screen icon (`index.html` line ~9, `apple-touch-icon`) |
| `logos/app-icon-192.png`, `logos/app-icon-512.png` | Android icons (from manifest) |
| `logos/giflogo_small.gif` | Spinning logo used in **email footer** (`QR_URL` var, line ~34 of .gs — name is misleading, it's the logo) |
| `diyseo_logo_static.png` | `DIYSEO_LOGO_URL` in .gs (line ~36) |
| `The_new_static_logo.png`, `The_new_dynamic_logo.gif` | Logo files already in repo (check vs new logo below — NOT identical bytes to the new uploads) |
| `BRAND.md` | Brand colors/fonts notes |
| `Whiz Bang Roman.ttf` | Brand font |
| `tests/`, `playwright.config.ts` | Playwright tests |

### Brand colors (from infographic)
- Purple bg / title: `#5b2a86` (91,42,134)
- Cream card: `#fff6dc` (255,246,220)
- Dark ink / borders / shadows: `#1a1033` (26,16,51)
- Orange: `#ff7a1a`
- Headline font: **Bangers** (npm `@fontsource/bangers`)

---

## 2. Already done

### Website (live now)
- Form no longer stuck after Google sign-in when listing check fails
- "Remove my business" only asks name, title, contact
- Slow submit: waits 30s, then shows honest "Almost there" message
- One-letter business names show in directory
- Feedback button shows confirmation pop-up
- Home-screen icon = DIYSEO round logo, name "CC Directory" (commit `43d91f1`)

### Email script (in repo, but USER MUST paste + deploy — check if done)
- Removal confirm link error fixed (`directorySheet_` bug)
- All emails: no purple title box, one orange centered button
- Email footer uses spinning GIF logo
- Confirmed removals move to new **Removed** tab
- Full Form sorted oldest first; alternating row colors
- **After deploy: run `tidySheet` once from the script editor**

### Home-screen infographic (made this session, NOT in repo)
File: `save-as-app.png` (1080×1350). User has it (sent in chat).
Changes vs. old version:
- Top right: new DIYSEO round logo (cream circle, blue ring)
- Removed orange website URL bar at bottom
- Added QR code + "SCAN TO OPEN IT!" (Bangers, purple), QR in white rounded box, dark border, dark offset shadow
- QR = CC Directory app branding: purple dots, dark corners with pink centers, CC Directory app icon in middle, no dinosaur
- QR tested: decodes to `https://diyseosupport.github.io/charlotte-directory/index.html`

---

## 3. Decisions made

- **App icon = "CC Directory" draft** (purple bg, cream rounded card, pink "CC" with dark shadow, yellow "DIRECTORY" pill). Not yet applied.
- **Infographic = new logo + QR code, no URL bar.** Done (file above).
- New logo = round DIYSEO logo: cream fill, blue ring, gear + orange arrow, "DIY" blue, "SEO" orange. Has PNG (static) and GIF (60 frames, animated) versions, both 1024×1024.

---

## 4. Files the user has (put these in the repo before starting)

These were uploaded in chat but are NOT in the repo. Make folder `assets/` in the repo and drop them in:

| Put at | What |
|---|---|
| `assets/save-as-app.png` | Finished new infographic |
| `assets/app-icon-draft.png` | "CC Directory" app icon (512×512) |
| `assets/new-logo.png` | New DIYSEO round logo, static (1024×1024, transparent corners) |
| `assets/new-logo.gif` | New DIYSEO round logo, animated (1024×1024, 60 frames) |
| `assets/qr-cc-directory.png` | CC Directory branded QR code (980×980) → `.../charlotte-directory/index.html` |

Old dino QR, DIYSEO-logo QR (qr-on-brand.png), and old infographic (no QR) = deleted. Not needed.

---

## 5. NEXT STEPS (in order)

### Step A — Swap app icon to "CC Directory" (website)
1. From `assets/app-icon-draft.png`, make 3 sizes and overwrite:
   - `logos/app-icon-180.png` (180×180)
   - `logos/app-icon-192.png` (192×192)
   - `logos/app-icon-512.png` (512×512)
   - Use high-quality resize (PIL `Image.LANCZOS`). No transparent corners for iPhone (180) — keep purple bg full bleed.
2. Bump cache: in `index.html` change `href="logos/app-icon-180.png"` → `href="logos/app-icon-180.png?v=2"`; same `?v=2` on both icon `src` in `manifest.webmanifest`.
3. Commit + push to `main`.
4. Test: open site on phone → Add to Home Screen → icon shows "CC Directory". (Old installs keep old icon — must delete + re-add.)

### Step B — New logo in emails (ASK USER FIRST — not yet confirmed)
1. Resize `assets/new-logo.gif` to small (about 120×120, keep all frames + loop) → overwrite `logos/giflogo_small.gif` (or new name + update `QR_URL` in .gs line ~34).
   - GIF resize: use `gifsicle --resize 120x120` or PIL with `save_all=True, loop=0, duration=` same as source.
2. If `DIYSEO_LOGO_URL` (.gs line ~36) still shows old logo anywhere, point it at a resized `new-logo.png`.
3. Push website (so image URL is live).
4. **User must** paste `form-receiver-v28.gs` into script.google.com + deploy new version (steps in section 1).
5. Test: submit a test listing → check email footer logo.

### Step C — Directory page logo (ASK USER — maybe)
- Check if `index.html` / `form.html` show the old DIYSEO logo anywhere (search `diyseo`, `logo`). Ask user if those should become new logo too.

### Step D — Update posts + status
- Infographic is ready to attach to Nextdoor posts (main feed + owners group). Post texts are in the project note `claude/directory-status.md`.
- Update `claude/directory-status.md` in the Claude project when things change.

---

## 6. Known problems (not fixed, no fix planned)
- Google sign-in does not work inside Nextdoor app's browser → tell people: open in Safari or Chrome.
- Emails often go to spam (free Gmail sender, no own domain).
- Owners without a Google account cannot sign up.

---

## 7. How the infographic was built (to redo it)

NOTE: old base image was deleted, so script below only works if you have it. To just change things, edit `assets/save-as-app.png` directly instead.

It's a patch on the old PNG with Python/PIL (no design source file exists).
Needs: `pip install pillow pyzbar` (+ system `libzbar0`), and Bangers font:
`npm pack @fontsource/bangers && tar xzf fontsource-bangers-*.tgz` → `package/files/bangers-latin-400-normal.woff`

```python
from PIL import Image, ImageDraw, ImageFont
CREAM=(255,246,220); DARK=(26,16,51); PURPLE=(91,42,134)
im=Image.open('assets/save-as-app-OLD.png').convert('RGB'); d=ImageDraw.Draw(im)
# 1. new logo top right (old logo was at x837-976, y95-234)
d.rectangle([826,84,990,246],fill=CREAM)
logo=Image.open('assets/new-logo.png').convert('RGBA').crop((36,36,988,988)).resize((150,150),Image.LANCZOS)
im.paste(logo,(907-75,165-75),logo)
# 2. remove URL bar
d.rectangle([110,1046,990,1298],fill=CREAM)
# 3. QR + text
qr=Image.open('assets/qr-cc-directory.png').convert('RGB').crop((20,20,960,960)).resize((188,188),Image.LANCZOS)
font=ImageFont.truetype('package/files/bangers-latin-400-normal.woff',72)
lines=['SCAN TO','OPEN IT!']
tw=max(d.textbbox((0,0),l,font=font)[2] for l in lines); gap=50; box=210
x0=(1080-(tw+gap+box))//2; qy=1060; lh=78; ty=qy+box//2-lh
for i,l in enumerate(lines): d.text((x0,ty+i*lh-6),l,font=font,fill=PURPLE)
bx=x0+tw+gap
d.rounded_rectangle([bx+8,qy+8,bx+box+8,qy+box+8],radius=16,fill=DARK)
d.rounded_rectangle([bx,qy,bx+box,qy+box],radius=16,fill=(255,255,255),outline=DARK,width=5)
im.paste(qr,(bx+11,qy+11))
im.save('assets/save-as-app.png')
```
Check QR still scans: `python3 -c "from pyzbar.pyzbar import decode;from PIL import Image;print(decode(Image.open('assets/save-as-app.png')))"`

---

## 7b. CC Directory QR recipe
QR is for the APP, so it uses CC Directory app branding (NOT DIYSEO). `pip install "qrcode[pil]"`. Error correction Q, box 20, border 2, RoundedModuleDrawer dots recolored purple `#5b2a86`. Finder eyes redrawn: dark ink `#1a1033` rounded square, white ring, pink `#c2307a` rounded center. White rounded square in middle + app icon (`assets/app-icon-draft.png`) at 20% width, rounded corners.
App icon colors: purple `#5b2a86`, cream `#fff6dc`, ink `#1a1033`, pink `#c2307a`, yellow `#ffd23f`. Always test scan with pyzbar after.

## 8. User preferences (for Claude in CLI)
- Be brief. Simple steps, like for a 12-year-old. Moderate caveman talk. No explaining why.
- Ask clarifying questions when unsure.
- Ask before pushing anything live.
- Commit message end lines:
  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  ```
