# Service API Examples - iPhone Screen Repair

## 1. Create Service Category

### Endpoint
```
POST /v1/service-categories
Authorization: Bearer {admin_token}
```

### Request Body
```json
{
  "name": "IPhone Repair",
  "slug": "i-phone-repair",
  "image_url": "https://your-image-url.com/mobile-repair-category.jpg",
  "seo_title": "Mobile Phone Repair Services | iPhone, Samsung, Android Screen & Battery Fix",
  "meta_description": "Expert mobile phone repair services for iPhone, Samsung, and Android devices. Fast screen replacement, battery repair, and hardware fixes. Professional technicians, same-day service available."
}
```

---

## 2. Create iPhone Screen Repair Service

### Endpoint
```
POST /v1/services
Authorization: Bearer {admin_token}
```

### Request Body
```json
{
  "category_id": 1,
  "name": "iPhone Screen Replacement & Repair",
  "slug": "iphone-screen-replacement-repair",
  "images": [
    {
      "image_url": "https://your-image-url.com/iphone-screen-repair-main.jpg",
      "alt_text": "iPhone screen replacement service - professional repair",
      "display_order": 0
    },
    {
      "image_url": "https://your-image-url.com/iphone-screen-repair-gallery-1.jpg",
      "alt_text": "iPhone screen repair process",
      "display_order": 1
    },
    {
      "image_url": "https://your-image-url.com/iphone-screen-repair-gallery-2.jpg",
      "alt_text": "Before and after iPhone screen repair",
      "display_order": 2
    }
  ],
  "short_description": "<p>Professional iPhone screen replacement and repair services designed to restore your device to perfect working condition. Our expert technicians use high-quality parts and advanced techniques to fix all types of screen damage.</p><ul><li>Fix cracked, broken, or damaged screens on all iPhone models</li><li>Same-day service available for urgent repairs</li><li>Genuine and compatible replacement parts</li><li>Expert certified technicians with years of experience</li><li>90-day warranty on all repairs</li></ul><p>Whether you have a minor crack or a completely shattered screen, we provide fast, reliable, and affordable repair solutions to get your iPhone back in working order quickly.</p>",
  "long_description": "<div><h2>iPhone Screen Replacement & Repair Service</h2><p>Get your iPhone screen fixed quickly and professionally. Our expert technicians specialize in repairing all iPhone models with high-quality replacement screens.</p><h3>What We Fix</h3><ul><li><strong>Cracked Screens:</strong> Repair or replace cracked iPhone screens on all models</li><li><strong>Broken Glass:</strong> Fix shattered or broken glass with precision replacement</li><li><strong>Touch Issues:</strong> Resolve unresponsive touch screen problems</li><li><strong>Display Problems:</strong> Fix black screens, lines, or discoloration issues</li><li><strong>Water Damage:</strong> Screen replacement after water damage incidents</li></ul><h3>iPhone Models We Service</h3><ul><li>iPhone 15 Pro Max, 15 Pro, 15 Plus, 15</li><li>iPhone 14 Pro Max, 14 Pro, 14 Plus, 14</li><li>iPhone 13 Pro Max, 13 Pro, 13 Mini, 13</li><li>iPhone 12 Pro Max, 12 Pro, 12 Mini, 12</li><li>iPhone 11 Pro Max, 11 Pro, 11</li><li>iPhone XS Max, XS, XR, X</li><li>iPhone 8 Plus, 8, 7 Plus, 7</li><li>iPhone SE (all generations)</li></ul><h3>Why Choose Our Service</h3><ul><li><strong>Genuine Parts:</strong> We use high-quality, compatible replacement screens</li><li><strong>Expert Technicians:</strong> Certified professionals with years of experience</li><li><strong>Same-Day Service:</strong> Most repairs completed within 2-4 hours</li><li><strong>Warranty Included:</strong> 90-day warranty on all screen replacements</li><li><strong>On-Site Available:</strong> We can come to your location for convenience</li></ul><h3>Service Process</h3><ol><li><strong>Diagnosis:</strong> Free assessment of your iPhone screen damage</li><li><strong>Quote:</strong> Transparent pricing with no hidden fees</li><li><strong>Repair:</strong> Professional screen replacement using proper tools</li><li><strong>Testing:</strong> Comprehensive testing to ensure everything works</li><li><strong>Delivery:</strong> Return your fully functional iPhone</li></ol></div>",
  "specifications": {
    "repair_time": "2-4 hours",
    "warranty_period": "90 days",
    "service_type": "On-site or In-shop",
    "parts_used": "High-quality compatible screens",
    "models_supported": "All iPhone models",
    "data_preservation": "100% data safe",
    "technician_certification": "Apple Certified"
  },
  "service_type": "hardware",
  "price_type": "variable",
  "warranty_info": "90-day warranty on screen replacement and labor",
  "seo_title": "iPhone Screen Replacement & Repair | Fast, Professional Service | IT Repair Hub",
  "meta_description": "Expert iPhone screen replacement and repair services. Fix cracked screens on all iPhone models. Same-day service, genuine parts, 90-day warranty. Professional technicians available for on-site or in-shop repairs.",
  "is_active": true,
  "section": "featured_services"
}
```

---

## 3. Additional iPhone Screen Repair Services

### iPhone Screen Crack Repair (Quick Fix)
```json
{
  "category_id": 1,
  "name": "iPhone Screen Crack Repair - Quick Fix",
  "slug": "iphone-screen-crack-repair-quick-fix",
  "images": [
    {
      "image_url": "https://your-image-url.com/iphone-crack-repair.jpg",
      "alt_text": "iPhone screen crack repair service",
      "display_order": 0
    }
  ],
  "short_description": "Fast iPhone screen crack repair service. Minor cracks fixed quickly without full replacement. Affordable solution for small screen damages.",
  "long_description": "<div><h2>iPhone Screen Crack Repair - Quick Fix Service</h2><p>Don't let a small crack ruin your iPhone experience. Our quick fix service repairs minor screen cracks efficiently and affordably.</p><h3>When to Use Quick Fix</h3><ul><li><strong>Minor Cracks:</strong> Small hairline cracks or surface scratches</li><li><strong>Corner Damage:</strong> Small cracks in screen corners</li><li><strong>Edge Cracks:</strong> Cracks along screen edges without full breakage</li><li><strong>Cost-Effective:</strong> More affordable than full screen replacement</li></ul><h3>Quick Fix Process</h3><ul><li>Assessment of crack severity</li><li>Screen stabilization treatment</li><li>Protective layer application</li><li>Quality testing</li></ul><h3>Benefits</h3><ul><li>Faster turnaround (1-2 hours)</li><li>Lower cost than full replacement</li><li>Preserves original screen</li><li>Same warranty coverage</li></ul></div>",
  "specifications": {
    "repair_time": "1-2 hours",
    "warranty_period": "60 days",
    "suitable_for": "Minor cracks only",
    "cost": "Lower than full replacement"
  },
  "service_type": "hardware",
  "price_type": "variable",
  "warranty_info": "60-day warranty on crack repair",
  "seo_title": "iPhone Screen Crack Repair | Quick Fix Service | Affordable Solution",
  "meta_description": "Fast iPhone screen crack repair for minor damages. Quick 1-2 hour service, affordable pricing. Professional crack repair without full screen replacement.",
  "is_active": true,
  "section": null
}
```

### iPhone Screen Replacement (Full Service)
```json
{
  "category_id": 1,
  "name": "iPhone Screen Replacement - Full Service",
  "slug": "iphone-screen-replacement-full-service",
  "images": [
    {
      "image_url": "https://your-image-url.com/iphone-full-replacement.jpg",
      "alt_text": "Complete iPhone screen replacement service",
      "display_order": 0
    }
  ],
  "short_description": "Complete iPhone screen replacement service. Full screen assembly replacement for severely damaged iPhones. Includes LCD, digitizer, and glass replacement.",
  "long_description": "<div><h2>iPhone Screen Replacement - Full Service</h2><p>Complete screen assembly replacement for severely damaged iPhones. We replace the entire screen module including LCD, digitizer, and glass for optimal results.</p><h3>Full Replacement Includes</h3><ul><li><strong>LCD Display:</strong> Complete LCD panel replacement</li><li><strong>Digitizer:</strong> Touch screen digitizer replacement</li><li><strong>Glass Panel:</strong> Outer glass replacement</li><li><strong>Frame Alignment:</strong> Proper screen frame alignment</li><li><strong>Seal Replacement:</strong> Water-resistant seal restoration</li></ul><h3>When Full Replacement is Needed</h3><ul><li>Severely shattered screens</li><li>Complete screen blackout</li><li>Touch screen completely unresponsive</li><li>Multiple crack patterns</li><li>Water damage affecting screen</li></ul><h3>Quality Assurance</h3><ul><li>OEM-quality replacement parts</li><li>Color accuracy matching</li><li>Touch sensitivity calibration</li><li>Display brightness optimization</li><li>Full functionality testing</li></ul><h3>Service Guarantee</h3><ul><li>90-day warranty on parts and labor</li><li>Free re-service if issues occur</li><li>Data preservation guarantee</li><li>Professional installation</li></ul></div>",
  "specifications": {
    "repair_time": "3-4 hours",
    "warranty_period": "90 days",
    "parts_included": "LCD, Digitizer, Glass, Frame",
    "quality": "OEM-compatible",
    "data_safety": "100% guaranteed"
  },
  "service_type": "hardware",
  "price_type": "variable",
  "warranty_info": "90-day warranty on full screen replacement",
  "seo_title": "iPhone Screen Replacement Full Service | Complete LCD & Digitizer Replacement",
  "meta_description": "Complete iPhone screen replacement service. Full LCD, digitizer, and glass replacement for severely damaged screens. 90-day warranty, professional installation.",
  "is_active": true,
  "section": "featured_services"
}
```

### iPhone Screen Repair - Emergency Service
```json
{
  "category_id": 1,
  "name": "iPhone Screen Emergency Repair - Same Day",
  "slug": "iphone-screen-emergency-repair-same-day",
  "images": [
    {
      "image_url": "https://your-image-url.com/iphone-emergency-repair.jpg",
      "alt_text": "Emergency iPhone screen repair same day service",
      "display_order": 0
    }
  ],
  "short_description": "Emergency iPhone screen repair with same-day service. Urgent screen replacement when you need it fast. Priority booking available.",
  "long_description": "<div><h2>iPhone Screen Emergency Repair - Same Day Service</h2><p>Need your iPhone screen fixed urgently? Our emergency repair service provides same-day screen replacement for critical situations.</p><h3>Emergency Service Features</h3><ul><li><strong>Same-Day Service:</strong> Screen replacement completed within hours</li><li><strong>Priority Booking:</strong> Fast-track appointment scheduling</li><li><strong>Express Processing:</strong> Expedited repair workflow</li><li><strong>On-Site Option:</strong> We can come to your location</li><li><strong>24/7 Booking:</strong> Emergency appointment booking available</li></ul><h3>When to Use Emergency Service</h3><ul><li>Business-critical device damage</li><li>Travel or meeting deadlines</li><li>Important calls or work requirements</li><li>Urgent communication needs</li></ul><h3>Emergency Process</h3><ol><li>Call or book emergency appointment</li><li>Immediate assessment upon arrival</li><li>Fast-track repair process</li><li>Priority quality testing</li><li>Quick return of device</li></ol><h3>Service Guarantee</h3><ul><li>Same-day completion guarantee</li><li>Full warranty coverage</li><li>Professional quality maintained</li><li>No compromise on standards</li></ul></div>",
  "specifications": {
    "repair_time": "2-3 hours (same day)",
    "warranty_period": "90 days",
    "booking": "Priority/emergency",
    "availability": "Same-day service"
  },
  "service_type": "hardware",
  "price_type": "variable",
  "warranty_info": "90-day warranty, same-day service guarantee",
  "seo_title": "iPhone Screen Emergency Repair | Same Day Service | Urgent Screen Fix",
  "meta_description": "Emergency iPhone screen repair with same-day service. Urgent screen replacement when you need it fast. Priority booking, 2-3 hour turnaround.",
  "is_active": true,
  "section": null
}
```

---

## Notes

1. **Category ID**: Replace `"category_id": 1` with the actual ID returned after creating the category
2. **Images Array**: 
   - Use `images` array instead of single `image_url`
   - `display_order: 0` = Main thumbnail image
   - `display_order: 1, 2, 3...` = Gallery images
   - `alt_text` is important for SEO (image accessibility)
   - You can add multiple images per service
3. **Slug**: Auto-generated if not provided, but you can customize
4. **Price Type**: Set to "variable" as pricing may vary by iPhone model
5. **Specifications**: JSON object with key-value pairs for additional info
6. **Long Description**: HTML formatted with proper structure (h2, h3, ul, ol, li, p, strong tags)
7. **SEO Fields**: Optimized for search engines with relevant keywords

## Managing Service Images Separately

You can also manage images separately using dedicated endpoints:

### Add Image to Service
```
POST /v1/services/:service_id/images
Authorization: Bearer {admin_token}
Body: {
  "image_url": "https://your-image-url.com/image.jpg",
  "alt_text": "SEO alt text for image",
  "display_order": 0
}
```

### Update Service Image
```
PUT /v1/services/:service_id/images/:image_id
Authorization: Bearer {admin_token}
Body: {
  "image_url": "https://updated-url.com/image.jpg",
  "alt_text": "Updated alt text",
  "display_order": 1
}
```

### Delete Service Image
```
DELETE /v1/services/:service_id/images/:image_id
Authorization: Bearer {admin_token}
```

## Testing Order

1. First create the category (POST /v1/service-categories)
2. Note the category `id` from response
3. Use that `id` in `category_id` field when creating services
4. Create services one by one using the examples above

