import { isAuth } from './auth.middleware.js';

/**
 * Middleware to check if user is admin
 * Must be used after isAuth middleware
 */
export function isAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Authentication required' });
  }

  if (req.user.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Admin access required' });
  }

  return next();
}

/**
 * Combined middleware: requires authentication AND admin role
 */
export function requireAdmin(req, res, next) {
  isAuth(req, res, (err) => {
    if (err) return next(err);
    isAdmin(req, res, next);
  });
}

