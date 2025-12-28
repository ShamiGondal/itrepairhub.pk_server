import { Router } from 'express';
import { requireAdmin } from '../middleware/admin.middleware.js';
import {
  getAdminProfile,
  updateAdminProfile,
  changeAdminPassword,
} from '../controllers/admin_settings.controller.js';

const router = Router();

// All routes require admin authentication
router.use(requireAdmin);

// Get admin profile
router.get('/profile', getAdminProfile);

// Update admin profile
router.put('/profile', updateAdminProfile);

// Change admin password
router.post('/change-password', changeAdminPassword);

export default router;

