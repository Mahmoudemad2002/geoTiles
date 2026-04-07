import * as repository from '../repository/geoJsonRepository.js'

export async function importGeoJson(filePath, tableName) {
  console.log('service.importGeoJson', { filePath, tableName })
  return repository.importGeoJsonToTable(filePath, tableName)
}

export async function getTileBuffer(fileId, z, x, y) {
  console.log('service.getTileBuffer', { fileId, z, x, y })
  return repository.getTile(fileId, z, x, y)
}

export async function getBounds(fileId) {
  console.log('service.getBounds', { fileId })
  return repository.getExtent(fileId)
}