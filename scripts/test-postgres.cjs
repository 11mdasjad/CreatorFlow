const { PGlite } = require('@electric-sql/pglite');
const { PGLiteSocketServer } = require('@electric-sql/pglite-socket');
const { readFileSync } = require('node:fs');
(async () => {
  const db = await PGlite.create();
  await db.exec(readFileSync('prisma/migrations/202610220001_initial/migration.sql', 'utf8'));
  const server = new PGLiteSocketServer({ db, host: '127.0.0.1', port: 5434 });
  await server.start();
  console.log('TEST_DATABASE_READY');
  process.on('SIGTERM', async () => {
    await server.stop();
    await db.close();
    process.exit(0);
  });
})();
