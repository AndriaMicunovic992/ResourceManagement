import { prisma } from '../db/prisma.js';
import { hashPassword, verifyPassword } from '../utils/password.js';
import { UnauthorizedError, ConflictError } from '../utils/errors.js';
import type { SignupInput, LoginInput } from '../schemas/auth.schema.js';
import { seedDefaultRoles } from './role.service.js';

export const authService = {
  async signup(input: SignupInput) {
    const existing = await prisma.user.findUnique({ where: { email: input.email } });
    if (existing) throw new ConflictError('Email already registered');

    const hashed = await hashPassword(input.password);
    const slug = input.orgName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

    const { user, org } = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { email: input.email, password: hashed, name: input.name },
      });

      const org = await tx.organization.create({
        data: { name: input.orgName, slug: slug + '-' + user.id.slice(0, 6) },
      });

      await tx.orgMember.create({
        data: { userId: user.id, orgId: org.id, role: 'owner' },
      });

      return { user, org };
    });

    await seedDefaultRoles(org.id);
    return { user: { id: user.id, email: user.email, name: user.name }, org };
  },

  async login(input: LoginInput) {
    const user = await prisma.user.findUnique({
      where: { email: input.email },
      include: { memberships: { include: { org: true } } },
    });
    if (!user) throw new UnauthorizedError('Invalid credentials');
    // SSO-provisioned accounts have no local password.
    if (!user.password) throw new UnauthorizedError('This account uses Microsoft sign-in');

    const valid = await verifyPassword(input.password, user.password);
    if (!valid) throw new UnauthorizedError('Invalid credentials');

    const firstMembership = user.memberships[0];
    if (!firstMembership) throw new UnauthorizedError('No organization access');

    return {
      user: { id: user.id, email: user.email, name: user.name },
      org: firstMembership.org,
      role: firstMembership.role,
    };
  },

  async getMe(userId: string, orgId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true, avatar: true, microsoftId: true },
    });
    const membership = await prisma.orgMember.findUnique({
      where: { userId_orgId: { userId, orgId } },
      include: { org: true },
    });
    return {
      user: user
        ? {
            id: user.id,
            email: user.email,
            name: user.name,
            avatar: user.avatar,
            // Boolean only — the oid itself stays server-side.
            microsoftLinked: !!user.microsoftId,
          }
        : null,
      org: membership?.org,
      role: membership?.role,
    };
  },
};
