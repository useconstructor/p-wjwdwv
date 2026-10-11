import 'server-only';
import { createClient } from '@libsql/client';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
let client: ReturnType<typeof createClient> | undefined;
let initialized: Promise<void> | undefined;
export async function database() {
 if (!process.env.TURSO_DATABASE_URL) throw new Error('La conexión con la agenda no está configurada. Configura TURSO_DATABASE_URL y TURSO_AUTH_TOKEN en el servidor.');
 client ??= createClient({url:process.env.TURSO_DATABASE_URL,authToken:process.env.TURSO_AUTH_TOKEN});
 initialized ??= (async()=>{ const sql=await readFile(path.join(process.cwd(),'migrations/001.sql'),'utf8'); await client!.executeMultiple(sql);
 const hoursSchema=await client!.execute("SELECT sql FROM sqlite_master WHERE type='table' AND name='hours'");
 if(/weekday BETWEEN 1 AND 7/i.test(String(hoursSchema.rows[0]?.sql))){
  // Preserve historical intervals from the earlier ISO weekday schema. Sunday is now 0.
  await client!.executeMultiple(await readFile(path.join(process.cwd(),'migrations/002-hours-weekday.sql'),'utf8'));
 } })().catch(e=>{initialized=undefined;throw e;});
 await initialized; return client;
}
