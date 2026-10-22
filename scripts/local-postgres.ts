import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import { mkdir } from 'node:fs/promises';
async function main() {
  if (process.env.NODE_ENV === 'production') throw new Error('PGlite is for development only');
  await mkdir('.local', { recursive: true });
  const db = await PGlite.create('.local/postgres');
  const server = new PGLiteSocketServer({ db, host: '127.0.0.1', port: 5433, maxConnections: 8 });
  await server.start();
  console.log(
    'Development PostgreSQL (PGlite) listening at 127.0.0.1:5433; data persisted in .local/postgres',
  );
  for (const signal of ['SIGINT', 'SIGTERM'])
    process.on(signal, async () => {
      await server.stop();
      await db.close();
      process.exit(0);
    });
}
void main();
