# Hosting the admin on Vercel

The public site deploys from `main` with no setup and shows the bundled sample until a
version is published. The admin (`/admin`) needs four things. Nothing below goes in the repo.

## 1. MongoDB Atlas (versions, audit trail, published data)

1. Create a cluster (M0 is enough to start; transactions are required and work on every tier).
2. **Database Access** → add a user with *Read and write* on the `country_index` database
   only, and a generated password.
3. **Network Access** → Vercel's IPs change, so either install the Atlas–Vercel
   integration or allow `0.0.0.0/0`. With the latter, the connection string is the only
   protection: keep the password strong and rotate it at handover.
4. **Connect → Drivers** → copy the `mongodb+srv://…` string → `MONGODB_URI`.

Collections and indexes are created on first use.

## 2. Azure Storage (every uploaded workbook)

1. Create a storage account. **Confirm the region with the client first** (an Indian region
   may be required, and moving later means recreating it). Redundancy: ZRS.
2. Enable blob versioning and soft delete (30 days).
3. Create a container `index-uploads` with access level **Private** — never public.
4. Optional but recommended: a lifecycle rule deleting `rejected/` blobs after 30 days, and
   a time-based immutability policy on `snapshots/`.
5. **Access keys** → copy a connection string → `AZURE_STORAGE_CONNECTION_STRING`.

## 3. Admin sign-in

- `AUTH_SECRET`: `openssl rand -base64 32` (a new one — not the local one).
- `ADMIN_EMAIL`, `ADMIN_NAME`: the shared admin account.
- `ADMIN_PASSWORD_HASH`: `npm run admin:password -- "<a strong password, 12+ characters>"`.
  On Vercel paste the hash **without** the `\` escapes the script adds for `.env.local`.

## 4. Vercel → Project → Settings → Environment Variables (Production)

| Key | Value |
|---|---|
| `MONGODB_URI` | from step 1 |
| `MONGODB_DB` | `country_index` |
| `AZURE_STORAGE_CONNECTION_STRING` | from step 2 |
| `AZURE_STORAGE_CONTAINER` | `index-uploads` |
| `AUTH_SECRET` | from step 3 |
| `ADMIN_EMAIL` / `ADMIN_NAME` / `ADMIN_PASSWORD_HASH` | from step 3 |
| `ADMIN_TIME_ZONE` | e.g. `Asia/Kolkata` |
| `ADMIN_REQUIRE_APPROVAL` | `false` until the client decides |
| `SHOW_SAMPLE_DATA_BANNER` | `true` |

Then redeploy. Set both storage variables or neither: one without the other stops the admin
with a clear error rather than mixing stores.

## After the first publish

Publishing expires the `index-data` cache tag, so the public pages update within seconds.
Uploaded data lives only in Atlas and Azure — never in this public repository.

## Review links (before the hosted admin exists)

To show reviewers a version that isn't published, without any of the above:

1. Locally: `npm run share:link` (the published version) or `npm run share:link -- <number>`.
   It writes `SHARE_TOKEN` and `SHARE_PAYLOAD` to `.data/share/vercel-env.txt` and prints the link.
2. Vercel → Settings → Environment Variables: add both (Production), then redeploy.
3. Send `https://crisil-country-index.vercel.app/share/<token>`. It opens the full site in
   preview, with a bar saying it isn't published. Everyone else still sees the published site.

To update the shared version but keep the link: `npm run share:link -- <number> --keep`, then
update `SHARE_PAYLOAD` on Vercel and redeploy. To revoke: run it without `--keep` (new token)
or delete the variables, then redeploy — browsers that opened the old link lose access too.
