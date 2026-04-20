import express from 'express';
import { getTodos, createTodo, updateTodo, deleteTodo, updateTodoStatus } from '../controllers/todoController';
import { authMiddleware } from '../middleware/auth';

const router = express.Router();

router.use(authMiddleware);

router.get('/', getTodos);
router.post('/', createTodo);
router.put('/:id', updateTodo);
router.delete('/:id', deleteTodo);
router.put('/:id/status', updateTodoStatus);

export default router;
