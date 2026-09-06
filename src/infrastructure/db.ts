import mongoose from 'mongoose'

interface MongooseCache {
  conn: typeof mongoose | null
  promise: Promise<typeof mongoose> | null
}

declare global {
  // eslint-disable-next-line no-var
  var mongoose: MongooseCache | undefined
}

const cached: MongooseCache = global.mongoose ?? { conn: null, promise: null }

if (!global.mongoose) {
  global.mongoose = cached
}

export async function connectToDatabase(): Promise<typeof mongoose> {
  // Read lazily so callers (e.g. seed scripts) can load .env before this runs
  const uri = process.env.MONGODB_URI
  if (!uri) {
    throw new Error('[db] MONGODB_URI is not defined in environment variables')
  }

  if (cached.conn) {
    return cached.conn
  }

  if (!cached.promise) {
    cached.promise = mongoose
      .connect(uri, { bufferCommands: false })
      .then((instance) => {
        console.log('[MongoDB] Connection established')
        return instance
      })
      .catch((err) => {
        cached.promise = null
        console.error('[MongoDB] Connection failed:', err)
        throw err
      })
  }

  cached.conn = await cached.promise
  return cached.conn
}
