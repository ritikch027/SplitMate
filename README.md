# SplitMate

SplitMate is a mobile-first expense sharing app built with Expo, React Native, and Supabase for splitting bills, tracking balances, and settling group expenses with less friction.

It is designed around a familiar real-world problem: trips, roommates, shared meals, and friend groups create messy money trails. SplitMate turns that into a cleaner flow with group creation, flexible expense splits, balance tracking, reminders, and settlement support in one app.

## Why This Project Stands Out

- Built as a full-stack mobile product, not just a UI demo.
- Uses Supabase for auth, realtime data, database storage, and backend functions.
- Supports OTP-based sign-in, push notifications, balance calculations, and settlement flows.
- Solves a real consumer product use case with meaningful app architecture behind it.

## Core Features

- Create and manage shared expense groups.
- Add expenses with equal or custom splits.
- Track who paid, who owes, and who should receive money back.
- View group-level balances and an overall balance breakdown across all groups.
- Record settlements and reflect them in balance calculations.
- Invite members using phone numbers.
- Send reminders for pending payments.
- Receive in-app and push notifications for expense and group activity.
- Support UPI-based settlement flows and payment context.

## Product Walkthrough

### Authentication

- Phone number login with OTP verification.
- Session-aware auth handling with rate limiting and resend cooldown logic.

### Group Expense Flow

- Create a group for a trip, flat, event, or recurring shared context.
- Add members and manage group participation.
- Log expenses with category, payer, amount, and split strategy.
- Review recent activity and per-member balances inside each group.

### Balance & Settlement Flow

- See how much you owe and how much others owe you.
- View balances aggregated across all groups.
- Record settlements after payment and automatically update outstanding amounts.
- Trigger reminders for unpaid balances.

## Tech Stack

- `Expo`
- `React Native`
- `Expo Router`
- `React Navigation`
- `Supabase`
- `Expo Notifications`
- `React Native Reanimated`

## Architecture Snapshot

```text
app/                  Expo entry points and app shell
src/screens/          Product screens and flows
src/components/       Shared UI components
src/services/         Auth, expenses, groups, balances, notifications
src/context/          Global providers and session state
src/utils/            Shared helpers and formatting logic
supabase/migrations/  Database schema evolution
supabase/functions/   Backend edge functions
```

## Highlights For Recruiters

- Product-oriented engineering:
  the app combines user flows, state management, backend integration, and domain logic around a clear financial use case.

- Realtime thinking:
  groups, expenses, and notifications are designed around live updates rather than static CRUD alone.

- Business logic beyond UI:
  expense splitting, net balances, settlement adjustment, and reminder handling all require non-trivial application logic.

- Mobile app maturity:
  includes OTP auth, notification handling, navigation flows, environment config, and deployment-ready Expo structure.

## Local Setup

1. Install dependencies.

```bash
npm install
```

2. Start the Expo dev server.

```bash
npx expo start
```

3. Run on your preferred platform.

```bash
npm run android
```

```bash
npm run ios
```

```bash
npm run web
```

## Environment Notes

- Supabase keys are loaded from local environment variables.
- Android Firebase config is expected at `android/app/google-services.json`.
- Secrets and service credentials should never be committed to GitHub.

## Current Technical Scope

- OTP authentication
- Group creation and member management
- Expense creation, editing, and deletion
- Equal and custom split handling
- Group and overall balance calculations
- Settlement recording
- Push and in-app notifications
- Supabase migrations and edge-function support

## Development

Run lint checks with:

```bash
npm run lint
```

## Roadmap

- Personal ledger support for non-group contacts
- Richer settlement history and payment proof
- Better analytics and spending insights
- More polished onboarding and collaboration flows

## License

This project is currently private and does not yet define a public license.
