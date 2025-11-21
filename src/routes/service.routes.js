import { Router } from 'express';
import { isAuth } from '../middleware/auth.middleware.js';
import { isAdmin } from '../middleware/admin.middleware.js';
import {
  getAllServices,
  getServiceBySlug,
  createService,
  updateService,
  deleteService,
  addServiceImage,
  updateServiceImage,
  deleteServiceImage,
} from '../controllers/service.controller.js';

const router = Router();

// Public endpoints - SEO-critical for service listings and detail pages
router.get('/', getAllServices);
router.get('/:slug', getServiceBySlug);

// Admin endpoints - require authentication and admin role
router.post('/', isAuth, isAdmin, createService);
router.put('/:id', isAuth, isAdmin, updateService);
router.delete('/:id', isAuth, isAdmin, deleteService);

// Service image management endpoints
router.post('/:service_id/images', isAuth, isAdmin, addServiceImage);
router.put('/:service_id/images/:image_id', isAuth, isAdmin, updateServiceImage);
router.delete('/:service_id/images/:image_id', isAuth, isAdmin, deleteServiceImage);

export default router;

