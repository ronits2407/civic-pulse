# Google Cloud Run deployment

## Service

- Project: `civicpulse-500505`
- Region: `asia-south1` (Mumbai)
- Service: `civicpulse`
- URL: https://civicpulse-855460198105.asia-south1.run.app
- Image repository: `asia-south1-docker.pkg.dev/civicpulse-500505/civicpulse-repo/civicpulse`
- Runtime identity: `civicpulse-run@civicpulse-500505.iam.gserviceaccount.com`
- Verified revision: `civicpulse-00001-prf`
- Successful build: `52bf4fe1-b385-4cc5-abce-d4b424276c9a`

Cloud Build builds the standalone Next.js Docker image using `cloudbuild.yaml`.
Local Docker is not required. `.gcloudignore` and `.dockerignore` exclude local
credentials, build outputs, and the separate mobile application.

## Configuration

`NEXT_PUBLIC_*` values are baked into the browser bundle during the build. Supply
them as the corresponding `_NEXT_PUBLIC_*` Cloud Build substitutions, including
`_NEXT_PUBLIC_APP_URL=https://civicpulse-855460198105.asia-south1.run.app`.
Set `_IMAGE` to a unique tag in the image repository. Never put server secrets in
build arguments or substitutions.

Cloud Run receives public configuration and `AI_PROVIDER`, `GEMINI_AGENT5_MODEL`,
and `DEMO_MODE=false` as runtime environment variables. The runtime service account
has Secret Manager accessor permission on these individual secrets:

| Environment variable | Secret |
| --- | --- |
| `SUPABASE_SERVICE_ROLE_KEY` | `civicpulse-supabase-service-role-key` |
| `GEMINI_API_KEY` | `civicpulse-gemini-api-key` |
| `GOOGLE_MAPS_API_KEY` | `civicpulse-google-maps-api-key` |

Deploy with numbered secret versions (not `latest`) for reproducibility. After
rotating a secret, create a new revision referencing its new version.

Service sizing: 1 CPU, 1 GiB memory, 0–3 instances, concurrency 20, request timeout
300 seconds. CPU throttling is disabled because report processing uses Next.js
`after()` after sending the HTTP response. **Instance-based billing applies while
instances run**, including idle time before scale-to-zero; build, registry, and
Secret Manager charges can also apply. Maximum instances is not a spending cap.

`after()` is not a durable queue: shutdowns or crashes can still interrupt work.
Use the existing retry/resume flow for interrupted reports; a durable task queue
is recommended before production-scale use.

## Supabase authentication setup

In Supabase project `iyrmsomjaugvdxkyxhsl`, open Authentication → URL Configuration:

1. Set **Site URL** to `https://civicpulse-855460198105.asia-south1.run.app`.
2. Add `https://civicpulse-855460198105.asia-south1.run.app/auth/callback**`
   to **Redirect URLs** (the suffix permits role query parameters).
3. Keep localhost redirects if local development is still needed.

Google OAuth's authorized redirect URI remains the Supabase callback URL,
`https://iyrmsomjaugvdxkyxhsl.supabase.co/auth/v1/callback`.
Google and email authentication are enabled in Supabase, but the Supabase URL
allowlist cannot be managed with a service-role database key. It requires access
to the Supabase dashboard or a separate management token.

Admin accounts must already have an authorized admin role. A login query parameter
does not grant that role. Production demo mode is disabled.

Web Push is not configured: the local environment did not contain VAPID keys.

## Verification and operations

Deployment checks passed: homepage, login, deck, health endpoint, and eight static
assets returned HTTP 200. Protected dashboards redirected to login; the admin API
and an unauthenticated report with a claimed user ID returned HTTP 401. The local
targeted suite passed 31 tests, and TypeScript passed. Supabase database access,
Gemini API authentication, and Google Maps geocoding were checked separately.
Interactive OAuth/email login and a complete authenticated report pipeline have
not been tested on the hosted site.

```sh
gcloud run services describe civicpulse \
  --project=civicpulse-500505 --region=asia-south1 \
  --format='value(status.url)'

curl --fail https://civicpulse-855460198105.asia-south1.run.app/api/test

gcloud run services logs read civicpulse \
  --project=civicpulse-500505 --region=asia-south1 --limit=50

cd /home/ronit/dev/web/civicpulse
bun test tests/auth/deployment-security.test.ts tests/evidence/policy.test.ts
bunx tsc --noEmit
```

The existing `.github/workflows/deploy-prod.yml` still targets the separate project
`civicpulse-500507`. It was not changed: do not assume pushing to `prod` updates
this service. GitHub workload identity and secrets must be migrated separately
before using that workflow for this project.