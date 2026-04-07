import * as geoJsonService from '../service/geoJsonService.js'
import multer from 'multer'
import fs from 'fs'
import { uploadDir } from '../provider.js'

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
})

export const upload = multer({
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

export async function uploadGeoJson(req, res) {
  console.log('uploadGeoJson request received')
  if (!req.file) {
    console.log('uploadGeoJson missing file')
    return res.status(400).json({ message: 'No file' })
  }

  console.log('uploadGeoJson file path:', req.file.path)
  const tableName = `geo_${Date.now()}`
  try {
    await geoJsonService.importGeoJson(req.file.path, tableName)

    console.log('uploadGeoJson imported into table:', tableName)
    return res.json({
      message: 'Imported successfully',
      fileId: tableName,
    })
  } catch (err) {
    console.error('uploadGeoJson failed', err)
    return res.status(500).json({ message: 'Import failed', error: err.message })
  }
}

export async function getTile(req, res) {
  const { fileId, z, x, y } = req.params
  console.log('getTile request', { fileId, z, x, y })

  const zi = Number(z)
  const xi = Number(x)
  const yi = Number(y)

  if ([zi, xi, yi].some((n) => Number.isNaN(n))) {
    console.log('getTile invalid tile coords', { z, x, y })
    return res.status(400).send('Invalid tile coord')
  }

  try {
    const tile = await geoJsonService.getTileBuffer(fileId, zi, xi, yi)
    if (!tile) {
      res.setHeader('Content-Type', 'application/x-protobuf')
      return res.status(204).send()
    }
    res.setHeader('Content-Type', 'application/x-protobuf')
    return res.send(tile)
  } catch (err) {
    console.error('getTile failed', err)
    return res.status(500).send('tile generation failed')
  }
}

export async function getBounds(req, res) {
  const { fileId } = req.params
  console.log('getBounds request', fileId)

  try {
    const bounds = await geoJsonService.getBounds(fileId)
    if (!bounds) {
      return res.json({ hasData: false })
    }
    return res.json({ hasData: true, bounds })
  } catch (err) {
    console.error('getBounds failed', err)
    return res.status(500).json({ error: 'Could not get bounds' })
  }
}

export function healthCheck(req, res) {
  res.send('OK')
}