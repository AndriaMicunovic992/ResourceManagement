// Startup script: resolve DATABASE_URL, run migrations, start server

const varNames = ['DATABASE_URL', 'DATABASE_PRIVATE_URL', 'DATABASE_PUBLIC_URL'];

// Find a database URL from common Railway env var names
if (!process.env.DATABASE_URL) {
  for (const name of varNames) {
    if (process.env[name]) {
      process.env.DATABASE_URL = process.env[name];
      console.log(`Using ${name} as DATABASE_URL`);
      break;
    }
  }
}

if (!process.env.DATABASE_URL) {
  console.error('========================================');
  console.error('FATAL: DATABASE_URL is not set!');
  console.error('');
  console.error('In Railway: add a PostgreSQL database,');
  console.error('then add a variable to this service:');
  console.error('  DATABASE_URL = ${{Postgres.DATABASE_URL}}');
  console.error('');
  console.error('Database-related env vars found:');
  for (const [k, v] of Object.entries(process.env)) {
    if (/database|postgres|pg/i.test(k)) {
      console.error(`  ${k}=${v ? '***(' + v.length + ' chars)' : '(empty)'}`);
    }
  }
  console.error('========================================');
}

// Run migrations (best-effort), then start server
import { execSync } from 'child_process';

if (process.env.DATABASE_URL) {
  try {
    console.log('Running prisma migrate deploy...');
    execSync('npx prisma migrate deploy', { stdio: 'inherit' });
    console.log('Migrations complete.');
  } catch (e) {
    console.error('Migration failed, continuing to start server:', (e as Error).message);
  }
}

// Start the actual server
await import('./index.js');
