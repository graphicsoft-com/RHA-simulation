import { Request, Response } from 'express';
import Session from '../models/Session.js';
import Message from '../models/Message.js';
import { ALL_ROOMS } from '../../../shared-types/src/index.js';


// Returns paginated list of past sessions for a room
export async function getSessionsByRoom(req: Request, res: Response): Promise<void> {
  const roomId = req.params['roomId'] as string;
  const page = parseInt(req.query['page'] as string) || 1;
  const limit = parseInt(req.query['limit'] as string) || 10;
  const skip = (page - 1) * limit;

  if (!ALL_ROOMS.includes(roomId)) {
    res.status(400).json({ success: false, error: 'Invalid roomId' });
    return;
  }

  try {
    const [sessions, total] = await Promise.all([
      Session.find({ roomId })
        .sort({ startTime: -1 })    // newest first
        .skip(skip)
        .limit(limit)
        .lean(),
      Session.countDocuments({ roomId }),
    ]);

    res.json({
      success: true,
      data: {
        sessions,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          hasMore: skip + sessions.length < total,
        },
      },
    });
  } catch (err) {
    console.error('❌  Failed to fetch sessions:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch sessions' });
  }
}

// ── GET /api/transcripts/:sessionId/messages ───────────────────────────────
// Returns all messages for a specific session in chronological order
export async function getMessagesBySession(req: Request, res: Response): Promise<void> {
  const sessionId = req.params['sessionId'] as string;

  try {
    // Verify session exists first
    const session = await Session.findById(sessionId).lean();
    if (!session) {
      res.status(404).json({ success: false, error: 'Session not found' });
      return;
    }

    const messages = await Message.find({ sessionId })
      .sort({ timestamp: 1 })   // chronological order
      .lean();

    res.json({
      success: true,
      data: {
        session,
        messages,
        messageCount: messages.length,
      },
    });
  } catch (err) {
    console.error('❌  Failed to fetch messages:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch messages' });
  }
}
