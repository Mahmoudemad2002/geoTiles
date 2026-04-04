import { pool } from '../provider.js'

export async function truncateGeoJsonData(client) {
  await client.query('TRUNCATE TABLE geojson_data')
}

export async function insertFeature(client, properties, geometry) {
  const insertSql =
    'INSERT INTO geojson_data (properties, geom) VALUES ($1, ST_SetSRID(ST_GeomFromGeoJSON($2), 4326))'
  await client.query(insertSql, [properties, JSON.stringify(geometry)])
}

export async function getTile(z, x, y) {
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
  const { rows } = await pool.query(sql, [z, x, y])
  return rows?.[0]?.tile ?? null
}

export async function getExtent() {
  const { rows } = await pool.query(`SELECT ST_Extent(geom) AS extent FROM geojson_data`)
  if (!rows[0]?.extent) return null

  const [, box] = rows[0].extent.match(/^BOX\((.*)\)$/) || []
  if (!box) return null
  return box.split(',').flatMap((p) => p.split(' ').map(Number))
}