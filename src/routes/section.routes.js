import { Router } from 'express';
import { getAllSections } from '../controllers/section.controller.js';

const router = Router();

// Public endpoint - no auth required for dropdowns
router.get('/', getAllSections);

export default router;

