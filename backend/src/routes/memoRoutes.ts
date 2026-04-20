import express from 'express';
import { getMemo, saveMemo } from '../controllers/memoController';
import { authMiddleware } from '../middleware/auth';

const router = express.Router();

router.use(authMiddleware);

router.get('/', getMemo);
router.post('/', saveMemo);

export default router;
