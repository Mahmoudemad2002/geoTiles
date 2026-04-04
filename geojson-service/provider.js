import fs from 'fs'
import path from 'path'
import { Pool } from 'pg'

const uploadDir = path.join(process.cwd(), 'geojson-service', 'uploads')
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true })
}

const dbUrl = process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/geojson'

export const pool = new Pool({ connectionString: dbUrl })

export async function initDb() {
  await pool.query(`
    CREATE EXTENSION IF NOT EXISTS postgis;
    CREATE EXTENSION IF NOT EXISTS postgis_tiger_geocoder;
    CREATE TABLE IF NOT EXISTS geojson_data (
      id SERIAL PRIMARY KEY,
      properties JSONB,
      geom GEOMETRY(Geometry, 4326)
    );
  `)

  await pool.query(
    `CREATE INDEX IF NOT EXISTS idx_geojson_geom ON geojson_data USING GIST (geom);`
  )
}

export { uploadDir }