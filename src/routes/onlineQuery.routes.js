import { Router } from 'express';
import { createOnlineQuery } from '../controllers/onlineQuery.controller.js';

const router = Router();

// Public endpoint – accepts guest and logged-in user submissions
router.post('/', createOnlineQuery);

export default router;


