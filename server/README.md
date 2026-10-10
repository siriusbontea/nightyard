# Night Yard accounts server

Plays sync through [PocketBase](https://pocketbase.io/) 0.40. A person signs in with a username and a password. No email is required, and the server stores no notes beyond the account and the play JSON already on the phone.

The app talks to `/nightyard/pb` (the Vite dev server proxies that to `127.0.0.1:8090`). Set `VITE_POCKETBASE_URL` to a full `http://` or `https://` URL when the API lives somewhere else.

## Schema

Migration: `pb_migrations/1760000000_night_yard_accounts.js`.

`users` (auth, already created by PocketBase):

- Sign-in identity is `username`, not email. Email is optional.
- Password length is at least 8.
- Username is 3–30 characters: a letter or number, then letters, numbers, `.`, `_`, or `-`. It is unique.
- A person can create an account. After that they can only read and update their own user. They cannot delete it through the API.
- `playbook_name` (text, optional, up to 60 characters) and `playbook_named_at` (number, unix milliseconds) still mirror the first playbook's name for older phones. Newer phones store each name on a `playbooks` row.

`playbooks` (migration `1760000002_playbooks.js`):

| Field | Type | Notes |
| --- | --- | --- |
| `owner` | relation → `users` | Required. Deletes with the user. |
| `book_id` | text | The playbook id from the phone. Unique together with `owner`. |
| `name` | text | Up to 60 characters. |
| `data` | json | Settings such as the default format, plus `updatedAt`. |
| `deleted` | bool | Tombstone. The row stays so other phones drop the playbook. |

List, view, update, and delete require `owner = @request.auth.id`. Create requires `@request.auth.id != "" && owner = @request.auth.id`.

`plays`:

| Field | Type | Notes |
| --- | --- | --- |
| `owner` | relation → `users` | Required. One user. Deletes with the user. |
| `play_id` | text | The play id from the phone. Unique together with `owner`. |
| `book_id` | text | Which playbook this play belongs to. Optional so older rows stay. |
| `data` | json | The whole play, including `updatedAt`. |
| `deleted` | bool | Tombstone. The row stays so other phones learn the play is gone. |

List, view, create, update, and delete all require `owner = @request.auth.id`.

Newest `data.updatedAt` wins. A tie keeps the server copy.

## Run it

PocketBase 0.40.5 or another 0.40 release:

```bash
curl -fsSL -o /tmp/pocketbase.zip \
  https://github.com/pocketbase/pocketbase/releases/download/v0.40.5/pocketbase_0.40.5_linux_amd64.zip
mkdir -p /tmp/pocketbase-bin
unzip -o /tmp/pocketbase.zip -d /tmp/pocketbase-bin

mkdir -p /tmp/night-yard-pb
/tmp/pocketbase-bin/pocketbase serve \
  --dir /tmp/night-yard-pb \
  --http 127.0.0.1:8090 \
  --migrationsDir server/pb_migrations
```

Run that from the repo root so `server/pb_migrations` resolves. The app does not need a superuser. The admin UI is `http://127.0.0.1:8090/_/` if you create one with `pocketbase superuser upsert`.

On the droplet, proxy `/nightyard/pb/` to this process and leave the service worker off that path. See the Nginx note in the project README.
