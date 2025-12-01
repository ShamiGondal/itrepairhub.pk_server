import { Router } from 'express';
import { isAuth } from '../middleware/auth.middleware.js';
import {
  getComponentTypes,
  getComponentsByType,
  getCompatibilityRules,
  validateConfiguration,
  calculatePrice,
  saveBuild,
  checkoutBuild,
} from '../controllers/pcBuilder.controller.js';

const router = Router();

// Public endpoints - SEO-critical for PC Builder
router.get('/component-types', getComponentTypes);
router.get('/components/:type', getComponentsByType);
router.get('/compatibility-rules', getCompatibilityRules);

// Public endpoints - Real-time validation and pricing (SSR)
router.post('/validate', validateConfiguration);
router.post('/calculate-price', calculatePrice);

// Save build - optional auth (guests can save too)
router.post('/save-build', saveBuild);

// Checkout build - requires authentication
router.post('/checkout', isAuth, checkoutBuild);

export default router;

