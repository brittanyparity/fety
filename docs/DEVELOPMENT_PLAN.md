# Fety development plan

Prioritized backlog for product work. Ordered **easiest → hardest** so early items can ship as complete workflow slices while harder foundations wait for the right dependencies.

## Priority order (easiest first)

| # | Item | Why this order | Depends on |
|---|------|----------------|------------|
| **1** | Create splash page (features + sign up / login) | Self-contained marketing/entry UI; no backend; clear done criteria | None |
| **2** | Improve mobile view | Mostly CSS/layout polish on surfaces that already exist; can ship in small passes | Splash (#1) should be included in mobile QA |
| **3** | Curate and fix widgets | Bounded UI/data cleanup once dashboard is usable on mobile | Mobile pass (#2) helps validate |
| **4** | Improve wizard setup UI & visuals | Larger existing surface (`OnboardingView`); visual redesign after entry flow feels right | Splash → wizard path (#1) |
| **5** | Build Chatless version for Etsy | Feature-flag / packaging cut of chat; product decision + build variant | Stable core UX (#2–4) |
| **6** | Make the app work as a retroactive cash flow system | Core domain correctness (ledger, schedules, as-of balances); higher risk | Widget/cash-flow UX (#3) |
| **7** | Secure the system | Auth boundaries, input validation, threat model for money data | Real accounts imply auth (#8–9) |
| **8** | Integrate AI into layered chat (premium) | PRD Phases 2–3 (local model + cloud fallback); needs stable tool layer | Phase 1 assistant already shipped |
| **9** | Add database | Persistence, sync, multi-device; largest architecture jump | Security (#7) designed with it |

## Current sprint focus

**Cloud accounts & sync (v1)** — Supabase email/password, `fety_user_stores` JSON sync, splash login wired. See `docs/AUTH_AND_SYNC.md`.

**Mobile product shell** — separate narrow-viewport experience (`src/mobile/`), bottom tabs (Transactions · Budget · Insights · Home · Goals), swipeable date strip + daily review on Home. Desktop unchanged above `useIsNarrow()` breakpoint.

**#3 Curate and fix widgets** — remove redundant cards, period + account filters, scrollable chart ranges, hybrid mobile customise, yearly calendar mobile polish.

## Done (recent)

- Splash page with features + sign up / login entry before onboarding
- Onboarding wizard, empty store, custom CSV import with column mapping + review
- Yearly calendar, calendar side panel, transaction CRUD from day panel
- Phase 1 assistant: deterministic parser, financial tools, confirmations, chat UI (`src/assistant/`)

## Assistant roadmap (PRD)

| Phase | Goal | Status |
|-------|------|--------|
| **1** | Tool system without AI | **Shipped** |
| **2** | Local lightweight model (WebLLM / schema intents) | Not started — backlog #8 |
| **3** | Cloud fallback (OpenRouter, server proxy, minimal context) | Not started — blocked on OpenRouter account |
| **4** | Routing metrics, optimization | Not started |

## Picture / receipt import (shipped in app — ops & production still open)

**In repo today:** `AddTransactionModal` picture flow → `src/lib/transactionImageExtract.ts` → `POST` extract URL. **Dev only:** `vite/transactionExtractPlugin.ts` serves `/api/transaction-extract` when `OPENAI_API_KEY` is set (see `vite.config.ts`). **Production builds** do not include that middleware; set `VITE_TRANSACTION_EXTRACT_URL` to a server you control.

### To-do — enable and document picture extract

- [ ] **Dev:** Create [OpenAI API key](https://platform.openai.com/api-keys); add `OPENAI_API_KEY=sk-...` to repo-root `.env.local` (gitignored); restart Vite / Figma Make dev server (`$PORT`, often 8443).
- [ ] **Dev smoke test:** With server running, add transaction via picture upload; confirm `POST /api/transaction-extract` returns draft JSON (not 501).
- [ ] **Production:** Deploy a `POST` handler that mirrors the plugin (same request/response as `vite/transactionExtractPlugin.ts`; keep `OPENAI_API_KEY` on the server only, never `VITE_*`).
- [ ] **Production:** Set `VITE_TRANSACTION_EXTRACT_URL=https://<your-host>/api/transaction-extract` in `.env.production` or CI; run `npm run build` and redeploy (Vite inlines `VITE_*` at build time).
- [ ] **Production:** Enable CORS on the extract API for the app’s deployed origin.
- [ ] **Docs (optional):** Add a one-file serverless template (e.g. Vercel/Netlify) in `docs/` or `scripts/` that copies the plugin logic for copy-paste deploy.

**Dev reference**

| Variable | Where | Purpose |
|----------|--------|---------|
| `OPENAI_API_KEY` | `.env.local`, server env | Powers dev middleware only (`gpt-4o-mini` vision) |
| `VITE_TRANSACTION_EXTRACT_URL` | `.env.local` or `.env.production` | Browser fetch target; defaults to `/api/transaction-extract` |

**Request:** `{ "imageDataUrl": "data:image/...", "mimeType": "image/jpeg" }`  
**Response:** `desc`, `amount`, `dateISO`, `type`, `category`, `notes`, `confidence`, `uncertainFields` (see plugin for errors `501` when key missing).

---

## Later — screenshot / image transaction import (product polish)

**Intent:** User uploads a receipt or bank-app screenshot; Fety proposes one or more transactions; user reviews and confirms; data is saved via existing validated tools (`create_transaction`), same trust model as CSV import.

**Why later (remaining work):** Extraction path is chosen (OpenAI vision via proxy); remaining items are production hosting, privacy copy, and optional local-first fallback.

**Proposed flow**

1. Upload (PNG/JPG; chat attachment and/or Transactions / Import entry point).
2. Extract — date, description/merchant, amount, optional category (never auto-commit without review).
3. Review UI — reuse import-review patterns (editable drafts, include/exclude rows).
4. Commit — `create_transaction` through assistant tool layer / `useFetyData`.

**Implementation options (decide when starting)**

| Option | Fits PRD | Notes |
|--------|----------|--------|
| Browser OCR (e.g. Tesseract.js) + deterministic parsing | Local-first | Good for simple receipts; weak on dense mobile banking UIs |
| Local model + OCR text | Phase 2 | Map OCR text to intents/fields |
| Multimodal cloud (OpenRouter image model) | Phase 3 | Server-side proxy only; user opt-in; privacy copy required |

**Acceptance**

- [x] User can attach or pick an image and see draft transaction(s) (dev + configured API)
- [x] User must confirm or edit before save (`TransactionPictureReview`)
- [x] No direct model → database writes (review step first)
- [x] Clear behavior when extraction fails (manual entry; 501 when unconfigured)
- [ ] Document what leaves the device if cloud vision is enabled (user-facing copy + plan above)

**Out of scope for v1 of this feature**

- Auto-categorization without user visibility
- Batch silent import with no review
- Storing raw images in localStorage long-term (prefer extract-then-discard unless user asks to keep receipts)

## Parking lot (user tweak notes)

_Add UI/UX tweaks here as you collect them before the next dev pass._

- _(empty — fill in when ready)_
