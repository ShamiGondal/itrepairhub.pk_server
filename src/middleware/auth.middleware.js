import jwt from 'jsonwebtoken';

export function isAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!token) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      return res.status(500).json({ success: false, message: 'JWT secret not configured' });
    }

    const payload = jwt.verify(token, secret);
    req.user = {
      id: payload.id,
      role: payload.role,
      full_name: payload.full_name,
      email: payload.email,
    };

    return next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
}

/**
 * Optional authentication middleware
 * Sets req.user if token is valid, but doesn't fail if token is missing
 * Useful for public endpoints that can optionally use user context
 */
export function optionalAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!token) {
      // No token provided - continue without setting req.user
      return next();
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      // JWT secret not configured - continue without setting req.user
      return next();
    }

    try {
      const payload = jwt.verify(token, secret);
      req.user = {
        id: payload.id,
        role: payload.role,
        full_name: payload.full_name,
        email: payload.email,
      };
    } catch (err) {
      // Invalid or expired token - continue without setting req.user
      // Don't fail the request, just proceed without authentication
    }

    return next();
  } catch (err) {
    // Any other error - continue without setting req.user
    return next();
  }
}


