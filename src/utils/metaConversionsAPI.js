import crypto from 'crypto';
import axios from 'axios';

/**
 * Meta Conversions API (CAPI) Utility
 * 
 * This service sends server-side events to Facebook's Conversions API
 * to track user actions for better ad targeting and measurement.
 * 
 * Key Benefits:
 * 1. More reliable tracking (not affected by ad blockers)
 * 2. Better event matching with hashed user data
 * 3. Improved attribution accuracy
 * 4. Works with Meta Pixel for deduplication
 * 
 * Documentation: https://developers.facebook.com/docs/marketing-api/conversions-api
 */

class MetaConversionsAPI {
  constructor() {
    // Meta Pixel ID (from Meta Events Manager)
    this.pixelId = process.env.META_PIXEL_ID || '1230498898985591';
    
    // Access Token (from Meta Events Manager)
    this.accessToken = process.env.META_CAPI_ACCESS_TOKEN;
    
    // API Version
    this.apiVersion = 'v21.0';
    
    // API Endpoint
    this.apiUrl = `https://graph.facebook.com/${this.apiVersion}/${this.pixelId}/events`;
    
    // Test Event Code (optional - for testing in Events Manager)
    this.testEventCode = process.env.META_TEST_EVENT_CODE || null;
    
    // Check if CAPI is enabled
    this.isEnabled = !!this.accessToken;
    
    if (!this.isEnabled) {
      console.warn('⚠️  Meta Conversions API: Access token not configured. Events will not be sent.');
    }
  }

  /**
   * Hash data using SHA-256 (required by Meta for PII)
   * Meta requires all personal data to be hashed before sending
   */
  hash(data) {
    if (!data) return null;
    
    // Normalize: trim whitespace, convert to lowercase
    const normalized = String(data).trim().toLowerCase();
    
    // Return SHA-256 hash
    return crypto.createHash('sha256').update(normalized).digest('hex');
  }

  /**
   * Normalize and hash email
   */
  hashEmail(email) {
    if (!email) return null;
    return this.hash(email);
  }

  /**
   * Normalize and hash phone number
   * Remove all non-numeric characters except leading +
   */
  hashPhone(phone) {
    if (!phone) return null;
    
    // Remove all spaces, dashes, parentheses
    let normalized = String(phone).trim().replace(/[\s\-()]/g, '');
    
    // Keep leading + for international format
    if (!normalized.startsWith('+')) {
      // If no country code, assume Pakistan (+92)
      if (!normalized.startsWith('92')) {
        // Remove leading 0 if present
        if (normalized.startsWith('0')) {
          normalized = '92' + normalized.substring(1);
        } else {
          normalized = '92' + normalized;
        }
      }
      normalized = '+' + normalized;
    }
    
    return this.hash(normalized);
  }

  /**
   * Hash other PII data (name, city, state, etc.)
   */
  hashPII(data) {
    if (!data) return null;
    return this.hash(data);
  }

  /**
   * Extract user data from request and create hashed user_data object
   */
  extractUserData(req, userData = {}) {
    const user_data = {};

    // Email (hashed)
    if (userData.email) {
      user_data.em = [this.hashEmail(userData.email)];
    } else if (req.user?.email) {
      user_data.em = [this.hashEmail(req.user.email)];
    }

    // Phone (hashed)
    if (userData.phone) {
      user_data.ph = [this.hashPhone(userData.phone)];
    } else if (req.user?.phone_number) {
      user_data.ph = [this.hashPhone(req.user.phone_number)];
    }

    // First Name (hashed)
    if (userData.first_name) {
      user_data.fn = [this.hashPII(userData.first_name)];
    } else if (req.user?.full_name) {
      const firstName = req.user.full_name.split(' ')[0];
      user_data.fn = [this.hashPII(firstName)];
    }

    // Last Name (hashed)
    if (userData.last_name) {
      user_data.ln = [this.hashPII(userData.last_name)];
    } else if (req.user?.full_name) {
      const nameParts = req.user.full_name.split(' ');
      if (nameParts.length > 1) {
        user_data.ln = [this.hashPII(nameParts[nameParts.length - 1])];
      }
    }

    // City (hashed)
    if (userData.city) {
      user_data.ct = [this.hashPII(userData.city)];
    }

    // State (hashed)
    if (userData.state) {
      user_data.st = [this.hashPII(userData.state)];
    }

    // Zip Code (hashed)
    if (userData.zip) {
      user_data.zp = [this.hashPII(userData.zip)];
    }

    // Country (hashed) - ISO 2-letter code
    if (userData.country) {
      user_data.country = [this.hashPII(userData.country)];
    } else {
      // Default to Pakistan
      user_data.country = [this.hashPII('pk')];
    }

    // Client IP Address (NOT hashed - Meta uses it for matching)
    const clientIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim() 
                     || req.headers['x-real-ip'] 
                     || req.socket?.remoteAddress 
                     || req.ip;
    if (clientIp) {
      user_data.client_ip_address = clientIp;
    }

    // Client User Agent (NOT hashed)
    if (req.headers['user-agent']) {
      user_data.client_user_agent = req.headers['user-agent'];
    }

    // Facebook Click ID (fbc) - NOT hashed
    // This comes from URL parameter fbclid or cookie _fbc
    const fbc = req.cookies?._fbc || req.body?.fbc || req.query?.fbclid;
    if (fbc) {
      user_data.fbc = fbc;
    }

    // Facebook Browser ID (fbp) - NOT hashed
    // This comes from the Meta Pixel cookie _fbp
    const fbp = req.cookies?._fbp || req.body?.fbp;
    if (fbp) {
      user_data.fbp = fbp;
    }

    return user_data;
  }

  /**
   * Send event to Meta Conversions API
   * 
   * @param {string} eventName - Standard event name (e.g., 'Purchase', 'AddToCart', 'ViewContent')
   * @param {object} req - Express request object
   * @param {object} options - Additional event data
   *   - eventId: Unique ID for deduplication with Pixel (recommended)
   *   - eventSourceUrl: URL where event occurred
   *   - customData: Object with currency, value, content_ids, etc.
   *   - userData: Additional user data (email, phone, etc.)
   */
  async sendEvent(eventName, req, options = {}) {
    if (!this.isEnabled) {
      console.log(`[Meta CAPI] Skipping ${eventName} - not configured`);
      return { success: false, message: 'CAPI not configured' };
    }

    try {
      const eventTime = Math.floor(Date.now() / 1000); // Unix timestamp in seconds

      // Build user_data from request + additional userData
      const user_data = this.extractUserData(req, options.userData || {});

      // Build event data
      const eventData = {
        event_name: eventName,
        event_time: eventTime,
        action_source: 'website', // Can be 'website', 'app', 'email', 'phone_call', etc.
        user_data: user_data,
      };

      // Event ID for deduplication (IMPORTANT: same ID should be used in Pixel)
      if (options.eventId) {
        eventData.event_id = options.eventId;
      }

      // Event Source URL (the page where event occurred)
      if (options.eventSourceUrl) {
        eventData.event_source_url = options.eventSourceUrl;
      } else if (req.headers.referer || req.headers.origin) {
        eventData.event_source_url = req.headers.referer || req.headers.origin;
      }

      // Custom Data (transaction details)
      if (options.customData) {
        eventData.custom_data = options.customData;
      }

      // Build request payload
      const payload = {
        data: [eventData],
      };

      // Add test event code if configured (for testing in Events Manager)
      if (this.testEventCode) {
        payload.test_event_code = this.testEventCode;
      }

      // Send to Meta
      const response = await axios.post(
        this.apiUrl,
        payload,
        {
          params: {
            access_token: this.accessToken,
          },
          headers: {
            'Content-Type': 'application/json',
          },
          timeout: 5000, // 5 second timeout
        }
      );

      console.log(`✅ [Meta CAPI] ${eventName} event sent successfully`, {
        eventId: options.eventId,
        eventsReceived: response.data?.events_received,
        fbtrace_id: response.data?.fbtrace_id,
      });

      return {
        success: true,
        data: response.data,
      };
    } catch (error) {
      console.error(`❌ [Meta CAPI] Failed to send ${eventName} event:`, {
        message: error.message,
        response: error.response?.data,
      });

      // Don't throw error - we don't want to break the main flow
      return {
        success: false,
        error: error.message,
        details: error.response?.data,
      };
    }
  }

  /**
   * Track Purchase Event
   * Sent when a customer completes a purchase
   */
  async trackPurchase(req, orderData) {
    const eventId = `order_${orderData.orderId}_${Date.now()}`;
    
    return await this.sendEvent('Purchase', req, {
      eventId,
      eventSourceUrl: orderData.eventSourceUrl || `${process.env.FRONTEND_URL}/checkout`,
      customData: {
        currency: orderData.currency || 'PKR',
        value: parseFloat(orderData.totalAmount) || 0,
        content_ids: orderData.productIds || [],
        content_type: 'product',
        num_items: orderData.itemCount || 1,
      },
      userData: orderData.userData || {},
    });
  }

  /**
   * Track Add to Cart Event
   * Sent when a customer adds an item to cart
   */
  async trackAddToCart(req, cartData) {
    const eventId = `cart_${cartData.cartItemId}_${Date.now()}`;
    
    return await this.sendEvent('AddToCart', req, {
      eventId,
      eventSourceUrl: cartData.eventSourceUrl,
      customData: {
        currency: cartData.currency || 'PKR',
        value: parseFloat(cartData.price) || 0,
        content_ids: [cartData.productId || cartData.serviceId],
        content_name: cartData.productName || cartData.serviceName,
        content_type: cartData.productId ? 'product' : 'service',
        quantity: cartData.quantity || 1,
      },
      userData: cartData.userData || {},
    });
  }

  /**
   * Track Initiate Checkout Event
   * Sent when customer starts checkout process
   */
  async trackInitiateCheckout(req, checkoutData) {
    const eventId = `checkout_${checkoutData.cartId}_${Date.now()}`;
    
    return await this.sendEvent('InitiateCheckout', req, {
      eventId,
      eventSourceUrl: checkoutData.eventSourceUrl || `${process.env.FRONTEND_URL}/checkout`,
      customData: {
        currency: checkoutData.currency || 'PKR',
        value: parseFloat(checkoutData.totalAmount) || 0,
        content_ids: checkoutData.productIds || [],
        num_items: checkoutData.itemCount || 1,
      },
      userData: checkoutData.userData || {},
    });
  }

  /**
   * Track Add Payment Info Event
   * Sent when customer enters payment information
   */
  async trackAddPaymentInfo(req, paymentData) {
    const eventId = `payment_${paymentData.orderId}_${Date.now()}`;
    
    return await this.sendEvent('AddPaymentInfo', req, {
      eventId,
      eventSourceUrl: paymentData.eventSourceUrl || `${process.env.FRONTEND_URL}/checkout`,
      customData: {
        currency: paymentData.currency || 'PKR',
        value: parseFloat(paymentData.amount) || 0,
      },
      userData: paymentData.userData || {},
    });
  }

  /**
   * Track Complete Registration Event
   * Sent when a new user registers
   */
  async trackCompleteRegistration(req, userData) {
    const eventId = `registration_${userData.userId}_${Date.now()}`;
    
    return await this.sendEvent('CompleteRegistration', req, {
      eventId,
      eventSourceUrl: userData.eventSourceUrl || `${process.env.FRONTEND_URL}/register`,
      customData: {
        status: 'success',
      },
      userData: userData,
    });
  }

  /**
   * Track View Content Event
   * Sent when customer views a product or service page
   */
  async trackViewContent(req, contentData) {
    const eventId = `view_${contentData.contentId}_${Date.now()}`;
    
    return await this.sendEvent('ViewContent', req, {
      eventId,
      eventSourceUrl: contentData.eventSourceUrl,
      customData: {
        content_ids: [contentData.contentId],
        content_name: contentData.contentName,
        content_type: contentData.contentType || 'product',
        currency: contentData.currency || 'PKR',
        value: parseFloat(contentData.price) || 0,
      },
      userData: contentData.userData || {},
    });
  }

  /**
   * Track Contact Event
   * Sent when customer contacts business (form submission, chat, etc.)
   */
  async trackContact(req, contactData) {
    const eventId = `contact_${Date.now()}`;
    
    return await this.sendEvent('Contact', req, {
      eventId,
      eventSourceUrl: contactData.eventSourceUrl || `${process.env.FRONTEND_URL}/contact`,
      customData: {
        contact_type: contactData.contactType || 'form', // 'form', 'chat', 'phone', 'email'
      },
      userData: contactData.userData || {},
    });
  }

  /**
   * Track Find Location Event
   * Sent when customer views location/contact info
   */
  async trackFindLocation(req, locationData) {
    const eventId = `location_${Date.now()}`;
    
    return await this.sendEvent('FindLocation', req, {
      eventId,
      eventSourceUrl: locationData.eventSourceUrl || `${process.env.FRONTEND_URL}/contact`,
      userData: locationData.userData || {},
    });
  }
}

// Export singleton instance
export const metaAPI = new MetaConversionsAPI();

// Export class for testing
export default MetaConversionsAPI;

