import { Router } from 'express';
import { requireAdmin } from '../middleware/admin.middleware.js';
import {
  getDashboardOverview,
  getSalesAnalytics,
  getRevenueAnalytics,
  getOrderAnalytics,
  getBookingAnalytics,
  getCustomerAnalytics,
  getProductAnalytics,
  getServiceAnalytics,
  getRecentActivities,
} from '../controllers/admin_dashboard.controller.js';

const router = Router();

// All routes require admin authentication
router.use(requireAdmin);

// Dashboard overview - All KPIs in one call
router.get('/overview', getDashboardOverview);

// Sales analytics - Daily, Monthly, Yearly
router.get('/sales', getSalesAnalytics);

// Revenue analytics - Payment gateway breakdown, trends
router.get('/revenue', getRevenueAnalytics);

// Order analytics - Status breakdown, trends
router.get('/orders', getOrderAnalytics);

// Booking analytics - Status breakdown, service type analysis
router.get('/bookings', getBookingAnalytics);

// Customer analytics - User types, growth, retention
router.get('/customers', getCustomerAnalytics);

// Product analytics - Stock, sales, categories
router.get('/products', getProductAnalytics);

// Service analytics - Bookings by service, revenue
router.get('/services', getServiceAnalytics);

// Recent activities - Latest orders, bookings, consultations
router.get('/activities', getRecentActivities);

export default router;

