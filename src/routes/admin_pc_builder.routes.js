import { Router } from 'express';
import { requireAdmin } from '../middleware/admin.middleware.js';
import {
  getAllCompatibilityRules,
  getCompatibilityRuleById,
  createCompatibilityRule,
  updateCompatibilityRule,
  deleteCompatibilityRule,
  getAllCustomPCBuilds,
  getCustomPCBuildById,
} from '../controllers/admin_pc_builder.controller.js';

const router = Router();

// All routes require admin authentication
router.use(requireAdmin);

// Compatibility Rules Routes
router.get('/compatibility-rules', getAllCompatibilityRules);
router.get('/compatibility-rules/:id', getCompatibilityRuleById);
router.post('/compatibility-rules', createCompatibilityRule);
router.put('/compatibility-rules/:id', updateCompatibilityRule);
router.delete('/compatibility-rules/:id', deleteCompatibilityRule);

// Custom PC Builds Routes
router.get('/custom-builds', getAllCustomPCBuilds);
router.get('/custom-builds/:id', getCustomPCBuildById);

export default router;

