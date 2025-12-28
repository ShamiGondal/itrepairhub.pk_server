import { Router } from 'express';
import { isAuth } from '../middleware/auth.middleware.js';
import { isAdmin } from '../middleware/admin.middleware.js';
import {
  getAllBookings,
  getBookingById,
  updateBookingStatus,
  updatePaymentStatus,
  assignTechnician,
  updateBookingDateTime,
  updateQuotedAmount,
  cancelBooking,
  addAdminNote,
  getTechnicians,
} from '../controllers/admin_booking.controller.js';

const router = Router();

// All admin booking routes require authentication and admin role
router.use(isAuth, isAdmin);

// Get all technicians (for assignment dropdown)
router.get('/technicians', getTechnicians);

// Get all bookings with filtering, pagination, and search
router.get('/', getAllBookings);

// Get booking by ID with full details
router.get('/:id', getBookingById);

// Update booking status
router.patch('/:id/status', updateBookingStatus);

// Update payment status (for fixed price services)
router.patch('/:id/payment-status', updatePaymentStatus);

// Assign technician to booking
router.patch('/:id/technician', assignTechnician);

// Update booking date and time
router.patch('/:id/datetime', updateBookingDateTime);

// Update quoted amount (for variable price services)
router.patch('/:id/quoted-amount', updateQuotedAmount);

// Cancel booking
router.post('/:id/cancel', cancelBooking);

// Add admin note to booking
router.post('/:id/notes', addAdminNote);

export default router;

