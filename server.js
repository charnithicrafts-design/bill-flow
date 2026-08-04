const express = require('express');
const cors = require('cors');
const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');
const initializeQueries = require('./database/queries');

function startServer(dbPath) {
  const app = express();
  const PORT = 8080;

  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('busy_timeout = 5000');
  db.pragma('synchronous = NORMAL');
  db.pragma('foreign_keys = ON');

  // Load core schema first
  try {
    const coreSchema = fs.readFileSync(path.join(__dirname, 'database', 'schema', 'core.sql'), 'utf8');
    db.exec(coreSchema);
    console.log('[DB] Core schema loaded');
  } catch (err) {
    console.error('[DB] Failed to load core.sql:', err.message);
  }

  // Check for active domain
  let activeDomain = null;
  let q = null;
  let performCheckout = null;

  try {
    const configRow = db.prepare("SELECT config_value FROM app_config WHERE config_key = 'ACTIVE_DOMAIN'").get();
    if (configRow) {
      activeDomain = configRow.config_value;
      console.log(`[DB] Active Domain found: ${activeDomain}`);
      initializeDomain(activeDomain);
    }
  } catch (err) {
    console.warn('[DB] Config table query failed (first run):', err.message);
  }

  function initializeDomain(domain) {
    activeDomain = domain;
    
    // Load domain schema
    try {
      const domainSchema = fs.readFileSync(path.join(__dirname, 'database', 'schema', 'domains', `${domain.toLowerCase()}.sql`), 'utf8');
      db.exec(domainSchema);
      console.log(`[DB] ${domain} schema loaded`);
      
      // Load seed data if empty
      const count = db.prepare('SELECT COUNT(*) AS count FROM products').get();
      if (count && count.count === 0) {
        const seedPath = path.join(__dirname, 'database', 'seed', 'domains', `${domain.toLowerCase()}.sql`);
        if (fs.existsSync(seedPath)) {
          const seedSql = fs.readFileSync(seedPath, 'utf8');
          db.exec(seedSql);
          console.log(`[DB] ${domain} seed data inserted`);
        }
      }
    } catch (err) {
      console.error(`[DB] Failed to initialize ${domain}:`, err.message);
    }

    // Initialize queries
    q = initializeQueries(db, domain);
    
    // Setup checkout transaction logic based on domain
    performCheckout = db.transaction((data) => {
      const nextNumRow = q.getNextInvoiceNumber.get();
      const invoiceNumber = nextNumRow.next_number;
      const today = new Date().toISOString().split('T')[0].replace(/-/g, '');
      const invoiceId = `INV-${today}-${String(invoiceNumber).padStart(4, '0')}`;

      let subtotal = 0;
      let taxTotal = 0;
      const processedItems = [];

      for (const item of data.items) {
        const stockRow = q.getStockBySku.get(item.sku_id);
        if (!stockRow) throw { code: 'SKU_NOT_FOUND', sku_id: item.sku_id };
        if (stockRow.stock_quantity < item.quantity) {
          throw { code: 'INSUFFICIENT_STOCK', sku_id: item.sku_id, requested: item.quantity, available: stockRow.stock_quantity };
        }

        const deduction = q.deductStock.run(item.quantity, item.sku_id, item.quantity);
        if (deduction.changes === 0) {
          throw { code: 'INSUFFICIENT_STOCK', sku_id: item.sku_id, requested: item.quantity, available: stockRow.stock_quantity };
        }

        const skuDetails = q.getSkuByCode.get(stockRow.sku_code);
        const taxRate = data.is_igst ? (skuDetails.igst_rate || 0) : ((skuDetails.cgst_rate || 0) + (skuDetails.sgst_rate || 0));

        let lineSubtotal = 0;
        let taxAmount = 0;
        let lineTotal = 0;

        if (domain === 'TEXTILE' || domain === 'GENERAL') {
          lineSubtotal = skuDetails.unit_price * item.quantity;
          taxAmount = (lineSubtotal * taxRate) / 100;
          lineTotal = lineSubtotal + taxAmount;
          
          processedItems.push({
            domain,
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
        } else if (domain === 'AGRI') {
           // Agri specific calculations
           lineSubtotal = skuDetails.unit_price * item.total_weight_kg; // unit price is per kg here
           const mandiCess = lineSubtotal * 0.01; // 1% mandi cess example
           taxAmount = ((lineSubtotal + mandiCess) * taxRate) / 100;
           lineTotal = lineSubtotal + mandiCess + taxAmount;
           
           processedItems.push({
             domain,
             sku_id: item.sku_id,
             sku_code: skuDetails.sku_code,
             product_name: skuDetails.product_name,
             grade: skuDetails.grade || '',
             hsn_code: skuDetails.hsn_code,
             bags: item.bags,
             total_weight_kg: item.total_weight_kg,
             unit_price_per_kg: skuDetails.unit_price,
             mandi_cess_amount: mandiCess,
             tax_rate: taxRate,
             tax_amount: taxAmount,
             line_total: lineTotal
           });
        }

        subtotal += lineSubtotal;
        taxTotal += taxAmount;
      }

      const discountAmount = data.discount_amount || 0;
      const grandTotal = subtotal + taxTotal - discountAmount;

      q.insertInvoice.run(
        invoiceId, invoiceNumber, data.customer_name || 'Walk-in Customer', data.customer_phone || '',
        data.customer_gstin || '', data.is_igst ? 1 : 0, subtotal, taxTotal, discountAmount, grandTotal,
        data.payment_method || 'CASH', data.counter_id || 'COUNTER-1'
      );

      for (const p of processedItems) {
        if (p.domain === 'TEXTILE') {
          q.insertInvoiceItem.run(invoiceId, p.sku_id, p.sku_code, p.product_name, p.color, p.size_label, p.hsn_code, p.quantity, p.unit_price, p.tax_rate, p.tax_amount, p.line_total);
        } else if (p.domain === 'GENERAL') {
          q.insertInvoiceItem.run(invoiceId, p.sku_id, p.sku_code, p.product_name, p.hsn_code, p.quantity, p.unit_price, p.tax_rate, p.tax_amount, p.line_total);
        } else if (p.domain === 'AGRI') {
          q.insertInvoiceItem.run(invoiceId, p.sku_id, p.sku_code, p.product_name, p.grade, p.hsn_code, p.bags, p.total_weight_kg, p.unit_price_per_kg, p.mandi_cess_amount, p.tax_rate, p.tax_amount, p.line_total);
        }
      }

      if (data.counter_id) {
        q.deleteDraft.run(data.counter_id);
      }

      return { invoice_id: invoiceId, invoice_number: invoiceNumber, grand_total: grandTotal, items_count: data.items.length };
    });
  }

  app.use(cors());
  app.use(express.json());

  app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => console.log(`[${req.method}] ${req.url} — ${res.statusCode} (${Date.now() - start}ms)`));
    next();
  });

  // Setup route (SCM)
  app.post('/api/setup', (req, res) => {
    const { domain } = req.body;
    if (activeDomain) return res.status(400).json({ error: 'ALREADY_CONFIGURED' });
    if (!['TEXTILE', 'GENERAL', 'AGRI'].includes(domain)) return res.status(400).json({ error: 'INVALID_DOMAIN' });
    
    try {
      db.prepare("INSERT INTO app_config (config_key, config_value) VALUES ('ACTIVE_DOMAIN', ?)").run(domain);
      initializeDomain(domain);
      res.json({ success: true, domain });
    } catch (err) {
      res.status(500).json({ error: 'SETUP_FAILED', message: err.message });
    }
  });

  app.get('/api/config', (req, res) => {
    res.json({ configured: !!activeDomain, activeDomain });
  });

  // Protect all routes below if not configured
  app.use((req, res, next) => {
    if (!activeDomain) return res.status(403).json({ error: 'NOT_CONFIGURED' });
    next();
  });

  app.get('/api/health', (req, res) => res.json({ status: 'ok', domain: activeDomain }));
  
  app.get('/api/products', (req, res) => {
    try {
      const products = q.searchProducts.all(`%${req.query.q || ''}%`);
      const enriched = products.map((p) => {
        const agg = q.aggregateProductStock.get(p.id);
        return { ...p, total_variations: agg ? agg.total_variations : 0, total_stock: agg ? agg.total_stock : 0 };
      });
      res.json(enriched);
    } catch (err) { res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message }); }
  });

  app.get('/api/products/:id/skus', (req, res) => res.json(q.getSkusByProductId.all(req.params.id)));
  
  app.get('/api/stock/:skuId', (req, res) => {
    const row = q.getStockBySku.get(req.params.skuId);
    row ? res.json(row) : res.status(404).json({ error: 'SKU_NOT_FOUND' });
  });

  app.get('/api/sku/lookup/:code', (req, res) => {
    const row = q.getSkuByCode.get(req.params.code);
    row ? res.json(row) : res.status(404).json({ error: 'SKU_NOT_FOUND' });
  });

  app.post('/api/checkout', (req, res) => {
    if (!req.body.items || !req.body.items.length) return res.status(400).json({ error: 'INVALID_REQUEST' });
    try {
      res.json({ success: true, ...performCheckout.immediate(req.body) });
    } catch (err) {
      if (err.code === 'SQLITE_BUSY') return res.status(409).json({ error: 'TRANSACTION_CONFLICT' });
      if (err.code === 'INSUFFICIENT_STOCK') return res.status(409).json({ error: 'INSUFFICIENT_STOCK', detail: err });
      if (err.code === 'SKU_NOT_FOUND') return res.status(404).json({ error: 'SKU_NOT_FOUND', sku_id: err.sku_id });
      res.status(500).json({ error: 'INTERNAL_ERROR' });
    }
  });

  app.post('/api/draft', (req, res) => {
    q.upsertDraft.run(req.body.counter_id, JSON.stringify(req.body.bill_data));
    res.json({ success: true });
  });

  app.get('/api/draft/:counterId', (req, res) => {
    const row = q.getDraft.get(req.params.counterId);
    res.json({ draft: row ? JSON.parse(row.bill_data) : null });
  });

  const server = app.listen(PORT, '0.0.0.0', () => console.log(`[Bill Flow] Server listening on http://0.0.0.0:${PORT}`));
  return { app, server, db };
}

module.exports = { startServer };
