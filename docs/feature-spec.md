# FlashRepeat: Spec Gap Analysis & Implementation Plan

## Context

The v2.1 spec (`docs/specs.md`) defines a full-featured offline-first SRS app with a WYSIWYG canvas editor, cloud sync, AI features, and community features. The current codebase is a basic MVP with text-only card creation, simple learn mode, and a dashboard. This plan identifies every gap between spec and implementation, then organizes them into buildable phases.

**Scope decision:** Build ALL client-side features (Phases 0-5) with the full WYSIWYG canvas editor (drag-and-drop, layers panel, resize handles, font picker, image upload). Server-dependent features (Phase 6) are deferred.

---

## Gap Summary: What's Built vs. What's Specced

### Already Implemented

- [x] SRS engine: 5-button modified FSRS with Perfect (2.5x cap) and Again (20% EF penalty cap) guardrails (`src/srs/engine.ts`)
- [x] Atomic SRS saves — each rating immediately persists to IndexedDB (`src/db/operations.ts:updateCardSRS`)
- [x] Free Roam mode with Fisher-Yates shuffle (`src/srs/engine.ts:shuffleCards`)
- [x] Deck CRUD: create, view, soft-delete with color picker (`src/db/operations.ts`)
- [x] Card CRUD: create (text-only), view, soft-delete (`src/db/operations.ts`)
- [x] Soft-delete cascading: deck deletion cascades to cards (`src/db/operations.ts:softDeleteDeck`)
- [x] Learn mode: CSS 3D card flip, 5 rating buttons, progress bar (`src/components/learn/StudyCard.tsx`)
- [x] Dashboard: deck grid with stats (total/due/learned) (`src/pages/DashboardPage.tsx`)
- [x] Compound IndexedDB index `[deckId+srs.nextReviewDate]` with `.limit(50)` (`src/db/index.ts`)
- [x] `navigator.storage.persist()` for storage persistence (`src/db/index.ts`)
- [x] `CanvasElement` type with relative % positioning, zIndex, text styling, image type (`src/types.ts`)
- [x] `prioritizeByRetrievability()` function exists (`src/srs/engine.ts:96`) — but unused
- [x] `StudySession.dailyCap` type exists (`src/types.ts:68`) — but unused
- [x] `updateCard()` and `updateDeck()` DB operations exist — but no UI calls them

### NOT Implemented — Client-Side Gaps (41 items)

| #       | Gap                                                                                                                        | Spec Section | Severity | Size                      |
| ------- | -------------------------------------------------------------------------------------------------------------------------- | ------------ | -------- | ------------------------- |
| G1      | **WYSIWYG Canvas Editor** — card editor is just a textarea; no element positioning, no drag-drop, no multi-element support | 3.1, 4.1     | Critical | XL                        |
| G2      | **Image elements** — `type: 'image'` in type but no upload, compression, or rendering                                      | 3.1          | Critical | L                         |
| G3      | **Drag-and-drop element repositioning** on canvas                                                                          | 3.1          | Critical | L                         |
| G4      | **Layers panel** (z-index management like Figma)                                                                           | 3.2          | Medium   | M                         |
| G5      | **Letterboxing** — `aspect-ratio: 3/4` exists but no `object-fit: contain` wrapper                                         | 3.1          | Low      | S                         |
| G6      | **Curated Google Font stack** — only Inter loaded, no font picker                                                          | 3.1          | Medium   | M                         |
| G7      | **25 element hard cap** — no validation                                                                                    | 3.1          | Low      | S                         |
| G8      | **Image compression** (1080px max, 1MB) — not implemented                                                                  | 3.1          | Medium   | M                         |
| G9      | **Invisible a11y layer** beneath canvas for screen readers                                                                 | 3.2          | Medium   | M                         |
| G10     | **Card editing UI** — `updateCard()` exists but no edit button/modal                                                       | —            | Critical | M                         |
| G11     | **Deck editing UI** — `updateDeck()` exists but no edit button/modal                                                       | —            | Medium   | S                         |
| G12     | **Streak counter** — no streak tracking, no `lastStudyDate` field                                                          | 4.1          | High     | M                         |
| G13     | **Daily review goals** — no goals system, no user settings                                                                 | 4.1          | Medium   | M                         |
| G14     | **Activity heat-map** — no review history table for aggregation                                                            | 4.1          | Medium   | L                         |
| G15     | **"Perfect" Lottie animations** — no Lottie, no celebration animation                                                      | 4.1          | Low      | M                         |
| G16     | **Keyboard shortcuts** (1-5 for ratings, Space to reveal) in Learn mode                                                    | 4.1          | Medium   | S                         |
| G17     | **"Flag Issue" button** in Learn mode — no `flaggedAt` field                                                               | 4.2          | Medium   | S                         |
| G18     | **Paced Mode** (daily overdue cap) — type exists but unused                                                                | 5.3          | Medium   | M                         |
| G19     | **Retrievability Index wiring** — function exists but never called                                                         | 5.3          | Low      | S                         |
| G20     | **Smooth distribution** of mature overdue cards to later days                                                              | 5.3          | Low      | M                         |
| G21     | **Home Timezone** setting — no user settings system                                                                        | 5.2          | Low      | S                         |
| G22     | **24-hour streak grace period**                                                                                            | 5.2          | Low      | S                         |
| G23     | **Canvas renderer in StudyCard** — only reads first text element, ignores positioning/styling/images                       | Learn        | Critical | L                         |
| G24     | **Landing page** — dashboard is at `/`, no marketing/intro page                                                            | 4.1          | Low      | L                         |
| G25     | **Voice-to-Text** — Web Speech API                                                                                         | 4.2          | Low      | M                         |
| G26     | **YouTube AI Importer**                                                                                                    | 4.2          | Low      | L (server)                |
| G27     | **AI Draft Staging Area** — no `status` field on cards                                                                     | 4.2          | Low      | M                         |
| G28     | **Anki Import** (.apkg parsing via sql.js Web Worker)                                                                      | 6.2          | Low      | L                         |
| G29-G37 | **Cloud Sync, CRDT, Auth, Public Registry, Forking, Collab Editing, Tombstones, CSS Sanitization**                         | 2.1-6.3      | Deferred | XL (all server-dependent) |
| G38     | **LRU Media Cache** with user-configurable storage cap                                                                     | 2.2          | Low      | M                         |
| G39     | **Media GC** via `requestIdleCallback`                                                                                     | 2.2          | Low      | M                         |
| G40     | **OPFS Media Storage** for binary blobs outside IndexedDB                                                                  | 2.2          | Low      | L                         |
| G41     | **User settings/preferences** persistence — no DB table, no UI                                                             | Multiple     | High     | M                         |

---

## Implementation Phases

### Phase 0: Data Model Foundation

_Unblocks all later phases. Adds tables + fields needed for settings, review history, flagging, drafts._

**Files to modify:**

- `src/types.ts` — Add `UserSettings`, `ReviewRecord` interfaces; add `flaggedAt: number | null` and `status: 'active' | 'draft'` to `Card`
- `src/db/index.ts` — Dexie v2 migration: add `settings` and `reviewHistory` tables, `.upgrade()` to set defaults on existing cards
- `src/db/operations.ts` — Add settings CRUD, `recordReview()` (called atomically inside `updateCardSRS`), `flagCard()`, `unflagCard()`, filter flagged/draft cards from `getDueCards` and `getCardsForDeck`

### Phase 1: WYSIWYG Canvas Editor

_The biggest gap. Replaces the textarea with a real canvas editor. Reuses existing `CanvasElement` type from `src/types.ts` (already has all needed fields)._

**New files to create:**

- `src/components/canvas/CanvasContainer.tsx` + `.module.css` — Fixed 3:4 aspect-ratio wrapper with letterboxing, `ResizeObserver` for scale factor (G5)
- `src/components/canvas/CanvasRenderer.tsx` + `.module.css` — Read-only renderer: maps `CanvasElement[]` to positioned `div`s/`img`s with full styling (G23)
- `src/components/canvas/CanvasEditor.tsx` + `.module.css` — Interactive editor: selection, drag-to-move (pointer events), resize handles, inline text editing (G1, G3)
- `src/components/canvas/CanvasToolbar.tsx` + `.module.css` — "Add Text", "Add Image" buttons, element cap enforcement (G7)
- `src/components/canvas/ElementProperties.tsx` + `.module.css` — Sidebar: font size/weight/style/alignment/color/font-family (G6)
- `src/components/canvas/LayersPanel.tsx` + `.module.css` — z-index reordering, element list, delete per element (G4)

**Files to modify:**

- `src/components/card-editor/CardEditor.tsx` — Rewrite: replace textarea with `CanvasEditor`, keep Front/Back tabs (G1)
- `src/components/learn/StudyCard.tsx` — Replace `getDisplayText()` with `CanvasRenderer` for multi-element display (G23)
- `src/styles/global.css` — Add Google Fonts imports for curated stack (G6)

**Approach:**

- Canvas editor is a controlled component: parent owns `elements[]`, passes `onChange` callback
- Drag-and-drop uses raw pointer events (no library needed — simple rectangle-in-container)
- `CanvasRenderer` is shared between editor (interactive overlays) and study card (read-only)
- A11y: hidden semantic layer beneath visual canvas, elements ordered spatially for `tabindex` (G9)

### Phase 2: Card & Deck Editing + Image Upload

_Completes CRUD. Reuses existing `updateCard()` and `updateDeck()` from `src/db/operations.ts`._

**New files:**

- `src/utils/image-utils.ts` — `compressImage(file: File): Promise<string>` using `HTMLCanvasElement` to resize to 1080px max + compress to JPEG under 1MB (G8)
- `src/components/dashboard/EditDeckForm.tsx` + `.module.css` — Clone of `CreateDeckForm` but pre-populated (G11)

**Files to modify:**

- `src/pages/DeckPage.tsx` — Add edit button per card row opening `CardEditor` modal with `initialFront`/`initialBack` + `submitLabel="Save"` (G10); add deck edit icon in header (G11)
- `src/components/dashboard/DeckCard.tsx` — Add edit option (G11)
- `src/components/canvas/CanvasEditor.tsx` — Wire image upload via file input with `accept="image/*"`, call `compressImage()` before creating image element (G2)
- `src/components/canvas/CanvasRenderer.tsx` — Render `type: 'image'` elements as `<img>` with `object-fit: contain` (G2)

### Phase 3: Dashboard Enhancements

_Streak, goals, heat-map. Depends on Phase 0's `reviewHistory` table and `UserSettings`._

**New files:**

- `src/utils/streak.ts` — Query `reviewHistory` grouped by calendar day (respecting home timezone), count consecutive days, apply grace period (G12, G22)
- `src/components/dashboard/HeatMap.tsx` + `.module.css` — SVG grid of last 365 days (like GitHub contributions), color intensity = review count (G14)
- `src/pages/SettingsPage.tsx` + `.module.css` — Form: home timezone dropdown, daily review goal, daily overdue cap (G41, G21, G13)

**Files to modify:**

- `src/pages/DashboardPage.tsx` — Add streak counter display, daily goal progress bar, render `HeatMap` (G12, G13, G14)
- `src/components/common/Layout.tsx` — Add "Settings" nav link
- `src/App.tsx` — Add `/settings` route

### Phase 4: Learn Mode Enhancements

_Keyboard shortcuts, flag button, Paced Mode, Perfect celebration. Depends on Phase 0 (flaggedAt) and Phase 1 (canvas renderer in StudyCard)._

**New files:**

- `src/components/learn/PerfectCelebration.tsx` + `.module.css` — CSS confetti/sparkle animation on q=5 rating, auto-dismiss ~2s (G15). Use pure CSS animation, no Lottie dependency needed for MVP.

**Files to modify:**

- `src/pages/LearnPage.tsx` — Add `useEffect` keydown listener: Space/Enter to reveal, 1-5 to rate when revealed (G16); wire Paced Mode daily cap from user settings (G18)
- `src/components/learn/StudyCard.tsx` — Add discrete "Flag" button, visual feedback when flagged (G17)
- `src/db/operations.ts` — `getDueCards`: use `prioritizeByRetrievability()` (already exists at `src/srs/engine.ts:96`) instead of simple sort; filter out flagged cards; apply daily cap (G18, G19)
- `src/components/learn/SessionComplete.tsx` — Show accuracy %, rating breakdown, streak update (G14 data)

### Phase 5: Advanced Client Features (Tier 2)

_Bigger features that are still client-only. Lower priority._

- **Landing page** (G24) — New `/` route with feature highlights, move dashboard to `/app`
- **Voice-to-Text** (G25) — `src/utils/speech.ts` wrapping Web Speech API, mic button in canvas editor
- **AI Draft Staging** (G27) — "Drafts" tab in `DeckPage`, approve/reject workflow (uses Phase 0's `status` field)
- **Anki Import** (G28) — Web Worker + `sql.js` WASM to parse `.apkg`, new `src/workers/anki-import.worker.ts`
- **OPFS Media Storage** (G40) — `src/storage/opfs.ts`, migrate images from data URLs in IndexedDB to OPFS file refs
- **LRU Media Cache + GC** (G38, G39) — Track usage timestamps, `requestIdleCallback` cleanup

### Phase 6: Server-Dependent Features (NOT in scope)

_Cannot be built without backend infrastructure. Deferred entirely._

Cloud Sync (G29), Yjs CRDT (G30), Auth/JWT (G37), Public Registry (G31), Deck Forking (G32), Collaborative Editing (G34), Tombstones (G35), CSS Sanitization (G36), YouTube AI Importer (G26), Lazy Media Fetching from CDN (G33)

---

## Dependency Graph

```
Phase 0 (Data Model) ──┬──> Phase 1 (Canvas Editor) ──> Phase 2 (Edit + Images)
                       │         │
                       │         └──> Phase 3 (Fonts/Polish — can parallel Phase 2)
                       │
                       ├──> Phase 3 (Dashboard — can parallel Phase 1)
                       │
                       └──> Phase 4 (Learn Enhancements — needs Phase 1 done for canvas in StudyCard)
                                │
                                └──> Phase 5 (Advanced — after 1-4)
```

Phases 1 and 3 can run in parallel after Phase 0. Phase 2 needs Phase 1. Phase 4 needs Phases 0 + 1.

---

## Verification Plan

After each phase, verify by:

1. `npx tsc --noEmit` — type check passes
2. `npx vite build` — production build succeeds
3. Manual testing in browser (`npm run dev`):
   - **Phase 0:** Create a card, verify new fields exist in IndexedDB via DevTools > Application > IndexedDB
   - **Phase 1:** Create a card with multiple text elements positioned at different locations, verify they render correctly in both the editor and learn mode
   - **Phase 2:** Edit an existing card, upload an image, verify compression and rendering
   - **Phase 3:** Complete a study session, verify streak updates on dashboard, check heat-map populates
   - **Phase 4:** Study with keyboard only (Space to reveal, 1-5 to rate), flag a card, verify it doesn't reappear
   - **Phase 5:** Test landing page renders at `/`, voice-to-text activates mic in canvas editor, Anki import parses a sample `.apkg` file, drafts tab shows draft cards that don't appear in study queue
