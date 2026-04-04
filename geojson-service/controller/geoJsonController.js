import fs from 'fs'
import { uploadDir } from '../provider.js'
import * as geoJsonService from '../service/geoJsonService.js'
import multer from 'multer'

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
  if (!req.file) {
    return res.status(400).json({ message: 'No file' })
  }

  let parsed
  try {
    const content = fs.readFileSync(req.file.path, 'utf-8')
    parsed = JSON.parse(content)
  } catch (err) {
    return res.status(400).json({ message: 'Invalid JSON' })
  }

  if (!parsed.type || parsed.type !== 'FeatureCollection' || !Array.isArray(parsed.features)) {
    return res.status(400).json({ message: 'Must be FeatureCollection' })
  }

  try {
    const featureCount = await geoJsonService.importGeoJson(parsed)
    return res.json({
      message: 'ok',
      featureCount,
      geojson: parsed,
    })
  } catch (err) {
    console.error('upload error', err)
    return res.status(500).json({ message: 'DB insert error', error: err.message })
  }
}

export async function getTile(req, res) {
  const { z, x, y } = req.params
  try {
    const tile = await geoJsonService.getTileBuffer(Number(z), Number(x), Number(y))
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
}

export async function getBounds(req, res) {
  try {
    const bounds = await geoJsonService.getBounds()
    if (!bounds) {
      return res.json({ hasData: false })
    }
    return res.json({ hasData: true, bounds })
  } catch (err) {
    console.error('bounds fail', err)
    return res.status(500).json({ error: 'Could not get bounds' })
  }
}

export function healthCheck(req, res) {
  res.send('OK')
}