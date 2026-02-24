// if src/prisma.js is inside src/
import pkg from './generated/prisma/index.js'
const { PrismaClient } = pkg
import { withAccelerate } from '@prisma/extension-accelerate'
import DB_KEY from '../env.js'

// Prisma will read the DB URL from your environment (e.g. process.env.DATABASE_URL)
const prisma = new PrismaClient()

export default prisma
