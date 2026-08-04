/**
 * Bill Flow by CN-SC
 * Express.js LAN Sync Server & Transaction Engine
 *
 * Runs inside the Electron main process on 0.0.0.0:8080.
 * Manages an embedded SQLite database in WAL mode with
 * BEGIN IMMEDIATE transactions for multi-counter race condition safety.
 */
const express = require('express');
const cors = require('cors');
const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');
const initializeQueries = require('./database/queries');

/**
 * Starts the Express server and initializes the SQLite database.
 * @param {string} dbPath - Absolute path to the SQLite database file
 * @returns {{ app: express.Application, server: import('http').Server, db: import('better-sqlite3').Database }}
 */
function startServer(dbPath) {
  const app = express();
  const PORT = 8080;

  // ---------------------------------------------------------------------------
  // 1. Initialize SQLite with WAL mode and defensive pragmas
  // ---------------------------------------------------------------------------
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('busy_timeout = 5000');
  db.pragma('synchronous = NORMAL');
  db.pragma('foreign_keys = ON');

  // ---------------------------------------------------------------------------
  // 2. Load DDL schema (idempotent — uses IF NOT EXISTS)
  // ---------------------------------------------------------------------------
  try {
    const schemaPath = path.join(__dirname, 'database', 'schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    db.exec(schemaSql);
    console.log('[DB] Schema loaded successfully');
  } catch (err) {
    console.error('[DB] Failed to load schema.sql:', err.message);
  }

  // ---------------------------------------------------------------------------
  // 3. Seed data if tables are empty
  // ---------------------------------------------------------------------------
  try {
    const count = db.prepare('SELECT COUNT(*) AS count FROM products').get();
    if (count && count.count === 0) {
      const seedPath = path.join(__dirname, 'database', 'seed.sql');
      const seedSql = fs.readFileSync(seedPath, 'utf8');
      db.exec(seedSql);
      console.log('[DB] Seed data inserted');
    }
  } catch (err) {
    console.warn('[DB] Seed skipped:', err.message);
  }

  // ---------------------------------------------------------------------------
  // 4. Initialize prepared statements via the query library
  // ---------------------------------------------------------------------------
  const q = initializeQueries(db);

  // ---------------------------------------------------------------------------
  // 5. Middleware
  // ---------------------------------------------------------------------------
  app.use(cors());
  app.use(express.json());

  // Request logging
  app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      const ms = Date.now() - start;
      console.log(`[${req.method}] ${req.url} — ${res.statusCode} (${ms}ms)`);
    });
    next();
  });

  // ---------------------------------------------------------------------------
  // 6. Routes
  // ---------------------------------------------------------------------------

  /**
   * GET /api/health — Server liveness check for LAN discovery
   */
  app.get('/api/health', (_req, res) => {
    try {
      const counts = q.getTableCount.get();
      res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        tables: counts,
      });
    } catch (err) {
      res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message });
    }
  });

  /**
   * GET /api/products — List/search parent products
   * Query: ?q=search_term
   */
  app.get('/api/products', (req, res) => {
    try {
      const searchTerm = req.query.q || '';
      const products = q.searchProducts.all(`%${searchTerm}%`);

      // Attach stock aggregation to each product
      const enriched = products.map((p) => {
        const agg = q.aggregateProductStock.get(p.id);
        return {
          ...p,
          total_variations: agg ? agg.total_variations : 0,
          total_stock: agg ? agg.total_stock : 0,
          min_price: agg ? agg.min_price : p.base_price,
          max_price: agg ? agg.max_price : p.base_price,
        };
      });

      res.json(enriched);
    } catch (err) {
      res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message });
    }
  });

  /**
   * GET /api/products/:id/skus — Get all SKU variations for a parent product
   */
  app.get('/api/products/:id/skus', (req, res) => {
    try {
      const skus = q.getSkusByProductId.all(req.params.id);
      res.json(skus);
    } catch (err) {
      res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message });
    }
  });

  /**
   * GET /api/stock/:skuId — Real-time stock check for a single SKU by database ID
   */
  app.get('/api/stock/:skuId', (req, res) => {
    try {
      const row = q.getStockBySku.get(req.params.skuId);
      if (!row) return res.status(404).json({ error: 'SKU_NOT_FOUND' });
      res.json({
        sku_id: row.id,
        sku_code: row.sku_code,
        stock_quantity: row.stock_quantity,
      });
    } catch (err) {
      res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message });
    }
  });

  /**
   * GET /api/sku/lookup/:code — Look up a SKU by barcode/sku_code
   * Returns full SKU data with parent product info (name, HSN, tax rates)
   */
  app.get('/api/sku/lookup/:code', (req, res) => {
    try {
      const row = q.getSkuByCode.get(req.params.code);
      if (!row) return res.status(404).json({ error: 'SKU_NOT_FOUND' });
      res.json(row);
    } catch (err) {
      res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message });
    }
  });

  // ---------------------------------------------------------------------------
  // 7. Atomic Checkout Transaction
  //
  // Uses db.transaction() which wraps the callback in BEGIN/COMMIT/ROLLBACK.
  // We invoke it via .immediate() to acquire a RESERVED lock at transaction
  // start (not at first write), preventing multi-counter write races.
  //
  // If Counter 2 tries to start while Counter 1 holds the write lock,
  // better-sqlite3 throws SQLITE_BUSY → we return HTTP 409.
  // ---------------------------------------------------------------------------

  const performCheckout = db.transaction((data) => {
    // 1. Generate invoice ID: INV-YYYYMMDD-NNNN
    const nextNumRow = q.getNextInvoiceNumber.get();
    const invoiceNumber = nextNumRow.next_number;
    const today = new Date().toISOString().split('T')[0].replace(/-/g, '');
    const invoiceId = `INV-${today}-${String(invoiceNumber).padStart(4, '0')}`;

    let subtotal = 0;
    let taxTotal = 0;
    const processedItems = [];

    // 2. Process each line item
    for (const item of data.items) {
      // a. Fetch current stock
      const stockRow = q.getStockBySku.get(item.sku_id);

      // b. SKU existence check
      if (!stockRow) {
        throw { code: 'SKU_NOT_FOUND', sku_id: item.sku_id };
      }

      // c. Stock sufficiency check
      if (stockRow.stock_quantity < item.quantity) {
        throw {
          code: 'INSUFFICIENT_STOCK',
          sku_id: item.sku_id,
          requested: item.quantity,
          available: stockRow.stock_quantity,
        };
      }

      // d. Atomic stock deduction (WHERE stock_quantity >= ? is the final safety net)
      const deduction = q.deductStock.run(item.quantity, item.sku_id, item.quantity);

      // e. Concurrent deduction guard — if changes === 0, someone else took the stock
      if (deduction.changes === 0) {
        throw {
          code: 'INSUFFICIENT_STOCK',
          sku_id: item.sku_id,
          requested: item.quantity,
          available: stockRow.stock_quantity,
        };
      }

      // f. Fetch full SKU details for the invoice line item
      const skuDetails = q.getSkuByCode.get(stockRow.sku_code);

      // g. Calculate tax based on IGST vs CGST+SGST
      const taxRate = data.is_igst
        ? (skuDetails.igst_rate || 0)
        : ((skuDetails.cgst_rate || 0) + (skuDetails.sgst_rate || 0));

      const lineSubtotal = skuDetails.unit_price * item.quantity;
      const taxAmount = (lineSubtotal * taxRate) / 100;

      // h. Calculate line total
      const lineTotal = lineSubtotal + taxAmount;

      processedItems.push({
        sku_id: item.sku_id,
        sku_code: skuDetails.sku_code,
        product_name: skuDetails.product_name,
        color: skuDetails.color || '',
        size_label: skuDetails.size_label || '',
        hsn_code: skuDetails.hsn_code,
        quantity: item.quantity,
        unit_price: skuDetails.unit_price,
        tax_rate: taxRate,
        tax_amount: taxAmount,
        line_total: lineTotal
      });

      subtotal += lineSubtotal;
      taxTotal += taxAmount;
    }

    // 3. Calculate totals
    const discountAmount = data.discount_amount || 0;
    const grandTotal = subtotal + taxTotal - discountAmount;

    // 4. Insert invoice record
    q.insertInvoice.run(
      invoiceId,
      invoiceNumber,
      data.customer_name || 'Walk-in Customer',
      data.customer_phone || '',
      data.customer_gstin || '',
      data.is_igst ? 1 : 0,
      subtotal,
      taxTotal,
      discountAmount,
      grandTotal,
      data.payment_method || 'CASH',
      data.counter_id || 'COUNTER-1'
    );

    // 5. Insert invoice line items
    for (const pItem of processedItems) {
      q.insertInvoiceItem.run(
        invoiceId,
        pItem.sku_id,
        pItem.sku_code,
        pItem.product_name,
        pItem.color,
        pItem.size_label,
        pItem.hsn_code,
        pItem.quantity,
        pItem.unit_price,
        pItem.tax_rate,
        pItem.tax_amount,
        pItem.line_total
      );
    }

    // 6. Delete draft bill for this counter
    if (data.counter_id) {
      q.deleteDraft.run(data.counter_id);
    }

    // 7. Return response payload
    return {
      invoice_id: invoiceId,
      invoice_number: invoiceNumber,
      grand_total: grandTotal,
      items_count: data.items.length,
    };
  });

  /**
   * POST /api/checkout — Atomic bill checkout with stock deduction
   */
  app.post('/api/checkout', (req, res) => {
    const { items } = req.body;

    // Input validation
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        error: 'INVALID_REQUEST',
        message: 'No items provided',
      });
    }

    try {
      // Execute with BEGIN IMMEDIATE — acquires write lock at transaction start
      const result = performCheckout.immediate(req.body);
      res.json({ success: true, ...result });
    } catch (err) {
      // SQLITE_BUSY: another counter holds the write lock
      if (err.code === 'SQLITE_BUSY') {
        return res.status(409).json({
          error: 'TRANSACTION_CONFLICT',
          message: 'Another counter is processing. Please retry.',
        });
      }

      // Insufficient stock (detected at check or at deduction)
      if (err.code === 'INSUFFICIENT_STOCK') {
        return res.status(409).json({
          error: 'INSUFFICIENT_STOCK',
          detail: {
            sku_id: err.sku_id,
            requested: err.requested,
            available: err.available,
          },
        });
      }

      // SKU not found
      if (err.code === 'SKU_NOT_FOUND') {
        return res.status(404).json({
          error: 'SKU_NOT_FOUND',
          sku_id: err.sku_id,
        });
      }

      // Unexpected error
      console.error('[CHECKOUT] Unexpected error:', err);
      return res.status(500).json({ error: 'INTERNAL_ERROR' });
    }
  });

  /**
   * POST /api/draft — Save draft bill state for crash recovery
   */
  app.post('/api/draft', (req, res) => {
    const { counter_id, bill_data } = req.body;
    if (!counter_id || bill_data === undefined) {
      return res.status(400).json({ error: 'INVALID_REQUEST' });
    }
    try {
      q.upsertDraft.run(counter_id, JSON.stringify(bill_data));
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message });
    }
  });

  /**
   * GET /api/draft/:counterId — Retrieve saved draft for a counter
   */
  app.get('/api/draft/:counterId', (req, res) => {
    try {
      const row = q.getDraft.get(req.params.counterId);
      if (!row) return res.json({ draft: null });
      res.json({ draft: JSON.parse(row.bill_data) });
    } catch (err) {
      res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message });
    }
  });

  // ---------------------------------------------------------------------------
  // 8. Start the HTTP server
  // ---------------------------------------------------------------------------
  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Bill Flow] Server listening on http://0.0.0.0:${PORT}`);
  });

  return { app, server, db };
}

module.exports = { startServer };
