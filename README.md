# Bill Flow by CN-SC

**Bill Flow** is a high-velocity, strictly offline-first, multi-device Billing & Inventory Desktop Suite tailored explicitly for the workflows of local Indian textile wholesalers. Engineered by **Charnithi Software Crafts (CN-SC)**, this application rejects high-volume, bloated frameworks in favor of precision, minimal resource consumption, and frictionless execution.

## 🏛️ Architectural Philosophy

Software engineering is a precise science. We do not compromise on latency or reliability, especially in high-traffic cash counter scenarios. 

- **Offline-First Resilience**: Entirely localized. No cloud dependencies during standard checkout flows.
- **Embedded Database Engine**: Powered by raw `better-sqlite3` running in high-concurrency Write-Ahead Logging (WAL) mode. This prevents `SQLITE_BUSY` deadlocks across multiple cash counters syncing on the same LAN.
- **Atomic Transactions**: All checkout writes are wrapped in `BEGIN IMMEDIATE` transaction blocks, guaranteeing zero race conditions when deducting inventory.
- **Keyboard-Driven UI**: Cashiers shouldn't need a mouse. Built with React and Tailwind CSS, the UI is optimized for F-key shortcuts (`F2` Lookup, `F8` Tax Toggle, `F12` Checkout).
- **Silent Thermal Printing**: Zero-margin, background rendering of receipts directly to 80mm thermal POS printers via Electron's off-screen `webContents`.

## 🛠️ Technology Stack

- **Runtime Engine**: Electron (Node.js & Chromium)
- **Frontend Core**: React 18, Vite, Tailwind CSS v3
- **Database**: SQLite3 (`better-sqlite3`)
- **Internal API Layer**: Express.js (running headless inside the Electron Main Process on `0.0.0.0:8080`)

## 🚀 Getting Started

### Prerequisites
- Node.js (v20+ recommended)
- A POS Thermal Printer (80mm) configured as the default system printer (for production use)

### Installation

Clone the repository and install dependencies. Because we rely on native C++ addons (`better-sqlite3`), ensure you have a standard build toolchain (like `build-essential` or Visual Studio Build Tools) installed on your system.

```bash
git clone https://github.com/charnithicrafts-design/bill-flow.git
cd bill-flow
npm install
```

### Development Mode

To run the application locally for active development:
1. Start the Vite development server to bundle the React UI:
   ```bash
   npm run build
   ```
2. Start the Electron wrapper:
   ```bash
   npm start
   ```

*(Note: While running in development mode, you can pass `NODE_ENV=development` to enable live hot-reloading from Vite).*

## 🗄️ Database Schema & Seed

Upon the very first launch, the `server.js` engine will automatically:
1. Instantiate `billflow.db` in the application directory.
2. Execute the strict DDL mapped in `database/schema.sql`.
3. Populate mock textile data (e.g., Kanchipuram Silk Sarees) from `database/seed.sql` for immediate testing.

## 🤝 Contribution Guidelines (CN-SC Standards)

Fellow craftsmen, adhere to the following when extending this suite:
1. **Zero ORMs**: Do not introduce Prisma, TypeORM, or Sequelize. We maintain absolute control over memory and synchronous blocking via raw prepared statements in `database/queries.js`.
2. **Atomicity First**: Any mutation involving `invoices` or `product_skus` must be wrapped in `db.transaction()` with `.immediate()` lock semantics.
3. **No Unnecessary State**: Keep the React component tree shallow. Leverage native DOM elements and CSS for visual feedback rather than expensive JS state recalculations.

---
*Crafted with precision by Charnithi Software Crafts.*
