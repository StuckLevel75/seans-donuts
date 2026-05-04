# Sean's Donuts

Live site: https://seansdonuts.com

This repository contains the public Sean's Donuts website, the employee portal, and the Google Apps Script backend files used by the portal.

## Branches

- `main` is the live custom-domain site.
- `test-site` is the staging branch for cleanup and testing.

Make changes on `test-site` first. After the site looks right, copy or merge the tested changes into `main`.

## File Map

Public website pages:

- `index.html` - homepage
- `menu.html` - public menu
- `careers.html` - application form
- `contact.html` - contact form
- `advertise.html` - advertising request form
- `crew.html` - crew/staff page
- `portal-link.html` - public staff-only portal gate

Employee portal:

- `portal.html` - portal page
- `app.js` - portal logic
- `styles.css` - portal styling

Shared website files:

- `website.js` - public website forms and sale popup
- `website.css` - public website styling
- `assets/` - images and other media
- `favicon.png` - browser tab icon
- `CNAME` - custom domain config for GitHub Pages

Google Apps Script backend:

- `apps-script/Code.gs` - portal/API actions
- `apps-script/Helpers.gs` - sheet helpers, permissions, formatting, cleanup tools

## Apps Script Deploy Notes

After changing files in `apps-script/`, paste the updated `Code.gs` and `Helpers.gs` into the Apps Script project, save, and deploy a new web app version if needed.

Useful setup functions:

```js
runSetup()
cleanUpSheets()
```

## Safety Notes

- Keep the Apps Script deployment URL private to trusted editors.
- Do not put passwords, API keys, or private tokens in website files.
- Test portal login, form submissions, checkout, rewards, and bank balance on `test-site` before touching `main`.
