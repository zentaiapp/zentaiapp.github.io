# Wishly — starter site

## What's in this folder

```
wishly/
├── index.html              ← home page (the wish-creation form)
├── view.html                ← the page people see when they open a shared link
├── style.css                 ← all styling
├── script.js                  ← form logic, link encode/decode, PWA install
├── manifest.json              ← PWA config (name, icon, colors)
├── sw.js                       ← service worker (offline + installability)
└── icons/
    ├── icon-192.png
    ├── icon-512.png
    └── icon-512-maskable.png
```

Keep this exact structure — every file links to the others using **relative paths**
(no leading `/`), so it works whether your site ends up at the root of a domain
or inside a GitHub Pages project folder like `username.github.io/wishly`.

## How to put it on GitHub Pages

1. Create a new repository on GitHub (e.g. `wishly`).
2. Upload every file and the `icons/` folder **as-is**, keeping this same structure,
   to the root of the repo (don't nest it inside another folder).
3. Go to your repo → **Settings → Pages**.
4. Under "Build and deployment", set **Source: Deploy from a branch**, branch:
   `main`, folder: `/ (root)`.
5. Save. Wait 1–2 minutes. Your site will be live at:
   - `https://yourusername.github.io/wishly/` (if repo name is `wishly`), or
   - `https://yourusername.github.io/` (only if the repo is literally named
     `yourusername.github.io`)
6. Open that link on your phone in Chrome — after a few seconds of browsing,
   the install banner/prompt should appear.

## How the "no backend" part works

When someone fills the form on `index.html`, their name/message/theme get
packed into a compact code and appended after `view.html#`. Nothing is sent
to a server — the entire wish lives inside the link itself. When the other
person opens that link, `view.html` reads the part after `#`, decodes it,
and renders the card. That's why hosting can be 100% static and free.

**Trade-off to know:** since the whole message rides in the URL, very long
messages produce a long link (still works, just not pretty). The form
already caps the message at 400 characters to keep this reasonable.

## What to customize next

- Replace `icons/icon-*.png` with your own logo (same sizes: 192×192, 512×512).
- Edit the `<title>` and `name`/`short_name` in `manifest.json`.
- Add more occasions in the `<select>` in `index.html`.
- Add more card themes: duplicate a `.theme-*` block in `style.css` and add
  a matching swatch + radio input in `index.html`.
- Buy a domain later (Porkbun, ~$8–10/yr) and point it at the repo via
  GitHub Pages' custom domain setting — no code changes needed.
