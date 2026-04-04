import { useEffect, useMemo, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import axios from 'axios'
import { Box, Button, Container, Paper, Stack, Typography } from '@mui/material'

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:7532'
const TILE_URL = `${API_BASE}/tiles/{z}/{x}/{y}.pbf`

function App() {
  const [fileName, setFileName] = useState('No file selected')
  const [status, setStatus] = useState('Waiting for GeoJSON upload')
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
      if (map.getSource('geojson-tile')) map.removeLayer('geojson-fill')
      if (map.getSource('geojson-tile')) map.removeSource('geojson-tile')

      map.addSource('geojson-tile', {
        type: 'vector',
        tiles: [TILE_URL],
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
    })

    return () => {
      if (map) map.remove()
    }
  }, [mapContainerId])

  const updateMapTiles = () => {
    if (mapRef.current?.getSource('geojson-tile')) {
      mapRef.current
        .getSource('geojson-tile')
        .setTiles([`${TILE_URL}?ts=${Date.now()}`])
    }
  }

  const fitToBounds = async () => {
    try {
      const r = await axios.get(`${API_BASE}/bounds`)
      if (r.data?.hasData && mapRef.current) {
        const [minx, miny, maxx, maxy] = r.data.bounds
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
    const formData = new FormData()
    formData.append('geojson', file)

    try {
      const resp = await axios.post(`${API_BASE}/upload-geojson`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })

      setStatus(`Upload success: ${resp.data.featureCount} features`)
      updateMapTiles()
      await fitToBounds()
    } catch (err) {
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
          </Stack>
        </Paper>
      </Container>

      <Container maxWidth="lg">
        <Box
          id={mapContainerId}
          sx={{
            width: '100%',
            height: 'calc(100vh - 200px)',
            borderRadius: 2,
            border: '1px solid',
            borderColor: 'divider',
            overflow: 'hidden',
          }}
        />
      </Container>
    </Box>
  )
}

export default App