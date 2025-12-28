import { Router } from 'express';
import { isAuth } from '../middleware/auth.middleware.js';
import { isAdmin } from '../middleware/admin.middleware.js';
import {
  getAllOrders,
  getOrderById,
  updateOrderStatus,
  updatePaymentStatus,
  cancelOrder,
  refundOrder,
  addOrderNote,
} from '../controllers/admin_order.controller.js';

const router = Router();

// All admin order routes require authentication and admin role
router.use(isAuth, isAdmin);

// Get all orders with filtering, pagination, and search
router.get('/', getAllOrders);

// Get order by ID with full details
router.get('/:id', getOrderById);

// Update order status
router.patch('/:id/status', updateOrderStatus);

// Update payment status
router.patch('/:id/payment-status', updatePaymentStatus);

// Cancel order
router.post('/:id/cancel', cancelOrder);

// Refund order
router.post('/:id/refund', refundOrder);

// Add admin note to order
router.post('/:id/notes', addOrderNote);

export default router;

