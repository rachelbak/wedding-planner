import { NextResponse } from 'next/server'
import { connectToDatabase } from '@/infrastructure/db'

export async function GET() {
  try {
    await connectToDatabase()
    return NextResponse.json({ status: 'ok', db: 'connected' })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { status: 'error', db: 'disconnected', message },
      { status: 500 }
    )
  }
}
