import { Router } from 'express';
import { requireAdmin } from '../middleware/admin.middleware.js';
import {
  getAllSellRequests,
  getSellRequestById,
  updateSellRequestStatus,
  updateSellRequestPrices,
  addInspectionNotes,
} from '../controllers/admin_sell_request.controller.js';

const router = Router();

// All routes require admin authentication
router.use(requireAdmin);

// Get all sell requests with filtering and pagination
router.get('/', getAllSellRequests);

// Get sell request by ID with full details
router.get('/:id', getSellRequestById);

// Update sell request status
router.patch('/:id/status', updateSellRequestStatus);

// Update sell request prices (estimated_price, final_offer_price)
router.patch('/:id/prices', updateSellRequestPrices);

// Add inspection notes/comments
router.post('/:id/notes', addInspectionNotes);

export default router;

