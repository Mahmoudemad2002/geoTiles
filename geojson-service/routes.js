import express from 'express'
import {
  uploadGeoJson,
  getTile,
  getBounds,
  healthCheck,
  upload,
} from './controller/geoJsonController.js'

const router = express.Router()

router.post('/upload-geojson', upload.single('geojson'), uploadGeoJson)
router.get('/tiles/:z/:x/:y.pbf', getTile)
router.get('/bounds', getBounds)
router.get('/health', healthCheck)

export default router