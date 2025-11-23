import { Router } from 'express';
import { isAuth } from '../middleware/auth.middleware.js';
import {
  getAllUsedLaptops,
  getUsedLaptopBySlug,
  createSellRequest,
} from '../controllers/usedLaptop.controller.js';

const router = Router();

// Public endpoints - SEO-critical for marketplace listings and detail pages
router.get('/', getAllUsedLaptops);
router.get('/:slug', getUsedLaptopBySlug);

// Protected endpoints - require authentication
router.post('/sell-request', isAuth, createSellRequest);

export default router;

