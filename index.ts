import fs from 'fs'
import path from 'path'
import { Sql } from 'postgres'

const join = path.join

export default async function ({
  sql,
  path = join(process.cwd(), 'migrations'),
  before = null,
  after = null
}: {
  sql: Sql
  path?: string
  before?:
    | ((migration: {
        path: string
        migration_id: number
        name: string
      }) => void)
    | null
  after?:
    | ((migration: {
        path: string
        migration_id: number
        name: string
      }) => void)
    | null
}) {
  const migrations = fs
    .readdirSync(path)
    .filter(x => x.match(/^[0-9]+_.*\.sql$/))
    .sort()
    .map(x => {
      const match = x.match(/\d+/)
      const migration_id = parseInt(match![0], 10)
      return {
        path: path,
        migration_id,
        name: x
      }
    })

  const latest = migrations[migrations.length - 1]

  if (latest.migration_id !== migrations.length)
    throw new Error('Inconsistency in migration numbering')

  await ensureMigrationsTable()

  const current = await getCurrentMigration()
  const needed = migrations.slice(current ? current.id : 0)

  return sql.begin(next)

  async function next(sql: Sql) {
    const current = needed.shift()
    if (!current) return

    before && before(current)
    await run(sql, current)
    after && after(current)
    await next(sql)
  }

  async function run(
    sql: Sql,
    {
      path,
      migration_id,
      name
    }: { path: string; migration_id: number; name: string }
  ) {
    await sql.file(join(path, name))
    await sql`
      insert into migrations (
        migration_id,
        name
      ) values (
        ${migration_id},
        ${name}
      )
    `
  }

  async function getCurrentMigration() {
    return sql`
      select migration_id as id from migrations
      order by migration_id desc
      limit 1
    `.then(([x]) => x)
  }

  function ensureMigrationsTable() {
    return sql.unsafe(`
      DO $$ 
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'migrations') THEN
          CREATE TABLE migrations (
            migration_id serial primary key,
            created_at timestamp with time zone not null default now(),
            name text
          );
        END IF;
      END $$;
    `)
  }
}
