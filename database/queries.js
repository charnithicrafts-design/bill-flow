/**
 * Database query library for Bill Flow by CN-SC.
 * Provides better-sqlite3 prepared statements for the application.
 */

function loadCoreQueries(db) {
  return {
    getProductById: db.prepare('SELECT * FROM products WHERE id = ? AND is_active = 1'),
    searchProducts: db.prepare('SELECT * FROM products WHERE is_active = 1 AND name LIKE ? LIMIT 20'),
    getNextInvoiceNumber: db.prepare('SELECT COALESCE(MAX(invoice_number), 0) + 1 AS next_number FROM invoices'),
    insertInvoice: db.prepare('INSERT INTO invoices (id, invoice_number, customer_name, customer_phone, customer_gstin, is_igst, subtotal, tax_total, discount_amount, grand_total, payment_method, counter_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'),
    upsertDraft: db.prepare(`INSERT INTO draft_bills (counter_id, bill_data, updated_at) VALUES (?, ?, datetime('now')) ON CONFLICT(counter_id) DO UPDATE SET bill_data = excluded.bill_data, updated_at = datetime('now')`),
    getDraft: db.prepare('SELECT bill_data FROM draft_bills WHERE counter_id = ?'),
    deleteDraft: db.prepare('DELETE FROM draft_bills WHERE counter_id = ?'),
    getTableCount: db.prepare('SELECT (SELECT COUNT(*) FROM products) AS products, (SELECT COUNT(*) FROM product_skus) AS skus, (SELECT COUNT(*) FROM invoices) AS invoices'),
    // Core stock aggregation (shared)
    aggregateProductStock: db.prepare('SELECT p.id, p.name, p.hsn_code, COUNT(s.id) AS total_variations, SUM(s.stock_quantity) AS total_stock, MIN(s.unit_price) AS min_price, MAX(s.unit_price) AS max_price FROM products p LEFT JOIN product_skus s ON s.product_id = p.id WHERE p.id = ? GROUP BY p.id'),
    getStockBySku: db.prepare('SELECT id, sku_code, stock_quantity FROM product_skus WHERE id = ? AND is_active = 1'),
    deductStock: db.prepare(`UPDATE product_skus SET stock_quantity = stock_quantity - ?, updated_at = datetime('now') WHERE id = ? AND stock_quantity >= ?`),
  };
}

function loadTextileQueries(db) {
  return {
    getSkuByCode: db.prepare('SELECT s.*, p.name AS product_name, p.hsn_code, p.cgst_rate, p.sgst_rate, p.igst_rate FROM product_skus s JOIN products p ON p.id = s.product_id WHERE s.sku_code = ? AND s.is_active = 1'),
    getSkusByProductId: db.prepare('SELECT * FROM product_skus WHERE product_id = ? AND is_active = 1 ORDER BY color, size_label'),
    insertInvoiceItem: db.prepare('INSERT INTO invoice_items (invoice_id, sku_id, sku_code, product_name, color, size_label, hsn_code, quantity, unit_price, tax_rate, tax_amount, line_total) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'),
  };
}

function loadGeneralQueries(db) {
  return {
    getSkuByCode: db.prepare('SELECT s.*, p.name AS product_name, p.hsn_code, p.cgst_rate, p.sgst_rate, p.igst_rate FROM product_skus s JOIN products p ON p.id = s.product_id WHERE s.sku_code = ? AND s.is_active = 1'),
    getSkusByProductId: db.prepare('SELECT * FROM product_skus WHERE product_id = ? AND is_active = 1'),
    insertInvoiceItem: db.prepare('INSERT INTO invoice_items (invoice_id, sku_id, sku_code, product_name, hsn_code, quantity, unit_price, tax_rate, tax_amount, line_total) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'),
  };
}

function loadAgriQueries(db) {
  return {
    getSkuByCode: db.prepare('SELECT s.*, p.name AS product_name, p.hsn_code, p.cgst_rate, p.sgst_rate, p.igst_rate FROM product_skus s JOIN products p ON p.id = s.product_id WHERE s.sku_code = ? AND s.is_active = 1'),
    getSkusByProductId: db.prepare('SELECT * FROM product_skus WHERE product_id = ? AND is_active = 1 ORDER BY grade'),
    insertInvoiceItem: db.prepare('INSERT INTO invoice_items (invoice_id, sku_id, sku_code, product_name, grade, hsn_code, bags, total_weight_kg, unit_price_per_kg, mandi_cess_amount, tax_rate, tax_amount, line_total) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'),
  };
}

/**
 * Initializes and returns the prepared SQL queries for the application based on the active domain.
 */
module.exports = function initializeQueries(db, domain) {
  const coreQueries = loadCoreQueries(db);
  let domainQueries = {};
  
  if (domain === 'TEXTILE') {
    domainQueries = loadTextileQueries(db);
  } else if (domain === 'GENERAL') {
    domainQueries = loadGeneralQueries(db);
  } else if (domain === 'AGRI') {
    domainQueries = loadAgriQueries(db);
  }
  
  return { ...coreQueries, ...domainQueries };
};
