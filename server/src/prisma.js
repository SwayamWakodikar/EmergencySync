// if src/prisma.js is inside src/
import pkg from './generated/prisma/index.js'
const { PrismaClient } = pkg
import { withAccelerate } from '@prisma/extension-accelerate'
import DB_KEY from '../env.js'

const prisma = new PrismaClient({
  accelerateUrl: DB_KEY,
}).$extends(withAccelerate())

export default prisma