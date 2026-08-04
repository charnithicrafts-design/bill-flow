-- Enable WAL mode and Defensive Pragmas
PRAGMA journal_mode=WAL;
PRAGMA busy_timeout=5000;
PRAGMA synchronous=NORMAL;
PRAGMA foreign_keys=ON;

-- Application Configuration (SCM)
CREATE TABLE IF NOT EXISTS app_config (
    config_key TEXT PRIMARY KEY,
    config_value TEXT NOT NULL
);

-- Products table (parent product)
CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    hsn_code TEXT NOT NULL,
    category TEXT DEFAULT 'General',
    base_price REAL NOT NULL,
    cgst_rate REAL NOT NULL DEFAULT 9.0,
    sgst_rate REAL NOT NULL DEFAULT 9.0,
    igst_rate REAL NOT NULL DEFAULT 18.0,
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- Invoices table
CREATE TABLE IF NOT EXISTS invoices (
    id TEXT PRIMARY KEY,
    invoice_number INTEGER NOT NULL,
    customer_name TEXT DEFAULT 'Walk-in Customer',
    customer_phone TEXT,
    customer_gstin TEXT,
    is_igst INTEGER DEFAULT 0,
    subtotal REAL NOT NULL DEFAULT 0,
    tax_total REAL NOT NULL DEFAULT 0,
    discount_amount REAL NOT NULL DEFAULT 0,
    grand_total REAL NOT NULL DEFAULT 0,
    payment_method TEXT DEFAULT 'CASH' CHECK(payment_method IN ('CASH','UPI','CARD','CREDIT')),
    counter_id TEXT DEFAULT 'COUNTER-1',
    created_at TEXT DEFAULT (datetime('now'))
);

-- Draft bills table
CREATE TABLE IF NOT EXISTS draft_bills (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    counter_id TEXT NOT NULL UNIQUE,
    bill_data TEXT NOT NULL,
    updated_at TEXT DEFAULT (datetime('now'))
);

-- Shared Indices
CREATE INDEX IF NOT EXISTS idx_products_hsn ON products(hsn_code);
CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);
CREATE INDEX IF NOT EXISTS idx_invoices_date ON invoices(created_at);
CREATE INDEX IF NOT EXISTS idx_invoices_number ON invoices(invoice_number);
CREATE INDEX IF NOT EXISTS idx_draft_counter ON draft_bills(counter_id);
