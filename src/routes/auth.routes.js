import { Router } from 'express';
import passport from 'passport';
import { register, registerB2B, login, googleCallbackHandler, googleCredentialAuth } from '../controllers/auth.controller.js';

const router = Router();

// Local auth
router.post('/register', register);
router.post('/register/b2b', registerB2B);
router.post('/login', login);

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


