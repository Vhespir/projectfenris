import pg from 'pg'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const { Pool } = pg
const __dirname = path.dirname(fileURLToPath(import.meta.url))

export async function runMigrations(connectionString) {
  const pool = new Pool({ connectionString })

  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
        id     SERIAL PRIMARY KEY,
        name   VARCHAR(255) UNIQUE NOT NULL,
        run_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `)

    const { rows } = await pool.query('SELECT name FROM _migrations')
    const completed = new Set(rows.map(r => r.name))

    const migrationsDir = path.join(__dirname, 'migrations')
    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort()

    for (const file of files) {
      if (completed.has(file)) continue

      console.log(`Running migration: ${file}`)
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8')

      await pool.query('BEGIN')
      try {
        await pool.query(sql)
        await pool.query('INSERT INTO _migrations (name) VALUES ($1)', [file])
        await pool.query('COMMIT')
        console.log(`Completed: ${file}`)
      } catch (err) {
        await pool.query('ROLLBACK')
        throw err
      }
    }

    console.log('Migrations up to date')
  } finally {
    await pool.end()
  }
}
