# SplitMate

SplitMate is a mobile expense-sharing app built with Expo and React Native for tracking shared costs, balancing group spends, and settling up with less back-and-forth.

## What It Does

- Create groups for trips, roommates, outings, or any shared spend.
- Add expenses with equal or custom splits.
- Track who paid, who owes, and who should get paid back.
- View group-level and overall balance summaries.
- Invite members with phone numbers.
- Sign in with OTP-based authentication.
- Receive in-app and push notifications for important activity.
- Store profile and settlement data with Supabase.

## Tech Stack

- Expo
- React Native
- Expo Router
- Supabase
- React Navigation
- Expo Notifications

## Project Structure

```text
app/                  Expo entry points
src/screens/          App screens
src/components/       Shared UI components
src/services/         Auth, group, expense, balance, and notification logic
src/context/          Global app state providers
src/utils/            Formatting and helper utilities
supabase/             Migrations and edge functions
```

## Getting Started

1. Install dependencies:

```bash
npm install
```

2. Start the Expo development server:

```bash
npx expo start
```

3. Run on a target platform:

```bash
npm run android
```

```bash
npm run ios
```

```bash
npm run web
```

## Configuration Notes

- Android Firebase config is expected at `android/app/google-services.json`.
- Supabase credentials should be provided through your local environment setup.
- Do not commit secrets or service config files to GitHub.

## Current Capabilities

- Real-time group and expense updates
- Group member management
- Balance breakdowns across groups
- Expense editing and deletion controls
- Push notification registration and delivery
- UPI ID and settlement-related database support

## Development

Run linting with:

```bash
npm run lint
```

## Roadmap Ideas

- Better settlement flows inside each group
- Payment proof or history tracking
- Smarter reminders for pending balances
- Richer analytics for monthly spending patterns

## License

This project is currently private and does not yet define a public license.
