import mongoose from 'mongoose';

/** Connects Mongoose to the given URI. */
export async function connectDb(uri: string): Promise<typeof mongoose> {
  mongoose.set('strictQuery', true);
  await mongoose.connect(uri);
  return mongoose;
}

/** Disconnects Mongoose (used on graceful shutdown). */
export async function disconnectDb(): Promise<void> {
  await mongoose.disconnect();
}

/** Readiness probe: true only when the connection is fully established. */
export function dbReadiness(): boolean {
  return mongoose.connection.readyState === 1;
}
