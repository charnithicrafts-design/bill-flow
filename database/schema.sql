-- Enable WAL mode
PRAGMA journal_mode=WAL;
PRAGMA busy_timeout=5000;
PRAGMA synchronous=NORMAL;
PRAGMA foreign_keys=ON;

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

-- Product SKUs table (variations)
CREATE TABLE IF NOT EXISTS product_skus (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    sku_code TEXT NOT NULL UNIQUE,
    color TEXT NOT NULL,
    size_label TEXT NOT NULL,
    unit_price REAL NOT NULL,
    stock_quantity INTEGER NOT NULL DEFAULT 0,
    reorder_level INTEGER NOT NULL DEFAULT 5,
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

-- Invoice items table
CREATE TABLE IF NOT EXISTS invoice_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_id TEXT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    sku_id INTEGER NOT NULL REFERENCES product_skus(id),
    sku_code TEXT NOT NULL,
    product_name TEXT NOT NULL,
    color TEXT,
    size_label TEXT,
    hsn_code TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    unit_price REAL NOT NULL,
    tax_rate REAL NOT NULL,
    tax_amount REAL NOT NULL,
    line_total REAL NOT NULL
);

-- Draft bills table
CREATE TABLE IF NOT EXISTS draft_bills (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    counter_id TEXT NOT NULL UNIQUE,
    bill_data TEXT NOT NULL,
    updated_at TEXT DEFAULT (datetime('now'))
);

-- Indices
CREATE INDEX IF NOT EXISTS idx_skus_product_id ON product_skus(product_id);
CREATE INDEX IF NOT EXISTS idx_skus_sku_code ON product_skus(sku_code);
CREATE INDEX IF NOT EXISTS idx_skus_stock ON product_skus(product_id, stock_quantity);
CREATE INDEX IF NOT EXISTS idx_products_hsn ON products(hsn_code);
CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);
CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice ON invoice_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoices_date ON invoices(created_at);
CREATE INDEX IF NOT EXISTS idx_invoices_number ON invoices(invoice_number);
CREATE INDEX IF NOT EXISTS idx_draft_counter ON draft_bills(counter_id);
