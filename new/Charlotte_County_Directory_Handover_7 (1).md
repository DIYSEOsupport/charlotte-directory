# Charlotte County Business Directory - Handover 7

Written Sun Oct 11, 2026, about 9:45 AM. Replaces Handovers 5 and 6 (deleted).
New chat: use the project files, then say: **"Continue from handover 7."**
Read this file, then ask the owner ONE question (see section 11).

---

## 1. Rules the owner set (follow always)

- Explain every action step simply, like to a 12 year old. No fluff. Say WHAT to do, not why.
- Best option first.
- Reply style: "caveman" (short plain words). **Never say "Ugg".**
- Everything must stay FREE. If any screen asks for a card or free trial, stop and tell the owner.
- Ask clarifying questions until 99% sure. ONE question at a time.
- Never edit, delete, add, move or change content without direction or permission.
- Stay on brand.
- Owner is new to vibecoding, GitHub and scripts. Give only small numbered steps.
- Owner uses a Chromebook: cannot place phone calls. Ctrl+Shift+Delete does nothing (use Chrome menu > Delete browsing data). New line inside a sheet cell = Ctrl+Enter.
- Claude cannot read the owner's Google Sheet, GitHub, or the live script. Ask for pasted text or screenshots.
- Claude cannot test in a browser or Google Sheets. Say so when handing over files.
- Owner runs low on usage limit. Keep replies short, batch work.
- Owner's name: Diana. Business: DIYSEO.

---

## 2. What the project is

Free web app. A directory of small businesses in Charlotte County, FL, plus an intake form for owners to add or update their listing. No paid hosting.

| Piece | Where | Notes |
|---|---|---|
| index.html | GitHub Pages | directory page, about 385 KB. Do not retype. Edit by find and replace only. |
| form.html | GitHub Pages | intake form, about 140 KB |
| form-receiver.gs | Google Apps Script (NOT GitHub) | receives form entries, writes sheet, serves public copy, runs update flow. Newest code = file `form-receiver-v7.gs` in this project. |
| Google Sheet (CORRECT) | Owner's Drive | ID `1W28srAyI6nJplMKJoFYWIcdaLQlvEb-Z35_S1xQBq10`, tab gid `59027526`. Has the 15 new headings. Empty. |
| Google Sheet (WRONG, old) | Owner's Drive | ID `1Ubl-WQtsX_MQHEnbDbrTiBPjTHOP_4OWAPNwO2oM0R4`, gid `1600060211`. Old 14-heading layout. Holds 2 rows: test "apples in a box" and DIYSEO. No Google Form linked. |
| Drive folder "Directory Logos" | Owner's Drive | logos, "anyone with link can view" |

Flow: owner fills form.html (Google sign-in) > script saves row in sheet > index.html asks script for public copy > cards show.

---

## 3. Word list: owner words vs code words

| Owner says | Means |
|---|---|
| "biz type" / "Business Type" | The CATEGORY (6 tiles). Sits in column A under the business name. |
| "type" (3-choice pick list) | Physical Location / Online Only / Mobile Service / Other = "About your business" on form. **Not saved** any more. |
| "About" | Text typed in "Describe your business" |
| "hidden columns" | Private columns (Name, Title, How to contact, Owner Key, Google Account Email) plus Logo link |
| "Directory" (owner, 03:38 and again 09:38) | NOT CONFIRMED. Two readings: (a) the old WRONG sheet/file; (b) the public Directory PAGE (index.html) shows the new entry but the new sheet does not. Both fit "form still sends to the OLD script". Ask the owner which. |

---

## 4. Where we are right now

### Found
- Script top is correct: `SHEET_ID` = `1W28sr...Bq10`, `SHEET_GID` = 59027526.
- Owner's last Deploy showed **version 9**. NOT confirmed that this is v7 code. Live address was never checked (owner pasted sheet headings instead).
- Correct sheet already has the 15 headings (owner confirmed copy came from it).
- Test row went to the WRONG old sheet because **GitHub form.html had the OLD script address** ending `5Luw` (checked at 02:51 and 03:07 on branch Patch-3).
- GitHub web editor search and github.dev (VS Code in browser) both failed or froze. Do NOT use them again.
- Claude made a fixed `form.html` (only change: script address now ends `ltgPadR_w`, no `5Luw` left). Saved in this project as `claude/form.html`. Owner was told to upload it by drag and drop (Add file > Upload files, on Patch-3). **Upload NOT confirmed.**
- GitHub: default branch is **Patch-3** (capital P).

### Owner's latest message (09:38, same as 03:38)
"When I fill in form now it puts it on Directory not sheet. We can create a new sheet if easiest. Limit close. Create handover, keep files in project, delete older versions."
A new sheet will NOT fix this if the form still hits the old script. The form page address must be right first.

### REPO MIX-UP (found 13:47)
- Owner has TWO GitHub repos with files named `form.html` and `index.html`.
  - **`Small-Biz-Directory`** = the real project (this handover). Live pages: `diyseosupport.github.io/Small-Biz-Directory/`.
  - **`DIR`** = a DIFFERENT, old project (`diyseosupport.github.io/DIR/`). Its index.html has script address `AKfycbwm_a...NHMc`. **Never edit or upload into DIR.**
- Owner checked the live Small-Biz-Directory form at 12:11: right comic design, all 5 steps, but rows go to the wrong sheet (old script address still live).
- Owner is on an iPhone at times. iPhone upload: save file to Files, Safari > aA > Request Desktop Website, repo `Small-Biz-Directory`, branch Patch-3, Add file > Upload files.
- The raw.githubusercontent link opens inside the chat app and goes back to chat. Have owner type it in Chrome address bar, or use github.com > form.html > Raw.
- First step next chat: confirm the owner is in `Small-Biz-Directory` (address bar must say that) before any upload.

### ADDED 15:30 - index.html and "still wrong form"
- `index.html` for Small-Biz-Directory is NOT in this project or zip (about 385 KB, owner never attached it). Claude cannot make the correct one without it. Need: owner attaches the real `index.html` from repo `Small-Biz-Directory`, branch Patch-3. Then swap ONLY the `CSV_URL` address to the one ending `ltgPadR_w` (and the share link `scaling-fiesta` to `Small-Biz-Directory` if owner agrees). Do not retype the file.
- Owner uploaded to Patch-3 and the live form still looked wrong / rows still wrong. Unchecked idea: GitHub Pages may build from a different branch (e.g. `main`), so Patch-3 uploads never go live. CHECK FIRST: repo Settings > Pages > "Build and deployment" > Branch. Page must build from the branch the owner uploads to. (Owner is on iPhone: use Safari Desktop Website.)
- Zip made 15:30 holds: form.html (fixed address), form-receiver-v7.gs, row1-headings.txt, row2 example, DUMMY test business, DIYSEO listing, this handover.

### NOT done
1. Confirm fixed form.html is live on GitHub (check method in section 7).
2. index.html on GitHub: not checked. Its `CSV_URL` (line 441) may still have the old address. Need owner to save the raw file and attach it, then Claude swaps the address (same method as form.html).
3. Confirm live script address shows v7 output (section 6).
4. Sheet reset: clear rows 1 and 2, paste 8 headings into A1, run `tidySheet`. (Correct sheet may already have headings, check.)
5. Re-enter DIYSEO listing through the form. Delete test rows.
6. Hide blue columns and Logo (later, ask first).

### Next steps in order
1. Ask the ONE question (section 11).
2. Make sure form.html on GitHub has `ltgPadR_w`.
3. Make sure index.html on GitHub has `ltgPadR_w`.
4. Check live address shows 16 headings starting `"Business Name","Category"`.
5. Test with dummy business. Check row lands in the CORRECT sheet (`1W28sr...`).
6. If row still goes to old sheet while form and live address are right: make a NEW Google Sheet, update `SHEET_ID` and `SHEET_GID` in the script, redeploy as New version on the existing deployment.
7. Re-enter DIYSEO. Delete test rows.

---

## 5. Files in this project

| File | What |
|---|---|
| `claude/Charlotte_County_Directory_Handover_7.md` | this file |
| `claude/form.html` | FIXED form page, script address `ltgPadR_w`. Upload to GitHub as `form.html`. |
| `claude/form-receiver-v7.gs` | script v7. Paste WHOLE file into Apps Script. |
| `claude/row1-headings.txt` | row 1, 8 headings, tab-separated, paste into A1 |
| `claude/row2-example-for-reference-only.txt` | what a finished row looks like. Reference only. |
| `claude/DUMMY-test-business.md` | fake business for form test |
| `claude/DIYSEO-listing-to-re-enter.md` | owner's real listing text |

index.html is NOT in the project (too big). Get it from the owner when needed.

---

## 6. Google script: rules and steps

### Put new code live
1. script.google.com > open the project.
2. Click in the code > **Ctrl+A** > paste `form-receiver-v7.gs` > **Ctrl+S**.
3. **Deploy > Manage deployments** > pencil on the deployment ending `ltgPadR_w`.
4. Version: **New version**. Who has access: **Anyone**. **Deploy**. Note version number.
5. **NEVER click "New deployment".** It makes a new address and breaks the pages.
6. If asked for permission: dropdown `authorizeOnce` > Run > Allow.
7. Dropdown `tidySheet` > Run. Adds 7 private columns, shades, sorts. Safe to rerun.

### Live address (Web app URL)
`https://script.google.com/macros/s/AKfycbybhaqyfJ2JNXy78PKCLIcIkhGL4AMHcd1w3Pfw3NB5-5BkJrruSeVuIGn8-ltgPadR_w/exec`

- Add `?ping=1`: page says "Directory form receiver is running."
- Without `?ping=1`: v7 shows public copy as text. First line must be `"Business Name","Category","Public Contact Name",...` (16 headings). Old script shows `"Business Name","Slogan","Phone"` (10 headings).

### Key constants
- Google sign-in Client ID: `429873674496-c3ld7ru88i8b0acssaeh26adtvfok12e.apps.googleusercontent.com`
- Admin email in script: diyseo.support@gmail.com. Help email on thank-you mail: DIYSEO.support@gmail.com
- Old dead deployment ID (never use): `AKfycbwh86Zwcn4bA9j_rdELSH7eeJYXnZewxTb-g0jpnkLNDn8SFRqEicCZ9E4D_y_D8J5Luw`
- Settings at top of script: `CATEGORY_GAP = 1`, `CATEGORY_COLOR = '#666666'`, `NAME_COLOR = '#5B2A86'`, `SHADE_COLOR = '#CFE2F3'`, `DIRECTORY_URL`.

### If a NEW sheet is needed
1. Make a new Google Sheet. Paste the 8 headings (row1-headings.txt) into A1.
2. Copy its ID (long code in its address between `/d/` and `/edit`) and its tab number (`gid=` at the end).
3. In the script, change `SHEET_ID` and `SHEET_GID` at the top. Save.
4. Deploy > Manage deployments > pencil > New version > Deploy (NEVER New deployment).
5. Run `authorizeOnce`, then `tidySheet`.
6. Keep sheet sharing Restricted.

---

## 7. GitHub steps (WORKING methods only)

Repo: https://github.com/DIYSEOsupport/Small-Biz-Directory
Branch: **Patch-3** (capital P). In URLs use `Patch-3`.

### Upload a file (best method)
1. Open the repo. Branch box: Patch-3.
2. **Add file > Upload files**. Drag in the file (`form.html` or `index.html`).
3. Pick **Commit directly to the Patch-3 branch**. Click green **Commit changes**.
4. Wait 1 minute.

### Check a file is live (best check)
Open in a new tab, then Ctrl+F `ENDPOINT` (form) or `CSV_URL` (index). Last 10 letters before `/exec` must be `ltgPadR_w`.
- Form: `https://raw.githubusercontent.com/DIYSEOsupport/Small-Biz-Directory/Patch-3/form.html`
- Index: `https://raw.githubusercontent.com/DIYSEOsupport/Small-Biz-Directory/Patch-3/index.html`

### Then test
Open the form page, press **Ctrl+Shift+R** (hard reload). Or try Incognito.
- Directory: `https://diyseosupport.github.io/Small-Biz-Directory/`
- Form: `https://diyseosupport.github.io/Small-Biz-Directory/form.html`

### Do NOT use
- GitHub pencil editor with Ctrl+F (cannot find text in big file).
- Pressing `.` or github.dev (froze; the `.` key just typed in the branch box).
- Pasting the whole file in chat.

### To edit index.html (when needed)
Owner opens the raw index.html link, Ctrl+S saves it, attaches it in chat. Claude swaps only the address with find and replace and sends it back. Owner uploads by drag and drop.

---

## 8. The sheet in detail (script v7)

### Row 1: 8 headings, columns A to H
| Col | Heading | What the script puts in it |
|---|---|---|
| A | Business Name | Name, 1 blank line, then category. Name bold purple. Category grey, not bold. |
| B | Slogan or short description | Slogan box |
| C | Contact | One cell, one item per line |
| D | Address | `123 Main St, Port Charlotte, FL 33948` |
| E | Area Served | Area / City Served (mobile services) |
| F | About | "Describe your business" text only (max 400 characters) |
| G | Details | "Other details" (only when pick list is Other) |
| H | Logo | Google Drive link |

### Contact cell format
```
Diana, Owner
Phone: 941-500-3707
Email: diyseo.support@gmail.com
Website: diyseosupport.gumroad.com
Facebook Business: facebook.com/page
NextDoor Business: nextdoor.com/pages/x
NextDoor Personal: nextdoor.com/u/y
```
First line with no label = public contact name, comma, title. Empty items left out. Labels must stay exact if edited by hand. `Facebook:` and `NextDoor:` also work.

### Private columns (script adds to the right of Logo, never public)
Timestamp | Name | Title | How to contact you with questions about your submission? | Owner Key (private) | Google Account Email (private) | Hidden (private)
- Shaded light blue (to hide later): Name, Title, How to contact, Owner Key, Google Account Email, Logo. Nothing hidden now.
- Hidden (private) gets a date when a listing is replaced. Replaced rows turn red with line through, left out of public copy.
- Owner Key = scrambled code of the Google account. First account to add a business name owns it. Only that account (or admin) can update.

### Hand edits in column A
Name on line 1. Category on a later line, exactly one of the 6 categories. Blank lines fine.

### 6 categories
Home & Garden Services, Local Trades & Repairs, Food & Drinks, Shops & Retail, Salons, Beauty & Fitness, Professional & Online Services
(Note: form.html tile text is "Salons, Beauty & Fitness" with commas as written in the page.)

### Public copy the script sends to index.html
Headings: Business Name, Category, Public Contact Name, Public Contact Title, About your business, Other details, Slogan, Phone, Website, Email, Facebook, NextDoor Business, NextDoor Personal, Address, Area Served, Logo. index.html needs no change except the script address.

### Form question > sheet column
Business Name > A line 1. Category > A under name. Slogan > B. Public contact name+title > C line 1. Phone, Email, Website, Facebook Business, NextDoor Business, NextDoor Personal > C labelled lines. Street/City/State/Zip > D. Area > E. Describe > F. Other details > G. Logo > H. About-your-business pick list > not saved. Name, Title, How to contact, Timestamp > private columns.

### Update flow
- Sign in with Google. Owner with existing businesses picks "New business" or "Update my business". Old answers fill the form.
- Update saves a NEW row, marks old row replaced. Same name on several visible rows: newest wins.
- Rename to a name used by someone else: NAME_TAKEN.
- Logo: none chosen keeps old one. "Delete my logo" removes it, file goes to Drive Trash.
- Pick list not saved, so an update opens on "Other". Owner re-picks.
- Form posts through a hidden frame. After 12 seconds with no reply it shows "You're in! Check the directory in a minute." Row saves anyway.

---

## 9. Still to do (priority order)

1. Finish section 4 next steps.
2. Hide blue columns and Logo in sheet (in `formatSheet_` add back hiding for `SHADE_HEADERS`). Ask first.
3. Fix share link in index.html: `https://diyseosupport.github.io/scaling-fiesta/` to `https://diyseosupport.github.io/Small-Biz-Directory/`. Ask first.
4. Pick list not saved: directory used to hide Area Served for "Online Only". Now Area Served shows if filled. Ask owner if it matters.
5. Check grey category look in sheet. Adjust `CATEGORY_GAP`, `CATEGORY_COLOR` if wrong.
6. Confirm new sheet sharing is Restricted.
7. If Google sign-in fails: Google Cloud Console > Credentials. Authorized origin `https://diyseosupport.github.io` (no repo name).
8. GitHub Settings > Pages: Branch and folder `/ (root)`. Confirm it shows index.html not README. Pages must build from Patch-3 (default branch).
9. Make the form look beautiful (owner request, not started). Ask what they want first.
10. Directory failed in owner's normal Chrome window but worked in Incognito earlier. Recheck.
11. Print page: "Other details::" two colons (script now sends no colon); Category at bottom instead of under name. Ask which still wrong.
12. Facebook value like "fb/diyseo.com" not seen as a Facebook link.
13. Privacy: consider removing form-receiver.gs from public GitHub repo (shows Client ID and admin email; not a password).
14. Clean old GitHub files only if owner agrees. Old branches exist: main, old/readme.txt, review, others. Do not delete without asking.
15. Possible later: P2P sync with WebRTC and QR code (never defined).

---

## 10. Troubleshooting quick list

| Problem | Likely cause | Action |
|---|---|---|
| Row lands in old 14-heading sheet | Form on GitHub has old address `5Luw` | Upload fixed form.html, check raw link |
| Live address shows 10 headings, no Category | Old script live | Redo deploy steps. Ask version number. |
| Live address downloads a file | Old script live | Same |
| Form says not connected / nothing saves | Pages on GitHub have old address | Upload fixed files |
| Directory empty | Sheet empty, script not live, or cache | Check live address first, then Ctrl+Shift+R |
| WRONG_OWNER | Different Google account than first | Use first account or admin email |
| Category not showing | Cell A lacks category on later line | Fix A by hand |
| Columns scrambled | Old data under new headings | Match order to section 8 |
| Page looks unchanged after upload | Cache | Ctrl+Shift+R or Incognito |

---

## 11. First message to send in the new chat

"Continue from handover 7. Read my files, then ask me ONE question: open the raw form link and tell me the last 10 letters before /exec."
(Raw form link is in section 7. Right answer: `ltgPadR_w`. If `D8J5Luw`, the upload did not work: redo the drag and drop upload. If `ltgPadR_w` and rows still go to the wrong place: ask the owner what "Directory" means (section 3), then check index.html `CSV_URL`.)
