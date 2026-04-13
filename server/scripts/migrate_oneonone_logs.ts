/**
 * One-off migration: move goodSides / badSides / suggestions text from each
 * OneOnOne row into Log rows.
 *
 * Idempotency: a OneOnOne is marked with `legacyFieldsMigratedAt` once its
 * structured content has been copied over. Re-runs skip anything already
 * marked.
 *
 * Usage:
 *   npx tsx scripts/migrate_oneonone_logs.ts --dry-run  # preview only
 *   npx tsx scripts/migrate_oneonone_logs.ts            # real run
 */
import { prisma } from '../src/db/prisma.js';

type FieldKind = 'good' | 'bad' | 'suggestion';

const FIELD_MAP: { field: 'goodSides' | 'badSides' | 'suggestions'; kind: FieldKind }[] = [
  { field: 'goodSides', kind: 'good' },
  { field: 'badSides', kind: 'bad' },
  { field: 'suggestions', kind: 'suggestion' },
];

function parseArgs(argv: string[]): { dryRun: boolean } {
  const dryRun = argv.includes('--dry-run');
  return { dryRun };
}

async function main(): Promise<number> {
  const { dryRun } = parseArgs(process.argv.slice(2));

  console.log(dryRun ? 'Running in DRY-RUN mode — no writes will be made.' : 'Running in LIVE mode.');

  const rows = await prisma.oneOnOne.findMany({
    where: { legacyFieldsMigratedAt: null },
    orderBy: { createdAt: 'asc' },
  });

  const total = rows.length;
  console.log(`Found ${total} unmigrated OneOnOne row(s).`);

  let processed = 0;
  let createdLogs = 0;
  let skipped = 0;
  let failed = 0;
  const failedIds: string[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    processed++;

    if (processed % 10 === 0 || processed === 1) {
      console.log(`Processing ${processed}/${total}...`);
    }

    const entries: { kind: FieldKind; content: string }[] = [];
    for (const { field, kind } of FIELD_MAP) {
      const raw = row[field];
      if (typeof raw === 'string') {
        const trimmed = raw.trim();
        if (trimmed.length > 0) {
          entries.push({ kind, content: trimmed });
        }
      }
    }

    if (entries.length === 0) {
      skipped++;
      if (dryRun) {
        console.log(`[dry-run] OneOnOne ${row.id}: no structured content, would mark as migrated.`);
      } else {
        try {
          await prisma.oneOnOne.update({
            where: { id: row.id },
            data: { legacyFieldsMigratedAt: new Date() },
          });
        } catch (err) {
          failed++;
          failedIds.push(row.id);
          console.error(`Failed to mark OneOnOne ${row.id} as migrated:`, err);
        }
      }
      continue;
    }

    if (dryRun) {
      console.log(
        `[dry-run] OneOnOne ${row.id}: would create ${entries.length} Log row(s) ` +
          `(${entries.map((e) => e.kind).join(', ')}) and mark migrated.`
      );
      createdLogs += entries.length;
      continue;
    }

    try {
      await prisma.$transaction(async (tx) => {
        for (const entry of entries) {
          await tx.log.create({
            data: {
              orgId: row.orgId,
              resourceId: row.resourceId,
              authorUserId: row.authorUserId,
              content: entry.content,
              kind: entry.kind,
              oneOnOneId: row.id,
              createdAt: row.createdAt,
              updatedAt: row.updatedAt,
            },
          });
        }
        await tx.oneOnOne.update({
          where: { id: row.id },
          data: { legacyFieldsMigratedAt: new Date() },
        });
      });
      createdLogs += entries.length;
    } catch (err) {
      failed++;
      failedIds.push(row.id);
      console.error(`Failed to migrate OneOnOne ${row.id}:`, err);
    }
  }

  console.log('');
  console.log(dryRun ? 'Migration complete (dry-run)' : 'Migration complete');
  console.log(`Processed ${processed} OneOnOnes`);
  console.log(`Created ${createdLogs} Log rows`);
  console.log(`Skipped ${skipped} OneOnOnes with no structured content`);
  console.log(`Failed ${failed} OneOnOnes`);
  if (failedIds.length > 0) {
    console.log(`Failed IDs: ${failedIds.join(', ')}`);
  }

  return failed > 0 ? 1 : 0;
}

main()
  .then(async (code) => {
    await prisma.$disconnect();
    process.exit(code);
  })
  .catch(async (err) => {
    console.error('Fatal error:', err);
    await prisma.$disconnect();
    process.exit(1);
  });
