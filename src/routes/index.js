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
import usedLaptopRoutes from './usedLaptop.routes.js';
import promoCodeRoutes from './promoCode.routes.js';
import cartRoutes from './cart.routes.js';
import orderRoutes from './order.routes.js';
import pcBuilderRoutes from './pcBuilder.routes.js';
import reviewRoutes from './review.routes.js';
import onlineQueryRoutes from './onlineQuery.routes.js';

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
router.use('/used-laptops-marketplace', usedLaptopRoutes);
router.use('/promo-codes', promoCodeRoutes);
router.use('/cart', cartRoutes);
router.use('/orders', orderRoutes);
router.use('/pc-builder', pcBuilderRoutes);
router.use('/reviews', reviewRoutes);
router.use('/online-queries', onlineQueryRoutes);

export default router;

