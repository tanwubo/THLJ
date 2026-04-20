import express from 'express';
import multer from 'multer';
import { getAttachments, uploadAttachment, deleteAttachment } from '../controllers/attachmentController';
import { authMiddleware } from '../middleware/auth';

const router = express.Router();
const upload = multer({ dest: 'public/uploads/' });

router.use(authMiddleware);

router.get('/', getAttachments);
router.post('/', upload.single('file'), uploadAttachment);
router.delete('/:id', deleteAttachment);

export default router;
