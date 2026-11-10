# TruTicket Mobile (Expo SDK 57)

Expo Router app. Mobile is built first. Android is the test target (Expo Go).

## Run locally
```bash
cd apps/mobile
cp .env.example .env        # local only, never commit
npm install
npx expo start              # scan QR with Expo Go (SDK 57)
```

## Checks (run before every handoff)
```bash
npx tsc --noEmit            # typecheck
npx expo lint               # lint
npx expo export --platform android --output-dir /tmp/tt-export   # bundle check
bash scripts/auth-selftest.sh                                    # auth logic tests
```

## Demo mode
`EXPO_PUBLIC_DEMO_MODE=true` enables the demo account (`demo.attendee@truticket.test`)
and the demo OTP `123456`. Never ship a build with this set to true.

## Folder rules
- Routes live in `src/app/` only. Components in `src/components/`. Auth in `src/auth/`.
- Colours, spacing and type come from `packages/ui-tokens` through `src/theme`. Do not hard-code them.
- Mock data lives in `src/mock/` and is replaced by services in Phase 2.
- Use `npx expo install <pkg>` for packages, so versions match SDK 57.
