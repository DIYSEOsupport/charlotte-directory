# Charlotte County Business Directory - Handover 8

Written Sun Oct 11, 2026, about 10:20 PM. Fresh start: new repo, new sheet, new script. Nothing from older setups applies. Ignore any older handover, repo, sheet, form or script.
New chat: say **"Continue from handover 8."** Read this file, then do the first step in section 10.

---

## 1. Rules the owner set (follow always)

- Explain every action step simply, like to a 12 year old. No fluff. Say WHAT to do, not why.
- Best option first.
- Reply style: "caveman" (short plain words). **Never say "Ugg".**
- Everything must stay FREE. If any screen asks for a card or free trial, stop and tell the owner.
- Ask clarifying questions until 99% sure. ONE question at a time.
- Never edit, delete, add, move or change content without direction or permission.
- Stay on brand.
- Owner is new to vibecoding, GitHub and scripts. Small numbered steps only.
- Owner (Diana, business DIYSEO) uses a Chromebook with a Linux terminal. Sometimes an iPhone. New line inside a sheet cell = Ctrl+Enter.
- Terminal file writes work better than copy-paste for big files. Pasting a long block into the terminal works.
- Claude cannot read the owner's Sheet, GitHub or live script by login. Ask for pasted text or screenshots. Claude CAN read public GitHub raw files (raw.githubusercontent.com) with curl or fetch.
- Claude cannot test the form or sheet in a real browser with the live script. Say so when handing over files.
- Owner runs low on usage. Keep replies short. Batch work.
- Never use github.dev, the "." key, or the GitHub pencil editor with Ctrl+F. They failed. Use the terminal or drag and drop upload.

---

## 2. What the project is

Free web app. A directory of small businesses in Charlotte County, FL, plus an intake form where owners add or update their listing. No paid hosting.

Flow: owner fills `form.html` (Google sign-in) > script saves a row in the sheet > `index.html` asks the script for a public copy > cards show.

---

## 3. The setup (all current)

| Piece | Where | Detail |
|---|---|---|
| GitHub repo | `DIYSEOsupport/charlotte-directory` | public, branch **main**, Pages ON (main, folder `/`) |
| Live form | https://diyseosupport.github.io/charlotte-directory/form.html | comic theme, 5 steps |
| Live directory | https://diyseosupport.github.io/charlotte-directory/ | `index.html` |
| Local folder | `~/charlotte-directory` on the owner's Chromebook (Linux) | same files as the repo |
| Google Sheet | "Charlotte County Directory" | ID `1ybb_f753JJ8OiKz3ioNH0Q2P5pPTgrAqu6QAFU3Ud7U`, tab **gid `112379302`** |
| Sheet link | https://docs.google.com/spreadsheets/d/1ybb_f753JJ8OiKz3ioNH0Q2P5pPTgrAqu6QAFU3Ud7U/edit?gid=112379302 | owned by isthismylife37@gmail.com |
| Google Apps Script | project "Charlotte Directory Receiver" at script.google.com | signed in as isthismylife37@gmail.com (owner believes). Code = `form-receiver-v7.gs` |
| Script web app address | `https://script.google.com/macros/s/AKfycbwGw2V1QUWKvgE8CEbRJ1cALv8vne_6MlQE0bbq6eVwPLYSYfliHyEI2_UEYn_UjO_lmw/exec` | deployed once as a web app: Execute as Me, Access Anyone |
| Drive folder "Directory Logos" | script makes it by itself | logos |

### GitHub terminal login
- `gh` is logged in to two accounts: `mylife3737` and `DIYSEOsupport`. Active account is **DIYSEOsupport** (switch with `gh auth switch --user DIYSEOsupport`). Check with `gh auth status`.
- Git identity in the repo folder: name DIYSEOsupport, email diyseo.support@gmail.com.

### Script settings (top of `form-receiver-v7.gs`)
- `SHEET_ID` = `1ybb_f753JJ8OiKz3ioNH0Q2P5pPTgrAqu6QAFU3Ud7U`
- `SHEET_GID` = `112379302`
- Google sign-in Client ID: `429873674496-c3ld7ru88i8b0acssaeh26adtvfok12e.apps.googleusercontent.com`
- Admin email: diyseo.support@gmail.com. Help email on thank-you mail: DIYSEO.support@gmail.com
- `DIRECTORY_URL` still holds an OLD web address (ends `/Small-Biz-Directory/`). **Needs changing to `https://diyseosupport.github.io/charlotte-directory/`. Ask owner first.**
- Other settings: `CATEGORY_GAP = 1`, `CATEGORY_COLOR = '#666666'`, `NAME_COLOR = '#5B2A86'`, `SHADE_COLOR = '#CFE2F3'`.

---

## 4. Where we are right now

### Done
- New repo `charlotte-directory` made from the terminal. `form.html` and `index.html` pushed to main. Pages turned on. (Live check NOT yet done by owner.)
- New sheet made with the 8 headings in row 1 (columns A to H).
- New script project made, pasted, saved, deployed as web app (first deployment). Address in section 3.
- `form-receiver-v7.gs` updated to the new sheet ID and gid. Syntax checked.
- 5 fake test businesses made: file `dummy-5-rows.tsv` (2 storefront, 1 online, 2 mobile). Owner was told to paste at A2. NOT confirmed pasted.

### NOT done (in order)
1. **Swap the script address in the pages.** `form.html` (line `var ENDPOINT='...'`) and `index.html` (line `const CSV_URL = '...'`) still hold an OLD script address ending `ltgPadR_w`. Both must end `UjO_lmw`. Do it by find and replace only, never retype a file. Ask owner first. Then push (section 7).
2. **`tidySheet` threw a red error.** The owner did not paste the error text yet. First error seen: "Could not find the sheet tab. Check SHEET_GID." (before the gid was fixed to 112379302). After the fix the owner answered the run was not clean. Get the exact new error text. Then fix.
3. Re-paste the new `form-receiver-v7.gs` into the script if the owner has not (Ctrl+A, paste, Ctrl+S). Then Deploy > Manage deployments > pencil > **New version** > Deploy.
4. Confirm the live script address works (section 6 check).
5. Confirm both live pages open and look right (comic fonts).
6. Test: fill the form with a dummy business. Check the row lands in the new sheet.
7. Format the sheet (section 8). Owner's NEXT task after the above.
8. Re-enter the real DIYSEO listing through the form. Delete test rows.
9. Change `DIRECTORY_URL` in the script (ask first). Share link in `index.html` (ask first).

---

## 5. Files to keep in the new project

| File | What |
|---|---|
| `Charlotte_County_Directory_Handover_8.md` | this file |
| `form.html` | intake form (comic theme, newer version with "Update my business" and help email). Needs script address swap (section 4 item 1). |
| `index.html` | directory page, about 384 KB. Do not retype. Edit by find and replace only. Needs script address swap. |
| `form-receiver-v7.gs` | script code. Already points at the new sheet. |
| `row1-headings.txt` | the 8 headings, tab-separated |
| `dummy-5-rows.tsv` | 5 fake businesses, rows only, no headings |

Claude can fetch the live repo files with curl from `https://raw.githubusercontent.com/DIYSEOsupport/charlotte-directory/main/<file>`.

---

## 6. Google script: steps

### Put new code live
1. script.google.com > open "Charlotte Directory Receiver".
2. Click in the code > **Ctrl+A** > paste the whole `form-receiver-v7.gs` > **Ctrl+S**.
3. **Deploy > Manage deployments** > pencil.
4. Version: **New version**. Who has access: **Anyone**. **Deploy**.
5. **NEVER click "New deployment" after the first one.** It makes a new address and breaks the pages.
6. If asked for permission: dropdown `authorizeOnce` > Run > Allow. If Google warns "unsafe": Advanced > Go to project.
7. Dropdown `tidySheet` > Run. It adds 7 private columns, shades, sorts. Safe to rerun.

### Check the live address
Open the web app address from section 3.
- Add `?ping=1`: page says "Directory form receiver is running."
- Without `?ping=1`: v7 shows the public copy as text. First line must be `"Business Name","Category","Public Contact Name",...` (16 headings).

---

## 7. Update the pages from the terminal (best method)

1. Open the Linux terminal. Type `cd ~/charlotte-directory`.
2. Make sure the new file is in that folder (drag from Files app > Linux files).
3. Run:
```
git add form.html index.html && git commit -m "update" && git push
```
4. Wait 1 to 2 minutes. Reload with **Ctrl+Shift+R**.
5. Check a file is live: open `https://raw.githubusercontent.com/DIYSEOsupport/charlotte-directory/main/form.html`, press Ctrl+F `ENDPOINT`. The last 10 letters before `/exec` must be `UjO_lmw`. Same for `index.html` and `CSV_URL`.

Fallback: repo on github.com > **Add file > Upload files** > drag > Commit to **main**.

---

## 8. The sheet in detail (script v7)

### Row 1: 8 headings, columns A to H
| Col | Heading | What the script puts in it |
|---|---|---|
| A | Business Name | Name, 1 blank line, then category. Name bold purple. Category grey, not bold. |
| B | Slogan or short description | Slogan box |
| C | Contact | One cell, one item per line |
| D | Address | `123 Main St, Port Charlotte, FL 33948` (storefront only) |
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
- Shaded light blue (to hide later): Name, Title, How to contact, Owner Key, Google Account Email, Logo. Nothing hidden yet.
- Hidden (private) gets a date when a listing is replaced. Replaced rows turn red with a line through, left out of public copy.
- Owner Key = scrambled code of the Google account. First account to add a business name owns it. Only that account (or admin) can update.

### Hand edits in column A
Name on line 1. Category on a later line, exactly one of the 6 categories. Blank lines fine.

### 6 categories
Home & Garden Services, Local Trades & Repairs, Food & Drinks, Shops & Retail, Salons, Beauty & Fitness, Professional & Online Services

### Public copy the script sends to index.html
Headings: Business Name, Category, Public Contact Name, Public Contact Title, About your business, Other details, Slogan, Phone, Website, Email, Facebook, NextDoor Business, NextDoor Personal, Address, Area Served, Logo.

### Update flow
- Sign in with Google. Owner with existing businesses picks "New business" or "Update my business". Old answers fill the form.
- Update saves a NEW row, marks the old row replaced. Same name on several visible rows: newest wins.
- Rename to a name used by someone else: NAME_TAKEN.
- Logo: none chosen keeps old one. "Delete my logo" removes it, file goes to Drive Trash.
- Form posts through a hidden frame. After 12 seconds with no reply it shows "You're in! Check the directory in a minute." Row saves anyway.

### SHEET FORMATTING (owner's next task)
Owner wants:
- **Montserrat** for the data (all cells below row 1).
- **Oswald** for the column titles (row 1).
- By hand today: Ctrl+A > font Montserrat; click row number 1 > font Oswald.
- Better: make the script set these fonts in `formatSheet_` so `tidySheet` keeps them. Ask first before editing the script.
- Ask the owner what else they want (column widths, wrap, hide blue columns, header color, brand purple `#5B2A86`). One question at a time.

---

## 9. Test businesses (fake, safe to delete)

`dummy-5-rows.tsv` holds 5 rows, columns A to H, no headings:
1. Dummy Sunny Bites Cafe (Food & Drinks, storefront)
2. Dummy Harbor Hardware (Shops & Retail, storefront)
3. Dummy Web Wizards (Professional & Online Services, online)
4. Dummy Mobile Mowers (Home & Garden Services, mobile)
5. Dummy Roving Stylist (Salons, Beauty & Fitness, mobile)

Paste at cell A2. Delete all 5 rows before real listings.

---

## 10. First steps in the new chat

1. Say: "Continue from handover 8." Read this file.
2. Ask the ONE question: "Paste the red error text from `tidySheet`, or tell me it runs clean."
3. Then follow section 4, NOT done list, in order.

---

## 11. Troubleshooting quick list

| Problem | Likely cause | Action |
|---|---|---|
| "Could not find the sheet tab. Check SHEET_GID." | Wrong tab number in script | Open sheet, copy number after `gid=` in address bar, set `SHEET_GID`, save, Deploy > New version |
| Row lands nowhere / form says not connected | Pages still hold an old script address | Swap address (section 4 item 1), push |
| Live address shows 10 headings, no Category | Old script code live | Redo section 6 steps |
| Live address downloads a file | Old script code live | Same |
| Directory empty | Sheet empty, script not live, or cache | Check live address first, then Ctrl+Shift+R |
| WRONG_OWNER | Different Google account than first | Use the first account or the admin email |
| Category not showing | Cell A lacks category on a later line | Fix cell A by hand |
| Page looks unchanged after push | Cache | Ctrl+Shift+R or Incognito |
| Google sign-in fails | Authorized origin missing | Google Cloud Console > Credentials > Authorized origin `https://diyseosupport.github.io` (no repo name) |
| `git push` asks who you are | `gh` on the wrong account | `gh auth switch --user DIYSEOsupport` |

---

## 12. Later (ask first)
- Hide blue columns and Logo in the sheet.
- Make the form look better (ask what they want).
- Print page and link tweaks in `index.html`.
- Privacy: do not keep `form-receiver-v7.gs` in the public repo (it shows the Client ID and admin email; not a password).
- Pick list "About your business" is no longer saved, so an update opens on "Other". Ask if it matters.
