import * as repository from '../repository/geoJsonRepository.js'

export async function importGeoJson(parsed) {
  const client = await repository.pool.connect()
  try {
    await client.query('BEGIN')
    await repository.truncateGeoJsonData(client)

    for (const feature of parsed.features) {
      if (!feature.geometry) continue
      await repository.insertFeature(client, feature.properties || {}, feature.geometry)
    }

    await client.query('COMMIT')
    return parsed.features.length
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

export async function getTileBuffer(z, x, y) {
  return repository.getTile(z, x, y)
}

export async function getBounds() {
  return repository.getExtent()
}