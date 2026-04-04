import app from './app.js'
import { initDb } from './provider.js'

const port = process.env.PORT || 4000

async function start() {
  await initDb()
  app.listen(port, () => {
    console.log(`geojson-service on http://localhost:${port}`)
  })
}

start().catch((err) => {
  console.error('Failed to start service', err)
  process.exit(1)
})