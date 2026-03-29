
---

# 🚀 SplitMate

**SplitMate** is a mobile-first expense sharing app that simplifies how groups manage money—whether it’s trips, roommates, or shared daily expenses.

Built with **Expo, React Native, and Supabase**, it combines intuitive UX with solid backend architecture to turn messy financial interactions into a smooth, trackable flow.

---

## 💡 The Problem

Group expenses are chaotic:

* “Who paid last time?”
* “How much do I owe?”
* “Did you already send me that?”

SplitMate removes that confusion by creating a **single source of truth for shared finances**.

---

## ✨ What Makes SplitMate Stand Out

* 📱 **Real product, not a demo** — full-stack, production-style mobile app
* ⚡ **Realtime architecture** — updates reflect instantly across users
* 🔐 **OTP-based authentication** — frictionless onboarding
* 🧠 **Non-trivial business logic** — balances, settlements, and split calculations
* 🔔 **Push + in-app notifications** — keeps users engaged and accountable

---

## 🔑 Core Features

### 👥 Group Management

* Create groups for trips, flats, or events
* Add members via phone numbers
* Manage participation dynamically

### 💸 Expense Tracking

* Add expenses with:

  * Equal splits
  * Custom splits
* Track payer vs participants
* Categorize and review spending

### 📊 Smart Balances

* See who owes whom in real time
* Group-level and overall balance views
* Clear net settlement insights

### ✅ Settlements

* Record payments and auto-adjust balances
* Maintain clean financial history

### 🔔 Notifications & Reminders

* Payment reminders
* Activity updates
* Push + in-app alerts

---

## 🔄 User Flow Overview

### 🔐 Authentication

* Phone number login with OTP
* Session persistence
* Rate limiting + resend cooldown

### 🧾 Expense Lifecycle

1. Create a group
2. Add members
3. Log expenses
4. Auto-calculate balances

---

## 🛠 Tech Stack

* **Frontend:** Expo, React Native
* **Navigation:** Expo Router, React Navigation
* **Backend:** Supabase (Auth, DB, Realtime, Edge Functions)
* **Animations:** React Native Reanimated
* **Notifications:** Expo Notifications

---

## 🧱 Architecture Snapshot

```
app/                  → Expo entry & routing
src/screens/          → App screens & flows
src/components/       → Reusable UI components
src/services/         → Business logic (auth, expenses, balances)
src/context/          → Global state & session management
src/utils/            → Helpers & formatting
supabase/migrations/  → Database schema
supabase/functions/   → Edge/backend logic
```

---

## 🧠 Engineering Highlights

* **Domain-driven logic:**
  Expense splitting, netting, and settlement flows are handled with structured logic—not shortcuts.

* **Realtime-first mindset:**
  Designed for live collaboration, not static CRUD apps.

* **Full-stack ownership:**
  Covers frontend UX, backend design, and infra considerations.

* **Mobile production patterns:**
  Auth flows, notifications, navigation, and environment configs are handled cleanly.

---

## ⚙️ Local Setup

```bash
npm install
npx expo start
```

Run on:

```bash
npm run android
npm run ios
npm run web
```

---

## 🔐 Environment Notes

* Uses Supabase environment variables
* Firebase config required for Android notifications
* Secrets are excluded from version control

---

## 📈 Roadmap

* 📒 Personal expense tracking (non-group)
* 📊 Spending insights & analytics
* 📊 UPI integration to support settlements.
* 🧾 Settlement history with proofs
* ✨ Improved onboarding experience

---

## 📌 Why This Project Matters

SplitMate isn’t just a UI project—it demonstrates:

* Product thinking
* Real-world problem solving
* Scalable app architecture
* Clean separation of concerns

---

## 📄 License

Currently private — license to be defined before public release.

---
