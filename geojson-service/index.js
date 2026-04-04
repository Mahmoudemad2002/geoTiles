import express from 'express'
import cors from 'cors'
import multer from 'multer'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { Pool } from 'pg'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const uploadDir = path.join(__dirname, 'uploads')
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true })

const app = express()
const port = process.env.PORT || 7532
const dbUrl =
  process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/geojson'

const pool = new Pool({ connectionString: dbUrl })
app.use(cors({ origin: '*' }))
app.use(express.json())

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
})
const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const ok = [
      'application/geo+json',
      'application/json',
      'application/octet-stream',
    ].includes(file.mimetype)
    cb(ok ? null : new Error('Invalid GeoJSON mimeType'), ok)
  },
})

async function initDb() {
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
initDb().catch((err) => console.error('initDb error', err))

app.post('/upload-geojson', upload.single('geojson'), async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'No file' })

  const content = fs.readFileSync(req.file.path, 'utf-8')
  let parsed
  try {
    parsed = JSON.parse(content)
  } catch (err) {
    return res.status(400).json({ message: 'Invalid JSON' })
  }

  if (!parsed.type || parsed.type !== 'FeatureCollection' || !Array.isArray(parsed.features)) {
    return res.status(400).json({ message: 'Must be FeatureCollection' })
  }

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query('TRUNCATE TABLE geojson_data')

    const insertSql =
      'INSERT INTO geojson_data (properties, geom) VALUES ($1, ST_SetSRID(ST_GeomFromGeoJSON($2), 4326))'

    for (const f of parsed.features) {
      if (!f.geometry) continue
      const geometry = JSON.stringify(f.geometry)
      await client.query(insertSql, [f.properties || {}, geometry])
    }

    await client.query('COMMIT')
    return res.json({
      message: 'ok',
      featureCount: parsed.features.length,
      geojson: parsed,
    })
  } catch (e) {
    await client.query('ROLLBACK')
    console.error('upload error', e)
    return res.status(500).json({ message: 'DB insert error', error: e.message })
  } finally {
    client.release()
  }
})

app.get('/tiles/:z/:x/:y.pbf', async (req, res) => {
  const { z, x, y } = req.params
  const zi = Number(z)
  const xi = Number(x)
  const yi = Number(y)

  if ([zi, xi, yi].some((n) => Number.isNaN(n))) {
    return res.status(400).send('Invalid tile coord')
  }

  const sql = `
    WITH bounds AS (
      SELECT ST_Transform(ST_TileEnvelope($1, $2, $3), 4326) AS bgeom
    ),
    mvtgeom AS (
      SELECT
        ST_AsMVTGeom(
          ST_Transform(g.geom, 3857),
          ST_TileEnvelope($1, $2, $3),
          4096,
          256,
          true
        ) AS mvt_geom,
        g.properties
      FROM geojson_data AS g
      JOIN bounds AS b ON ST_Intersects(g.geom, b.bgeom)
    )
    SELECT ST_AsMVT(mvtgeom, 'geojson_layer', 4096, 'mvt_geom') AS tile FROM mvtgeom;
  `
  try {
    const { rows } = await pool.query(sql, [zi, xi, yi])
    const tile = rows?.[0]?.tile
    if (!tile) {
      res.setHeader('Content-Type', 'application/x-protobuf')
      return res.status(204).send()
    }
    res.setHeader('Content-Type', 'application/x-protobuf')
    return res.send(tile)
  } catch (err) {
    console.error('tile error', err)
    return res.status(500).send('tile generation failed')
  }
})

app.get('/health', (req, res) => res.send('OK'))
app.get('/bounds', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT ST_Extent(geom) AS extent FROM geojson_data`
    )
    if (!rows[0]?.extent) return res.json({ hasData: false })

    const [, box] = rows[0].extent.match(/^BOX\((.*)\)$/) || []
    const [minx, miny, maxx, maxy] = box
      .split(',')
      .flatMap((p) => p.split(' ').map(Number))
    res.json({ hasData: true, bounds: [minx, miny, maxx, maxy] })
  } catch (err) {
    console.error('bounds fail', err)
    res.status(500).json({ error: 'Could not get bounds' })
  }
})
app.listen(port, () => {
  console.log(`geojson-service on http://localhost:${port}`)
})