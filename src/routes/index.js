import { Router } from 'express';
import authRoutes from './auth.routes.js';
import userRoutes from './user.routes.js';
import mediaRoutes from './media.routes.js';
import consultationRoutes from './consultation.routes.js';
import bookingRoutes from './booking.routes.js';
import serviceCategoryRoutes from './serviceCategory.routes.js';
import serviceRoutes from './service.routes.js';
import productCategoryRoutes from './productCategory.routes.js';
import productRoutes from './product.routes.js';
import promoCodeRoutes from './promoCode.routes.js';

const router = Router();

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/media', mediaRoutes);
router.use('/consultations', consultationRoutes);
router.use('/bookings', bookingRoutes);
router.use('/service-categories', serviceCategoryRoutes);
router.use('/services', serviceRoutes);
router.use('/product-categories', productCategoryRoutes);
router.use('/products', productRoutes);
router.use('/promo-codes', promoCodeRoutes);

export default router;

