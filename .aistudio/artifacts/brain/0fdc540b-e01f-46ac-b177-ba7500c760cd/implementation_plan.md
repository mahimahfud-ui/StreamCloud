# Admin Listing Adder & Gemini AI Chatbot Integration

Integrate a secure, multi-step listing adder (+) directly beneath the animated hero portal box to dynamically add and persist new websites, movie apps, and music apps live across all visitors, coupled with a floating cinematic Gemini AI Chatbot assistant.

## User Review & Critical Decisions

> [!IMPORTANT]
> The following user preferences were confirmed during clarification:
> - **Server-side Storage**: Newly submitted items are persisted on the server (`data/custom-listings.json`) so they appear live for all current and future visitors.
> - **Chatbot Placement**: Floating chat bubble in the bottom-right corner, expanding into a glassmorphic cinematic assistant panel.
> - **Logo Resolution**: The server and client automatically resolve the real website favicon and high-resolution logo from the supplied URL.

---

## 1. Overview & Core Concept

- **Admin Listing Adder (`+` Action)**: Positioned directly under the animated 3D hero portal box. Clicking it prompts for admin access (PIN code `6993`). Upon validation, a guided 3-stage flow gathers Category (`Movie Websites`, `Movie Apps`, or `Music Apps`), Website/App URL, and Listing Name.
- **Instant Live Update**: When submitted, the backend fetches the site's real favicon/logo, appends the listing to the persistent server catalog, and instantly injects the new card into the active view without reloading the page.
- **StreamCloud Gemini Assistant**: A floating chat widget powered by Google's `gemini-3.8-flash` through a server proxy (`/api/chat`). It has full knowledge of StreamCloud's catalog, helping visitors find streaming sources, compare Android APKs, and discover music apps.

---

## 2. User Experience & Visual Design

### Key User Flows

#### A. Adding a New Listing Flow
```
[ Click '+' below Portal ]
           │
           ▼
[ Step 1: Security PIN ] ──(PIN !== '6993')──► [ Shake Animation + Retry ]
           │ (PIN === '6993')
           ▼
[ Step 2: Select Category ] ──► [ Websites | Movie Apps | Music Apps ]
           │
           ▼
[ Step 3: Enter URL ] ──► [ Paste Public Link / Domain ]
           │
           ▼
[ Step 4: Enter Name & Submit ] ──► [ Auto Fetch Logo + Live Card Injection ]
```

#### B. Gemini Chatbot Flow
```
[ Floating AI Bubble (Bottom Right) ] ──► [ Expands Cinematic Chat Drawer ]
           │
           ▼
[ Quick Prompt Suggestions / User Query ] ──► [ Server /api/chat Proxy ]
           │
           ▼
[ Gemini 3.8 Flash Contextual Streaming/Response with Direct Catalog Links ]
```

### Visual Identity & Theme
- **Plus Icon Button**: Placed directly centered below `#portal` within `.portal-wrap`. Circular 44px dark glass button (`border: 1px solid rgba(255,255,255,0.15)`) with crimson glow on hover (`box-shadow: 0 0 16px rgba(229,9,20,0.4)`), smooth scale micro-interaction.
- **Admin Modal**: Dark panel matching `.detail-panel` (`#181818` surface with subtle red accent border), step indicator, clear keyboard focus rings, and input autofocus.
- **Floating Chat Bubble**: 54px circular glass button at bottom-right with an AI spark/message icon, pulse aura, and unread tooltip.
- **Chat Drawer**: Sleek slide-up panel (width: 380px, max-height: 520px) featuring:
  - Header with Gemini indicator and clear/minimize buttons.
  - Conversation bubble feed with user messages (crimson tint) and AI replies (neutral dark panel with Markdown parsing).
  - Quick action chips for fast discovery ("Top Movie Sites", "Free Music Apps", "Ad-Free APKs").
  - Form input with send button and loading indicator.

---

## 3. Key Product Decisions & Trade-Offs

- **Server-Side File Persistence (`data/custom-listings.json`)**:
  - *Chosen Approach*: Store user-added listings in a structured JSON file managed by `server.js` with read/write endpoints (`GET /api/listings` and `POST /api/listings`).
  - *Why*: Provides real multi-user persistence for all visitors without needing external database provisioning or schema migrations, matching the lightweight nature of StreamCloud.
- **Step-by-Step Modal vs. Long Form**:
  - *Chosen Approach*: Multi-step wizard matching user's explicit request: Password -> Category selection -> URL entry -> Name entry.
  - *Why*: Reduces visual friction, ensures security check occurs first, and validates inputs sequentially.
- **Server-Side Gemini API Proxy**:
  - *Chosen Approach*: Route chat requests through `POST /api/chat` in `server.js` using `@google/genai` with `process.env.GEMINI_API_KEY`.
  - *Why*: Enforces strict secret isolation (no client-side API keys exposed in browser) and allows injecting directory catalog context into the system instructions.

---

## 4. Technical Architecture & Data Strategy

```
┌────────────────────────────────────────────────────────┐
│                      Client UI                         │
│  ┌──────────────────┐  ┌─────────────┐  ┌───────────┐  │
│  │ Portal (+) Button│  │ Admin Modal │  │ AI Drawer │  │
│  └────────┬─────────┘  └──────┬──────┘  └─────┬─────┘  │
└───────────┼───────────────────┼───────────────┼────────┘
            │                   │               │
            ▼                   ▼               ▼
┌────────────────────────────────────────────────────────┐
│                   Express Backend                      │
│                                                        │
│  GET /api/listings   ──►  Reads data/custom-listings   │
│  POST /api/listings  ──►  Validates 6993, fetches logo │
│                           & saves to custom-listings   │
│  POST /api/chat      ──►  @google/genai TypeScript SDK │
│                           gemini-3.8-flash model       │
└────────────────────────────────────────────────────────┘
```

### Data Schema (`custom-listings.json`)
```json
[
  {
    "id": "custom-1718000000000",
    "category": "sites",
    "name": "Example Stream",
    "url": "https://example.com/",
    "domain": "example.com",
    "logoUrl": "assets/logos/sites/example.png",
    "desc": "Community added streaming website.",
    "ads": 1,
    "pop": 80,
    "smooth": 80,
    "langs": 80,
    "new": true,
    "createdAt": 1718000000000
  }
]
```

### Key Implementation Steps
1. **Express Backend Endpoints in `server.js`**:
   - Install `@google/genai` dependency.
   - Implement `GET /api/listings` to serve custom catalog items.
   - Implement `POST /api/listings` to authenticate PIN `6993`, extract domain, download/cache favicon to `assets/logos/sites/`, and append entry.
   - Implement `POST /api/chat` using `@google/genai` and `gemini-3.8-flash` with full catalog context.
2. **Admin Modal & Portal Button in `index.html`**:
   - Add the `+` button directly beneath the `#portal` element.
   - Build the step-by-step modal with steps: PIN input -> Category radio/select -> URL input -> Name input.
   - On submission, trigger instant DOM update in active view and show confirmation toast.
3. **Gemini Chatbot Widget in `index.html`**:
   - Add floating launcher bubble and animated slide-up drawer.
   - Implement chat communication logic with loading indicator, message formatting, and suggested queries.
