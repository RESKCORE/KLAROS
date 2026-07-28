# 🧪 KLAROS Test Datasets Hub

This directory contains sample retail datasets in **4 different file formats** with realistic, non-standard column headers (`Prod_ID`, `Item Desc`, `Dept_Group`, `Selling_Price_INR`, `Cost_Per_Unit`, `Available_Stock_Qty`, `Txn_Date`).

You can use these files directly in the KLAROS UI (**Connect Data** page) to test the **Universal AI File Extractor & Dynamic Schema Mapper**!

---

## 📁 Sample Test Files Included

| File Name | Format | Description | Custom Headers Tested |
|---|---|---|---|
| 📄 [`supermarket_sales.json`](file:///e:/KLAROS/test_datasets/supermarket_sales.json) | **JSON** | Structured JSON array of retail product sales records. | `prod_id`, `item_desc`, `dept_group`, `selling_price_inr`, `cost_per_unit`, `available_stock_qty`, `txn_date` |
| 📄 [`inventory_stock.xml`](file:///e:/KLAROS/test_datasets/inventory_stock.xml) | **XML** | XML element node tree containing product stock data. | `prod_id`, `item_desc`, `dept_group`, `selling_price_inr`, `cost_per_unit`, `available_stock_qty`, `txn_date` |
| 📄 [`retail_report.txt`](file:///e:/KLAROS/test_datasets/retail_report.txt) | **TXT / PDF** | Tab-delimited text/PDF table report. | `Prod_ID`, `Item Desc`, `Dept_Group`, `Selling_Price_INR`, `Cost_Per_Unit`, `Available_Stock_Qty`, `Txn_Date` |
| 📄 [`custom_retail_sales.csv`](file:///e:/KLAROS/test_datasets/custom_retail_sales.csv) | **CSV** | Comma-separated CSV dataset with non-standard header names. | `Prod_ID`, `Item Desc`, `Dept_Group`, `Selling_Price_INR`, `Cost_Per_Unit`, `Available_Stock_Qty`, `Txn_Date` |

---

## 🚀 How to Test in KLAROS UI

1. Start the KLAROS dev server (`npm run dev`).
2. Open your browser and navigate to **Connect Data** (`/connect-data`).
3. Under **AI Universal File Uploader & Schema Mapper**, click **Select Files to Upload** (or drag and drop any of the test files above).
4. Observe:
   - The file extractor parses the format instantly (JSON / XML / TXT / CSV).
   - The **AI Schema Mapping Preview Modal** automatically opens.
   - Headers like `Prod_ID`, `Item Desc`, `Selling_Price_INR` are mapped to `sku`, `name`, `revenue`/`price` with high confidence.
   - Any missing fields trigger explicit **Amber Auto-Healing Badges** and notice banners.
   - Click **Confirm & Normalize Dataset** to connect the data and launch auto-analysis!
