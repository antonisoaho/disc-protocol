# disc-protocol

**Mobile-first disc golf social web app** (React + Vite, Firebase, PWA). Product direction and data design live in **`docs/architecture.md`**. Contributor workflow lives in [`.cursorrules`](.cursorrules) and the mirrored [`.claude/REPOSITORY_RULES.md`](.claude/REPOSITORY_RULES.md).

## Prerequisites

- **Git** and GitHub remote **`origin`**
- **GitHub CLI**: [https://cli.github.com](https://cli.github.com) — `gh auth login`
- **Node.js** + npm (see `package.json`)
- **Python 3.10+** (optional; only needed if you use `orchestrator.py` for batch issue ops — `gh` works for everything)

## Workflow

```text
Issue → Branch → TDD → Rebase main → Verify → PR → Review → Merge → Cleanup
```

1. **Issue** — `gh issue create` with title, motivation, scope, and acceptance criteria.
2. **Branch** — `git checkout -b issue/<N> origin/main`. Work directly on the branch — no worktree.
3. **TDD** — Red → Green → Refactor with Vitest for changes under `src/` (see [`.claude/rules/tdd-vitest.md`](.claude/rules/tdd-vitest.md)).
4. **Rebase** — `git fetch origin && git rebase origin/main`; resolve conflicts.
5. **Verify (hard rule)** — `npm run lint`, `npm run test`, `npm run build`, `npm run verify:doctor` must all pass; fix any major doctor findings.
6. **PR** — `git push -u origin issue/<N>` then `gh pr create`. Link the issue (`Closes #<N>`).
7. **Review and merge** — `gh pr checks`, structured review (security, fit with `docs/architecture.md`, obvious bugs), then `gh pr merge` once green. Surface explicit blockers if branch protection rejects the merge.
8. **Cleanup** — `git checkout main && git pull origin main && git branch -d issue/<N>`.

All orchestration docs and comments are in **English**.

## Firebase Hosting (merge to `main`)

Merging into **`main`** or **`master`** (when triggered paths change) runs **`.github/workflows/firebase-hosting-deploy.yml`**, which builds the app and deploys **`firebase deploy --only hosting`**. Enable **Hosting** for your Firebase project in the [console](https://console.firebase.google.com) before the first deploy succeeds.

**Secrets:** **`FIREBASE_SERVICE_ACCOUNT`** (full service account JSON with Hosting deploy permission) is **required**; the workflow exits with an error if it is missing or empty. The build step uses the same **`VITE_*`** variables as **CI** (see below); unset values use placeholders so the job still runs.

The **`default`** project id in **`.firebaserc`** must match your Firebase / GCP project id (**`disc-protocol`** here). If your real project id differs, change **`default`** there—never commit **`.env.local`** or service account JSON.

**Local:** `npm run deploy:hosting` (runs `build` then Hosting deploy; requires `firebase login` or compatible credentials).

## GitHub Actions secrets (CI and Hosting)

**CI** (`.github/workflows/ci.yml`) and **Hosting deploy** read these optional **`VITE_*`** repository secrets; when missing, the build uses placeholders so forks without secrets still pass.

| Secret | Purpose |
|--------|---------|
| `VITE_FIREBASE_API_KEY` | Firebase web API key |
| `VITE_FIREBASE_AUTH_DOMAIN` | Auth domain (e.g. `project.firebaseapp.com`) |
| `VITE_FIREBASE_PROJECT_ID` | GCP / Firebase project id |
| `VITE_FIREBASE_STORAGE_BUCKET` | Default storage bucket |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | FCM sender id |
| `VITE_FIREBASE_APP_ID` | Firebase web app id |

**Hosting only:** `FIREBASE_SERVICE_ACCOUNT` — JSON key for deploy (never commit this file).

**CLI** (trusted machine; values from `.env.local`, not committed):

```bash
gh secret set VITE_FIREBASE_API_KEY --body "your-api-key"
gh secret set VITE_FIREBASE_AUTH_DOMAIN --body "your-project.firebaseapp.com"
gh secret set VITE_FIREBASE_PROJECT_ID --body "your-project-id"
gh secret set VITE_FIREBASE_STORAGE_BUCKET --body "your-project.appspot.com"
gh secret set VITE_FIREBASE_MESSAGING_SENDER_ID --body "123456789012"
gh secret set VITE_FIREBASE_APP_ID --body "1:123:web:abc"
gh secret set FIREBASE_SERVICE_ACCOUNT < path/to/serviceAccount.json
```

**GitHub UI:** Repository **Settings → Secrets and variables → Actions**. Names are case-sensitive.

## Scripts

| Script | Purpose |
|--------|---------|
| `orchestrator.py` | Optional `gh` helper: `create`, `list`, `show`, `track` |

### Examples

```bash
python3 orchestrator.py create --title "Task" --body "Acceptance: …"
python3 orchestrator.py track
```

- Branch: `issue/<N>`

## Styling

- **SCSS** under `src/common/styles/`: `_variables.scss` (semantic **score** colors), `_mixins.scss`, `main.scss`
- **BEM** for UI components (`.block__element--modifier`)

## GitHub Actions secrets (CI)

The **CI** workflow reads the same **`VITE_*`** names as local development. Set them on the repository (or fork) so `npm run build` in Actions uses your real Firebase web config; when a secret is missing or empty, CI falls back to **placeholders** so fork PRs without secrets still build.

If you add a **Firebase Hosting deploy** workflow later, use the same `VITE_*` secrets for its build step plus **`FIREBASE_SERVICE_ACCOUNT`** (service account JSON with Hosting deploy permission).

| Secret | Purpose |
|--------|---------|
| `VITE_FIREBASE_API_KEY` | Firebase web API key |
| `VITE_FIREBASE_AUTH_DOMAIN` | Auth domain (e.g. `project.firebaseapp.com`) |
| `VITE_FIREBASE_PROJECT_ID` | GCP / Firebase project id |
| `VITE_FIREBASE_STORAGE_BUCKET` | Default storage bucket |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | FCM sender id |
| `VITE_FIREBASE_APP_ID` | Firebase web app id |

**Hosting deploy** also requires **`FIREBASE_SERVICE_ACCOUNT`**: JSON for a service account with Hosting deploy permission (never commit this file).

**CLI** (from a trusted machine; use values from your local `.env.local`, not committed):

```bash
gh secret set VITE_FIREBASE_API_KEY --body "your-api-key"
gh secret set VITE_FIREBASE_AUTH_DOMAIN --body "your-project.firebaseapp.com"
gh secret set VITE_FIREBASE_PROJECT_ID --body "your-project-id"
gh secret set VITE_FIREBASE_STORAGE_BUCKET --body "your-project.appspot.com"
gh secret set VITE_FIREBASE_MESSAGING_SENDER_ID --body "123456789012"
gh secret set VITE_FIREBASE_APP_ID --body "1:123:web:abc"
# Deploy only:
gh secret set FIREBASE_SERVICE_ACCOUNT < path/to/serviceAccount.json
```

**GitHub UI:** Repository **Settings → Secrets and variables → Actions → New repository secret**. Name must match the table exactly (case-sensitive).

## Firebase (local)

Copy [`.env.example`](.env.example) to **`.env.local`** and paste your Firebase web config (`VITE_*` keys). Vite only exposes variables prefixed with `VITE_`. The file is gitignored (`*.local`, `.env`, `.env.local`). Names match the Firebase console **Project settings → Your apps → Web app** SDK snippet (`apiKey` → `VITE_FIREBASE_API_KEY`, and so on); see [`src/core/firebase/app.ts`](src/core/firebase/app.ts).

### Authentication

- **Primary sign-in:** email / password (Firebase Auth). OAuth providers can be enabled later in the Firebase console and wired in the client.

### Troubleshooting Identity Toolkit `API_KEY_INVALID`

Typical causes:

1. **Wrong or placeholder `apiKey`** — Copy the web app config again from the Firebase console into `.env.local` (or into GitHub Actions secrets for any workflow that **builds the app users load**, for example Hosting on merge). CI may build successfully with placeholder `VITE_*` values because `readFirebaseConfig()` runs in the browser, not during `npm run build`.
2. **API key restrictions (GCP)** — In [Google Cloud Console → APIs & Services → Credentials](https://console.cloud.google.com/apis/credentials), open the browser key used by Firebase. For HTTP referrer restrictions, include your Firebase Hosting origin(s), `http://localhost:*`, and any dev URL you use. Ensure the **Identity Toolkit API** is enabled for the project and the key is allowed to call it (or use “Don’t restrict key” temporarily to confirm).
3. **Stale deploy** — After updating secrets or `.env.local`, rebuild and redeploy the client.

## GitHub Actions (CI)

[`.github/workflows/ci.yml`](.github/workflows/ci.yml) passes optional repository secrets **`VITE_FIREBASE_*`** into the build when set (Settings → Secrets and variables → Actions). If they are missing, the workflow uses **CI placeholders** so forked PRs still pass. That artifact is fine for lint/build checks only; do **not** ship it to end users without replacing env with real Firebase web config.

If you add a **Firebase Hosting** (or other) deploy workflow that runs `npm run build` before upload, configure the same **`VITE_*`** secrets there for production—**without** falling back to placeholders—or the live site can show **`API_KEY_INVALID`** at sign-in.

```bash
gh secret set VITE_FIREBASE_API_KEY --body "your-web-api-key"
gh secret set VITE_FIREBASE_AUTH_DOMAIN --body "your-project.firebaseapp.com"
gh secret set VITE_FIREBASE_PROJECT_ID --body "your-project-id"
gh secret set VITE_FIREBASE_STORAGE_BUCKET --body "your-project.appspot.com"
gh secret set VITE_FIREBASE_MESSAGING_SENDER_ID --body "123456789012"
gh secret set VITE_FIREBASE_APP_ID --body "1:123:web:abc"
```
- **Profiles:** on first successful sign-in, the app creates `users/{uid}` in Firestore with `displayName`, `photoUrl`, `bio`, and `createdAt` (see `src/core/users/userProfile.ts`).
- **Security rules:** [`firestore.rules`](firestore.rules) restrict `users/{userId}` to the signed-in owner. Deploy with `firebase deploy --only firestore:rules` after `firebase login` and project selection.

### Admin (custom claims)

Course and moderation epics will require **admin** privileges. Grant out-of-band with the Firebase Admin SDK (backend script or Cloud Function), for example: `admin.auth().setCustomUserClaims(uid, { admin: true })`. Firestore rules treat you as admin when **`request.auth.token.admin`** is true **or** the Firestore profile `users/{uid}.admin` is true (either path works). The app shows the admin badge when either is set. No separate admin console is included in this repo yet.

## Application commands

```bash
npm ci
npm run dev
npm run build
npm run lint
npm run deploy:hosting   # build + Firebase Hosting (needs Firebase auth)
```
