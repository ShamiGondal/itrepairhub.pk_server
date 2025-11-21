import { Router } from 'express';
import authRoutes from './auth.routes.js';
import userRoutes from './user.routes.js';
import mediaRoutes from './media.routes.js';
import consultationRoutes from './consultation.routes.js';
import serviceCategoryRoutes from './serviceCategory.routes.js';
import serviceRoutes from './service.routes.js';

const router = Router();

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/media', mediaRoutes);
router.use('/consultations', consultationRoutes);
router.use('/service-categories', serviceCategoryRoutes);
router.use('/services', serviceRoutes);

export default router;

