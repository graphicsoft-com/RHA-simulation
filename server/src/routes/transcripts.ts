import { Router } from 'express';
import {
  getSessionsByRoom,
  getMessagesBySession,
} from '../controllers/transcriptController.js';


const router = Router();

router.get('/:roomId', getSessionsByRoom);
router.get('/:sessionId/messages', getMessagesBySession);

export default router;
