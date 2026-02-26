import mongoose, { Document, Schema } from 'mongoose';
import { IMessage, IAgentRole } from '@org/shared-types';

// ─────────────────────────────────────────────
//  Message Model
//  Every single line spoken in a session
//  — clinician or patient — gets one document
// ─────────────────────────────────────────────

export interface IMessageDocument extends Omit<IMessage, '_id' | 'sessionId'>, Document {
  sessionId: mongoose.Types.ObjectId;
}

const MessageSchema = new Schema<IMessageDocument>(
  {
    sessionId: {
      type: Schema.Types.ObjectId,
      ref: 'Session',
      required: [true, 'sessionId is required'],
      index: true,
    },

    roomId: {
      type: String,
      required: [true, 'roomId is required'],
      enum: ['room1', 'room2', 'room3', 'room4', 'room5', 'room6'],
      index: true,
    },

    role: {
      type: String,
      enum: ['clinician', 'patient'] satisfies IAgentRole[],
      required: [true, 'role is required'],
    },

    // The actual spoken text from the AI agent
    text: {
      type: String,
      required: [true, 'text is required'],
      trim: true,
      maxlength: [2000, 'Message text too long'],
    },

    timestamp: {
      type: Date,
      default: () => new Date(),
      index: true,
    },
  },
  {
    versionKey: false,
  }
);

// Compound index — fetch all messages for a session in order
MessageSchema.index({ sessionId: 1, timestamp: 1 });

// Compound index — fetch all messages for a room across sessions
MessageSchema.index({ roomId: 1, timestamp: -1 });

export const Message = mongoose.model<IMessageDocument>('Message', MessageSchema);
export default Message;