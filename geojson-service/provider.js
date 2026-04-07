import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { Pool } from 'pg'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
export const uploadDir = path.join(__dirname, 'uploads')
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true })

const dbUrl =
  process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/geojson'

export const pool = new Pool({ connectionString: dbUrl })
export const databaseUrl = dbUrl

export async function initDb() {
  await pool.query(`
    CREATE EXTENSION IF NOT EXISTS postgis;
    CREATE EXTENSION IF NOT EXISTS postgis_tiger_geocoder;
  `)
}