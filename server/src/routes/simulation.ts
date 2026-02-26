import { Router } from 'express';
import {
  startSimulation,
  stopSimulation,
  getAllRoomStatuses,
} from '../controllers/simulationController.js';


const router = Router();

router.post('/start/:roomId', startSimulation);
router.post('/stop/:roomId', stopSimulation);
router.get('/status', getAllRoomStatuses);

export default router;
