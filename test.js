const path = require('path');
const { startServer } = require('./server');

async function runTests() {
  const dbPath = path.join(__dirname, 'billflow.db');
  console.log('Starting server with DB at', dbPath);
  const { server, db } = startServer(dbPath);

  // Wait a moment for server to bind
  await new Promise(r => setTimeout(r, 500));

  try {
    console.log('\n--- 1. Testing SKU Lookup ---');
    const lookupRes = await fetch('http://localhost:8080/api/sku/lookup/KSS47-MRN-65');
    const skuData = await lookupRes.json();
    console.log('Lookup Result:', skuData);

    console.log('\n--- 2. Testing Checkout (Success) ---');
    const checkoutPayload = {
      items: [{ sku_id: skuData.id, quantity: 2 }],
      customer_name: 'Test Customer',
      customer_phone: '1234567890',
      payment_method: 'CASH',
      is_igst: false
    };
    
    const checkoutRes = await fetch('http://localhost:8080/api/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(checkoutPayload)
    });
    const checkoutResult = await checkoutRes.json();
    console.log('Checkout Result:', checkoutResult);

    console.log('\n--- 3. Verifying Stock Deduction ---');
    const stockRes = await fetch(`http://localhost:8080/api/stock/${skuData.id}`);
    const stockData = await stockRes.json();
    console.log(`Original Stock: ${skuData.stock_quantity}, New Stock: ${stockData.stock_quantity}`);

    console.log('\n--- 4. Testing Checkout (Insufficient Stock) ---');
    const failPayload = {
      items: [{ sku_id: skuData.id, quantity: 1000 }],
      customer_name: 'Fail Customer',
      payment_method: 'CASH',
      is_igst: false
    };
    
    const failRes = await fetch('http://localhost:8080/api/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(failPayload)
    });
    console.log('Insufficient Stock Status:', failRes.status);
    const failResult = await failRes.json();
    console.log('Insufficient Stock Result:', failResult);

  } catch (err) {
    console.error('Test failed:', err);
  } finally {
    server.close();
    db.close();
    console.log('\nServer and DB closed. Tests finished.');
  }
}

runTests();
