import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

// We prefer a real MongoDB URI, but a memory server will be used if
// connection fails (useful when Docker isn't available on dev machine).
let MONGO_URI = process.env.MONGO_URI || '';

// Track connection state so we don't reconnect on every call
let isConnected = false;
let memoryServer: MongoMemoryServer | null = null;

export async function connectDB(): Promise<void> {
  if (isConnected) {
    console.log('MongoDB already connected');
    return;
  }

  async function connect(uri: string) {
    await mongoose.connect(uri, {
      // healthy connection over long runs
      serverSelectionTimeoutMS: 5000,   // fail fast if Atlas unreachable
      socketTimeoutMS: 45000,
    });
    isConnected = true;
    console.log('MongoDB connected:', mongoose.connection.host);

    mongoose.connection.on('disconnected', () => {
      console.warn('MongoDB disconnected');
      isConnected = false;
    });

    mongoose.connection.on('reconnected', () => {
      console.log('🔄  MongoDB reconnected');
      isConnected = true;
    });
  }

  try {
    if (!MONGO_URI) {
      throw new Error('no MONGO_URI');
    }
    await connect(MONGO_URI);
  } catch (err) {
    console.warn('Failed to connect to MongoDB at', MONGO_URI, '-', err.message || err);
    console.warn('Falling back to in-memory MongoDB instance');

    if (!memoryServer) {
      memoryServer = await MongoMemoryServer.create();
    }
    MONGO_URI = memoryServer.getUri();
    await connect(MONGO_URI);
  }
}

export async function disconnectDB(): Promise<void> {
  if (!isConnected) return;
  await mongoose.disconnect();
  isConnected = false;
  console.log('🔌  MongoDB disconnected cleanly');
}

export default connectDB;