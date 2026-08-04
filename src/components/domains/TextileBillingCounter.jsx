import React, { useState, useRef, useEffect } from 'react';

// Icons
const BarcodeIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 5v14"/><path d="M8 5v14"/><path d="M12 5v14"/><path d="M17 5v14"/><path d="M21 5v14"/></svg>
);
const TrashIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
);

const API_BASE = 'http://localhost:8080';

export default function BillingCounter() {
  const [skuInput, setSkuInput] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [lineItems, setLineItems] = useState([]);
  const [isIGST, setIsIGST] = useState(false);
  const [customerName, setCustomerName] = useState('Walk-in Customer');
  const [customerPhone, setCustomerPhone] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [stockWarning, setStockWarning] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastInvoice, setLastInvoice] = useState(null);
  const [pendingItem, setPendingItem] = useState(null);
  const [error, setError] = useState('');
  
  const skuInputRef = useRef(null);
  const quantityRef = useRef(null);
  
  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'F2') {
        e.preventDefault();
        skuInputRef.current?.focus();
      } else if (e.key === 'F8') {
        e.preventDefault();
        setIsIGST(prev => !prev);
      } else if (e.key === 'F12') {
        e.preventDefault();
        handleCheckout();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setSkuInput('');
        setQuantity(1);
        setStockWarning('');
        setPendingItem(null);
        skuInputRef.current?.focus();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lineItems, customerName, customerPhone, paymentMethod, isIGST]);

  // Sku Lookup
  const handleSkuSubmit = async (e) => {
    if (e.key === 'Enter' && skuInput.trim() !== '') {
      e.preventDefault();
      setError('');
      setStockWarning('');
      try {
        const res = await fetch(`${API_BASE}/api/sku/lookup/${encodeURIComponent(skuInput.trim())}`);
        if (!res.ok) throw new Error('SKU not found');
        const data = await res.json();
        
        setPendingItem(data);
        if (data.stock_quantity < 1) {
          setStockWarning(`Only ${data.stock_quantity} in stock!`);
        }
        quantityRef.current?.focus();
      } catch (err) {
        setError('SKU Not Found');
      }
    }
  };
  
  // Add item
  const handleQuantitySubmit = (e) => {
    if (e.key === 'Enter' && pendingItem) {
      e.preventDefault();
      
      const qty = parseInt(quantity) || 1;
      if (pendingItem.stock_quantity < qty) {
         setStockWarning(`Only ${pendingItem.stock_quantity} in stock!`);
      }
      
      let tax_rate = 0;
      let tax_amount = 0;
      
      if (isIGST) {
        tax_rate = pendingItem.igst_rate || 0;
        tax_amount = pendingItem.unit_price * qty * (tax_rate / 100);
      } else {
        tax_rate = (pendingItem.cgst_rate || 0) + (pendingItem.sgst_rate || 0);
        tax_amount = pendingItem.unit_price * qty * (tax_rate / 100);
      }
      
      const line_total = (pendingItem.unit_price * qty) + tax_amount;
      
      const newItem = {
        ...pendingItem,
        sku_id: pendingItem.id,
        _lineId: String(Date.now()) + String(Math.random()),
        quantity: qty,
        tax_rate,
        tax_amount,
        line_total
      };
      
      setLineItems(prev => [...prev, newItem]);
      
      // Reset
      setPendingItem(null);
      setSkuInput('');
      setQuantity(1);
      setStockWarning('');
      skuInputRef.current?.focus();
    }
  };

  const removeItem = (lineId) => {
    setLineItems(prev => prev.filter(item => item._lineId !== lineId));
  };

  const generateReceiptHTML = (invoiceData, items, totals) => {
    return `
      <div style="width: 302px; font-family: monospace; color: black; background: white; padding: 10px; box-sizing: border-box;">
        <div style="text-align: center; font-weight: bold; font-size: 16px; margin-bottom: 5px;">Bill Flow by CN-SC</div>
        <div style="text-align: center; font-size: 12px; margin-bottom: 10px;">Tax Invoice</div>
        
        <div style="font-size: 12px; margin-bottom: 5px;">Invoice No: ${invoiceData.invoice_number || 'INV-001'}</div>
        <div style="font-size: 12px; margin-bottom: 5px;">Date: ${new Date().toLocaleString()}</div>
        ${customerName !== 'Walk-in Customer' ? `<div style="font-size: 12px; margin-bottom: 10px;">Customer: ${customerName} ${customerPhone ? `(${customerPhone})` : ''}</div>` : '<div style="font-size: 12px; margin-bottom: 10px;">Customer: Walk-in</div>'}
        
        <div style="border-top: 1px dashed black; border-bottom: 1px dashed black; padding: 5px 0; margin-bottom: 10px;">
          <table style="width: 100%; font-size: 12px; border-collapse: collapse;">
            <tr style="text-align: left;">
              <th>Item</th>
              <th>Qty</th>
              <th>Price</th>
              <th style="text-align: right;">Amt</th>
            </tr>
            ${items.map(item => `
              <tr>
                <td style="padding-top: 5px;">${item.product_name}</td>
                <td style="padding-top: 5px;">${item.quantity}</td>
                <td style="padding-top: 5px;">${item.unit_price.toFixed(2)}</td>
                <td style="padding-top: 5px; text-align: right;">${(item.unit_price * item.quantity).toFixed(2)}</td>
              </tr>
            `).join('')}
          </table>
        </div>
        
        <div style="font-size: 12px; display: flex; justify-content: space-between; margin-bottom: 2px;">
          <span>Subtotal:</span>
          <span>${totals.subtotal.toFixed(2)}</span>
        </div>
        <div style="font-size: 12px; display: flex; justify-content: space-between; margin-bottom: 5px;">
          <span>Tax (${isIGST ? 'IGST' : 'CGST+SGST'}):</span>
          <span>${totals.tax.toFixed(2)}</span>
        </div>
        <div style="font-size: 14px; font-weight: bold; display: flex; justify-content: space-between; border-top: 1px solid black; padding-top: 5px; margin-bottom: 15px;">
          <span>GRAND TOTAL:</span>
          <span>${totals.total.toFixed(2)}</span>
        </div>
        
        <div style="text-align: center; font-size: 12px;">Thank you for your purchase!</div>
      </div>
    `;
  };

  const handleCheckout = async () => {
    if (lineItems.length === 0) return;
    
    setIsProcessing(true);
    setError('');
    
    try {
      const payload = {
        items: lineItems.map(item => ({ sku_id: item.sku_id, quantity: item.quantity })),
        customer_name: customerName,
        customer_phone: customerPhone,
        payment_method: paymentMethod,
        is_igst: isIGST
      };
      
      const res = await fetch(`${API_BASE}/api/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      if (!res.ok) {
        if (res.status === 409) {
          throw new Error('Conflict: Stock unavailable or transaction conflict');
        }
        throw new Error('Checkout failed');
      }
      
      const result = await res.json();
      
      const receiptHTML = generateReceiptHTML(result, lineItems, { subtotal, tax: totalTax, total: grandTotal });
      
      if (window.billflow && window.billflow.printReceipt) {
        window.billflow.printReceipt(receiptHTML);
      } else {
        console.log("Printing receipt...", receiptHTML);
        // Fallback for development
        const printWindow = window.open('', '', 'width=400,height=600');
        printWindow.document.write(receiptHTML);
        printWindow.document.close();
        printWindow.print();
      }
      
      setLastInvoice(result.invoice_number || 'INV-SUCCESS');
      setTimeout(() => setLastInvoice(null), 3000);
      
      // Reset State
      setLineItems([]);
      setCustomerName('Walk-in Customer');
      setCustomerPhone('');
      setPaymentMethod('CASH');
      setSkuInput('');
      setQuantity(1);
      
    } catch (err) {
      setError(err.message);
    } finally {
      setIsProcessing(false);
      skuInputRef.current?.focus();
    }
  };

  // Calculations
  const subtotal = lineItems.reduce((acc, item) => acc + (item.unit_price * item.quantity), 0);
  const totalTax = lineItems.reduce((acc, item) => acc + item.tax_amount, 0);
  const grandTotal = subtotal + totalTax;

  return (
    <div className="flex flex-col h-full bg-[#0A0A0F] text-white">
      {/* HEADER BAR */}
      <div className="bg-[#111118] border-b border-[#1E1E2A] p-2 flex gap-4 text-sm items-center shadow-sm shrink-0">
        <span className="text-gray-400 font-medium ml-2">Shortcuts:</span>
        <div className="flex gap-3">
          <span className="flex items-center gap-1.5"><kbd className="bg-gray-800 text-gray-300 px-2 py-0.5 rounded text-xs border border-gray-700 shadow-sm">F2</kbd> <span className="text-gray-500">Focus SKU</span></span>
          <span className="flex items-center gap-1.5"><kbd className="bg-gray-800 text-gray-300 px-2 py-0.5 rounded text-xs border border-gray-700 shadow-sm">F8</kbd> <span className="text-gray-500">Toggle Tax Mode</span></span>
          <span className="flex items-center gap-1.5"><kbd className="bg-amber-900/50 text-amber-500 px-2 py-0.5 rounded text-xs border border-amber-800/50 shadow-sm">F12</kbd> <span className="text-gray-500">Checkout</span></span>
          <span className="flex items-center gap-1.5"><kbd className="bg-gray-800 text-gray-300 px-2 py-0.5 rounded text-xs border border-gray-700 shadow-sm">Esc</kbd> <span className="text-gray-500">Clear Input</span></span>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* LEFT COLUMN: LINE ITEMS & INPUT */}
        <div className="flex-1 flex flex-col h-full border-r border-[#1E1E2A]">
          {/* LINE ITEMS TABLE */}
          <div className="flex-1 overflow-y-auto bg-[#0A0A0F]">
            <table className="w-full text-left border-collapse">
              <thead className="bg-[#111118] sticky top-0 z-10 shadow-sm">
                <tr className="text-xs uppercase tracking-wider text-gray-500 border-b border-[#1E1E2A]">
                  <th className="p-3 font-medium">SKU / Item</th>
                  <th className="p-3 font-medium text-center">Qty</th>
                  <th className="p-3 font-medium text-right">Price</th>
                  <th className="p-3 font-medium text-right">Tax</th>
                  <th className="p-3 font-medium text-right">Total</th>
                  <th className="p-3 w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/50">
                {lineItems.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="text-center py-12 text-gray-600">
                      <div className="flex flex-col items-center gap-2">
                        <BarcodeIcon />
                        <p>Scan or enter SKU to begin</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  lineItems.map((item, idx) => (
                    <tr key={item._lineId} className={`hover:bg-gray-900/40 transition-colors ${idx % 2 === 0 ? 'bg-transparent' : 'bg-[#111118]/30'}`}>
                      <td className="p-3">
                        <div className="font-medium text-gray-200">{item.product_name}</div>
                        <div className="text-xs text-gray-500 flex gap-2">
                          <span className="font-mono text-amber-500/70">{item.sku_code}</span>
                          {item.color && <span>• {item.color}</span>}
                          {item.size_label && <span>• {item.size_label}</span>}
                        </div>
                      </td>
                      <td className="p-3 text-center font-medium">{item.quantity}</td>
                      <td className="p-3 text-right text-gray-400">₹{item.unit_price.toFixed(2)}</td>
                      <td className="p-3 text-right text-gray-400 text-sm">
                        <div>₹{item.tax_amount.toFixed(2)}</div>
                        <div className="text-[10px] text-gray-600">{item.tax_rate}%</div>
                      </td>
                      <td className="p-3 text-right font-medium">₹{item.line_total.toFixed(2)}</td>
                      <td className="p-3 text-center">
                        <button onClick={() => removeItem(item._lineId)} className="text-gray-600 hover:text-red-400 p-1 rounded-md hover:bg-red-400/10 transition-colors">
                          <TrashIcon />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* INPUT BAR */}
          <div className="p-4 bg-[#111118] border-t border-[#1E1E2A] shrink-0">
            <div className="flex items-end gap-4">
              <div className="flex-1 relative">
                <label className="block text-xs font-medium text-gray-500 mb-1.5 ml-1">SKU Code</label>
                <div className="relative flex items-center">
                  <div className="absolute left-3 text-gray-500">
                    <BarcodeIcon />
                  </div>
                  <input
                    ref={skuInputRef}
                    type="text"
                    value={skuInput}
                    onChange={(e) => setSkuInput(e.target.value)}
                    onKeyDown={handleSkuSubmit}
                    placeholder="Scan Barcode..."
                    className="w-full bg-gray-900 border border-gray-700 text-white rounded-lg py-3 pl-10 pr-4 text-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 focus-glow transition-all"
                  />
                </div>
                {error && <div className="absolute -top-6 left-1 text-xs text-red-400">{error}</div>}
              </div>
              
              <div className="w-24">
                <label className="block text-xs font-medium text-gray-500 mb-1.5 ml-1">Qty</label>
                <input
                  ref={quantityRef}
                  type="number"
                  min="1"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  onKeyDown={handleQuantitySubmit}
                  className="w-full bg-gray-900 border border-gray-700 text-white rounded-lg py-3 px-4 text-center focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 focus-glow transition-all"
                />
              </div>
              
              <button 
                onClick={() => handleQuantitySubmit({ key: 'Enter', preventDefault: () => {} })}
                className="bg-gray-800 hover:bg-gray-700 text-white py-3 px-6 rounded-lg border border-gray-600 font-medium transition-colors h-[50px] disabled:opacity-50"
                disabled={!pendingItem}
              >
                Add
              </button>
            </div>
            
            <div className="h-6 mt-2 flex items-center justify-between">
              {pendingItem && (
                <div className="text-sm text-emerald-400 flex items-center gap-2">
                   <span>{pendingItem.product_name}</span>
                   <span className="text-gray-500">•</span>
                   <span>₹{pendingItem.unit_price}</span>
                </div>
              )}
              {stockWarning && <div className="text-sm text-amber-500 font-medium animate-pulse ml-auto">{stockWarning}</div>}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: SIDEBAR */}
        <div className="w-80 bg-[#111118] flex flex-col shrink-0">
          
          <div className="p-5 flex-1 overflow-y-auto space-y-6">
             {/* Customer Info */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Customer Details</h3>
              
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Name</label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full bg-gray-900 border border-gray-700 text-white rounded-md py-2 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500"
                />
              </div>
              
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Phone</label>
                <input
                  type="text"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="Optional"
                  className="w-full bg-gray-900 border border-gray-700 text-white rounded-md py-2 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500"
                />
              </div>
            </div>

            {/* Billing Settings */}
            <div className="space-y-4 pt-4 border-t border-gray-800">
               <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Billing Setup</h3>
               
               <div>
                  <label className="block text-xs font-medium text-gray-500 mb-2">Tax Mode (F8)</label>
                  <button 
                    onClick={() => setIsIGST(!isIGST)}
                    className="w-full flex p-1 bg-gray-900 rounded-md border border-gray-700 relative overflow-hidden"
                  >
                    <div className={`absolute top-1 bottom-1 w-[calc(50%-4px)] rounded bg-gray-700 transition-all duration-300 ease-in-out ${isIGST ? 'translate-x-[calc(100%+4px)]' : 'translate-x-0'}`}></div>
                    <div className={`flex-1 text-center py-1.5 text-xs font-medium z-10 transition-colors ${!isIGST ? 'text-emerald-400' : 'text-gray-500'}`}>CGST+SGST</div>
                    <div className={`flex-1 text-center py-1.5 text-xs font-medium z-10 transition-colors ${isIGST ? 'text-blue-400' : 'text-gray-500'}`}>IGST</div>
                  </button>
               </div>

               <div>
                  <label className="block text-xs font-medium text-gray-500 mb-2">Payment Method</label>
                  <select 
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="w-full bg-gray-900 border border-gray-700 text-white rounded-md py-2 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500 appearance-none"
                  >
                    <option value="CASH">Cash</option>
                    <option value="UPI">UPI</option>
                    <option value="CARD">Credit/Debit Card</option>
                    <option value="CREDIT">Store Credit</option>
                  </select>
               </div>
            </div>

            {/* Notifications area */}
            {lastInvoice && (
              <div className="mt-4 p-3 bg-emerald-900/30 border border-emerald-800/50 rounded-lg flex items-center justify-center">
                <span className="text-emerald-400 text-sm font-medium">Invoice created: {lastInvoice}</span>
              </div>
            )}
          </div>

          {/* TOTALS PANEL (BOTTOM RIGHT) */}
          <div className="bg-[#181824] border-t border-[#2A2A3C] p-5 shrink-0 relative shadow-[0_-4px_20px_rgba(0,0,0,0.3)]">
            <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-amber-500/20 to-transparent"></div>
            
            <div className="space-y-3 mb-6">
              <div className="flex justify-between text-gray-400 text-sm">
                <span>Subtotal</span>
                <span>₹{subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-gray-400 text-sm">
                <span>Tax ({isIGST ? 'IGST' : 'CGST+SGST'})</span>
                <span>₹{totalTax.toFixed(2)}</span>
              </div>
              <div className="pt-3 border-t border-gray-700/50 flex justify-between items-end">
                <span className="text-gray-300 font-medium">Grand Total</span>
                <span className="text-3xl font-extrabold text-emerald-400 animate-text-pulse">₹{grandTotal.toFixed(2)}</span>
              </div>
            </div>

            <button
              onClick={handleCheckout}
              disabled={isProcessing || lineItems.length === 0}
              className="w-full bg-amber-600 hover:bg-amber-500 text-white font-bold py-4 rounded-xl shadow-[0_0_15px_rgba(217,119,6,0.3)] hover:shadow-[0_0_25px_rgba(217,119,6,0.5)] transition-all disabled:opacity-50 disabled:shadow-none flex items-center justify-center gap-2"
            >
              {isProcessing ? (
                 <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              ) : 'CHECKOUT (F12)'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
