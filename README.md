# Admin meezab

Private admin app (PWA) for **Meezab E Rahemat Haj Tours** – for Sulait and Basil only.

- Live: https://ayyubisulait220762-spec.github.io/admin-meezab/
- Log in with your admin password (set in the "Meezab leads" Sheet: menu Meezab › Set admin password).
- Screens: Pilgrims (list, add, edit, checklist, send My Hajj code on WhatsApp), Alerts, Leads, Me (log out).
- Data lives only in the private Google Sheet (Apps Script v6). Nothing is stored in this repo.
- Preview with sample data: add `?demo` to the link.
- Install: open the link in Chrome on the phone › menu › "Add to Home screen".

## Sheet code (self-updating)
- `sheet/Meezab-loader.gs` – pasted ONCE into the "Meezab leads" Sheet's Apps Script. Never changes.
- `sheet/meezab-core.js` – the real Sheet code. The loader downloads it (checks every 10 minutes), tests it, and keeps
  the last good copy. To update the Sheet: edit this file, raise `var VERSION = '...'`, push to main.
