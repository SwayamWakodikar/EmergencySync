// prisma.js
import dotenv from 'dotenv'
dotenv.config()
import { PrismaClient } from '@prisma/client'
import { withAccelerate } from '@prisma/extension-accelerate'

// if (!process.env.DATABASE_URL) {
//   throw new Error('DATABASE_URL is not set')
// }

const prisma = new PrismaClient({
  accelerateUrl: process.env.DATABASE_URL,
}).$extends(withAccelerate())

export default prisma