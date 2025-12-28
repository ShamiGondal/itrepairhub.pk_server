import { Router } from 'express';
import { requireAdmin } from '../middleware/admin.middleware.js';
import {
  getAllConsultations,
  getConsultationById,
  updateConsultationStatus,
  updateConsultationDetails,
  deleteConsultation,
} from '../controllers/admin_consultation.controller.js';

const router = Router();

// All routes require admin authentication
router.use(requireAdmin);

// Get all consultations with filtering and pagination
router.get('/', getAllConsultations);

// Get consultation by ID with full details
router.get('/:id', getConsultationById);

// Update consultation status
router.patch('/:id/status', updateConsultationStatus);

// Update consultation details (scheduled_at, type, contact info)
router.patch('/:id/details', updateConsultationDetails);

// Delete consultation
router.delete('/:id', deleteConsultation);

export default router;

