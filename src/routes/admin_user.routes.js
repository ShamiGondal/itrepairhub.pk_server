import { Router } from 'express';
import { requireAdmin } from '../middleware/admin.middleware.js';
import {
  getAllUsers,
  getUserById,
  updateUserRole,
  getAllGuestUsers,
  getGuestUserById,
} from '../controllers/admin_user.controller.js';

const router = Router();

// All routes require admin authentication
router.use(requireAdmin);

// Get all guest users with filtering, pagination, and statistics (must come before /:id)
router.get('/guests', getAllGuestUsers);

// Get guest user by ID with full details and statistics (must come before /:id)
router.get('/guests/:id', getGuestUserById);

// Get all system users with filtering, pagination, and statistics
router.get('/', getAllUsers);

// Get system user by ID with full details and statistics
router.get('/:id', getUserById);

// Update user role
router.patch('/:id/role', updateUserRole);

// Update user status (if you add an active/inactive status field)
// router.patch('/:id/status', updateUserStatus);

export default router;

