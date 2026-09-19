# Fety development plan

Living backlog aligned with the Conversational Assistant PRD (Phase 1–4). Items marked **Later** are agreed scope but not scheduled for the current sprint.

## Done (recent)

- Onboarding wizard, empty store, custom CSV import with column mapping + review
- Yearly calendar, calendar side panel, transaction CRUD from day panel
- Phase 1 assistant: deterministic parser, financial tools, confirmations, chat UI (`src/assistant/`)

## Assistant roadmap (PRD)

| Phase | Goal | Status |
|-------|------|--------|
| **1** | Tool system without AI | **Shipped** |
| **2** | Local lightweight model (WebLLM / schema intents) | Not started |
| **3** | Cloud fallback (OpenRouter, server proxy, minimal context) | Not started — blocked on OpenRouter account |
| **4** | Routing metrics, optimization | Not started |

## Later — screenshot / image transaction import

**Intent:** User uploads a receipt or bank-app screenshot; Fety proposes one or more transactions; user reviews and confirms; data is saved via existing validated tools (`create_transaction`), same trust model as CSV import.

**Why later:** Depends on choosing extraction path (local OCR vs optional cloud vision) and fits naturally after Phase 1 is stable, often alongside Phase 2/3 AI work.

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

**Acceptance (when built)**

- [ ] User can attach or pick an image and see draft transaction(s)
- [ ] User must confirm or edit before save
- [ ] No direct model → database writes
- [ ] Clear behavior when extraction fails (clarify, no fabricated amounts)
- [ ] Document what leaves the device if cloud vision is enabled

**Out of scope for v1 of this feature**

- Auto-categorization without user visibility
- Batch silent import with no review
- Storing raw images in localStorage long-term (prefer extract-then-discard unless user asks to keep receipts)

## Parking lot (user tweak notes)

_Add UI/UX tweaks here as you collect them before the next dev pass._

- _(empty — fill in when ready)_
