# Discount Engine API Examples

## 1. Create Fixed Price Service with Line-Item Discount

### Endpoint
```
POST /v1/services
Authorization: Bearer {admin_token}
```

### Request Body - Fixed Price Service with 15% Discount
```json
{
  "category_id": 1,
  "name": "iPhone Screen Replacement - Premium Service",
  "slug": "iphone-screen-replacement-premium",
  "images": [
    {
      "image_url": "https://your-image-url.com/iphone-screen-premium.jpg",
      "alt_text": "Premium iPhone screen replacement service",
      "display_order": 0
    }
  ],
  "short_description": "<p>Premium iPhone screen replacement service with genuine parts. Professional installation and 90-day warranty included.</p><ul><li>Genuine Apple-certified screens</li><li>Professional installation by certified technicians</li><li>90-day warranty on parts and labor</li><li>Same-day service available</li><li>Data preservation guaranteed</li></ul>",
  "long_description": "<div><h2>Premium iPhone Screen Replacement Service</h2><p>Get your iPhone screen replaced with genuine parts by certified technicians. Our premium service ensures the highest quality repair with full warranty coverage.</p><h3>What's Included</h3><ul><li>Genuine Apple-certified replacement screen</li><li>Professional installation by certified technicians</li><li>90-day warranty on parts and labor</li><li>Free diagnostic before repair</li><li>Data preservation guarantee</li><li>Same-day service available</li></ul><h3>Supported Models</h3><ul><li>All iPhone models from iPhone 8 to iPhone 15 Pro Max</li><li>iPhone SE (all generations)</li></ul></div>",
  "specifications": {
    "repair_time": "2-4 hours",
    "warranty_period": "90 days",
    "parts_quality": "Genuine Apple-certified",
    "technician_level": "Certified Professional"
  },
  "service_type": "hardware",
  "price_type": "fixed",
  "price": 15000,
  "discount_percentage": 15,
  "warranty_info": "90-day warranty on parts and labor",
  "seo_title": "Premium iPhone Screen Replacement | 15% Off | IT Repair Hub",
  "meta_description": "Premium iPhone screen replacement service with 15% discount. Genuine parts, certified technicians, 90-day warranty. Same-day service available.",
  "is_active": true,
  "section": "featured_services"
}
```

### Example Response
```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "iPhone Screen Replacement - Premium Service",
    "price": 15000,
    "original_price": 15000,
    "discounted_price": 12750,
    "discount_percentage": 15,
    "price_type": "fixed",
    ...
  },
  "message": "Service created successfully"
}
```

---

## 2. More Fixed Price Service Examples

### Example 2: Laptop Repair Service with 20% Discount
```json
{
  "category_id": 2,
  "name": "Laptop Screen Replacement Service",
  "slug": "laptop-screen-replacement-service",
  "images": [
    {
      "image_url": "https://your-image-url.com/laptop-screen-repair.jpg",
      "alt_text": "Laptop screen replacement service",
      "display_order": 0
    }
  ],
  "short_description": "<p>Professional laptop screen replacement for all major brands. Fast service with warranty included.</p><ul><li>All major laptop brands supported</li><li>High-quality replacement screens</li><li>Professional installation</li><li>30-day warranty</li></ul>",
  "long_description": "<div><h2>Laptop Screen Replacement Service</h2><p>Expert laptop screen replacement for Dell, HP, Lenovo, Asus, Acer, and more.</p></div>",
  "specifications": {
    "repair_time": "3-5 hours",
    "warranty_period": "30 days",
    "brands_supported": "Dell, HP, Lenovo, Asus, Acer, MSI, Razer"
  },
  "service_type": "hardware",
  "price_type": "fixed",
  "price": 12000,
  "discount_percentage": 20,
  "warranty_info": "30-day warranty on replacement screen",
  "seo_title": "Laptop Screen Replacement | 20% Off | IT Repair Hub",
  "meta_description": "Laptop screen replacement service with 20% discount. All major brands supported. Professional service with warranty.",
  "is_active": true,
  "section": "featured_services"
}
```

### Example 3: Software Installation Service with 10% Discount
```json
{
  "category_id": 3,
  "name": "Windows 11 Installation Service",
  "slug": "windows-11-installation-service",
  "images": [
    {
      "image_url": "https://your-image-url.com/windows-installation.jpg",
      "alt_text": "Windows 11 installation service",
      "display_order": 0
    }
  ],
  "short_description": "<p>Professional Windows 11 installation with data backup and driver installation included.</p><ul><li>Complete Windows 11 installation</li><li>Data backup before installation</li><li>Driver installation and updates</li><li>Software configuration</li></ul>",
  "long_description": "<div><h2>Windows 11 Installation Service</h2><p>Professional Windows 11 installation with full data backup and driver setup.</p></div>",
  "specifications": {
    "service_time": "2-3 hours",
    "data_backup": "Included",
    "driver_installation": "Included"
  },
  "service_type": "software",
  "price_type": "fixed",
  "price": 5000,
  "discount_percentage": 10,
  "warranty_info": "30-day support included",
  "seo_title": "Windows 11 Installation Service | 10% Off | IT Repair Hub",
  "meta_description": "Professional Windows 11 installation service with 10% discount. Data backup and driver installation included.",
  "is_active": true,
  "section": "featured_services"
}
```

---

## 3. Create Promo Code

### Endpoint
```
POST /v1/promo-codes
Authorization: Bearer {admin_token}
```

### Example 1: Percentage-Based Promo Code (20% Off)
```json
{
  "code": "SUMMER20",
  "discount_type": "percentage",
  "discount_value": 20,
  "min_order_amount": 5000,
  "usage_limit": 100,
  "expires_at": "2024-12-31T23:59:59",
  "is_active": true
}
```

### Example 2: Fixed Amount Promo Code (Rs. 1000 Off)
```json
{
  "code": "SAVE1000",
  "discount_type": "fixed_amount",
  "discount_value": 1000,
  "min_order_amount": 10000,
  "usage_limit": 50,
  "expires_at": "2024-12-31T23:59:59",
  "is_active": true
}
```

### Example 3: No Minimum Order Promo Code
```json
{
  "code": "WELCOME10",
  "discount_type": "percentage",
  "discount_value": 10,
  "min_order_amount": 0,
  "usage_limit": null,
  "expires_at": null,
  "is_active": true
}
```

### Example 4: Limited Time Promo Code (No Usage Limit)
```json
{
  "code": "FLASH50",
  "discount_type": "percentage",
  "discount_value": 50,
  "min_order_amount": 20000,
  "usage_limit": null,
  "expires_at": "2024-06-30T23:59:59",
  "is_active": true
}
```

### Example 5: Fixed Amount with No Expiration
```json
{
  "code": "FIXED500",
  "discount_type": "fixed_amount",
  "discount_value": 500,
  "min_order_amount": 5000,
  "usage_limit": 200,
  "expires_at": null,
  "is_active": true
}
```

### Example Response
```json
{
  "success": true,
  "data": {
    "id": 1,
    "code": "SUMMER20",
    "discount_type": "percentage",
    "discount_value": 20,
    "min_order_amount": 5000,
    "usage_limit": 100,
    "used_count": 0,
    "expires_at": "2024-12-31T23:59:59",
    "is_active": true,
    "created_at": "2024-01-15T10:30:00"
  },
  "message": "Promo code created successfully"
}
```

---

## 4. Field Descriptions

### Service Fields (Fixed Price with Discount)
- **price_type**: Must be `"fixed"` for discount to apply
- **price**: Original price (required for fixed price services)
- **discount_percentage**: Line-item discount (0-100). Example: `15` means 15% off
- **section**: Optional. Use `"featured_services"` to show on homepage

### Promo Code Fields
- **code**: Promo code (will be converted to uppercase automatically)
- **discount_type**: Either `"percentage"` or `"fixed_amount"`
- **discount_value**: 
  - For percentage: 0-100 (e.g., `20` = 20% off)
  - For fixed_amount: Amount in PKR (e.g., `1000` = Rs. 1000 off)
- **min_order_amount**: Minimum order amount required (use `0` for no minimum)
- **usage_limit**: Maximum number of times code can be used (use `null` for unlimited)
- **expires_at**: Expiration date/time in ISO format (use `null` for no expiration)
- **is_active**: `true` or `false` to enable/disable the code

---

## 5. How Discounts Work Together

### Example Scenario:
1. **Service Price**: Rs. 15,000
2. **Line-Item Discount**: 15% → Price becomes Rs. 12,750
3. **Promo Code Applied**: "SUMMER20" (20% off)
4. **Final Calculation**:
   - Quoted Amount: Rs. 12,750 (after line-item discount)
   - Promo Discount: 20% of Rs. 12,750 = Rs. 2,550
   - **Total Amount**: Rs. 10,200

### Booking Flow:
1. User selects service with fixed price
2. Line-item discount is automatically applied (shown in UI)
3. User can enter promo code during booking
4. Promo code discount is applied to the already-discounted price
5. Final total is calculated and stored in booking

---

## 6. cURL Examples

### Create Fixed Price Service with Discount
```bash
curl -X POST http://localhost:4000/v1/services \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -d '{
    "category_id": 1,
    "name": "iPhone Screen Replacement - Premium Service",
    "slug": "iphone-screen-replacement-premium",
    "service_type": "hardware",
    "price_type": "fixed",
    "price": 15000,
    "discount_percentage": 15,
    "short_description": "<p>Premium service with discount</p>",
    "long_description": "<div><h2>Premium Service</h2></div>",
    "is_active": true
  }'
```

### Create Promo Code
```bash
curl -X POST http://localhost:4000/v1/promo-codes \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -d '{
    "code": "SUMMER20",
    "discount_type": "percentage",
    "discount_value": 20,
    "min_order_amount": 5000,
    "usage_limit": 100,
    "expires_at": "2024-12-31T23:59:59",
    "is_active": true
  }'
```

---

## 7. Quick Reference

### Service Discount Calculation
- Original Price: `price`
- Discounted Price: `price * (1 - discount_percentage / 100)`
- Example: Rs. 15,000 with 15% discount = Rs. 12,750

### Promo Code Discount Calculation
- For percentage: `quoted_amount * (discount_value / 100)`
- For fixed_amount: `discount_value` (capped at quoted_amount)
- Example: Rs. 12,750 with 20% promo = Rs. 2,550 discount

### Final Total
- Total = Quoted Amount (after line-item discount) - Promo Discount
- Example: Rs. 12,750 - Rs. 2,550 = Rs. 10,200

