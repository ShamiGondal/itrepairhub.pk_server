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


