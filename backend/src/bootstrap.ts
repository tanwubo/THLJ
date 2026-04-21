import { db, exec, initDB } from './db'
import { applyWorkbenchSchema } from './db/init'
import { ensureDefaultTimelineTemplateSeeded } from './services/timelineTemplates'

export async function bootstrapDatabase(): Promise<void> {
  await initDB()
  await applyWorkbenchSchema({
    exec: (sql: string) => db.exec(sql),
    run: (sql: string) => exec(sql),
  })
  await ensureDefaultTimelineTemplateSeeded()
}
