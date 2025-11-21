import { Router } from 'express';
import { isAuth, optionalAuth } from '../middleware/auth.middleware.js';
import {
  createConsultation,
  getMyConsultations,
  getConsultationById,
  updateConsultation,
  deleteConsultation,
} from '../controllers/consultation.controller.js';

const router = Router();

// Public endpoint with optional auth - guests can book, logged-in users will have user_id set
router.post('/', optionalAuth, createConsultation);

// Authenticated endpoints - users can manage their own consultations
router.get('/me', isAuth, getMyConsultations);
router.get('/:id', isAuth, getConsultationById);
router.put('/:id', isAuth, updateConsultation);
router.delete('/:id', isAuth, deleteConsultation);

export default router;

