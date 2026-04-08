import { useEffect, useMemo, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import axios from 'axios'
import {
  Box,
  Button,
  Container,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableRow,
  Typography,
} from '@mui/material'

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:7532'

function App() {
  const [fileId, setFileId] = useState(null)
  const [fileName, setFileName] = useState('No file selected')
  const [status, setStatus] = useState('Waiting for GeoJSON upload')
  const [selectedFeature, setSelectedFeature] = useState(null)
  const mapRef = useRef(null)
  const mapContainerId = useMemo(() => 'maplibre-map', [])

  useEffect(() => {
    const map = new maplibregl.Map({
      container: mapContainerId,
      style: {
        version: 8,
        sources: {
          osm: {
            type: 'raster',
            tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
            tileSize: 256,
          },
        },
        layers: [
          {
            id: 'osm-base',
            type: 'raster',
            source: 'osm',
          },
        ],
      },
      center: [0, 20],
      zoom: 2,
    })

    mapRef.current = map

    map.on('load', () => {
      console.log('Map loaded')
    })

    return () => {
      if (map) map.remove()
    }
  }, [mapContainerId])

  useEffect(() => {
    if (!mapRef.current || !fileId) return

    const map = mapRef.current
    const tileUrl = `${API_BASE}/tiles/${fileId}/{z}/{x}/{y}.pbf`

    console.log('Updating tile source for fileId', fileId, tileUrl)

    if (map.getSource('geojson-tile')) {
      map.getSource('geojson-tile').setTiles([tileUrl])
    } else {
      map.addSource('geojson-tile', {
        type: 'vector',
        tiles: [tileUrl],
        minzoom: 0,
        maxzoom: 14,
      })

      map.addLayer({
        id: 'geojson-fill',
        type: 'fill',
        source: 'geojson-tile',
        'source-layer': 'geojson_layer',
        paint: {
          'fill-color': '#0077cc',
          'fill-opacity': 0.45,
          'fill-outline-color': '#003d66',
        },
      })

      map.addLayer({
        id: 'geojson-line',
        type: 'line',
        source: 'geojson-tile',
        'source-layer': 'geojson_layer',
        paint: {
          'line-color': '#0044aa',
          'line-width': 2,
        },
      })
    }

    map.once('idle', () => {
      fitToBounds(fileId)
    })
  }, [fileId])

  useEffect(() => {
    if (!mapRef.current) return

    const map = mapRef.current
    const onMove = (event) => {
      const features = map.queryRenderedFeatures(event.point, {
        layers: ['geojson-fill'],
      })
      map.getCanvas().style.cursor = features.length ? 'pointer' : ''
    }

    const onClick = (event) => {
      const features = map.queryRenderedFeatures(event.point, {
        layers: ['geojson-fill'],
      })
      setSelectedFeature(features?.[0]?.properties || null)
    }

    map.on('mousemove', 'geojson-fill', onMove)
    map.on('click', 'geojson-fill', onClick)

    return () => {
      map.off('mousemove', 'geojson-fill', onMove)
      map.off('click', 'geojson-fill', onClick)
    }
  }, [fileId])

  const fitToBounds = async (targetFileId) => {
    const id = targetFileId || fileId
    if (!id || !mapRef.current) return

    try {
      console.log('Requesting bounds for', id)
      const r = await axios.get(`${API_BASE}/bounds/${id}`)
      if (r.data?.hasData && mapRef.current) {
        const [minx, miny, maxx, maxy] = r.data.bounds
        console.log('Bounds received', r.data.bounds)
        mapRef.current.fitBounds(
          [
            [minx, miny],
            [maxx, maxy],
          ],
          { padding: 40, maxZoom: 16, duration: 700 }
        )
      }
    } catch (error) {
      console.warn('Could not query bounds', error)
    }
  }

  const uploadFile = async (event) => {
    const file = event.target.files?.[0]
    if (!file) {
      setFileName('No file selected')
      setStatus('No file selected')
      return
    }

    setFileName(file.name)
    setStatus('Uploading GeoJSON...')
    setSelectedFeature(null)
    console.log('Uploading file', file.name)

    const formData = new FormData()
    formData.append('geojson', file)

    try {
      const resp = await axios.post(`${API_BASE}/upload-geojson`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })

      const id = resp.data.fileId
      console.log('Upload response', resp.data)
      setFileId(id)
      setStatus(`Upload success: ${resp.data.message}`)
      await fitToBounds(id)
    } catch (err) {
      console.error('Upload failed', err)
      setStatus(`Upload failed: ${err?.response?.data?.message || err.message}`)
    }
  }

  return (
    <Box component="main" sx={{ minHeight: '100vh', bgcolor: '#f5f5f5', p: 2 }}>
      <Container maxWidth="lg">
        <Paper elevation={3} sx={{ p: 3, mb: 3 }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} alignItems="center" spacing={2}>
            <Button variant="contained" component="label">
              Upload GeoJSON
              <input
                hidden
                accept=".geojson,.json,application/geo+json"
                type="file"
                onChange={uploadFile}
              />
            </Button>
            <Typography variant="body2" color="text.primary">
              Selected: {fileName}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {status}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {fileId ? `fileId: ${fileId}` : 'No active dataset'}
            </Typography>
          </Stack>
        </Paper>
      </Container>

      <Container maxWidth="lg">
        <Box
          id={mapContainerId}
          sx={{
            width: '100%',
            height: 'calc(100vh - 240px)',
            borderRadius: 2,
            border: '1px solid',
            borderColor: 'divider',
            overflow: 'hidden',
          }}
        />
      </Container>

      <Container maxWidth="lg" sx={{ mt: 2 }}>
        <Paper elevation={3} sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>
            Feature properties
          </Typography>

          {selectedFeature ? (
            <TableContainer>
              <Table>
                <TableBody>
                  {Object.entries(selectedFeature).map(([key, value]) => (
                    <TableRow key={key}>
                      <TableCell sx={{ fontWeight: 'bold' }}>{key}</TableCell>
                      <TableCell>{value === null ? 'null' : String(value)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          ) : (
            <Typography variant="body2" color="text.secondary">
              Click a feature on the map to see its properties.
            </Typography>
          )}
        </Paper>
      </Container>
    </Box>
  )
}

export default App