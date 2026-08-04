import React, { useState, useRef, useEffect } from 'react';

// Icons
const BarcodeIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 5v14"/><path d="M8 5v14"/><path d="M12 5v14"/><path d="M17 5v14"/><path d="M21 5v14"/></svg>
);
const TrashIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
);
const MinusIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line></svg>
);
const PlusIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
);

const API_BASE = 'http://localhost:8080';

export default function GeneralBillingCounter() {
  const [skuInput, setSkuInput] = useState('');
  const [lineItems, setLineItems] = useState([]);
  const [isIGST, setIsIGST] = useState(false);
  
  // Supermarket specific CRM
  const [customerPhone, setCustomerPhone] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  
  const [stockWarning, setStockWarning] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastInvoice, setLastInvoice] = useState(null);
  const [error, setError] = useState('');
  
  const skuInputRef = useRef(null);
  
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
        setStockWarning('');
        skuInputRef.current?.focus();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lineItems, customerPhone, paymentMethod, isIGST]);

  // Sku Lookup & Auto-Add (Supermarket Mode)
  const handleSkuSubmit = async (e) => {
    if (e.key === 'Enter' && skuInput.trim() !== '') {
      e.preventDefault();
      setError('');
      setStockWarning('');
      const scannedSku = skuInput.trim();
      setSkuInput(''); // Instantly clear for next scan
      
      try {
        const res = await fetch(`${API_BASE}/api/sku/lookup/${encodeURIComponent(scannedSku)}`);
        if (!res.ok) throw new Error('SKU not found');
        const data = await res.json();
        
        // Auto-increment if already in cart
        setLineItems(prev => {
          const existing = prev.find(item => item.sku_code === data.sku_code);
          const newQty = existing ? existing.quantity + 1 : 1;
          
          if (data.stock_quantity < newQty) {
            setStockWarning(`Only ${data.stock_quantity} in stock for ${data.product_name}!`);
          }
          
          let tax_rate = isIGST ? (data.igst_rate || 0) : ((data.cgst_rate || 0) + (data.sgst_rate || 0));
          let lineSubtotal = data.unit_price * newQty;
          let tax_amount = lineSubtotal * (tax_rate / 100);
          let line_total = lineSubtotal + tax_amount;
          
          if (existing) {
            return prev.map(item => item.sku_code === data.sku_code ? {
              ...item,
              quantity: newQty,
              tax_amount,
              line_total
            } : item);
          } else {
            return [{
              ...data,
              sku_id: data.id,
              _lineId: String(Date.now()) + String(Math.random()),
              quantity: 1,
              tax_rate,
              tax_amount,
              line_total
            }, ...prev]; // Add new items to TOP of list for visibility
          }
        });
        
      } catch (err) {
        setError(`SKU ${scannedSku} Not Found`);
      }
    }
  };
  
  // Manual quantity adjust
  const adjustQuantity = (lineId, delta) => {
    setLineItems(prev => prev.map(item => {
      if (item._lineId === lineId) {
        const newQty = Math.max(1, item.quantity + delta);
        const lineSubtotal = item.unit_price * newQty;
        const tax_amount = lineSubtotal * (item.tax_rate / 100);
        return {
          ...item,
          quantity: newQty,
          tax_amount,
          line_total: lineSubtotal + tax_amount
        };
      }
      return item;
    }));
  };

  const removeItem = (lineId) => {
    setLineItems(prev => prev.filter(item => item._lineId !== lineId));
  };

  const generateReceiptHTML = (invoiceData, items, totals) => {
    return `
      <div style="width: 302px; font-family: monospace; color: black; background: white; padding: 10px; box-sizing: border-box;">
        <div style="text-align: center; font-weight: bold; font-size: 16px; margin-bottom: 5px;">Supermarket by CN-SC</div>
        <div style="text-align: center; font-size: 12px; margin-bottom: 10px;">Retail Invoice</div>
        
        <div style="font-size: 12px; margin-bottom: 5px;">Bill No: ${invoiceData.invoice_number || 'INV-001'}</div>
        <div style="font-size: 12px; margin-bottom: 10px;">Date: ${new Date().toLocaleString()}</div>
        ${customerPhone ? `<div style="font-size: 12px; margin-bottom: 10px;">Phone: ${customerPhone}</div>` : ''}
        
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
          <span>Items: ${items.length}</span>
          <span>Sub: ${totals.subtotal.toFixed(2)}</span>
        </div>
        <div style="font-size: 12px; display: flex; justify-content: space-between; margin-bottom: 5px;">
          <span>Tax (${isIGST ? 'IGST' : 'CGST+SGST'}):</span>
          <span>${totals.tax.toFixed(2)}</span>
        </div>
        <div style="font-size: 14px; font-weight: bold; display: flex; justify-content: space-between; border-top: 1px solid black; padding-top: 5px; margin-bottom: 15px;">
          <span>TOTAL:</span>
          <span>${totals.total.toFixed(2)}</span>
        </div>
        
        <div style="text-align: center; font-size: 12px;">Thank you for shopping!</div>
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
        customer_name: customerPhone ? 'Retail Member' : 'Walk-in Customer',
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
        if (res.status === 409) throw new Error('Conflict: Stock unavailable');
        throw new Error('Checkout failed');
      }
      
      const result = await res.json();
      const receiptHTML = generateReceiptHTML(result, lineItems, { subtotal, tax: totalTax, total: grandTotal });
      
      if (window.billflow && window.billflow.printReceipt) {
        window.billflow.printReceipt(receiptHTML);
      } else {
        const printWindow = window.open('', '', 'width=400,height=600');
        printWindow.document.write(receiptHTML);
        printWindow.document.close();
        printWindow.print();
      }
      
      setLastInvoice(result.invoice_number || 'INV-SUCCESS');
      setTimeout(() => setLastInvoice(null), 3000);
      
      // Reset State
      setLineItems([]);
      setCustomerPhone('');
      setPaymentMethod('CASH');
      
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
    <div className="flex flex-col h-full bg-[#0A0F14] text-white font-sans">
      {/* HEADER BAR */}
      <div className="bg-[#111820] border-b border-[#1E293B] p-2 flex gap-4 text-sm items-center shadow-sm shrink-0">
        <span className="text-cyan-400 font-bold ml-2 tracking-wide">🛒 Supermarket Mode</span>
        <div className="flex gap-3 ml-auto mr-4">
          <span className="flex items-center gap-1.5"><kbd className="bg-gray-800 text-gray-300 px-2 py-0.5 rounded text-xs border border-gray-700 shadow-sm">F2</kbd> <span className="text-gray-500">Scan</span></span>
          <span className="flex items-center gap-1.5"><kbd className="bg-gray-800 text-gray-300 px-2 py-0.5 rounded text-xs border border-gray-700 shadow-sm">F8</kbd> <span className="text-gray-500">Tax</span></span>
          <span className="flex items-center gap-1.5"><kbd className="bg-cyan-900/50 text-cyan-400 px-2 py-0.5 rounded text-xs border border-cyan-800/50 shadow-sm">F12</kbd> <span className="text-gray-500">Pay</span></span>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* LEFT COLUMN: SCANNER & LIST */}
        <div className="flex-1 flex flex-col h-full border-r border-[#1E293B]">
          
          {/* MASSIVE INPUT BAR */}
          <div className="p-6 bg-[#111820] border-b border-[#1E293B] shrink-0 shadow-lg z-20">
            <div className="relative">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-cyan-500">
                <BarcodeIcon />
              </div>
              <input
                ref={skuInputRef}
                type="text"
                autoFocus
                value={skuInput}
                onChange={(e) => setSkuInput(e.target.value)}
                onKeyDown={handleSkuSubmit}
                placeholder="Scan Barcode & Auto-Add..."
                className="w-full bg-[#0A0F14] border-2 border-[#1E293B] text-white rounded-xl py-5 pl-14 pr-4 text-2xl font-mono focus:outline-none focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/20 transition-all shadow-inner placeholder-gray-700"
              />
              {error && <div className="absolute -bottom-6 left-2 text-sm text-red-400 font-medium">{error}</div>}
              {stockWarning && <div className="absolute -bottom-6 right-2 text-sm text-amber-400 font-medium">{stockWarning}</div>}
            </div>
          </div>

          {/* LINE ITEMS TABLE */}
          <div className="flex-1 overflow-y-auto bg-[#0A0F14]">
            <table className="w-full text-left border-collapse">
              <thead className="bg-[#111820]/90 backdrop-blur sticky top-0 z-10 shadow-sm">
                <tr className="text-xs uppercase tracking-wider text-cyan-600/70 border-b border-[#1E293B]">
                  <th className="p-4 font-bold">Product</th>
                  <th className="p-4 font-bold text-center w-32">Qty</th>
                  <th className="p-4 font-bold text-right">Price</th>
                  <th className="p-4 font-bold text-right">Total</th>
                  <th className="p-4 w-12"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1E293B]/50">
                {lineItems.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="text-center py-20 text-gray-700">
                      <div className="flex flex-col items-center gap-4 opacity-50">
                        <svg className="w-20 h-20 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"></path></svg>
                        <p className="text-xl">Awaiting Items...</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  lineItems.map((item) => (
                    <tr key={item._lineId} className="hover:bg-cyan-900/10 transition-colors group">
                      <td className="p-4">
                        <div className="font-semibold text-gray-200 text-lg">{item.product_name}</div>
                        <div className="text-xs text-cyan-600/70 font-mono mt-1">{item.sku_code}</div>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center justify-center gap-2 bg-[#111820] rounded-lg border border-[#1E293B] p-1">
                          <button onClick={() => adjustQuantity(item._lineId, -1)} className="p-1 text-gray-500 hover:text-white hover:bg-gray-800 rounded"><MinusIcon/></button>
                          <span className="w-8 text-center font-bold text-white">{item.quantity}</span>
                          <button onClick={() => adjustQuantity(item._lineId, 1)} className="p-1 text-gray-500 hover:text-white hover:bg-gray-800 rounded"><PlusIcon/></button>
                        </div>
                      </td>
                      <td className="p-4 text-right text-gray-400">₹{item.unit_price.toFixed(2)}</td>
                      <td className="p-4 text-right font-bold text-cyan-400 text-lg">₹{item.line_total.toFixed(2)}</td>
                      <td className="p-4 text-center">
                        <button onClick={() => removeItem(item._lineId)} className="text-gray-700 hover:text-red-400 p-2 rounded-lg hover:bg-red-400/10 transition-colors opacity-0 group-hover:opacity-100">
                          <TrashIcon />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* RIGHT COLUMN: SIDEBAR */}
        <div className="w-80 bg-[#111820] flex flex-col shrink-0">
          
          <div className="p-6 flex-1 overflow-y-auto space-y-8">
            {/* Express CRM */}
            <div className="space-y-4">
              <h3 className="text-xs font-bold text-cyan-600/70 uppercase tracking-widest flex items-center gap-2"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path></svg> Loyalty Member</h3>
              
              <div className="relative">
                <input
                  type="text"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="Phone Number (Optional)"
                  className="w-full bg-[#0A0F14] border border-[#1E293B] text-white rounded-lg py-3 px-4 text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500"
                />
              </div>
            </div>

            {/* Quick Settings */}
            <div className="space-y-4 pt-6 border-t border-[#1E293B]">
               
               <div>
                  <label className="block text-xs font-bold text-cyan-600/70 uppercase tracking-widest mb-3">Tax Mode (F8)</label>
                  <button 
                    onClick={() => setIsIGST(!isIGST)}
                    className="w-full flex p-1.5 bg-[#0A0F14] rounded-lg border border-[#1E293B] relative overflow-hidden"
                  >
                    <div className={`absolute top-1.5 bottom-1.5 w-[calc(50%-6px)] rounded-md bg-[#1E293B] shadow transition-all duration-300 ease-in-out ${isIGST ? 'translate-x-[calc(100%+6px)]' : 'translate-x-0'}`}></div>
                    <div className={`flex-1 text-center py-2 text-xs font-bold tracking-wide z-10 transition-colors ${!isIGST ? 'text-white' : 'text-gray-600'}`}>LOCAL (C+S)</div>
                    <div className={`flex-1 text-center py-2 text-xs font-bold tracking-wide z-10 transition-colors ${isIGST ? 'text-blue-400' : 'text-gray-600'}`}>INTER (IGST)</div>
                  </button>
               </div>

               <div>
                  <label className="block text-xs font-bold text-cyan-600/70 uppercase tracking-widest mb-3 mt-6">Payment</label>
                  <select 
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="w-full bg-[#0A0F14] border border-[#1E293B] text-white rounded-lg py-3 px-4 text-sm font-semibold focus:outline-none focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500 appearance-none"
                  >
                    <option value="CASH">💵 Cash</option>
                    <option value="UPI">📱 UPI / QR Code</option>
                    <option value="CARD">💳 Credit / Debit Card</option>
                  </select>
               </div>
            </div>

            {/* Notifications area */}
            {lastInvoice && (
              <div className="mt-4 p-4 bg-cyan-900/20 border border-cyan-800/50 rounded-xl flex items-center justify-center shadow-inner">
                <span className="text-cyan-400 text-sm font-bold flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                  {lastInvoice}
                </span>
              </div>
            )}
          </div>

          {/* TOTALS PANEL (BOTTOM RIGHT) */}
          <div className="bg-[#0A0F14] border-t border-[#1E293B] p-6 shrink-0 relative">
            <div className="space-y-4 mb-8">
              <div className="flex justify-between text-gray-500 text-sm font-medium">
                <span>Items</span>
                <span className="text-gray-300">{lineItems.reduce((acc, item) => acc + item.quantity, 0)}</span>
              </div>
              <div className="flex justify-between text-gray-500 text-sm font-medium">
                <span>Subtotal</span>
                <span>₹{subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-gray-500 text-sm font-medium">
                <span>Tax</span>
                <span>₹{totalTax.toFixed(2)}</span>
              </div>
              <div className="pt-4 border-t border-[#1E293B] flex justify-between items-end">
                <span className="text-cyan-600/70 font-bold uppercase tracking-widest text-xs mb-1">Total Due</span>
                <span className="text-4xl font-black text-white tracking-tight">₹{grandTotal.toFixed(2)}</span>
              </div>
            </div>

            <button
              onClick={handleCheckout}
              disabled={isProcessing || lineItems.length === 0}
              className="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-5 rounded-xl shadow-[0_4px_20px_rgba(8,145,178,0.4)] hover:shadow-[0_4px_25px_rgba(8,145,178,0.6)] transition-all disabled:opacity-50 disabled:shadow-none flex items-center justify-center gap-2 text-lg"
            >
              {isProcessing ? (
                 <svg className="animate-spin h-6 w-6 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              ) : 'PAY (F12)'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
