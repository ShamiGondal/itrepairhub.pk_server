import { Router } from 'express';
import { isAuth, optionalAuth } from '../middleware/auth.middleware.js';
import {
  createBooking,
  getMyBookings,
  getBookingById,
  getMyAddresses,
} from '../controllers/booking.controller.js';

const router = Router();

// Public endpoint with optional auth - guests can book, logged-in users will have user_id set
router.post('/', optionalAuth, createBooking);

// Authenticated endpoints - users can manage their own bookings
router.get('/me', isAuth, getMyBookings);
router.get('/addresses', isAuth, getMyAddresses);
router.get('/:id', isAuth, getBookingById);

export default router;

