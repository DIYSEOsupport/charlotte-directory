# Session Summary: Oct 13-14, 2026 (continues Handover 9)

Rules still apply (see Handover 9 section 1): simple numbered steps, short "caveman" replies, one question at a time, everything FREE, never edit content without permission, owner on Chromebook (`~/charlotte-directory`), sometimes iPhone. Always `cd ~/charlotte-directory` BEFORE any git command (one push went to the wrong repo, `local-seo-strategy`, and was rejected: do NOT push that).

## Where we left off (START HERE)
**The directory is blank because cell A1 of the sheet ("Full Form" tab) is now EMPTY.** It must say `Business Name`. The script finds the name column by that heading; with it missing, every row is skipped and the feed returns only the heading line. Verified by reading the sheet: A1 blank, H1 now says `About` (good).
Fix: Google Sheet > tab "Full Form" > click A1 > type `Business Name` > Enter. Wait 1 minute, reload the directory (Ctrl+Shift+R).
Then confirm with owner: (1) v14 script pasted and deployed as New version, (2) latest `index.html` and `form.html` actually copied into `~/charlotte-directory` and pushed (last push said "nothing to commit": files were not replaced).

## Built this session (all delivered as files; deploy status unconfirmed)
Latest files: `form-receiver-v14.gs`, `index.html`, `form.html`.
1. Update list shows only the signer's own businesses (admin too).
2. "Remove my business" button: hides the row and stamps column P (recoverable).
3. Contact column D has no labels; plain lines; links saved as `https://`. Old labeled rows still read.
4. Review page Edit buttons go to their own section.
5. Directory Download = PDF only. All CSV/spreadsheet download code removed.
6. Phone PDF/file download uses the phone share sheet (Save to Files).
7. Share email/text: tidy emoji layout, full links, Google Maps link, directory link. Contact card (.vcf) improved.
8. Confirmation email to the submitter: branded HTML (purple/orange), copy of the saved listing with links (phone, email, website, maps), directory button, update/remove instructions. `DIRECTORY_URL` fixed to `https://diyseosupport.github.io/charlotte-directory/`.
9. Directory cards: new "ABOUT" section (same style as Contact/Location). Text comes from the form's "Describe your business". Label "Area Served" renamed "Mobile Service Area" (cards, PDF, print, share, email).
10. Sheet font: new rows set to Montserrat by the script (formatting code now Montserrat data / Oswald headings).
11. Form: "Other details" box now sits directly under the "About your business" type choices.
12. Form: if type = "Other", the address boxes show as "Physical address (optional)"; saved and shown if filled.

## Sheet facts
- Tab "Full Form", gid 112379302, ID `1mSNjflXI-u1B4zHkbUT2SKx7lklbE08nFwmoFFzYQvE`. Headings row 1 must be exact: A `Business Name`, B `Category/Specialty`, C `Slogan or Short Description`, D `Contact`, E/F `Address`, G `Mobile Services Area Served`, H `About`, I `Logo`, J-P private, Q `Business Type` (stray).
- Column H heading was blank earlier, which hid the About text. Now `About`.
- "Version 19" in Apps Script is Google's deploy counter, not my v-number.

## Still to do (ask before each)
1. Fix A1, confirm deploy + push (above), then test: new business, update (own only), remove, confirmation email, PDF on iPhone, "Other" with address.
2. Sheet formatting (Montserrat/Oswald, widths, wrap, hide private columns J-P on a public view, stripes).
3. Fix the "Owner View" tab (deferred by owner).
4. Share link in `index.html` still points to an old address in places: ask first.
5. Delete dummy rows; re-enter the real DIYSEO listing (`dummy-data/DIYSEO-listing-to-re-enter.md`).
6. Phone numbers in the sheet do not dial (owner said leave the sheet to her).
7. Keep `.gs` out of the public repo.
