import shift from '../index.js'
import postgres from 'postgres'
import { fileURLToPath } from 'url'

const urlString = ''
const url = new URL(urlString)
const username = url.username
const password = url.password
const host = url.hostname
const port = parseInt(url.port)
const database = url.pathname.slice(1)

const sql = postgres({
  host,
  port,
  database,
  username,
  password,
  ssl: false
})

shift({
  sql,
  path: fileURLToPath(new URL('migrations', import.meta.url)),
  before: ({ migration_id, name }: { migration_id: number; name: string }) => {
    console.log('Migrating', migration_id, name)
  }
})
  .then(() => console.log('All good'))
  .catch(err => {
    console.error('Failed', err)
    process.exit(1)
  })
