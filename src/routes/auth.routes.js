import { Router } from 'express';
import passport from 'passport';
import { register, registerB2B, login, adminLogin, googleCallbackHandler, googleCredentialAuth, verifyToken } from '../controllers/auth.controller.js';
import { isAuth } from '../middleware/auth.middleware.js';

const router = Router();

// Local auth
router.post('/register', register);
router.post('/register/b2b', registerB2B);
router.post('/login', login);

// Admin login - Special endpoint for admin panel (allows Google-authenticated admins)
router.post('/admin/login', adminLogin);

// Token verification (protected route)
router.get('/verify', isAuth, verifyToken);

// Google OAuth
router.get(
  '/google',
  passport.authenticate('google', {
    scope: ['profile', 'email'],
    session: false,
  })
);

router.get(
  '/google/callback',
  passport.authenticate('google', { session: false, failureRedirect: '/auth/google/failure' }),
  googleCallbackHandler   
);

// New Google Identity Services endpoint (credential-based)
router.post('/google', googleCredentialAuth);

export default router;


