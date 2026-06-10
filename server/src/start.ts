// Canonical production entry point (used by both `npm start` and the Docker
// image): resolve DATABASE_URL, validate config, run migrations, then boot the
// server. Dev uses src/index.ts directly (no migrations) — run `npm run
// db:migrate` yourself.

import { execSync } from 'child_process';
import { assertProductionConfig } from './config.js';

const varNames = ['DATABASE_URL', 'DATABASE_PRIVATE_URL', 'DATABASE_PUBLIC_URL'];

// Find a database URL from common Railway env var names.
if (!process.env.DATABASE_URL) {
  for (const name of varNames) {
    if (process.env[name]) {
      process.env.DATABASE_URL = process.env[name];
      console.log(`Using ${name} as DATABASE_URL`);
      break;
    }
  }
}

// Fail fast on missing/invalid configuration instead of booting insecure or
// broken (e.g. a guessable JWT secret, or no database).
const configErrors = assertProductionConfig();
if (configErrors.length > 0) {
  console.error('========================================');
  console.error('FATAL: Invalid configuration. Server will not start.');
  for (const e of configErrors) console.error(`  - ${e}`);
  if (!process.env.DATABASE_URL) {
    console.error('');
    console.error('In Railway: add a PostgreSQL database, then set on this service:');
    console.error('  DATABASE_URL = ${{Postgres.DATABASE_URL}}');
    const found = Object.keys(process.env).filter((k) => /database|postgres|pg/i.test(k));
    if (found.length) console.error(`  (db-related vars present: ${found.join(', ')})`);
  }
  console.error('========================================');
  process.exit(1);
}

// Apply migrations. A failure here means the schema is stale — booting anyway
// risks silent data corruption and confusing 500s, so refuse to start.
try {
  console.log('Running prisma migrate deploy...');
  execSync('npx prisma migrate deploy', { stdio: 'inherit' });
  console.log('Migrations complete.');
} catch (e) {
  console.error('FATAL: Migration failed. Refusing to start on a stale schema.');
  console.error((e as Error).message);
  process.exit(1);
}

// Start the actual server.
await import('./index.js');
