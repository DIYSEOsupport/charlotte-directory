# Charlotte County Business Directory - Handover 9

Written Wed Oct 14, 2026. Replaces Handover 7 and 8 (both out of date: old sheet ID, old layout). Ignore any older handover, repo, sheet or script.
New chat: say **"Continue from handover 9."** Read this file, then do section 10.

---

## 1. Rules the owner set (follow always)

- Owner: Diana Leff (business DIYSEO). Digital marketing strategist, new to vibecoding, GitHub and scripts.
- Explain every action step simply. Small numbered steps, explicit ("click X, then Y"). No fluff. Say WHAT to do, not why. Best option first.
- Reply style: "caveman" (short, plain words). **Never say "Ugg".** Owner runs low on usage: keep replies short, batch work.
- ONE question at a time. Ask until 99% sure of the goal.
- Everything must stay FREE. If any screen asks for a card or trial, stop and tell the owner.
- **Never edit, delete, add, move or change content without direction or permission.** Stay on brand.
- Owner uses a Chromebook with a Linux terminal (folder `~/charlotte-directory`). Sometimes an iPhone. New line inside a sheet cell = Ctrl+Enter.
- Pasting a long block into the terminal works. Terminal file writes beat copy-paste for big files.
- Never use github.dev, the "." key or the GitHub pencil editor. They failed. Use the terminal or drag and drop.
- Claude cannot test the live Google script (proxy blocks it). Say so when handing over files. Claude CAN syntax-check with `node --check` on a .js copy of the script.
- If a Google Drive connector is present, Claude can READ the sheet (ID below). It cannot write cells.
- Hand files to the owner with SendUserFile, then give numbered steps.

---

## 2. What the project is

Free web app. A directory of small businesses in Charlotte County, FL, plus an intake form where owners add, update or remove their listing. No paid hosting.

Flow: owner opens `form.html` (Google sign-in) > posts to a Google Apps Script web app > row in the Google Sheet > `index.html` (directory) asks the same script for a public CSV > cards show. The script also emails the submitter a confirmation.

---

## 3. The setup (all current)

| Piece | Detail |
|---|---|
| GitHub repo | `DIYSEOsupport/charlotte-directory`, public, branch **main**, Pages ON |
| Live directory | https://diyseosupport.github.io/charlotte-directory/ |
| Live form | https://diyseosupport.github.io/charlotte-directory/form.html |
| Local folder | `~/charlotte-directory` (Linux, Chromebook) |
| Google Sheet | "Charlotte County Directory", ID `1mSNjflXI-u1B4zHkbUT2SKx7lklbE08nFwmoFFzYQvE`, tab **"Full Form"**, gid `112379302` |
| Second tab | "Owner View": read-only, formula-driven copy the owner will share by link. **Messed up, deferred** (chips do not show there because it is formula output) |
| Apps Script | "Charlotte Directory Receiver", code = `form-receiver-v12.gs` |
| Script web app address | `https://script.google.com/macros/s/AKfycbwGw2V1QUWKvgE8CEbRJ1cALv8vne_6MlQE0bbq6eVwPLYSYfliHyEI2_UEYn_UjO_lmw/exec` (ends `UjO_lmw`) |
| Google sign-in Client ID | `429873674496-c3ld7ru88i8b0acssaeh26adtvfok12e.apps.googleusercontent.com` |
| Admin email | diyseo.support@gmail.com (also the help email) |
| Logos | script auto-makes Drive folder "Directory Logos" |

GitHub terminal: `gh` has two accounts (`mylife3737`, `DIYSEOsupport`). Active must be **DIYSEOsupport** (`gh auth switch --user DIYSEOsupport`). Git identity: DIYSEOsupport / diyseo.support@gmail.com.

Script settings (top of `.gs`): `SHEET_ID`, `SHEET_GID` = 112379302, `DIRECTORY_URL` = new repo URL (fixed in v12), `FORM_URL`, `ADMIN_EMAILS`, `ALLOW_CLAIM_OLD_ROWS = true`.

---

## 4. What was built this stretch (state: all delivered, deploy status below)

1. New sheet + script v10 (adopted, working, test row landed in "Full Form").
2. Category renamed **"Beauty Salons & Fitness"** (a comma in a name breaks sheet chips). Six categories, exact names (must match the form, directory and sheet dropdown):
   Home & Garden Services; Local Trades & Repairs; Food & Drinks; Shops & Retail; Beauty Salons & Fitness; Professional & Online Services.
3. 10 dummy businesses with every column filled (files in `dummy-data/`).
4. **v11/v12 script + new form.html/index.html:**
   - **Update my business** lists ONLY the signer's own businesses (admin too, no bypass).
   - **Remove my business**: new third button on the form. Pick, confirm, POST `{action:'remove'}`. Script hides the row and stamps column P (recoverable, not deleted).
   - **Column D (Contact) has NO labels**: name/title line, then phone, email, then website, Facebook, NextDoor business, NextDoor personal, each on its own line; links saved as full `https://`. The parser still reads old labeled rows (`Phone:` etc.) and reads plain lines by shape.
   - Review page **Edit buttons** go to their own section (not always step 1).
   - **Directory Download = PDF only.** Spreadsheet/CSV download removed for the public.
   - **Phone PDF/share download** uses the phone share sheet (Save to Files) instead of a blob link.
   - **Share text** (email/text) is tidy with emoji lines; contact card (.vcf) has title, category, note.
   - **Confirmation email to submitter**: branded HTML (purple/orange), copy of what was saved, directory button, update/remove instructions.
5. Owner confirmed: phone numbers dial on iPhone; on Chromebook they copy the number (by design).

### Deploy status (ASK the owner, do not assume)
- git push of renamed category files: worked (push after `git pull --no-rebase --no-edit -X ours`).
- `form-receiver-v11.gs` + `form.html` (Remove button): owner told to deploy; not confirmed tested.
- **v12.gs, final `index.html`, final `form.html`: delivered, NOT confirmed deployed.**

---

## 5. Files in the zip

| File | What |
|---|---|
| `form-receiver-v12.gs` | CURRENT script. Paste into Apps Script. |
| `form.html` | CURRENT intake form (New / Update / Remove). |
| `index.html` | CURRENT directory (~384 KB, hero image embedded). Edit by find and replace only. Never retype. |
| `Charlotte_County_Directory_Handover_9.md` | this file |
| `dummy-data/` | dummy business TSVs, DIYSEO listing to re-enter, row headings reference |

Both pages hold the script address ending `UjO_lmw` (`ENDPOINT` in form.html, `CSV_URL` in index.html).

---

## 6. Sheet layout, tab "Full Form" (row 1 headings, A to P; Q is a stray "Business Type" column from dummy data)

| Col | Heading | Notes |
|---|---|---|
| A | Business Name | name ONLY (no category line any more) |
| B | Category/Specialty | chips dropdown; names must match the form. Multi-select OFF |
| C | Slogan or Short Description | |
| D | Contact | label-free lines (see above) |
| E | Address | maps-hyperlink formula (row 2 has the formula). Script skips formula columns |
| F | Address (raw) | text typed by the form; the directory reads THIS one (last address column wins) |
| G | Mobile Services Area Served | chips |
| H | About | |
| I | Logo | Drive link |
| J | Timestamp | private |
| K | Name | private |
| L | Title | private |
| M | How to contact you... | private |
| N | Owner Key (private) | HMAC of `owner|email` with secret in script properties. Claude cannot make real keys |
| O | Google Account Email (private) | |
| P | Hidden (private) | date stamp = retired/removed row. Rule `=$P2<>""` on `A2:P1000` shades red + strikethrough |

Script `keyFor_` maps headings to keys (`businessName, slogan, contact, address, category, area, about, other, logo, timestamp, name, title, how`). Each key is written once. The script also adds private columns if missing.
Rows below the data must have strikethrough OFF (select `A13:P1000`, Alt+Shift+5).
Update saves a NEW row and hides the old one (stamp in P). Same name on several live rows: newest wins. Owner is the first account that used the name; admin may edit any.

---

## 7. How to put code live (explicit steps for the owner)

### Script
1. script.google.com > open "Charlotte Directory Receiver" > open `Code.gs`.
2. Ctrl+A, delete, paste the whole `form-receiver-v12.gs`, **Ctrl+S**.
3. **Deploy > Manage deployments** > pencil > Version: **New version** > Deploy.
4. **NEVER click "New deployment"** (makes a new address, breaks the pages).
5. Permission screen: Advanced > Go to project > Allow. Do not run `tidySheet`.

### Website files
1. Drag the files into the Linux folder `charlotte-directory`, replace old.
2. Terminal: `cd ~/charlotte-directory && git add . && git commit -m "update" && git push`
3. If "rejected (fetch first)": `git pull --no-rebase --no-edit -X ours && git push`
4. Wait 1 min, Ctrl+Shift+R.

---

## 8. Still to do (owner's order, ask before each)

1. Confirm v12 + index.html + form.html are deployed; test: new business, update (own only), remove, confirmation email, PDF download on iPhone.
2. Check new submissions land correctly (A name only, B category, F raw address, E formula untouched).
3. **Format the sheet:** Montserrat for data, Oswald for headings; widths, wrap, header row, hide private columns J to P (not on the owner view), stripes. Best done in script formatting or by hand; ask first.
4. **Fix the "Owner View" tab** (owner: "we will work on that later").
5. Phone numbers in the SHEET do not dial. Owner asked about it, then said forget the spreadsheet for customers (they get the PDF; the sheet is hers). Only revisit if she asks (needs HYPERLINK tel: formula).
6. Share link in `index.html` still points to an older address in places: ask first.
7. Optional card fix in `index.html` (About vs Details heading): awaiting yes/no.
8. Delete dummy rows. Re-enter the real DIYSEO listing (`dummy-data/DIYSEO-listing-to-re-enter.md`).
9. Privacy: `.gs` should not live in the public repo (shows Client ID and admin email).

---

## 9. Troubleshooting

| Problem | Action |
|---|---|
| Category chip invalid | Name in sheet dropdown differs from the form. Match exactly; no commas |
| Row lands strikethrough | Clear strike on empty rows below data |
| WRONG_OWNER | Use the first Google account or the admin email |
| Remove / mine does nothing | Old script live: redo Deploy > New version |
| git push rejected | pull command in section 7 |
| Page looks unchanged | Ctrl+Shift+R or incognito |
| Sign-in fails | Google Cloud Console > Credentials > authorized origin `https://diyseosupport.github.io` |
| "Could not find the sheet tab" | `SHEET_GID` wrong (use number after `gid=`), redeploy |

---

## 10. First steps in the new chat

1. Read this file. Say "Continue from handover 9."
2. Ask the ONE question: "Did you paste v12 into the script and push the new `index.html` and `form.html`? (yes / no / not sure)"
3. Then follow section 8 in order.
