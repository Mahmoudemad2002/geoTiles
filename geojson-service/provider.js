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


/*
CREATE EXTENSION IF NOT EXISTS postgis;

This ensures that the postgis extension is installed in the database.
postgis adds spatial capabilities to PostgreSQL, allowing the database to store and query geographic data (e.g., points, polygons, etc.).
CREATE EXTENSION IF NOT EXISTS postgis_tiger_geocoder;

This ensures that the postgis_tiger_geocoder extension is installed.
This extension provides geocoding capabilities, which means it can convert addresses into geographic coordinates (latitude and longitude).
*/