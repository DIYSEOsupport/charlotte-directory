# Update v15 (Oct 15)

What changed
- Cards: About now sits above Mobile Service Area.
- Cards: every website you enter shows (before, extra links were dropped when a web address was not a real Facebook/NextDoor one).
- Form: new optional "Google Reviews Link" (step 3). Saved in the Contact column (D), no new sheet column.
- Cards: "Google Reviews" link with a star. Also in the PDF, share text and contact card.
- PDF: the business logo shows next to the name.
- Contact card (.vcf): logo is saved as the contact photo.
- Confirmation email: directory look (banner, color stripe, logo, reviews link).

Files and where they go
- form-receiver-v15.gs -> paste into Apps Script, Deploy > Manage deployments > pencil > New version. (Not on GitHub.)
- index.html, form.html, email-banner.jpg -> drag into the charlotte-directory folder, then git add . && git commit && git push.

Note: the script now has a logo-picture lookup (Drive permission already granted). If Google asks to re-authorize, click Allow.
