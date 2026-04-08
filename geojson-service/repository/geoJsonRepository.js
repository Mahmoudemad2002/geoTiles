import { spawn } from 'child_process'
import { URL } from 'url'
import { pool, databaseUrl } from '../provider.js'

const VALID_TABLE_NAME = /^[a-zA-Z0-9_]+$/

function sanitizeTableName(tableName) {
  if (!VALID_TABLE_NAME.test(tableName)) {
    throw new Error('Invalid fileId')
  }
  return tableName
}

function buildOgr2ogrPgConnection(databaseUrl) {
  const u = new URL(databaseUrl)
  const host = u.hostname
  const port = u.port || '5432'
  const user = u.username
  const password = u.password
  const dbname = u.pathname.replace(/^\//, '')

  if (!host || !dbname) {
    throw new Error('Invalid DATABASE_URL')
  }

  return `PG:host=${host} port=${port} user=${user} password=${password} dbname=${dbname}`
}
//Constructs a PostgreSQL connection string in the format required by ogr2ogr.



async function createSpatialIndex(tableName) {
  const safeName = sanitizeTableName(tableName)
  console.log('createSpatialIndex', safeName)
  await pool.query(
    `CREATE INDEX IF NOT EXISTS idx_${safeName}_geom ON ${safeName} USING GIST (geom)`
  )
}

function runOgr2ogr(filePath, tableName) {
  return new Promise((resolve, reject) => {
    const connString = buildOgr2ogrPgConnection(databaseUrl)
    const args = [
      '-f',
      'PostgreSQL',
      connString,
      filePath,
      '-nln',
      tableName,
      '-nlt',
      'PROMOTE_TO_MULTI',
      '-lco',
      'GEOMETRY_NAME=geom',
      '-t_srs',
      'EPSG:4326',
    ]

    console.log('ogr2ogr command:', 'ogr2ogr', args.join(' '))

    const ogr = spawn('ogr2ogr', args, { stdio: ['ignore', 'pipe', 'pipe'] })

    let stdout = ''
    let stderr = ''

    ogr.stdout.on('data', (chunk) => {
      stdout += chunk.toString()
    })

    ogr.stderr.on('data', (chunk) => {
      stderr += chunk.toString()
    })

    ogr.on('error', (err) => {
      console.error('ogr2ogr spawn error', err)
      reject(err)
    })

    ogr.on('close', (code) => {
      console.log('ogr2ogr exit code', code)
      if (code === 0) {
        console.log('ogr2ogr stdout:', stdout)
        console.log('ogr2ogr stderr:', stderr)
        resolve()
      } else {
        reject(new Error(`ogr2ogr failed with code ${code}: ${stderr || stdout}`))
      }
    })
  })
}

export async function importGeoJsonToTable(filePath, tableName) {
  const safeName = sanitizeTableName(tableName)
  console.log('importGeoJsonToTable', { filePath, tableName: safeName })
  await runOgr2ogr(filePath, safeName)
  await createSpatialIndex(safeName)
  console.log('importGeoJsonToTable finished', safeName)
  return safeName
}

function simplifyTolerance(z) {
  if (z <= 5) return 0.05
  if (z <= 8) return 0.01
  if (z <= 11) return 0.0025
  return 0.0005
}

export async function getTile(fileId, z, x, y) {
  const safeName = sanitizeTableName(fileId)
  console.log('getTile repo', { safeName, z, x, y })

  const tolerance = simplifyTolerance(z)


//SELECT ST_Transform(ST_TileEnvelope($1, $2, $3), 4326) AS bgeom

//computes the geographic box for the requested tile.
//ST_Transform(..., 4326) converts that box into WGS84 latitude/longitude.



//.................

/*
mvtgeom AS (...)
This part selects only the features that intersect the tile, prepares them for vector tile encoding, 
and creates a tile-ready geometry column.
*/
  const sql = `
    WITH bounds AS (
      SELECT ST_Transform(ST_TileEnvelope($1, $2, $3), 4326) AS bgeom
    ),
    mvtgeom AS (
      SELECT
        ST_AsMVTGeom(
          ST_Transform(
            ST_SimplifyPreserveTopology(g.geom, $4),
            3857
          ),
          ST_TileEnvelope($1, $2, $3),
          4096,
          256,
          true
        ) AS mvt_geom,
        g.*
      FROM ${safeName} AS g
      JOIN bounds AS b ON ST_Intersects(g.geom, b.bgeom)
      WHERE g.geom IS NOT NULL
    )
    SELECT ST_AsMVT(mvtgeom, 'geojson_layer', 4096, 'mvt_geom') AS tile
    FROM mvtgeom;
  `
  const { rows } = await pool.query(sql, [z, x, y, tolerance])
  return rows?.[0]?.tile ?? null
}

export async function getExtent(fileId) {
  const safeName = sanitizeTableName(fileId)
  console.log('getExtent repo', { safeName })

  const { rows } = await pool.query(
    `SELECT ST_Extent(geom) AS extent FROM ${safeName}`
  )

  if (!rows[0]?.extent) return null

  const [, box] = rows[0].extent.match(/^BOX\((.*)\)$/) || []
  if (!box) return null

  return box.split(',').flatMap((p) => p.split(' ').map(Number))
}