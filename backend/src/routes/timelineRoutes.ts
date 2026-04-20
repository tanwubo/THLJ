import express from 'express';
import { getTimeline, createNode, updateNode, deleteNode, updateNodeOrder } from '../controllers/timelineController';
import { authMiddleware } from '../middleware/auth';

const router = express.Router();

router.use(authMiddleware);

router.get('/', getTimeline);
router.post('/', createNode);
router.put('/:id', updateNode);
router.delete('/:id', deleteNode);
router.post('/update-order', updateNodeOrder);

export default router;
