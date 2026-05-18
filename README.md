# PushupCrew — Expo + Supabase MVP Skeleton

React Native (Expo) implementation of the ACID-themed pushup tracker.
This is the **MVP skeleton**: all 5 screens + 4-step onboarding render
against mock data from `src/state/seed.ts`. Supabase is wired as a stub
with TODOs at every integration point.

## Quick start

```bash
cd pushup-crew-app
npm install
cp .env.example .env   # edit before going beyond mock mode
npx expo start
```

Press `i` for iOS simulator, `a` for Android emulator, or scan the QR
with the Expo Go app.

> ⚠️ Fonts: Anton, Inter, JetBrains Mono are pulled from
> `@expo-google-fonts/*` at runtime. First load on a fresh install will
> spin the splash for a second while they download.

## Project layout

```
pushup-crew-app/
├── app/
│   ├── _layout.tsx              ← root: font loader + onboarding gate
│   ├── index.tsx
│   ├── (onboarding)/
│   │   ├── _layout.tsx
│   │   ├── welcome.tsx          ← step 0
│   │   ├── name.tsx             ← step 1
│   │   ├── crew.tsx             ← step 2 (join | create)
│   │   └── goal.tsx             ← step 3
│   └── (tabs)/
│       ├── _layout.tsx          ← floating pill tab bar
│       ├── index.tsx            ← HOME
│       ├── log.tsx              ← LOG
│       ├── rank.tsx             ← RANK
│       ├── chat.tsx             ← CHAT
│       └── you.tsx              ← YOU / Profile
├── src/
│   ├── theme/                   ← colors, fonts, spacing, glows
│   ├── components/              ← Panel, AcidButton, Chip, Sparkline, …
│   ├── state/
│   │   ├── useAppStore.ts       ← Zustand store + selectors
│   │   └── seed.ts              ← mock crew, chat, week sparklines
│   ├── lib/
│   │   ├── supabase.ts          ← client stub (env-driven)
│   │   ├── auth.ts              ← Apple ✓ / Google ◯ sign-in stubs
│   │   └── mechanics.ts         ← XP, level, streak helpers
│   └── types.ts
└── supabase/
    └── migrations/
        └── 0001_init.sql        ← full schema + RLS + realtime publication
```

## What's done

- [x] All 5 main screens (Home / Log / Rank / Chat / You) with ACID styling
- [x] Onboarding flow (Welcome → Name → Crew → Goal)
- [x] Floating pill tab bar with active-pill state
- [x] Custom theme tokens matching the design README
- [x] Zustand store mirroring `shared.jsx` mock data + log/chat actions
- [x] Sparkline SVG component, ProgressBar, Kicker, Panel, AcidButton
- [x] XP / level / streak mechanics
- [x] Apple sign-in helper (works as soon as Supabase + Apple are configured)
- [x] Full Supabase SQL schema (profiles, crews, crew_members, pushup_logs,
      chat_messages) with row-level security and realtime publication

## What's stubbed (search the code for `TODO`)

- [ ] **Supabase wiring** — `src/lib/supabase.ts` creates the client when env
      vars are present but no calls are made yet. Replace store actions
      (`logPushups`, `sendChat`) with Supabase inserts and subscribe to
      `pushup_logs` / `chat_messages` realtime channels.
- [ ] **Google sign-in** — `signInWithGoogle()` in `src/lib/auth.ts`
      needs `@react-native-google-signin/google-signin` configured with
      iOS + Web client IDs.
- [ ] **Persisted onboarding** — currently in-memory only. Wrap the
      Zustand store with `persist` (using MMKV or AsyncStorage) so a
      fresh app launch keeps the user past onboarding.
- [ ] **Confetti + Level-Up overlay** — `logPushups` already emits a
      `levelUpEvent` timestamp; render the overlay in a top-level
      component listening to `useAppStore(s => s.levelUpEvent)`.
- [ ] **Push notifications** — Expo Notifications + a Supabase Edge Function
      cron for the 5 alert types listed in the design README.
- [ ] **iOS Live Activity** — `expo-live-activity` integration for the
      Dynamic Island pill (top-of-stack today-count widget).
- [ ] **Streak reset cron** — Supabase Edge Function at 23:59 local that
      increments `crews.skip_pot_cents` by 100 for anyone with 0 logs
      and resets `streak`.
- [ ] **Real slider for daily goal** — currently +/- step buttons.
      Drop in `@react-native-community/slider`.
- [ ] **Clipboard copy** on the crew-create code screen — wire
      `expo-clipboard`.

## Configuring Supabase

1. Create a project at <https://supabase.com>.
2. Copy `URL` and `anon public` key from **Settings → API** into `.env`:

   ```
   EXPO_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi…
   ```

3. Open **SQL Editor** → paste the contents of
   `supabase/migrations/0001_init.sql` → run. RLS + realtime publication
   are set up by the script.

4. Enable providers under **Authentication → Providers**:
   - Apple — add your Service ID + client secret (JWT)
   - Google — add iOS + Web OAuth client IDs

5. Restart `npx expo start --clear`; `supabaseConfigured` will now be
   true and `auth.ts` flows light up.

## Design source

The original prototype (HTML + JSX) lives one directory up — see
`../README.md` for the full handoff: colors, copy, screen specs,
animation timings, push-notification copy. This skeleton matches that
spec for typography, spacing, and color tokens.
