import { Router } from 'express';
import { optionalAuth } from '../middleware/auth.middleware.js';
import {
  getCart,
  addToCart,
  addServiceToCart,
  updateCartItem,
  removeFromCart,
  applyPromoCode,
  removePromoCode,
  clearCart,
} from '../controllers/cart.controller.js';

const router = Router();

// All endpoints use optionalAuth to support both logged-in and guest users
router.get('/', optionalAuth, getCart);
router.post('/items', optionalAuth, addToCart);
router.post('/services', optionalAuth, addServiceToCart);
router.put('/items/:id', optionalAuth, updateCartItem);
router.delete('/items/:id', optionalAuth, removeFromCart);
router.post('/promo-code', optionalAuth, applyPromoCode);
router.delete('/promo-code', optionalAuth, removePromoCode);
router.delete('/', optionalAuth, clearCart);

export default router;

