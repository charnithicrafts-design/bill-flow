-- Parent Products
INSERT INTO products (id, name, hsn_code, category, base_price, cgst_rate, sgst_rate, igst_rate)
VALUES 
(1, 'Kanchipuram Silk Saree — Design #47', '5007', 'Sarees', 4500.0, 2.5, 2.5, 5.0),
(2, 'Banarasi Georgette Dupatta — Collection A', '5007', 'Dupattas', 1200.0, 2.5, 2.5, 5.0),
(3, 'Cotton Lungi — Premium Grade', '5208', 'Menswear', 350.0, 2.5, 2.5, 5.0);

-- Product SKUs (Variations)
-- For Product 1: Kanchipuram Silk Saree
INSERT INTO product_skus (product_id, sku_code, color, size_label, unit_price, stock_quantity)
VALUES
(1, 'KSS47-MRN-65', 'Maroon', '6.5m', 4500.0, 25),
(1, 'KSS47-EMG-65', 'Emerald Green', '6.5m', 4500.0, 15),
(1, 'KSS47-RYB-65', 'Royal Blue', '6.5m', 4500.0, 20),
(1, 'KSS47-GLD-65', 'Golden', '6.5m', 4800.0, 10);

-- For Product 2: Banarasi Georgette Dupatta
INSERT INTO product_skus (product_id, sku_code, color, size_label, unit_price, stock_quantity)
VALUES
(2, 'BGD-A-RD-25', 'Red', '2.5m', 1200.0, 50),
(2, 'BGD-A-YL-25', 'Yellow', '2.5m', 1200.0, 45),
(2, 'BGD-A-PK-25', 'Pink', '2.5m', 1200.0, 30),
(2, 'BGD-A-GN-25', 'Green', '2.5m', 1200.0, 40),
(2, 'BGD-A-BL-25', 'Blue', '2.5m', 1200.0, 35);

-- For Product 3: Cotton Lungi
INSERT INTO product_skus (product_id, sku_code, color, size_label, unit_price, stock_quantity)
VALUES
(3, 'LUN-PRM-WH-FS', 'White', 'Free Size', 350.0, 100),
(3, 'LUN-PRM-BL-FS', 'Blue Check', 'Free Size', 350.0, 80),
(3, 'LUN-PRM-GN-FS', 'Green Check', 'Free Size', 350.0, 75),
(3, 'LUN-PRM-BR-FS', 'Brown Check', 'Free Size', 350.0, 60);
