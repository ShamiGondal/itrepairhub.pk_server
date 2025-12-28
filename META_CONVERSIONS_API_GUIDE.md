# Meta (Facebook) Conversions API Implementation Guide

## 📋 Overview

The Meta Conversions API (CAPI) is now integrated into your IT Repair Hub backend. This allows you to send server-side events to Facebook for better ad tracking, attribution, and performance measurement.

## 🎯 What is Meta Conversions API?

Meta Conversions API is a server-to-server connection between your backend and Facebook. It works alongside your Meta Pixel (which is already installed on your frontend) to provide:

1. **More reliable tracking** - Not affected by ad blockers or browser restrictions
2. **Better event matching** - Uses hashed customer data for accurate attribution  
3. **Improved ad performance** - Better data = better ad targeting = lower costs
4. **Deduplication** - Works with Meta Pixel to avoid counting events twice

## 🔧 Setup Instructions

### Step 1: Add Environment Variables

Add these to your `server/.env` file:

```env
# Meta Pixel ID (already in use on your frontend)
META_PIXEL_ID=1230498898985591

# Access Token from Meta Events Manager
META_CAPI_ACCESS_TOKEN=EAARHujoYRkcBQZAUBl6DCvNtGRTy4C5KggtEiQoNPghSObpKzcARq1U3OZAj5YXjbKqOb8p77o709ZAMjZASgAVmMGDWsqlt52eXEDdj47L2SsLaMrQBIL4T7e6MvBPYjTPlzugaD2r27QYoZByTbmRz5oDQ3ClzQh5HkzxiEHh3vdSSYmZB3bqJDgecocawZDZD

# Optional: Test Event Code (for testing in Meta Events Manager)
# META_TEST_EVENT_CODE=TEST12345

# Your frontend URL (for event source URL)
FRONTEND_URL=https://www.itrepairhub.com
```

**Important:** 
- The access token provided above is from your Meta Events Manager (generated Dec 29, 2025)
- This token includes Dataset Quality API permissions for monitoring event quality
- Save this token securely - Facebook doesn't store it

### Step 2: Restart Your Server

After adding the environment variables, restart your backend:

```bash
cd server
npm start
```

You should see this log on startup:
```
✅ [Meta CAPI] Configured successfully
```

If the access token is missing, you'll see:
```
⚠️  Meta Conversions API: Access token not configured. Events will not be sent.
```

## 📊 What Events Are Being Tracked?

The following events are automatically tracked by your backend:

### 1. **Purchase** (Order Completed)
- **When:** Customer completes an order
- **Location:** `server/src/controllers/order.controller.js`
- **Data sent:**
  - Order ID
  - Total amount (PKR)
  - Product IDs
  - Number of items
  - Customer email, phone, name (hashed)

### 2. **AddToCart** (Product Added to Cart)
- **When:** Customer adds a product or service to cart
- **Location:** `server/src/controllers/cart.controller.js`
- **Data sent:**
  - Product/Service ID and name
  - Price and quantity
  - Customer data (if logged in)

### 3. **CompleteRegistration** (New User Registration)
- **When:** New customer or B2B account is created
- **Location:** `server/src/controllers/auth.controller.js`
- **Data sent:**
  - User ID
  - Email, phone, name (hashed)

## 🔐 Privacy & Security

All personal information is **automatically hashed** using SHA-256 before sending to Facebook:

- ✅ Email addresses → Hashed
- ✅ Phone numbers → Normalized & hashed
- ✅ Names → Hashed
- ✅ City, state, zip → Hashed
- ❌ IP Address → NOT hashed (used for matching)
- ❌ User Agent → NOT hashed (used for matching)

**Example:**
```javascript
Email: "customer@example.com"
Sent as: "7b17fb0bd173f625b58636fb796407c22b3d16fc78302d79f0fd30c2fc2fc068"
```

## 🎨 Event Deduplication

To avoid counting the same event twice (once from Pixel, once from CAPI), we use **Event IDs**.

### How it Works:

1. **Backend** sends event with unique ID: `order_12345_1735430400000`
2. **Frontend Pixel** sends same event with same ID
3. **Facebook** deduplicates and counts as 1 event

### Frontend Implementation (Required)

You need to update your Meta Pixel code on the frontend to include event IDs. Here's how:

**In your `client/app/layout.tsx` (or checkout page):**

```javascript
// When user completes purchase
fbq('track', 'Purchase', {
  value: 142.52,
  currency: 'PKR',
}, {
  eventID: 'order_12345_1735430400000' // Same ID as backend
});
```

**Get the event ID from your order API response and pass it to the Pixel.**

## 📈 Monitor Your Events

### Meta Events Manager
1. Go to [Meta Events Manager](https://business.facebook.com/events_manager)
2. Select your Pixel (ID: 1230498898985591)
3. Click "Test Events" to see real-time events
4. Click "Overview" to see event metrics

### Key Metrics to Monitor:

1. **Event Match Quality**
   - Shows how well events match to Facebook accounts
   - Target: >70% match rate
   - Improve by sending more customer data (email, phone)

2. **Events Received**
   - Total events received from both Pixel and CAPI
   - Check that both sources are working

3. **Deduplication Rate**
   - Percentage of duplicate events removed
   - Target: High deduplication = good setup

## 🧪 Testing Your Implementation

### Using Test Event Code

1. In Meta Events Manager, go to "Test Events"
2. Copy your Test Event Code
3. Add to `.env`:
   ```env
   META_TEST_EVENT_CODE=TEST12345
   ```
4. Restart server
5. Perform actions (add to cart, register, purchase)
6. See events appear in real-time in Events Manager

### Manual Testing

1. **Test Purchase Event:**
   ```bash
   # Create an order through your API
   curl -X POST http://localhost:4000/v1/orders \
     -H "Content-Type: application/json" \
     -d '{"product_id": 1, "quantity": 1, ...}'
   ```

2. **Check Server Logs:**
   ```
   ✅ [Meta CAPI] Purchase event sent successfully {
     eventId: 'order_123_1735430400000',
     eventsReceived: 1,
     fbtrace_id: 'ABC123...'
   }
   ```

3. **Check Meta Events Manager** - Event should appear within seconds

## ⚠️ Troubleshooting

### "Access token not configured"
- Add `META_CAPI_ACCESS_TOKEN` to `.env`
- Restart server

### "Failed to send event"
- Check internet connection
- Verify access token is valid
- Check Meta Events Manager for error details

### Events not appearing in Meta
- Wait 1-2 minutes (can have delay)
- Check server logs for errors
- Verify Pixel ID matches
- Test with Test Event Code

### Low Event Match Quality
- Send more customer data (email, phone)
- Ensure phone numbers include country code (+92 for Pakistan)
- Check that fbp and fbc cookies are being captured

## 🔄 How the Code Works

### Architecture

```
Customer Action (Frontend)
    ↓
Backend API Endpoint
    ↓
Controller Function (order/cart/auth)
    ↓
Database Transaction
    ↓
setImmediate() → Non-blocking
    ↓
metaAPI.trackEvent()
    ↓
Hash Customer Data (SHA-256)
    ↓
Send to Meta Conversions API
    ↓
Response logged (✅ or ❌)
```

### Key Files

1. **`server/src/utils/metaConversionsAPI.js`**
   - Main CAPI utility class
   - Handles hashing, formatting, sending events
   - Reusable methods for all event types

2. **`server/src/controllers/order.controller.js`**
   - Tracks Purchase events
   - Line ~465-510 (after order creation)

3. **`server/src/controllers/cart.controller.js`**
   - Tracks AddToCart events
   - Lines ~523-545 (product) and ~672-694 (service)

4. **`server/src/controllers/auth.controller.js`**
   - Tracks CompleteRegistration events
   - Lines ~57-75 (registration) and ~147-165 (B2B)

### Non-Blocking Design

All Meta CAPI calls use `setImmediate()` to run asynchronously:

```javascript
setImmediate(async () => {
  try {
    await metaAPI.trackPurchase(...);
  } catch (error) {
    console.error('Meta tracking error:', error);
    // Error is logged but doesn't break main flow
  }
});
```

**Why?**
- Customer response is NOT delayed by Meta API
- If Meta is down, customer still gets their order
- Tracking is important but not critical to core functionality

## 📚 Additional Resources

- [Meta Conversions API Documentation](https://developers.facebook.com/docs/marketing-api/conversions-api)
- [Event Deduplication Guide](https://developers.facebook.com/docs/marketing-api/conversions-api/deduplicate-pixel-and-server-events)
- [Customer Information Parameters](https://developers.facebook.com/docs/marketing-api/conversions-api/parameters/customer-information-parameters)
- [Standard Events Reference](https://developers.facebook.com/docs/meta-pixel/reference)

## 🚀 Next Steps

1. ✅ Add environment variables to `.env`
2. ✅ Restart server
3. ✅ Test events using Test Event Code
4. ⏳ Implement event ID deduplication on frontend
5. ⏳ Monitor metrics in Meta Events Manager
6. ⏳ Optimize based on Event Match Quality score

## 💡 Pro Tips

1. **Include fbp and fbc cookies** in frontend requests
   - These improve event matching significantly
   - Capture from `_fbp` and `_fbc` cookies

2. **Send events as soon as they happen**
   - Don't batch events (we send immediately)
   - Freshness matters for ad optimization

3. **Include as much customer data as possible**
   - Email, phone, name, address
   - All data is hashed for privacy
   - More data = better matching = better results

4. **Monitor Dataset Quality metrics weekly**
   - Event Match Quality
   - Deduplication Rate
   - Data Freshness

5. **Use the same currency consistently**
   - We use PKR (Pakistani Rupee)
   - Make sure it matches your Pixel events

## 📞 Support

If you need help or have questions about the implementation, refer to:
- Meta Business Help Center
- Facebook Developer Docs
- This documentation

---

**Implementation Date:** December 29, 2025  
**Version:** 1.0.0  
**Status:** ✅ Production Ready

