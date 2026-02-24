import 'dotenv/config'
import pool from './config/db.js'

const test = async () => {
  try {
    const res = await pool.query('SELECT NOW()')
    console.log('DB Connected ✅')
    console.log(res.rows)
  } catch (err) {
    console.error('DB Connection Failed ❌')
    console.error(err)
  } finally {
    process.exit()
  }
}

test()