# Product API Examples - JSON Bodies and URLs

## Base URL
```
http://localhost:4000/api
```

**Note:** All POST/PUT/DELETE endpoints require authentication. Include the JWT token in the Authorization header:
```
Authorization: Bearer <your_jwt_token>
```

---

## Step 1: Create Product Categories

### Category 1: Laptops

**URL:** `POST http://localhost:4000/api/product-categories`

**Headers:**
```
Content-Type: application/json
Authorization: Bearer <your_jwt_token>
```

**Body:**
```json
{
  "name": "Laptops",
  "image_url": "https://zxye5ao9vt.ufs.sh/f/msrOEpeHSyjWMAPRjDNrd2uQgiVx8ohO6f7m1vEqSryCIY3Z",
  "slug": "laptops",
  "seo_title": "Buy Laptops Online - New & Used Laptops in Pakistan | IT Repair Hub",
  "meta_description": "Shop the best laptops online in Pakistan. New and used laptops from top brands. Fast delivery and warranty included. Browse our collection now!"
}
```

---

### Category 2: Mobile Phones

**URL:** `POST http://localhost:4000/api/product-categories`

**Body:**
```json
{
  "name": "Mobile Phones",
  "image_url": "https://zxye5ao9vt.ufs.sh/f/msrOEpeHSyjWiHrX4VzQy1zbvWZ4D8APJ6EYeXlritknp2oh",
  "slug": "mobile-phones",
  "seo_title": "Buy Mobile Phones Online - New & Used Phones in Pakistan | IT Repair Hub",
  "meta_description": "Find the best mobile phones in Pakistan. New and used smartphones from Apple, Samsung, and more. Great prices and warranty available."
}
```

---

### Category 3: Desktop Computers

**URL:** `POST http://localhost:4000/api/product-categories`

**Body:**
```json
{
  "name": "Desktop Computers",
  "image_url": "https://zxye5ao9vt.ufs.sh/f/msrOEpeHSyjW7TLO4BJvMqYRg98zyHxKwaltoXTJZUhnAj5L",
  "slug": "desktop-computers",
  "seo_title": "Buy Desktop Computers Online - New & Used PCs in Pakistan | IT Repair Hub",
  "meta_description": "Shop desktop computers in Pakistan. New and used PCs for home and office. Custom builds available. Fast delivery and support."
}
```

---

### Category 4: Accessories

**URL:** `POST http://localhost:4000/api/product-categories`

**Body:**
```json
{
  "name": "Accessories",
  "image_url": "http://zxye5ao9vt.ufs.sh/f/msrOEpeHSyjWiNGRmSzQy1zbvWZ4D8APJ6EYeXlritknp2oh",
  "slug": "accessories",
  "seo_title": "Computer & Mobile Accessories Online - Pakistan | IT Repair Hub",
  "meta_description": "Buy computer and mobile accessories online. Keyboards, mice, chargers, cases, and more. Best prices in Pakistan with fast delivery."
}
```

---

### Category 5: Gaming Equipment

**URL:** `POST http://localhost:4000/api/product-categories`

**Body:**
```json
{
  "name": "Gaming Equipment",
  "image_url": "http://zxye5ao9vt.ufs.sh/f/msrOEpeHSyjWSX7Qgya4MRo6PkswjLJBF1nSUXW2cIh7Z4uq",
  "slug": "gaming-equipment",
  "seo_title": "Gaming Equipment Online - Gaming PCs, Laptops & Accessories | IT Repair Hub",
  "meta_description": "Shop gaming equipment in Pakistan. Gaming PCs, laptops, keyboards, mice, and more. High-performance gear for gamers."
}
```

---

## Step 2: Create Products (After Getting Category IDs)

**Note:** After creating categories, you'll receive category IDs in the response. Use those IDs in the `category_id` field when creating products.

### Product 1: HP EliteBook 840 G5 (Laptops Category)

**URL:** `POST http://localhost:4000/api/products`

**Body:**
```json
{
  "category_id": 1,
  "name": "HP EliteBook 840 G5 Business Laptop",
  "slug": "hp-elitebook-840-g5",
  "sku": "LAP-HP-840G5-001",
  "condition": "used",
  "price": 45000,
  "stock_quantity": 3,
  "short_description": "<p>Powerful business laptop with <strong>Intel Core i5</strong>, <strong>8GB RAM</strong>, <strong>256GB SSD</strong>. Excellent condition, perfect for professionals.</p>",
  "long_description": "<div><h2>HP EliteBook 840 G5 Business Laptop</h2><p>This premium business laptop offers exceptional performance and reliability for professionals on the go.</p><h3>Key Features</h3><ul><li><strong>Processor:</strong> Intel Core i5-8250U (8th Gen)</li><li><strong>Memory:</strong> 8GB DDR4 RAM</li><li><strong>Storage:</strong> 256GB SSD</li><li><strong>Display:</strong> 14-inch Full HD (1920x1080)</li><li><strong>Graphics:</strong> Intel UHD Graphics 620</li><li><strong>Battery:</strong> Up to 10 hours</li><li><strong>Weight:</strong> 1.54 kg</li></ul><h3>Condition</h3><p>This laptop is in excellent used condition with minimal wear. Screen and keyboard are in perfect working order. Battery health is good.</p><h3>What's Included</h3><ul><li>HP EliteBook 840 G5 Laptop</li><li>Original Charger</li><li>1 Year IT Repair Hub Warranty</li></ul></div>",
  "specifications": {
    "Processor": "Intel Core i5-8250U (8th Generation)",
    "RAM": "8GB DDR4",
    "Storage": "256GB SSD",
    "Display": "14-inch Full HD (1920x1080)",
    "Graphics": "Intel UHD Graphics 620",
    "Operating System": "Windows 10 Pro",
    "Ports": "USB 3.0, USB-C, HDMI, Ethernet",
    "Battery Life": "Up to 10 hours",
    "Weight": "1.54 kg",
    "Color": "Silver"
  },
  "warranty_info": "1 Year IT Repair Hub Warranty",
  "seo_title": "HP EliteBook 840 G5 Used Laptop - Business Laptop Pakistan | IT Repair Hub",
  "meta_description": "Buy HP EliteBook 840 G5 used laptop in Pakistan. Intel i5, 8GB RAM, 256GB SSD. Excellent condition with 1 year warranty. Best price guaranteed.",
  "is_active": true,
  "section": "featured_products",
  "images": [
    {
      "image_url": "https://zxye5ao9vt.ufs.sh/f/msrOEpeHSyjWLHcYI2ZSjQP873v0OmfKegaELhNIxq4HtRnG",
      "alt_text": "HP EliteBook 840 G5 Laptop Front View",
      "display_order": 0
    },
    {
      "image_url": "https://zxye5ao9vt.ufs.sh/f/msrOEpeHSyjWHmQyEcftJAR3vnYbpUZd5QfIE6KkHxeTCjG9",
      "alt_text": "HP EliteBook 840 G5 Laptop Keyboard View",
      "display_order": 1
    },
    {
      "image_url": "https://example.com/images/products/hp-elitebook-840g5-3.jpg",
      "alt_text": "HP EliteBook 840 G5 Laptop Side Ports",
      "display_order": 2
    }
  ]
}
```

---

### Product 2: iPhone 13 Pro (Mobile Phones Category)

**URL:** `POST http://localhost:4000/api/products`

**Body:**
```json
{
  "category_id": 2,
  "name": "Apple iPhone 13 Pro 128GB",
  "slug": "iphone-13-pro-128gb",
  "sku": "PHN-IPH-13PRO-128",
  "condition": "used",
  "price": 125000,
  "stock_quantity": 2,
  "short_description": "<p>Premium <strong>iPhone 13 Pro</strong> in excellent condition. <strong>128GB storage</strong>, all features working perfectly. Includes charger and case.</p>",
  "long_description": "<div><h2>Apple iPhone 13 Pro 128GB</h2><p>The iPhone 13 Pro delivers exceptional performance with its A15 Bionic chip and Pro camera system.</p><h3>Key Features</h3><ul><li><strong>Display:</strong> 6.1-inch Super Retina XDR OLED</li><li><strong>Processor:</strong> Apple A15 Bionic</li><li><strong>Storage:</strong> 128GB</li><li><strong>Camera:</strong> Triple 12MP camera system (Wide, Ultra Wide, Telephoto)</li><li><strong>Battery:</strong> Up to 22 hours video playback</li><li><strong>Water Resistance:</strong> IP68 (6m for 30 minutes)</li><li><strong>Face ID:</strong> Yes</li></ul><h3>Condition</h3><p>This iPhone is in excellent used condition. Screen has no cracks or scratches. Battery health is 92%. All functions work perfectly.</p><h3>What's Included</h3><ul><li>iPhone 13 Pro 128GB</li><li>Original Charger</li><li>Protective Case</li><li>Screen Protector (Pre-installed)</li><li>6 Months IT Repair Hub Warranty</li></ul></div>",
  "specifications": {
    "Model": "iPhone 13 Pro",
    "Storage": "128GB",
    "Display": "6.1-inch Super Retina XDR OLED",
    "Processor": "Apple A15 Bionic",
    "Camera": "Triple 12MP (Wide, Ultra Wide, Telephoto)",
    "Front Camera": "12MP TrueDepth",
    "Battery": "Up to 22 hours video playback",
    "Water Resistance": "IP68 (6m for 30 minutes)",
    "Operating System": "iOS 15+",
    "Color": "Graphite",
    "Battery Health": "92%"
  },
  "warranty_info": "6 Months IT Repair Hub Warranty",
  "seo_title": "Buy iPhone 13 Pro 128GB Used - Best Price Pakistan | IT Repair Hub",
  "meta_description": "Buy used iPhone 13 Pro 128GB in Pakistan. Excellent condition, 92% battery health. Triple camera system, A15 Bionic chip. 6 months warranty included.",
  "is_active": true,
  "section": "featured_products",
  "images": [
    {
      "image_url": "https://example.com/images/products/iphone-13-pro-1.jpg",
      "alt_text": "iPhone 13 Pro Front View",
      "display_order": 0
    },
    {
      "image_url": "https://example.com/images/products/iphone-13-pro-2.jpg",
      "alt_text": "iPhone 13 Pro Back Camera View",
      "display_order": 1
    },
    {
      "image_url": "https://example.com/images/products/iphone-13-pro-3.jpg",
      "alt_text": "iPhone 13 Pro Side View",
      "display_order": 2
    }
  ]
}
```

---

### Product 3: Dell OptiPlex 7090 Desktop (Desktop Computers Category)

**URL:** `POST http://localhost:4000/api/products`

**Body:**
```json
{
  "category_id": 3,
  "name": "Dell OptiPlex 7090 Desktop PC",
  "slug": "dell-optiplex-7090-desktop",
  "sku": "DESK-DELL-7090-001",
  "condition": "used",
  "price": 55000,
  "stock_quantity": 4,
  "short_description": "<p>Powerful business desktop PC with <strong>Intel Core i7</strong>, <strong>16GB RAM</strong>, <strong>512GB SSD</strong>. Perfect for office and home use.</p>",
  "long_description": "<div><h2>Dell OptiPlex 7090 Desktop PC</h2><p>This compact desktop PC delivers excellent performance for business and productivity tasks.</p><h3>Key Features</h3><ul><li><strong>Processor:</strong> Intel Core i7-11700 (11th Gen)</li><li><strong>Memory:</strong> 16GB DDR4 RAM</li><li><strong>Storage:</strong> 512GB NVMe SSD</li><li><strong>Graphics:</strong> Intel UHD Graphics 750</li><li><strong>Form Factor:</strong> Small Form Factor (SFF)</li><li><strong>Operating System:</strong> Windows 11 Pro</li><li><strong>Ports:</strong> USB 3.2, USB-C, DisplayPort, HDMI</li></ul><h3>Condition</h3><p>This desktop is in excellent condition. All components tested and working perfectly. Cleaned and optimized for best performance.</p><h3>What's Included</h3><ul><li>Dell OptiPlex 7090 Desktop PC</li><li>Power Cable</li><li>Keyboard and Mouse</li><li>1 Year IT Repair Hub Warranty</li></ul></div>",
  "specifications": {
    "Processor": "Intel Core i7-11700 (11th Generation)",
    "RAM": "16GB DDR4",
    "Storage": "512GB NVMe SSD",
    "Graphics": "Intel UHD Graphics 750",
    "Operating System": "Windows 11 Pro",
    "Form Factor": "Small Form Factor (SFF)",
    "Ports": "USB 3.2, USB-C, DisplayPort, HDMI, Ethernet",
    "Dimensions": "17.5 x 17.5 x 3.7 cm",
    "Weight": "3.5 kg"
  },
  "warranty_info": "1 Year IT Repair Hub Warranty",
  "seo_title": "Dell OptiPlex 7090 Desktop PC - Used Business PC Pakistan | IT Repair Hub",
  "meta_description": "Buy Dell OptiPlex 7090 desktop PC in Pakistan. Intel i7, 16GB RAM, 512GB SSD. Excellent condition with 1 year warranty. Perfect for office use.",
  "is_active": true,
  "section": "featured_products",
  "images": [
    {
      "image_url": "https://example.com/images/products/dell-optiplex-7090-1.jpg",
      "alt_text": "Dell OptiPlex 7090 Desktop Front View",
      "display_order": 0
    },
    {
      "image_url": "https://example.com/images/products/dell-optiplex-7090-2.jpg",
      "alt_text": "Dell OptiPlex 7090 Desktop Back Ports",
      "display_order": 1
    }
  ]
}
```

---

### Product 4: Logitech MX Master 3 Mouse (Accessories Category)

**URL:** `POST http://localhost:4000/api/products`

**Body:**
```json
{
  "category_id": 4,
  "name": "Logitech MX Master 3 Wireless Mouse",
  "slug": "logitech-mx-master-3-mouse",
  "sku": "ACC-LOG-MX3-001",
  "condition": "new",
  "price": 12000,
  "stock_quantity": 15,
  "short_description": "<p>Premium wireless mouse with <strong>advanced tracking</strong>, <strong>ergonomic design</strong>, and <strong>multi-device connectivity</strong>. Perfect for professionals.</p>",
  "long_description": "<div><h2>Logitech MX Master 3 Wireless Mouse</h2><p>The MX Master 3 is the ultimate productivity mouse designed for professionals who demand precision and comfort.</p><h3>Key Features</h3><ul><li><strong>Sensor:</strong> Darkfield High Precision (4000 DPI)</li><li><strong>Connectivity:</strong> Bluetooth and USB Receiver (Logi Bolt)</li><li><strong>Battery:</strong> Up to 70 days on single charge</li><li><strong>Multi-Device:</strong> Connect up to 3 devices simultaneously</li><li><strong>Ergonomic Design:</strong> Comfortable for long work sessions</li><li><strong>Scroll Wheel:</strong> MagSpeed electromagnetic scrolling</li><li><strong>Buttons:</strong> 7 programmable buttons</li></ul><h3>Perfect For</h3><ul><li>Graphic Designers</li><li>Video Editors</li><li>Programmers</li><li>Office Professionals</li><li>Gamers (casual)</li></ul></div>",
  "specifications": {
    "Model": "MX Master 3",
    "Connectivity": "Bluetooth, USB Receiver (Logi Bolt)",
    "Sensor": "Darkfield High Precision",
    "DPI": "4000 DPI",
    "Battery": "Up to 70 days",
    "Charging": "USB-C",
    "Multi-Device": "Up to 3 devices",
    "Buttons": "7 programmable buttons",
    "Scroll Wheel": "MagSpeed electromagnetic",
    "Compatibility": "Windows, macOS, Linux, iPad",
    "Color": "Graphite"
  },
  "warranty_info": "2 Years Manufacturer Warranty",
  "seo_title": "Logitech MX Master 3 Wireless Mouse - Best Price Pakistan | IT Repair Hub",
  "meta_description": "Buy Logitech MX Master 3 wireless mouse in Pakistan. Premium ergonomic mouse with 70-day battery, multi-device support. Best price with warranty.",
  "is_active": true,
  "section": "featured_products",
  "images": [
    {
      "image_url": "https://example.com/images/products/logitech-mx-master-3-1.jpg",
      "alt_text": "Logitech MX Master 3 Mouse Top View",
      "display_order": 0
    },
    {
      "image_url": "https://example.com/images/products/logitech-mx-master-3-2.jpg",
      "alt_text": "Logitech MX Master 3 Mouse Side View",
      "display_order": 1
    }
  ]
}
```

---

### Product 5: ASUS ROG Strix G15 Gaming Laptop (Gaming Equipment Category)

**URL:** `POST http://localhost:4000/api/products`

**Body:**
```json
{
  "category_id": 5,
  "name": "ASUS ROG Strix G15 Gaming Laptop",
  "slug": "asus-rog-strix-g15-gaming-laptop",
  "sku": "GAM-ASUS-ROG-G15-001",
  "condition": "used",
  "price": 180000,
  "stock_quantity": 2,
  "short_description": "<p>High-performance gaming laptop with <strong>RTX 3060</strong>, <strong>AMD Ryzen 7</strong>, <strong>16GB RAM</strong>, and <strong>512GB SSD</strong>. Perfect for gaming and content creation.</p>",
  "long_description": "<div><h2>ASUS ROG Strix G15 Gaming Laptop</h2><p>Experience next-level gaming performance with this powerful ROG Strix G15 laptop designed for serious gamers.</p><h3>Key Features</h3><ul><li><strong>Processor:</strong> AMD Ryzen 7 5800H</li><li><strong>Graphics:</strong> NVIDIA GeForce RTX 3060 (6GB GDDR6)</li><li><strong>Memory:</strong> 16GB DDR4 RAM</li><li><strong>Storage:</strong> 512GB NVMe SSD</li><li><strong>Display:</strong> 15.6-inch Full HD 144Hz</li><li><strong>Cooling:</strong> ROG Intelligent Cooling System</li><li><strong>Keyboard:</strong> RGB Backlit Keyboard</li><li><strong>Battery:</strong> 90Wh</li></ul><h3>Gaming Performance</h3><p>This laptop can handle the latest AAA games at high settings. The RTX 3060 provides excellent ray tracing and DLSS support for enhanced visuals.</p><h3>Condition</h3><p>Excellent used condition. All components tested and working perfectly. Screen has no dead pixels. Keyboard and trackpad in perfect condition.</p><h3>What's Included</h3><ul><li>ASUS ROG Strix G15 Laptop</li><li>Original Charger (230W)</li><li>Original Box</li><li>1 Year IT Repair Hub Warranty</li></ul></div>",
  "specifications": {
    "Processor": "AMD Ryzen 7 5800H",
    "Graphics": "NVIDIA GeForce RTX 3060 (6GB GDDR6)",
    "RAM": "16GB DDR4",
    "Storage": "512GB NVMe SSD",
    "Display": "15.6-inch Full HD (1920x1080) 144Hz",
    "Refresh Rate": "144Hz",
    "Cooling": "ROG Intelligent Cooling System",
    "Keyboard": "RGB Backlit Keyboard",
    "Battery": "90Wh",
    "Operating System": "Windows 11 Home",
    "Weight": "2.3 kg",
    "Color": "Eclipse Gray"
  },
  "warranty_info": "1 Year IT Repair Hub Warranty",
  "seo_title": "ASUS ROG Strix G15 Gaming Laptop - RTX 3060 Pakistan | IT Repair Hub",
  "meta_description": "Buy ASUS ROG Strix G15 gaming laptop in Pakistan. RTX 3060, Ryzen 7, 16GB RAM, 144Hz display. Excellent condition with 1 year warranty.",
  "is_active": true,
  "section": "featured_products",
  "images": [
    {
      "image_url": "https://example.com/images/products/asus-rog-strix-g15-1.jpg",
      "alt_text": "ASUS ROG Strix G15 Gaming Laptop Front View",
      "display_order": 0
    },
    {
      "image_url": "https://example.com/images/products/asus-rog-strix-g15-2.jpg",
      "alt_text": "ASUS ROG Strix G15 Gaming Laptop RGB Keyboard",
      "display_order": 1
    },
    {
      "image_url": "https://example.com/images/products/asus-rog-strix-g15-3.jpg",
      "alt_text": "ASUS ROG Strix G15 Gaming Laptop Side View",
      "display_order": 2
    },
    {
      "image_url": "https://example.com/images/products/asus-rog-strix-g15-4.jpg",
      "alt_text": "ASUS ROG Strix G15 Gaming Laptop Back View",
      "display_order": 3
    }
  ]
}
```

---

## Quick Reference: API Endpoints

### Product Categories
- **GET** `/api/product-categories` - List all categories
- **GET** `/api/product-categories/:slug` - Get category by slug
- **POST** `/api/product-categories` - Create category (Admin only)
- **PUT** `/api/product-categories/:id` - Update category (Admin only)
- **DELETE** `/api/product-categories/:id` - Delete category (Admin only)

### Products
- **GET** `/api/products` - List all products (supports query params: category_id, condition, section, is_active, search, min_price, max_price, in_stock)
- **GET** `/api/products/:slug` - Get product by slug
- **POST** `/api/products` - Create product (Admin only)
- **PUT** `/api/products/:id` - Update product (Admin only)
- **DELETE** `/api/products/:id` - Delete product (Admin only)

### Product Images
- **POST** `/api/products/:product_id/images` - Add image (Admin only)
- **PUT** `/api/products/:product_id/images/:image_id` - Update image (Admin only)
- **DELETE** `/api/products/:product_id/images/:image_id` - Delete image (Admin only)

---

## Testing with cURL

### Create Category Example:
```bash
curl -X POST http://localhost:4000/api/product-categories \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "name": "Laptops",
    "image_url": "https://example.com/images/categories/laptops.jpg",
    "slug": "laptops",
    "seo_title": "Buy Laptops Online - New & Used Laptops in Pakistan | IT Repair Hub",
    "meta_description": "Shop the best laptops online in Pakistan. New and used laptops from top brands. Fast delivery and warranty included."
  }'
```

### Create Product Example:
```bash
curl -X POST http://localhost:4000/api/products \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "category_id": 1,
    "name": "HP EliteBook 840 G5 Business Laptop",
    "slug": "hp-elitebook-840-g5",
    "sku": "LAP-HP-840G5-001",
    "condition": "used",
    "price": 45000,
    "stock_quantity": 3,
     "short_description": "<p>Powerful business laptop with <strong>Intel Core i5</strong>, <strong>8GB RAM</strong>, <strong>256GB SSD</strong>.</p>",
    "section": "featured_products",
    "is_active": true
  }'
```

---

## Important Notes

1. **Authentication Required:** All POST, PUT, DELETE operations require admin authentication
2. **Category IDs:** After creating categories, note the `id` from the response to use in products
3. **SKU Uniqueness:** Each product must have a unique SKU
4. **Section Field:** Use `"section": "featured_products"` to mark products as featured
5. **Images:** Can be added during product creation or separately using image endpoints
6. **SEO Fields:** Always include `seo_title` and `meta_description` for better SEO
7. **Specifications:** Must be valid JSON (object or stringified JSON)

