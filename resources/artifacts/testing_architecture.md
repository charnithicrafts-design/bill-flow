# Testing Architecture: The Bill Flow Framework

**Prepared by:** Murat (QA Lead & Test Architect)  
**Context:** Ensuring absolute reliability for an offline-first, high-velocity billing suite.

Because Bill Flow is designed to run in rigorous, high-speed environments (like wholesale cash counters), our testing strategy cannot rely on brittle browser-based assumptions. We must guarantee offline transaction atomic safety and keyboard-driven UI resilience.

## 🏗️ The 3-Tier Testing Pyramid

Our architecture leverages the speed of **Vitest** (which natively understands our Vite build tooling) and splits testing into three distinct layers:

### 1. Backend & Transaction Engine (In-Memory Integration)
* **Framework:** `Vitest` + `Supertest`
* **Execution:** Tests run against `server.js` using a purely in-memory SQLite database (`:memory:`).
* **Core Responsibilities:**
  * **SCM Initialization:** Verify that `/api/setup` permanently locks the `ACTIVE_DOMAIN` and correctly loads the modular SQL schemas (`core.sql` + `[domain].sql`).
  * **Atomic Locking:** Simulate concurrent checkout requests to ensure `BEGIN IMMEDIATE` properly throws `SQLITE_BUSY` (HTTP 409) rather than over-deducting stock.
  * **Data Integrity:** Guarantee that grand totals, tax distributions, and mandi cess calculations are mathematically perfect.

### 2. Frontend React Components (Behavioral Testing)
* **Framework:** `Vitest` + `@testing-library/react` + `@testing-library/user-event`
* **Execution:** Tests run inside a `jsdom` simulated browser environment.
* **Core Responsibilities:**
  * **Keyboard Workflows:** Simulate raw `keydown` events (`F2`, `F8`, `F12`) to prove cashiers can navigate, toggle tax states, and trigger checkouts without a mouse.
  * **Domain-Specific UI:** Verify that the `OnboardingWizard` correctly mounts, and that `TextileBillingCounter` shows "Color/Size" while `AgriBillingCounter` shows "Bags/Grade".
  * **State Resilience:** Ensure the UI correctly displays stock warnings (e.g., "Only 3 left in stock!") when the backend flags low inventory.

### 3. End-to-End (E2E) Desktop Validation
* **Framework:** `Playwright` (Configured for Electron)
* **Execution:** Boots the compiled `.exe` application.
* **Core Responsibilities:**
  * **IPC Bridge:** Verify that when the React UI dispatches a `print-receipt` event, the Electron Main Process (`main.js`) successfully intercepts it and generates the off-screen `BrowserWindow`.
  * **Hardware Emulation:** Mock printer outputs to guarantee zero-margin thermal receipts format correctly before physical paper is wasted.

---

## 🚀 Execution Philosophy
*"Speed is a feature."* 
By keeping the Database layer directly bound via `better-sqlite3` and testing entirely in-memory, our backend suite executes in **~600ms**. This ensures developers at Charnithi Software Crafts receive instant feedback on their architectural decisions without waiting for bloated CI pipelines.
