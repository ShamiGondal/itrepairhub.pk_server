import { Router } from 'express';
import { isAuth } from '../middleware/auth.middleware.js';
import {
  // Profile
  getMe,
  updateMe,
  updatePassword,
  // Addresses
  getMyAddresses,
  getMyAddress,
  addMyAddress,
  updateMyAddress,
  deleteMyAddress,
  // Orders
  getMyOrders,
  getMyOrder,
  cancelMyOrder,
  // Bookings
  getMyBookings,
  getMyBooking,
  cancelMyBooking,
  // Consultations
  getMyConsultations,
  getMyConsultation,
  // PC Builds
  getMyPCBuilds,
  getMyPCBuild,
  // Reviews
  getMyReviews,
  // Sell Requests
  getMySellRequests,
  getMySellRequest,
  // Stats
  getMyStats,
} from '../controllers/user.controller.js';

const router = Router();

// ===== Profile Routes =====
router.get('/profile', isAuth, getMe);
router.put('/profile', isAuth, updateMe);
router.put('/password', isAuth, updatePassword);

  // ===== Address Routes =====
router.get('/addresses', isAuth, getMyAddresses);
router.post('/addresses', isAuth, addMyAddress);
router.get('/addresses/:id', isAuth, getMyAddress);
router.put('/addresses/:id', isAuth, updateMyAddress);
router.delete('/addresses/:id', isAuth, deleteMyAddress);

// ===== Order Routes =====
router.get('/orders', isAuth, getMyOrders);
router.get('/orders/:id', isAuth, getMyOrder);
router.post('/orders/:id/cancel', isAuth, cancelMyOrder);

// ===== Booking Routes =====
router.get('/bookings', isAuth, getMyBookings);
router.get('/bookings/:id', isAuth, getMyBooking);
router.post('/bookings/:id/cancel', isAuth, cancelMyBooking);

// ===== Consultation Routes =====
router.get('/consultations', isAuth, getMyConsultations);
router.get('/consultations/:id', isAuth, getMyConsultation);

// ===== PC Build Routes =====
router.get('/pc-builds', isAuth, getMyPCBuilds);
router.get('/pc-builds/:id', isAuth, getMyPCBuild);

// ===== Review Routes =====
router.get('/reviews', isAuth, getMyReviews);

// ===== Sell Request Routes =====
router.get('/sell-requests', isAuth, getMySellRequests);
router.get('/sell-requests/:id', isAuth, getMySellRequest);

// ===== Stats Route =====
router.get('/stats', isAuth, getMyStats);

export default router;


