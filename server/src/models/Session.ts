import mongoose, { Schema, Document } from 'mongoose';
import { ISession } from '@org/shared-types';

// ─────────────────────────────────────────────
//  Session Model
//  One document per room per recording session
//  (e.g. one night 6pm–4am = one session per room)
// ──────

export interface ISessionDocument extends Omit<ISession, '_id'>, Document {}

const SessionSchema: Schema = new Schema<ISessionDocument>(
{
    roomId: {
      type: String,
      required: [true, 'roomId is required'],
      enum: ['room1', 'room2', 'room3', 'room4', 'room5', 'room6'],
      index: true,
    },

    startTime: {
      type: Date,
      default: () => new Date(),
    },

    endTime: {
      type: Date,
      default: null,
    },

    status: {
      type: String,
      enum: ['active', 'stopped'],
      default: 'active',
      index: true,
    },

    patientProfile: {
      type: String,
      required: [true, 'patientProfile is required'],
    },

    messageCount: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true, // adds createdAt and updatedAt fields
  }
);

SessionSchema.index({ roomId: 1, status: 1 });

export const Session = mongoose.model<ISessionDocument>('Session', SessionSchema);
export default Session;