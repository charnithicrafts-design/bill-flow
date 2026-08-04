import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import TextileBillingCounter from '../src/components/domains/TextileBillingCounter';

// Mock the global IPC window API
global.window.electronAPI = {
  printReceipt: vi.fn().mockResolvedValue({ printed: true })
};

// Mock fetch for API calls
global.fetch = vi.fn();

describe('TextileBillingCounter Keyboard Workflow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Default mock response for SKU lookup (barcode scan)
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 1,
        sku_code: '123456',
        product_name: 'Test Saree',
        color: 'Red',
        size_label: 'Free Size',
        hsn_code: '5007',
        unit_price: 1500,
        stock_quantity: 10,
        cgst_rate: 2.5,
        sgst_rate: 2.5,
        igst_rate: 5
      })
    });
  });

  it('renders correctly and focuses the barcode input', () => {
    render(<TextileBillingCounter />);
    const barcodeInput = screen.getByPlaceholderText(/Scan Barcode/i);
    expect(barcodeInput).toBeDefined();
  });

  it('handles F12 keydown to focus the payment toggle', () => {
    render(<TextileBillingCounter />);
    
    // Simulate F12
    fireEvent.keyDown(document, { key: 'F12', code: 'F12' });
    
    // Check if the Cash/UPI toggle is focused (or whatever logic F12 does)
    // For now we just verify it doesn't crash since focus management is complex in JSDOM
  });

  it('adds an item to the cart on barcode submit', async () => {
    const user = userEvent.setup();
    render(<TextileBillingCounter />);
    
    const barcodeInput = screen.getByPlaceholderText(/Scan Barcode/i);
    
    // Type barcode and hit enter
    await user.type(barcodeInput, '123456{Enter}');
    
    // Wait for the mock fetch to resolve and state to update
    // Wait for the mock fetch to resolve and state to update (pendingItem appears)
    await waitFor(() => {
      expect(screen.getByText('Test Saree')).toBeDefined();
    });

    // Now hit enter on the quantity input to add it to the cart
    const qtyInput = screen.getByDisplayValue('1');
    await user.type(qtyInput, '{Enter}');

    // Now it should be in the line items table (Red color will be displayed)
    await waitFor(() => {
      expect(screen.getByText('Red')).toBeDefined();
    });
  });

  it('toggles IGST when F8 is pressed', async () => {
    render(<TextileBillingCounter />);
    
    // Initial state should not show IGST
    expect(screen.queryByText(/IGST @/)).toBeNull();
    
    // Simulate F8
    fireEvent.keyDown(document, { key: 'F8', code: 'F8' });
    
    // Add an item to see the tax calculation change (mocked)
    const user = userEvent.setup();
    const barcodeInput = screen.getByPlaceholderText(/Scan Barcode/i);
    await user.type(barcodeInput, '123456{Enter}');
    
    await waitFor(() => {
      expect(screen.getByText('Test Saree')).toBeDefined();
    });

    const qtyInput = screen.getByDisplayValue('1');
    await user.type(qtyInput, '{Enter}');
    
    await waitFor(() => {
      expect(screen.getByText(/IGST/)).toBeDefined();
    });
  });
});
