import mongoose from 'mongoose';


const MONGO_URI = process.env.MONGO_URI || '';

if (!MONGO_URI) {
  throw new Error('MONGO_URI is not defined in your .env file');
}

// Track connection state so we don't reconnect on every call
let isConnected = false;

export async function connectDB(): Promise<void> {
  if (isConnected) {
    console.log('MongoDB already connected');
    return;
  }

  try {
    await mongoose.connect(MONGO_URI, {
      // healthy connection over long runs
      serverSelectionTimeoutMS: 5000,   // fail fast if Atlas unreachable
      socketTimeoutMS: 45000,
    });

    isConnected = true;
    console.log('MongoDB connected:', mongoose.connection.host);

    // Log disconnection events so we know when Atlas drops
    mongoose.connection.on('disconnected', () => {
      console.warn('MongoDB disconnected');
      isConnected = false;
    });

    mongoose.connection.on('reconnected', () => {
      console.log('🔄  MongoDB reconnected');
      isConnected = true;
    });

  } catch (error) {
    console.error('MongoDB connection failed:', error);
    process.exit(1);
  }
}

export async function disconnectDB(): Promise<void> {
  if (!isConnected) return;
  await mongoose.disconnect();
  isConnected = false;
  console.log('🔌  MongoDB disconnected cleanly');
}

export default connectDB;