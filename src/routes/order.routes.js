import { Router } from 'express';
import { isAuth, optionalAuth } from '../middleware/auth.middleware.js';
import {
  createOrder,
  getOrderById,
} from '../controllers/order.controller.js';

const router = Router();

// Create order from cart - supports both logged-in and guest users
router.post('/', optionalAuth, createOrder);

// Get order by ID - requires authentication (user can only view their own)
router.get('/:id', isAuth, getOrderById);

export default router;

