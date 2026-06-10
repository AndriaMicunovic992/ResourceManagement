import { prisma } from './prisma.js';
import { hashPassword } from '../utils/password.js';
import { monthRange } from '../utils/months.js';

async function seed() {
  // This wipes every table before inserting demo data. Guard against running it
  // against a production database by accident.
  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_SEED !== 'true') {
    throw new Error(
      'Refusing to seed in production — this deletes all data. Set ALLOW_SEED=true to override.'
    );
  }

  console.log('Seeding database...');

  // Clean up
  await prisma.assignment.deleteMany();
  await prisma.resourceRole.deleteMany();
  await prisma.need.deleteMany();
  await prisma.resource.deleteMany();
  await prisma.project.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.orgMember.deleteMany();
  await prisma.organization.deleteMany();
  await prisma.user.deleteMany();

  // Create user + org
  const user = await prisma.user.create({
    data: { email: 'demo@databob.ch', password: await hashPassword('demo123'), name: 'Demo User' },
  });

  const org = await prisma.organization.create({
    data: { name: 'databob', slug: 'databob' },
  });

  await prisma.orgMember.create({
    data: { userId: user.id, orgId: org.id, role: 'owner' },
  });

  // Create customer
  const customer = await prisma.customer.create({
    data: { name: 'CH Media', status: 'realised', orgId: org.id },
  });

  // Create projects
  const generalSupport = await prisma.project.create({
    data: { name: 'General Support', customerId: customer.id, orgId: org.id, startMonth: '2026-03', endMonth: '2026-12', status: 'realised' },
  });

  const financeReporting = await prisma.project.create({
    data: { name: 'Finance Reporting', customerId: customer.id, orgId: org.id, startMonth: '2026-03', endMonth: '2026-06', status: 'realised' },
  });

  // Create resources
  const sem = await prisma.resource.create({
    data: {
      name: 'Sem', capacity: 1.0, orgId: org.id,
      roles: { create: [
        { domain: 'Data', role: 'FE', seniority: 'Medior' },
        { domain: 'Data', role: 'BE', seniority: 'Medior' },
      ] },
    },
    include: { roles: true },
  });

  const luka = await prisma.resource.create({
    data: {
      name: 'Luka', capacity: 1.0, orgId: org.id,
      roles: { create: [{ domain: 'Data', role: 'FE', seniority: 'Medior' }] },
    },
    include: { roles: true },
  });

  const nikola = await prisma.resource.create({
    data: {
      name: 'Nikola', capacity: 1.0, orgId: org.id,
      roles: { create: [{ domain: 'Data', role: 'BE', seniority: 'Medior' }] },
    },
    include: { roles: true },
  });

  const milan = await prisma.resource.create({
    data: {
      name: 'Milan', capacity: 1.0, orgId: org.id,
      roles: { create: [{ domain: 'Data', role: 'BE', seniority: 'Medior' }] },
    },
    include: { roles: true },
  });

  // Create needs for General Support
  const gsFE = await prisma.need.create({
    data: {
      projectId: generalSupport.id, orgId: org.id,
      domain: 'Data', role: 'FE', seniority: 'Medior', status: 'realised',
      startMonth: '2026-04', endMonth: '2026-12',
      monthAllocations: Object.fromEntries(monthRange('2026-04', '2026-12').map((m) => [m, 1.0])),
    },
  });

  const gsBE = await prisma.need.create({
    data: {
      projectId: generalSupport.id, orgId: org.id,
      domain: 'Data', role: 'BE', seniority: 'Medior', status: 'realised',
      startMonth: '2026-04', endMonth: '2026-12',
      monthAllocations: Object.fromEntries(monthRange('2026-04', '2026-12').map((m) => [m, 1.0])),
    },
  });

  // Create need for Finance Reporting
  const frFE = await prisma.need.create({
    data: {
      projectId: financeReporting.id, orgId: org.id,
      domain: 'Data', role: 'FE', seniority: 'Medior', status: 'realised',
      startMonth: '2026-04', endMonth: '2026-06',
      monthAllocations: Object.fromEntries(monthRange('2026-04', '2026-06').map((m) => [m, 1.0])),
    },
  });

  // Create assignments
  // Sem on General Support FE (Apr-Dec)
  await prisma.assignment.create({
    data: {
      needId: gsFE.id, resourceId: sem.id, orgId: org.id,
      monthAllocations: Object.fromEntries(monthRange('2026-04', '2026-12').map((m) => [m, 1.0])),
    },
  });

  // Luka on General Support FE (Apr-Dec)
  await prisma.assignment.create({
    data: {
      needId: gsFE.id, resourceId: luka.id, orgId: org.id,
      monthAllocations: Object.fromEntries(monthRange('2026-04', '2026-12').map((m) => [m, 1.0])),
    },
  });

  // Nikola on General Support BE (Apr-Jun)
  await prisma.assignment.create({
    data: {
      needId: gsBE.id, resourceId: nikola.id, orgId: org.id,
      monthAllocations: Object.fromEntries(monthRange('2026-04', '2026-06').map((m) => [m, 1.0])),
    },
  });

  // Sem on General Support BE (Apr-Dec)
  await prisma.assignment.create({
    data: {
      needId: gsBE.id, resourceId: sem.id, orgId: org.id,
      monthAllocations: Object.fromEntries(monthRange('2026-04', '2026-12').map((m) => [m, 1.0])),
    },
  });

  // Luka on Finance Reporting FE (Apr-Jun)
  await prisma.assignment.create({
    data: {
      needId: frFE.id, resourceId: luka.id, orgId: org.id,
      monthAllocations: Object.fromEntries(monthRange('2026-04', '2026-06').map((m) => [m, 1.0])),
    },
  });

  console.log('Seed complete!');
  console.log('Login: demo@databob.ch / demo123');
}

seed()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
