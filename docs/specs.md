Here is the complete, synthesized **v2.1 Technical Design Specification** for Flash Repeat. I have merged the original product vision, the v2.0 architectural upgrades, and every single edge-case solution from the v2.1 addendum (CRDT bloat, algorithm caps, tombstone payloads, memory limits) into one master document. No information has been lost.

---

# Flash Repeat: Complete Technical Design Specification (v2.1)

## 1. Product Vision & Overview

**Flash Repeat** is an offline-first, thick-client spaced repetition system (SRS) featuring a WYSIWYG canvas editor. It merges the scientifically proven benefits of SRS and interleaved practice with the delightful, gamified user experience of modern learning apps.

**Core Philosophy:**

* **Performance First:** A "thick client, thin server" architecture capable of handling queues of 100,000+ cards in the browser without lag or freezing the main thread.
* **Freedom of Creation:** A PowerPoint-style WYSIWYG editor allowing flexible positioning of rich media.
* **Smart Learning:** Utilization of customized spaced repetition math and "Free Roaming" (interleaved) modes to maximize memory retention.

---

## 2. Core Architecture & Data Storage

To maintain the "Offline-First" vision while ensuring data integrity and preventing browser overload, the application utilizes a hybrid local/cloud storage strategy.

### 2.1. The "Thick Client, Thin Server" Approach

* **Frontend Framework:** TypeScript, Vite, React.js, maybe TanStack (optimized with `useMemo` and virtualized lists).
* **Backend API (Thin Server):** Lightweight Node.js/Express server or Serverless functions (e.g., Vercel, AWS Lambda) handling authentication, permission validation, and complex sync resolution. It should focus on reducing server costs so a hoster might be cloudflare instead.
* **Cloud Database:** A scalable NoSQL database (e.g., MongoDB, DynamoDB, or Supabase) acting as a backup, sync target, and public registry.

### 2.2. Storage & Media Management

* **Text Data:** Managed via **IndexedDB** using local-first wrappers (e.g., Dexie.js) for fast, structured querying.
* **Media Assets:** Stored locally using the **Origin Private File System (OPFS)**, bypassing IndexedDB limits to safely handle large binary blobs (images, audio).
* **Storage Eviction & Persistence:** To prevent the browser from wiping IndexedDB under storage pressure, the app utilizes `navigator.storage.persist()`.
* **Media Caching & Purging:** Implements an LRU cache. Users set a local storage cap. To prevent "zombie" data, the app utilizes the `requestIdleCallback` API to run a background garbage collector that permanently deletes media associated with soft-deleted cards when the device is idle.
* **Auth Expiry Offline:** If a user's JWT expires while disconnected, the app queues SRS reviews locally in an encrypted state. Upon reconnection, sync pauses, forcing the user to re-authenticate before flushing the queue.

### 2.3. Syncing, CRDTs, and Data Integrity

* **Conflict Resolution (Yjs):** Card editing relies on Yjs (or a similar CRDT framework). Changes merge granularly at the element level upon sync, avoiding "Last Write Wins" overwrites.
* **CRDT Bloat Mitigation:** To prevent sync payloads from growing too large, the backend performs **State Vector Compaction**. When a card hasn't been edited in 30 days, the backend flushes the granular keystroke history into a single flattened snapshot.
* **The "Ghost" Index (Memory Limit):** Querying 100,000 cards on mobile would freeze the main thread. We use Compound Indices in Dexie (e.g., `[deckId+nextReviewDate]`) and chain `.limit(50)` so the "Due" query only loads the current session's batch into memory.

---

## 3. The Canvas Schema & Responsive Design

Absolute positioning breaks on varying screen sizes and degrades accessibility. Flash Repeat utilizes a scalable, mathematically relative canvas model.

### 3.1. Scalable Coordinates & Limits

* **Relative Positioning:** Coordinate data uses relative percentages (e.g., `x: 10.5%`, `y: 20%`, `width: 80%`).
* **Aspect Ratio & Letterboxing:** The canvas strictly enforces a fixed aspect ratio (e.g., 3:4). If viewed on an ultrawide or iPad screen, the canvas container behaves like CSS `object-fit: contain`—scaling proportionally and utilizing "Letterboxing" to preserve coordinate integrity.
* **Font Uniformity:** Text is restricted to a curated stack of embedded Google Fonts to prevent varying OS fonts from causing kerning-induced overlaps.
* **Hardware Safeguards:** A hard cap of 25 elements per card. Image uploads are automatically compressed client-side to a max width of 1080px and under 1MB per file before writing to OPFS.

### 3.2. Accessibility (a11y) & Layering

* **Invisible Semantic Layer:** The canvas renderer generates an invisible HTML layer beneath the visual canvas. Elements are assigned a spatial order to dictate `tabindex` and screen-reader flow.
* **Z-Index Collisions:** The WYSIWYG editor features a "Layers Panel" (like Photoshop/Figma) for touch devices. The invisible a11y DOM layer maps directly to this Z-index array.

### 3.3. Relational Integrity

The NoSQL cloud database uses database-level triggers. When a `Deck` is soft-deleted, a serverless function immediately sets `deletedAt` for all associated `Card` documents, preventing orphaned data from syncing.

---

## 4. UI/UX & AI Content Boundaries

### 4.1. Core Application Pages

* **Landing Page:** Highlights "Free Roaming" and "Absolute Freedom" editors with interactive 3D Lottie animations.
* **Dashboard:** A grid showing Classes/Decks, accompanied by a streak counter, daily review goals, and an activity heat-map.
* **Learn Mode:** Distraction-free. User thinks of the answer, clicks "Reveal" (smooth CSS flip), and rates the card using the 5 Button Scale. 

Again (Red): "I forgot this completely."

Hard (Orange): "I remembered, but it took severe mental effort."

Good (Yellow): "I remembered with a little hesitation."

Easy (Green): "I remembered this instantly."

Perfect (Blue): "This is trivial to me." (Triggers dopamine-loop Lottie animations).

### 4.2. Content Creation & AI Fallbacks

* **Voice-to-Text:** The Web Speech API is the zero-cost default. Falls back to a rate-limited, server-side OpenAI Whisper API route.
* **YouTube AI Importer:** Serverless endpoints parse videos under 15 minutes to generate Q&A pairs.
* **The "Draft" Staging Area:** AI-generated flashcards do **not** enter the learning queue automatically. They are pushed to a `Drafts` staging area requiring manual user verification.
* **The AI Hallucination Loop:** In Learn Mode, every card features a discrete "Flag Issue" button. If an AI-generated card is flagged, it is instantly suspended from the SRS queue and sent back to the "Drafts" area.

---

## 5. Core Algorithms & Learning Engine

### 5.1. Modified Spaced Repetition Math (5 Buttons)

The application utilizes a modified FSRS approach to accommodate a 5th button ("Perfect"):


$$EF_{new} = EF_{old} + (0.1 - (5 - q) \times (0.08 + (5 - q) \times 0.02)) + P_{bonus}$$

* **The "Perfect" Guardrail:** $P_{bonus}$ is a discrete multiplier applied only when $q = 5$ (Perfect). To prevent the "Perfect Trap", the maximum interval jump is capped at 2.5x the previous interval, preventing cards from disappearing for 5 years prematurely.
* **The "Again" Guardrail:** Hitting "Again" ($q=1$) does *not* completely reset the Ease Factor. It penalizes the $EF$ by a maximum of 20% and drops the interval to 1 day, preventing users from having to "re-learn" the card from scratch due to a simple slip-up.

### 5.2. Session Interruptions & Timezones

* **Atomic Saves:** Ratings are never batched. The moment a user clicks an SRS rating button, the $EF$ and `nextReviewDate` are recalculated and atomically committed to IndexedDB. If the app crashes on card 46, cards 1-45 are already saved safely.
* **Timezone Shifts:** Users set a "Home Timezone" in their profile. Streaks are calculated against this static UTC offset, granting a 24-hour grace period to prevent broken streaks during international flights.

### 5.3. SRS Overload & Free Roaming

* **Overload Mitigation (Paced Mode):** Users can cap daily overdue reviews (e.g., 50/day). A "Retrievability Index" prioritizes cards closest to being forgotten, while mature overdue cards are smoothly distributed to later days.
* **Free Roaming Mode (Interleaving):** Queries due cards across all selected decks, pools them, and applies a Fisher-Yates shuffle algorithm to force context-switching and interleaved practice.

---

## 6. Community, Downloads & Security

### 6.1. Heavy Payload Downloads & Forking Updates

* **Chunked Fetching:** Downloading massive public decks initiates a Streams API fetch, injecting JSON into IndexedDB in chunks of 100.
* **Lazy Media Fetching:** Images/audio are only fetched and cached to OPFS as the user actually approaches those cards in their SRS queue.
* **The "Update" Conflict:** When User A downloads a deck, they create a local fork. If User B (creator) pushes an update, User A can merge it. Every element in the canvas arrays generates a UUID. The sync engine diff-matches the UUIDs. Any custom elements/cards User A added locally will safely bypass the update. `srsData` is strictly ignored during merges.

### 6.2. Moderation, Privacy & "The Right to be Forgotten"

* **Importing:** Web Workers use `sql.js` (WebAssembly SQLite) to parse zipped Anki files in the browser, extract media, and rewrite URLs without blocking the UI thread.
* **Tombstone Payloads:** If a public deck contained copyrighted/illegal material taken down by Admins, a "Tombstone" payload is sent to all clients via the CRDT sync, forcefully purging the exact card UUIDs from all local IndexedDBs to comply with legal requirements.

### 6.3. Security & Expansion Paths

* **CSS Sanitization:** Custom deck themes run through an Abstract Syntax Tree (AST) parser (e.g., `css-tree`) on the backend. It explicitly strips any `position: fixed`, `position: absolute`, or `z-index` properties that attempt to break out of the `.user-theme-scope` container, ensuring malicious actors cannot visually hide core UI elements (like a "Report" button).
* **Collaborative Editing:** Real-time WebSocket integration (leveraging the Yjs CRDTs) allowing multiple users to edit the same deck simultaneously.