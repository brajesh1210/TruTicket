# TruTicket — Integration Guide (Plan v3, Phase 0 + Phase 1 batch 1)

Windows paths. Your repo: `F:\Desktop\TruTicket`. Extract the zip to `F:\Downloads\TruTicket_v3\` so the code sits at `F:\Downloads\TruTicket_v3\TruTicket`.

No commits are made by these steps. Review with `git status`, then commit when you are ready.

## 0. What is in this drop

Changed or new:
- `assets/brand/` — 8 PNGs generated from the official logo (`image-2.png`)
- `tools/brand_assets.py` — regenerates the brand PNGs (needs Python 3, Pillow, numpy)
- `packages/ui-tokens/tokens.json`, `packages/ui-tokens/index.ts` — design tokens
- `apps/mobile/` — full rewrite (Expo SDK 57, Expo Router). Replaces the old starter.
  - `app.json`, `package.json`, `metro.config.js`, `tsconfig.json`, `README.md`, `AGENTS.md`, `.env.example`
  - `assets/images/` (logo-based icon, splash, adaptive icon, favicon, logo mark)
  - `src/app/` (routes), `src/components/`, `src/auth/`, `src/theme/`, `src/mock/`
  - `scripts/auth-selftest.sh`
- `docs/PLAN.md` (Phase 0 done, Phase 1 in progress), `docs/PROGRESS.md` (v3 status section), `docs/INTEGRATION_GUIDE.md` (this file)
- `package-lock.json` (root workspace lock now includes the mobile dependencies)

Not changed: `prisma/`, `supabase/`, `contracts/`, `services/`, `n8n/`, `infra/`, `apps/web/`, `docs/ML_BRIEF.md`, root `package.json`.

Old `apps/mobile` files that no longer exist (for example `App.tsx` and the template components) are removed by step 2, so they do not linger in your repo.

## 1. Save your local changes first (important)

Your local repo has uncommitted changes to `package.json` and `apps/mobile/package.json`. The robocopy step overwrites these files. Save them first:

```powershell
cd F:\Desktop\TruTicket
git status
git diff > F:\Desktop\TruTicket_local_changes_before_v3.diff
```

## 2. Move the old mobile app out of the repo

```powershell
Move-Item "F:\Desktop\TruTicket\apps\mobile" "F:\Desktop\TruTicket_old_mobile_backup"
```

If the move fails with "already exists", delete the old backup folder first, then run it again.

## 3. Copy the new files in with robocopy

```powershell
robocopy "F:\Downloads\TruTicket_v3\TruTicket" "F:\Desktop\TruTicket" /E /XD node_modules .expo .git /XF .env /R:1 /W:1 /NP
```

- `/E` copies all folders, including empty ones.
- `/XD` skips `node_modules`, `.expo` and `.git`.
- `/XF .env` never overwrites your local `.env`.
- Robocopy exit codes 0–7 mean success. 8 or higher means an error. Check the output.

Check the result:

```powershell
if ($LASTEXITCODE -lt 8) { "robocopy OK" } else { "robocopy FAILED: $LASTEXITCODE" }
```

## 4. Restore your local env (only if you had one)

```powershell
if (Test-Path "F:\Desktop\TruTicket_old_mobile_backup\.env") {
  Copy-Item "F:\Desktop\TruTicket_old_mobile_backup\.env" "F:\Desktop\TruTicket\apps\mobile\.env"
}
```

Create a fresh local env file if you do not have one:

```powershell
cd F:\Desktop\TruTicket\apps\mobile
Copy-Item .env.example .env
```

`.env` is ignored by git. Never commit it.

## 5. Install and check (run from the repo root)

```powershell
cd F:\Desktop\TruTicket
npm install                       # root workspace install (uses the updated root package-lock.json)
cd apps\mobile
npx tsc --noEmit                  # must print no errors
npx expo export --platform android --output-dir $env:TEMP\tt-export   # bundle check, must finish with "Exported"
```

Auth self-test. `scripts/auth-selftest.sh` is a bash script. On Windows, run it in Git Bash:

```powershell
& "C:\Program Files\Git\bin\bash.exe" -c "cd /f/Desktop/TruTicket/apps/mobile && bash scripts/auth-selftest.sh"
```

Expected output: `ALL AUTH TESTS PASSED`. A line about `Cannot find name 'process'` may appear first. It is harmless.

## 6. Run the app on your phone (Expo Go, SDK 57)

```powershell
cd F:\Desktop\TruTicket\apps\mobile
npx expo start
```

Scan the QR code with Expo Go (must be SDK 57). Then:

1. Onboarding opens. Swipe or tap Next. Tap Get Started.
2. On the login screen, tap **Use demo account** (only visible when `EXPO_PUBLIC_DEMO_MODE=true` in `.env`).
3. Home, Categories, Tickets and Profile tabs open. Log out from Profile.

Email login flow (demo): Continue with Email → enter `demo.attendee@truticket.test` → Send code → enter **123456**.

## 7. Review, then commit yourself

```powershell
cd F:\Desktop\TruTicket
git status
git add -A
git status            # check: no .env, no node_modules, no .expo, no *.zip
```

Check that `git status` does not list `apps/mobile/.env`. The root `.gitignore` already blocks it, so it will not appear.

## 8. Cleanup (after you have confirmed the app runs)

```powershell
Remove-Item -Recurse -Force "F:\Desktop\TruTicket_old_mobile_backup"
```

## Notes for the team

- Ansh and Shivam: screens use shared tokens from `packages/ui-tokens` through `apps/mobile/src/theme`. Do not hard-code colours. Components are in `apps/mobile/src/components`.
- Brajesh: the auth module in `apps/mobile/src/auth/session.ts` is the only file that changes in Phase 2. Screens call its exported functions only.
- Expo rules: use `npx expo install <package>` so versions match SDK 57. Routes live in `src/app/` only.
- Security: `EXPO_PUBLIC_DEMO_MODE` must be `false` in any production build. Demo OTP `123456` works only in demo mode.
- Not yet built (Phase 1 batch 2 and 3): event detail, queue, tier select, checkout (mock), success, ticket QR, new-device screen, organiser and gate screens. Categories and My Tickets are placeholders. See `docs/PROGRESS.md`.
