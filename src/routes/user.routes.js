import { Router } from 'express';
import { isAuth } from '../middleware/auth.middleware.js';
import {
  getMe,
  updateMe,
  getMyAddresses,
  addMyAddress,
  deleteMyAddress,
} from '../controllers/user.controller.js';

const router = Router();

router.get('/me', isAuth, getMe);
router.put('/me', isAuth, updateMe);

router.get('/me/addresses', isAuth, getMyAddresses);
router.post('/me/addresses', isAuth, addMyAddress);
router.delete('/me/addresses/:id', isAuth, deleteMyAddress);

export default router;


