import { Router } from 'express';
import { optionalAuth } from '../middleware/auth.middleware.js';
import {
  getServiceReviews,
  getProductReviews,
  createServiceReview,
  createProductReview,
} from '../controllers/review.controller.js';

const router = Router();

// Public endpoints - SEO-critical for review listings
router.get('/services/:service_id', getServiceReviews);
router.get('/products/:product_id', getProductReviews);

// Review creation endpoints - support both authenticated users and guests
// Uses optionalAuth to allow guests to post reviews via email
router.post('/services/:service_id', optionalAuth, createServiceReview);
router.post('/products/:product_id', optionalAuth, createProductReview);

export default router;

