# Fety development plan

Prioritized backlog for Fety (BudgetingOS) — a retroactive cash-flow / spending-power product. Ordered **easiest / highest leverage first** so each ship builds on the last.

## Priority order

| # | Item | Why this order | Size |
|---|------|----------------|------|
| **1** | **Curate and fix widgets** | Several dashboard widgets still show hardcoded demo numbers while the ledger already has live summary data. Small, visible, and teaches the cash-flow model. | S |
| **2** | **Improve mobile view** | Nav, chat dock, and calendar already have mobile CSS; polish touch targets, safe areas, and dense manage screens. Unlocks real phone usage. | S–M |
| **3** | **Improve wizard setup (UI + visuals)** | Onboarding exists end-to-end; polish steps, progress, and empty states before driving more traffic through it. | M |
| **4** | **Splash page (features + sign up / login UI)** | Marketing surface on top of current local-first app. Sign-up/login can be UI + local session first; real auth waits on #7–8. | M |
| **5** | **Make the app work as a retroactive cash-flow system** | Core product: starting balances, scheduled bills/income, daily ending balance, spending power. Widgets (#1) and calendar already lean this way — finish gaps and edge cases. | L |
| **6** | **Build Chatless version for Etsy** | Strip/hide assistant; spreadsheet-style cash-flow UX for the digital-product SKU. Depends on #5 being trustworthy. | M–L |
| **7** | **Add database** | Move off `localStorage` to a real store (accounts, sync, multi-device). Prerequisite for real auth and security. | L |
| **8** | **Secure the system** | Auth, authorization, input validation at the API boundary, secrets handling. Requires #7. | L |
| **9** | **Integrate AI into layered chat (premium)** | Phase 2–4 of the assistant PRD (local model → cloud fallback → routing). Phase 1 deterministic tools already ship. | L |

## Current sprint — #1 Curate and fix widgets

**Goal:** Every dashboard widget renders from `useFetyData` / `computeSummary`, not static demo fixtures.

**In scope**

- Wire remaining hardcoded widgets (`stat-monthly-net`, `stat-weekly-spend`, `stat-remaining`, `daily-limit`, `today-balance`, `money-in`, `money-out`, `monthly-net`) to live store data
- Prefer income streams for “next paycheck” when scheduled income exists
- Remove unused demo constants from `App.tsx`
- Keep picker previews as illustrative samples (they are not live)

**Done when**

- [x] No widget `render()` shows fixed dollar amounts unrelated to the store
- [x] Changing transactions / budgets updates those widgets after save
- [x] Dead demo arrays removed from `App.tsx`

## Assistant roadmap (PRD) — maps to #9

| Phase | Goal | Status |
|-------|------|--------|
| **1** | Tool system without AI | **Shipped** |
| **2** | Local lightweight model (WebLLM / schema intents) | Not started |
| **3** | Cloud fallback (OpenRouter, server proxy, minimal context) | Not started — blocked on OpenRouter account |
| **4** | Routing metrics, optimization | Not started |

## Later — screenshot / image transaction import

**Intent:** User uploads a receipt or bank-app screenshot; Fety proposes transactions; user reviews and confirms via existing tools.

**Why later:** Fits after Phase 1 is stable; often alongside Phase 2/3 AI work (#9).

## Parking lot

_Add UI/UX tweaks here before the next pass._

- _(empty — fill in when ready)_
