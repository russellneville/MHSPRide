# MHSPRide

Next.js App Router + Firebase (Auth/Firestore/Storage) + Resend, deployed on Vercel.

## Firebase

- Project ID: `mhspride`. Authorized domains: `localhost`, `mhspride.firebaseapp.com`, `mhspride.web.app`, `mhspride.com` — **`www.mhspride.com` is NOT authorized.** Any `actionCodeSettings`/redirect URL must use the bare domain or Firebase rejects it with `auth/unauthorized-continue-uri`.
- Admin SDK access via `lib/firebaseAdmin.js`, keyed off `FIREBASE_SERVICE_ACCOUNT_KEY` (full service account JSON as a string env var).
- Server routes verify the caller with `lib/adminAuth.js`: `verifyAuthRequest` (any signed-in user) or `verifyAdminRequest` (role must be `admin` in Firestore `users/{uid}`).

## Email

All outbound email goes through `lib/email.js` (Resend, `from: noreply@mhspride.com`), sent from server-side API routes (`app/api/notify-*`, `app/api/reset-password`) — never call Firebase's built-in Auth email sending client-side; it has no delivery logging anywhere and is unreliable for custom domains.

- Password reset: generated via `getAdminAuth().generatePasswordResetLink()` then emailed through Resend, not Firebase's default mailer. **Requesting a new reset link for an account invalidates any previous outstanding one for that account** — if you're testing repeatedly, always use the newest email or you'll get a bogus "expired or already used" error that has nothing to do with actual expiration.
- Routes that send to multiple recipients use `Promise.allSettled` — make sure rejected results get `console.error`'d individually (see `notify-booking`, `notify-cancellation`, `notify-ride-update`), otherwise failures are silently invisible.
- To check whether an email actually sent: `GET https://api.resend.com/emails` (or `/emails/:id`) with `RESEND_API_KEY` — this is the actual source of truth, more reliable than assuming a 200 from an API route means delivery succeeded.

## Deployment / debugging

- Vercel project: `mhsp-ride`, production at `mhspride.com`. `npx vercel logs <url>` works without a global install but on this plan is a live tail with short retention — not useful for anything that happened more than a few minutes ago.
- `scripts/seedTestData.mjs` seeds `bookings`/`rides` docs with `TEST-` prefixed IDs (or IDs referencing a `TEST` ride). When debugging with real Firestore data, filter these out first — don't mistake seed data for organic usage.

## Conventions

- Admin-page actions that mutate state log to the `activity_log` collection via `lib/activityLog.js`'s `logEvent()`, fire-and-forget (`.catch(() => {})`). Follow this pattern for new admin actions.
- PR template lives at `.github/PULL_REQUEST_TEMPLATE.md` (ISSUE / DESCRIPTION / TESTING).
- Before making a commit, check whether `README.md` needs updating (new/changed admin features, setup steps, env vars, etc.) and update it if so.

## Useful Claude Code skills for this repo

- `vercel:env` — project is linked (`vercel link` has been run, `.vercel/project.json` exists), so `vercel env pull` syncs real prod env vars instead of hand-editing `.env.local`.
- `verify` — drives a changed flow end-to-end in the running app rather than trusting a build/typecheck pass. Use this for anything touching email, auth, or booking flows before calling a fix done — this codebase's bugs (see the password-reset issue) tend to fail silently with no error and no log, so exercising the actual path is the only way to confirm a fix.
