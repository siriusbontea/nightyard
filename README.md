# Night Yard

Phone-first football play designer for flag (5v5 through 9v9) and 11v11. Draw routes on a night-game field, play them back, keep a playbook in the browser, and export letter-size PNG sheets. It installs as a PWA and the production build is a static `dist/` folder.

Personal project for Sirius Bontea.

## Local development

```bash
npm install
npm run dev
```

The dev server is [http://127.0.0.1:43123](http://127.0.0.1:43123). Development uses base path `/`, so asset URLs and the document root stay at the origin root. The service worker is not registered in dev.

A free account is optional. The first visit shows a welcome card once on that device: make a free account, or try the editor as a guest. Guests can draw and play in that session. Save, Save all, a new saved play, and sync ask for a free account instead of writing, and the play stays on the screen until they sign up. A small guest chip opens signup. Plays already saved on this phone stay there, and making an account uploads them. Sign in with a username and password (8 or more characters, no email) and plays sync to PocketBase at `/nightyard/pb`. The dev server proxies that path to `127.0.0.1:8090`. Set `VITE_POCKETBASE_URL` to a full URL to point somewhere else. See `server/README.md` for the schema and how to start PocketBase.

```bash
npm test
```

## Build

Production defaults to base path `/nightyard/`, which is the path on [https://www.roninforged.com/nightyard/](https://www.roninforged.com/nightyard/). `BASE_PATH` overrides that for any production build. The value is normalized to a leading and trailing slash (`nightyard` and `/nightyard` both become `/nightyard/`). `/` stays the site root.

| Command | Base path |
| --- | --- |
| `npm run build` | `/nightyard/`, or `$BASE_PATH` when set |
| `npm run build:prod` | always `/nightyard/` |
| `BASE_PATH=/ npm run build` | `/` (subdomain or dedicated host) |

`npm run build` typechecks, then runs Vite. `npm run build:prod` is the droplet build: it sets `BASE_PATH=/nightyard/` and emits `dist/` with manifest `start_url` and `scope` of `/nightyard/`, and a service worker whose navigation fallback only claims `/nightyard` and paths under it. The worker does not cache `/nightyard/pb` and does not answer that path with the app shell. It uses a network-only route for those requests.

Preview a production build locally (same port as dev; stop `npm run dev` first):

```bash
npm run build:prod
npm run preview
```

Open [http://127.0.0.1:43123/nightyard/](http://127.0.0.1:43123/nightyard/).

## Deploy to a droplet

Target: Nginx 1.24 on Ubuntu, inside the existing `www.roninforged.com` site. The app does not need a Node process after the build. Files are served from `/var/www/nightyard/` at `https://www.roninforged.com/nightyard/`.

```bash
npm ci
npm run build:prod
sudo mkdir -p /var/www/nightyard
sudo rsync -a --delete dist/ /var/www/nightyard/
sudo nginx -t && sudo systemctl reload nginx
```

`dist/index.html` lands at `/var/www/nightyard/index.html`. HTTPS stays on the existing `www.roninforged.com` server block. The service worker file is `/nightyard/sw.js`, so its maximum scope is `/nightyard/` and it does not control the rest of the site.

Hashed files live under `/nightyard/assets/`. `index.html`, `sw.js`, `registerSW.js`, and `workbox-*.js` must not be cached. Nginx 1.24’s stock `mime.types` has no `webmanifest` entry, so the manifest location sets `application/manifest+json` itself.

`alias` and `try_files` with a URI fallback disagree in Nginx 1.24, so the SPA fallback is a named location. Exact `=` locations for the shell files beat the prefix location. `try_files $uri =404` is safe on the assets alias because the last argument is a status code, not a URI.

```nginx
# Night Yard — https://www.roninforged.com/nightyard/
# alias target: /var/www/nightyard/

location = /nightyard/index.html {
    alias /var/www/nightyard/index.html;
    add_header Cache-Control "no-cache";
}

location = /nightyard/sw.js {
    alias /var/www/nightyard/sw.js;
    default_type application/javascript;
    add_header Cache-Control "no-cache";
}

location = /nightyard/registerSW.js {
    alias /var/www/nightyard/registerSW.js;
    default_type application/javascript;
    add_header Cache-Control "no-cache";
}

location ~* ^/nightyard/(workbox-[^/]+\.js)$ {
    alias /var/www/nightyard/$1;
    default_type application/javascript;
    add_header Cache-Control "no-cache";
}

location = /nightyard/manifest.webmanifest {
    alias /var/www/nightyard/manifest.webmanifest;
    default_type application/manifest+json;
    add_header Cache-Control "no-cache";
}

location ^~ /nightyard/pb/ {
    proxy_pass http://127.0.0.1:8090/;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-Host $host;
}

location ^~ /nightyard/assets/ {
    alias /var/www/nightyard/assets/;
    try_files $uri =404;
    add_header Cache-Control "public, max-age=31536000, immutable";
}

location /nightyard/ {
    alias /var/www/nightyard/;
    index index.html;
    error_page 404 = @nightyard_spa;
}

location @nightyard_spa {
    rewrite ^ /nightyard/index.html last;
}
```

Reload Nginx after `nginx -t` succeeds. Confirm the manifest response is `Content-Type: application/manifest+json` and that `index.html` and `sw.js` send `Cache-Control: no-cache`.

### Leaving `/playbook/`

Phones that installed the app at `/playbook/` still have that service worker. Do not 301 `/playbook/sw.js` or `/playbook/registerSW.js`: a redirected worker script fails to update. Serve a kill-switch worker from `/var/www/playbook-redirect/` and redirect every other `/playbook` URL to the matching `/nightyard` path.

```bash
sudo mkdir -p /var/www/playbook-redirect
# playbook-killswitch-sw.js → sw.js
# playbook-registerSW.js → registerSW.js
```

```nginx
location = /playbook/sw.js {
    alias /var/www/playbook-redirect/sw.js;
    default_type application/javascript;
    add_header Cache-Control "no-cache";
}

location = /playbook/registerSW.js {
    alias /var/www/playbook-redirect/registerSW.js;
    default_type application/javascript;
    add_header Cache-Control "no-cache";
}

location = /playbook {
    return 301 /nightyard/;
}

location = /playbook/ {
    return 301 /nightyard/;
}

location /playbook/ {
    rewrite ^/playbook/(.*)$ /nightyard/$1 permanent;
}
```

The exact `=` locations win over the prefix rewrite, so the worker script is a 200. Saved plays stay in IndexedDB: the database name is still `night-yard`, and the file format is unchanged. The new worker has a new scope, so it does not see the old caches; the kill switch deletes those.

### Subdomain alternative

A host such as `nightyard.roninforged.com` uses a root build, not `/nightyard/`:

```bash
BASE_PATH=/ npm run build
sudo rsync -a --delete dist/ /var/www/nightyard-host/
```

```nginx
server {
    listen 443 ssl http2;
    server_name nightyard.roninforged.com;
    root /var/www/nightyard-host;

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
- `npm run build` — typecheck and production build (default base `/nightyard/`)
- `npm run build:prod` — production build pinned to `/nightyard/`
- `npm run preview` — serve `dist/` on port 43123
- `npm test` — play model, route geometry, save/load, export markup, base path
- `npm run icons` — regenerate PWA icons from `public/favicon.svg`
