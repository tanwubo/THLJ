import express from 'express'
import { authMiddleware } from '../middleware/auth'
import {
  applyTimelineTemplate,
  createTimelineTemplate,
  deleteTimelineTemplate,
  getTimelineTemplate,
  listTimelineTemplates,
  updateTimelineTemplate,
} from '../controllers/timelineTemplateController'

const router = express.Router()

router.use(authMiddleware)

router.get('/', listTimelineTemplates)
router.post('/apply', applyTimelineTemplate)
router.get('/:id', getTimelineTemplate)
router.post('/', createTimelineTemplate)
router.put('/:id', updateTimelineTemplate)
router.delete('/:id', deleteTimelineTemplate)

export default router
