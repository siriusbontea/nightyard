# Night Yard

Phone-first football play designer for flag (5v5 through 9v9) and 11v11. Draw routes on a night-game field, play them back, keep a playbook in the browser, and export letter-size PNG sheets. It installs as a PWA and the production build is a static `dist/` folder.

Personal project for Sirius Bontea.

## Local development

```bash
npm install
npm run dev
```

The dev server is [http://127.0.0.1:43123](http://127.0.0.1:43123). Development uses base path `/`, so asset URLs and the document root stay at the origin root. The service worker is not registered in dev.

```bash
npm test
```

## Build

Production defaults to base path `/playbook/`, which is the path on [https://www.roninforged.com/playbook/](https://www.roninforged.com/playbook/). `BASE_PATH` overrides that for any production build. The value is normalized to a leading and trailing slash (`playbook` and `/playbook` both become `/playbook/`). `/` stays the site root.

| Command | Base path |
| --- | --- |
| `npm run build` | `/playbook/`, or `$BASE_PATH` when set |
| `npm run build:prod` | always `/playbook/` |
| `BASE_PATH=/ npm run build` | `/` (subdomain or dedicated host) |

`npm run build` typechecks, then runs Vite. `npm run build:prod` is the droplet build: it sets `BASE_PATH=/playbook/` and emits `dist/` with manifest `start_url` and `scope` of `/playbook/`, and a service worker whose navigation fallback only claims `/playbook` and paths under it.

Preview a production build locally (same port as dev; stop `npm run dev` first):

```bash
npm run build:prod
npm run preview
```

Open [http://127.0.0.1:43123/playbook/](http://127.0.0.1:43123/playbook/).

## Deploy to a droplet

Target: Nginx 1.24 on Ubuntu, inside the existing `www.roninforged.com` site. The app does not need a Node process after the build.

```bash
npm ci
npm run build:prod
sudo mkdir -p /var/www/roninforged/playbook
sudo rsync -a --delete dist/ /var/www/roninforged/playbook/
sudo nginx -t && sudo systemctl reload nginx
```

`dist/index.html` lands at `/var/www/roninforged/playbook/index.html`. HTTPS stays on the existing `www.roninforged.com` server block (the certificate that already covers that name). Paste the location block below into that server. The service worker file is `/playbook/sw.js`, so its maximum scope is `/playbook/` and it does not control the rest of the site.

Hashed files live under `/playbook/assets/`. `index.html`, `sw.js`, `registerSW.js`, and `workbox-*.js` must not be cached: a long-lived shell or worker will keep serving an old app after a deploy. Nginx 1.24’s stock `mime.types` has no `webmanifest` entry, so the manifest location sets `application/manifest+json` itself.

```nginx
# Night Yard — https://www.roninforged.com/playbook/
# root is the parent of the playbook directory, e.g. /var/www/roninforged

location = /playbook/index.html {
    add_header Cache-Control "no-cache";
}

location = /playbook/sw.js {
    default_type application/javascript;
    add_header Cache-Control "no-cache";
}

location = /playbook/registerSW.js {
    default_type application/javascript;
    add_header Cache-Control "no-cache";
}

location ~* ^/playbook/workbox-[^/]+\.js$ {
    default_type application/javascript;
    add_header Cache-Control "no-cache";
}

location = /playbook/manifest.webmanifest {
    default_type application/manifest+json;
    add_header Cache-Control "no-cache";
}

# Hashed bundles only. A missing file is a 404, not the SPA shell.
location ^~ /playbook/assets/ {
    try_files $uri =404;
    add_header Cache-Control "public, max-age=31536000, immutable";
}

location /playbook/ {
    try_files $uri $uri/ /playbook/index.html;
}
```

Reload Nginx after `nginx -t` succeeds. Confirm the manifest response is `Content-Type: application/manifest+json` and that `index.html` and `sw.js` send `Cache-Control: no-cache`.

### Subdomain alternative

A host such as `playbook.roninforged.com` uses a root build, not `/playbook/`:

```bash
BASE_PATH=/ npm run build
sudo rsync -a --delete dist/ /var/www/playbook/
```

```nginx
server {
    listen 443 ssl http2;
    server_name playbook.roninforged.com;
    root /var/www/playbook;

    # ssl_certificate and ssl_certificate_key: the droplet's existing cert lines.

    location = /index.html {
        add_header Cache-Control "no-cache";
    }

    location = /sw.js {
        default_type application/javascript;
        add_header Cache-Control "no-cache";
    }

    location = /registerSW.js {
        default_type application/javascript;
        add_header Cache-Control "no-cache";
    }

    location ~* ^/workbox-[^/]+\.js$ {
        default_type application/javascript;
        add_header Cache-Control "no-cache";
    }

    location = /manifest.webmanifest {
        default_type application/manifest+json;
        add_header Cache-Control "no-cache";
    }

    location ^~ /assets/ {
        try_files $uri =404;
        add_header Cache-Control "public, max-age=31536000, immutable";
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

## Scripts

- `npm run dev` — Vite on port 43123, base `/`
- `npm run build` — typecheck and production build (default base `/playbook/`)
- `npm run build:prod` — production build pinned to `/playbook/`
- `npm run preview` — serve `dist/` on port 43123
- `npm test` — play model, route geometry, save/load, export markup, base path
- `npm run icons` — regenerate PWA icons from `public/favicon.svg`
