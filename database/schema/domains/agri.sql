-- AGRI/MANDI DOMAIN SCHEMA
-- Produce variations (Bag sizes, Origin, Grade)
CREATE TABLE IF NOT EXISTS product_skus (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    sku_code TEXT NOT NULL UNIQUE,
    grade TEXT NOT NULL,
    bag_weight_kg REAL NOT NULL,
    origin_farmer TEXT,
    unit_price REAL NOT NULL,
    stock_quantity INTEGER NOT NULL DEFAULT 0,
    reorder_level INTEGER NOT NULL DEFAULT 5,
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- Invoice items table (mandi specific with weights)
CREATE TABLE IF NOT EXISTS invoice_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_id TEXT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    sku_id INTEGER NOT NULL REFERENCES product_skus(id),
    sku_code TEXT NOT NULL,
    product_name TEXT NOT NULL,
    grade TEXT,
    hsn_code TEXT NOT NULL,
    bags INTEGER NOT NULL,
    total_weight_kg REAL NOT NULL,
    unit_price_per_kg REAL NOT NULL,
    mandi_cess_amount REAL NOT NULL DEFAULT 0,
    tax_rate REAL NOT NULL,
    tax_amount REAL NOT NULL,
    line_total REAL NOT NULL
);

-- Farmer / Commission Accounts
CREATE TABLE IF NOT EXISTS commission_agents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    phone TEXT,
    commission_rate REAL NOT NULL DEFAULT 2.0,
    balance REAL NOT NULL DEFAULT 0
);

-- Indices
CREATE INDEX IF NOT EXISTS idx_skus_product_id ON product_skus(product_id);
CREATE INDEX IF NOT EXISTS idx_skus_sku_code ON product_skus(sku_code);
CREATE INDEX IF NOT EXISTS idx_skus_stock ON product_skus(product_id, stock_quantity);
CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice ON invoice_items(invoice_id);
