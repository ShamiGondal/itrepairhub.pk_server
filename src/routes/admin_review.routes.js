import { Router } from 'express';
import { requireAdmin } from '../middleware/admin.middleware.js';
import {
  getAllReviews,
  getReviewById,
  approveReview,
  rejectReview,
  deleteReview,
  updateReviewRating,
} from '../controllers/admin_review.controller.js';

const router = Router();

// All routes require admin authentication
router.use(requireAdmin);

// Get all reviews with filtering and pagination
router.get('/', getAllReviews);

// Get review by ID with full details
router.get('/:id', getReviewById);

// Approve review
router.patch('/:id/approve', approveReview);

// Reject review (set is_approved to false)
router.patch('/:id/reject', rejectReview);

// Delete review
router.delete('/:id', deleteReview);

// Update review rating (if needed for corrections)
router.patch('/:id/rating', updateReviewRating);

export default router;

