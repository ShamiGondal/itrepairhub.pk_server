import { Router } from 'express';
import { isAuth } from '../middleware/auth.middleware.js';
import { isAdmin } from '../middleware/admin.middleware.js';
import {
  getAllMedia,
  getMediaById,
  getMediaBySection,
  createMedia,
  updateMedia,
  deleteMedia,
  updateDisplayOrder,
} from '../controllers/media.controller.js';

const router = Router();

// Public routes (for SEO-optimized frontend)
router.get('/', getAllMedia); // GET /v1/media?section=hero_slider&is_active=true
router.get('/section/:section', getMediaBySection); // GET /v1/media/section/hero_slider
router.get('/:id', getMediaById); // GET /v1/media/:id

// Admin-only routes (require authentication + admin role)
router.post('/', isAuth, isAdmin, createMedia); // POST /v1/media
router.put('/:id', isAuth, isAdmin, updateMedia); // PUT /v1/media/:id
router.delete('/:id', isAuth, isAdmin, deleteMedia); // DELETE /v1/media/:id
router.put('/display-order/bulk', isAuth, isAdmin, updateDisplayOrder); // PUT /v1/media/display-order/bulk

export default router;

