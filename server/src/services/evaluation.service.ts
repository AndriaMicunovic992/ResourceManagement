import { Prisma } from '@prisma/client';
import { prisma } from '../db/prisma.js';
import { NotFoundError, ForbiddenError } from '../utils/errors.js';
import {
  isAdminRole,
  userIsManagerOf,
  userIsResponsibleFor,
  getRequestingResourceId,
} from './personAccess.service.js';
import type {
  CreateEvaluationInput,
  BatchCreateEvaluationInput,
  UpdateScoreInput,
  FinalizeEvaluationInput,
  ListEvaluationsQuery,
} from '../schemas/evaluation.schema.js';

const evaluationInclude: Prisma.EvaluationInclude = {
  resource: { select: { id: true, name: true } },
  customer: { select: { id: true, name: true } },
  project: { select: { id: true, name: true } },
  createdByUser: { select: { id: true, name: true, email: true } },
  finalizedByUser: { select: { id: true, name: true, email: true } },
  categorySnapshots: {
    orderBy: [
      { categoryGroupingSnapshot: 'asc' },
      { sortOrderSnapshot: 'asc' },
      { categoryNameSnapshot: 'asc' },
    ],
  },
  scores: true,
};

type EvaluationFull = Prisma.EvaluationGetPayload<{
  include: {
    resource: { select: { id: true; name: true } };
    customer: { select: { id: true; name: true } };
    project: { select: { id: true; name: true } };
    createdByUser: { select: { id: true; name: true; email: true } };
    finalizedByUser: { select: { id: true; name: true; email: true } };
    categorySnapshots: true;
    scores: true;
  };
}>;

function parseDateOnly(value: string, endOfDay: boolean): Date {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const suffix = endOfDay ? 'T23:59:59.999Z' : 'T00:00:00.000Z';
    return new Date(`${value}${suffix}`);
  }
  return new Date(value);
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function computeFinal(snapshots: { id: string; weightSnapshot: number }[], scores: { categorySnapshotId: string; responsibleScore: number | null }[]): number | null {
  let weightedSum = 0;
  let weightTotal = 0;
  for (const snap of snapshots) {
    const score = scores.find((s) => s.categorySnapshotId === snap.id)?.responsibleScore;
    if (score == null) continue;
    weightedSum += score * snap.weightSnapshot;
    weightTotal += snap.weightSnapshot;
  }
  if (weightTotal === 0) return null;
  return round1(weightedSum / weightTotal);
}

async function ensureResourceInOrg(orgId: string, resourceId: string) {
  const r = await prisma.resource.findFirst({ where: { id: resourceId, orgId } });
  if (!r) throw new NotFoundError('Resource not found');
  return r;
}

async function ensureCustomerInOrg(orgId: string, customerId: string) {
  const c = await prisma.customer.findFirst({ where: { id: customerId, orgId } });
  if (!c) throw new NotFoundError('Customer not found');
  return c;
}

async function ensureProjectInOrg(orgId: string, projectId: string, customerId?: string) {
  const p = await prisma.project.findFirst({ where: { id: projectId, orgId } });
  if (!p) throw new NotFoundError('Project not found');
  if (customerId && p.customerId !== customerId) {
    throw new NotFoundError('Project does not belong to this customer');
  }
  return p;
}

async function computePeriodStart(
  orgId: string,
  resourceId: string,
  customerId: string,
  projectId: string | null
): Promise<Date> {
  const previous = await prisma.evaluation.findFirst({
    where: {
      orgId,
      resourceId,
      state: 'finalized',
      customerId,
      projectId: projectId ?? null,
    },
    orderBy: { periodEnd: 'desc' },
    select: { periodEnd: true },
  });
  if (previous) return previous.periodEnd;
  // Fallback to person createdAt.
  const person = await prisma.resource.findUnique({
    where: { id: resourceId },
    select: { createdAt: true },
  });
  return person?.createdAt ?? new Date(0);
}

async function snapshotCategories(evaluationId: string, orgId: string) {
  const cats = await prisma.performanceLogCategory.findMany({
    where: { orgId, active: true },
    orderBy: [{ grouping: 'asc' }, { sortOrder: 'asc' }, { name: 'asc' }],
  });
  for (const c of cats) {
    const snap = await prisma.evaluationCategorySnapshot.create({
      data: {
        evaluationId,
        categoryId: c.id,
        categoryNameSnapshot: c.name,
        categoryGroupingSnapshot: c.grouping ?? null,
        weightSnapshot: c.weight,
        sortOrderSnapshot: c.sortOrder,
      },
    });
    await prisma.evaluationScore.create({
      data: {
        evaluationId,
        categorySnapshotId: snap.id,
      },
    });
  }
}

/**
 * Tie matching logs to a finalized evaluation:
 * resourceId matches, createdAt within [periodStart, periodEnd], evaluationId
 * is null, and customer/project scope matches (null counts as wildcard).
 */
async function tieLogs(evaluation: {
  id: string;
  orgId: string;
  resourceId: string;
  customerId: string | null;
  projectId: string | null;
  periodStart: Date;
  periodEnd: Date;
}): Promise<void> {
  const where: Prisma.LogWhereInput = {
    orgId: evaluation.orgId,
    resourceId: evaluation.resourceId,
    evaluationId: null,
    createdAt: {
      gte: evaluation.periodStart,
      lte: evaluation.periodEnd,
    },
  };
  if (evaluation.customerId) {
    where.OR = [{ customerId: evaluation.customerId }, { customerId: null }];
  }
  if (evaluation.projectId) {
    // Combine with the customer filter: project match OR null project.
    const projectClause: Prisma.LogWhereInput = {
      OR: [{ projectId: evaluation.projectId }, { projectId: null }],
    };
    where.AND = [...(Array.isArray(where.AND) ? where.AND : []), projectClause];
  }
  await prisma.log.updateMany({ where, data: { evaluationId: evaluation.id } });
}

/**
 * Decide whether the requesting user can read the given evaluation in its
 * current state. Returns 'admin', 'manager', 'responsible', 'subject' (target
 * person) or null if denied.
 */
type ViewerKind = 'admin' | 'manager' | 'responsible' | 'subject' | null;

async function viewerKindFor(
  orgId: string,
  evaluation: { resourceId: string; customerId: string | null; projectId: string | null; state: string },
  userId: string,
  role: string
): Promise<ViewerKind> {
  if (isAdminRole(role)) return 'admin';
  if (await userIsManagerOf(orgId, userId, evaluation.resourceId)) return 'manager';
  if (
    await userIsResponsibleFor(
      orgId,
      userId,
      evaluation.customerId,
      evaluation.projectId
    )
  )
    return 'responsible';
  // Subject: the person themselves.
  const meId = await getRequestingResourceId(orgId, userId);
  if (meId && meId === evaluation.resourceId) return 'subject';
  return null;
}

/**
 * Trim an evaluation for an employee viewing their own finalized evaluation.
 * Removes comments and the log list entirely.
 */
function trimForSubjectFinalized(evaluation: EvaluationFull): Record<string, unknown> {
  return {
    ...evaluation,
    scores: evaluation.scores.map((s) => ({
      id: s.id,
      evaluationId: s.evaluationId,
      categorySnapshotId: s.categorySnapshotId,
      responsibleScore: s.responsibleScore,
      employeeScore: null,
      employeeComment: null,
      responsibleComment: null,
      managerComment: null,
      updatedAt: s.updatedAt,
    })),
    overrideReason: null,
    logs: [],
    _logsHidden: true,
  };
}

export const evaluationService = {
  async list(orgId: string, requestingUserId: string, requestingUserRole: string, query: ListEvaluationsQuery) {
    const where: Prisma.EvaluationWhereInput = { orgId };
    if (query.resourceId) where.resourceId = query.resourceId;
    if (query.state) where.state = query.state;
    if (query.customerId) where.customerId = query.customerId;
    if (query.projectId) where.projectId = query.projectId;

    const all = (await prisma.evaluation.findMany({
      where,
      orderBy: [{ periodEnd: 'desc' }, { createdAt: 'desc' }],
      include: evaluationInclude,
    })) as unknown as EvaluationFull[];

    if (isAdminRole(requestingUserRole)) {
      return all.map((e) => ({ ...e, _viewerKind: 'admin' as const }));
    }

    // Filter by viewer ability.
    const meId = await getRequestingResourceId(orgId, requestingUserId);
    const out: Record<string, unknown>[] = [];
    for (const e of all) {
      const kind = await viewerKindFor(orgId, e, requestingUserId, requestingUserRole);
      if (!kind) continue;
      if (kind === 'subject') {
        if (e.state !== 'finalized') {
          if (e.state === 'draft' && meId === e.resourceId) {
            out.push({ ...e, _viewerKind: 'subject' });
          }
          continue;
        }
        out.push({ ...trimForSubjectFinalized(e), _viewerKind: 'subject' });
        continue;
      }
      out.push({ ...e, _viewerKind: kind });
    }
    return out;
  },

  async getById(orgId: string, id: string, requestingUserId: string, requestingUserRole: string) {
    const evaluation = (await prisma.evaluation.findFirst({
      where: { id, orgId },
      include: evaluationInclude,
    })) as unknown as EvaluationFull | null;
    if (!evaluation) throw new NotFoundError('Evaluation not found');

    const kind = await viewerKindFor(orgId, evaluation, requestingUserId, requestingUserRole);
    if (!kind) throw new NotFoundError('Evaluation not found');

    if (kind === 'subject') {
      if (evaluation.state === 'draft') {
        const meId = await getRequestingResourceId(orgId, requestingUserId);
        if (meId === evaluation.resourceId) {
          return { ...evaluation, _viewerKind: 'subject' as const };
        }
      }
      if (evaluation.state === 'finalized') {
        return { ...trimForSubjectFinalized(evaluation), _viewerKind: 'subject' as const };
      }
      throw new NotFoundError('Evaluation not found');
    }

    const logs = await prisma.log.findMany({
      where: { orgId, evaluationId: id },
      orderBy: { createdAt: 'desc' },
      select: { id: true, createdAt: true, kind: true, content: true, customerId: true, projectId: true },
    });
    return { ...evaluation, logs, _viewerKind: kind };
  },

  async createOne(
    orgId: string,
    requestingUserId: string,
    requestingUserRole: string,
    data: CreateEvaluationInput
  ) {
    return this._createInternal(orgId, requestingUserId, requestingUserRole, data);
  },

  async createBatch(
    orgId: string,
    requestingUserId: string,
    requestingUserRole: string,
    data: BatchCreateEvaluationInput
  ) {
    const created: Awaited<ReturnType<typeof this._createInternal>>[] = [];
    for (const scope of data.scopes) {
      const c = await this._createInternal(orgId, requestingUserId, requestingUserRole, {
        resourceId: data.resourceId,
        customerId: scope.customerId,
        projectId: scope.projectId ?? null,
        periodEnd: data.periodEnd,
      });
      created.push(c);
    }
    return created;
  },

  async _createInternal(
    orgId: string,
    requestingUserId: string,
    requestingUserRole: string,
    data: CreateEvaluationInput
  ) {
    await ensureResourceInOrg(orgId, data.resourceId);
    const customer = await ensureCustomerInOrg(orgId, data.customerId);
    let project: { id: string; name: string } | null = null;
    if (data.projectId) {
      const p = await ensureProjectInOrg(orgId, data.projectId, data.customerId);
      project = { id: p.id, name: p.name };
    }

    // Authorization: admin OR responsible for the scope OR manager of the target.
    const admin = isAdminRole(requestingUserRole);
    const isResponsible = await userIsResponsibleFor(orgId, requestingUserId, data.customerId, data.projectId ?? null);
    const isManager = await userIsManagerOf(orgId, requestingUserId, data.resourceId);
    if (!admin && !isResponsible && !isManager) {
      throw new ForbiddenError('You cannot create an evaluation for this scope');
    }

    const periodStart = await computePeriodStart(
      orgId,
      data.resourceId,
      data.customerId,
      data.projectId ?? null
    );
    const periodEnd = parseDateOnly(data.periodEnd, true);

    const evaluation = await prisma.evaluation.create({
      data: {
        orgId,
        resourceId: data.resourceId,
        customerId: data.customerId,
        customerNameSnapshot: customer.name,
        projectId: data.projectId ?? null,
        projectNameSnapshot: project?.name ?? null,
        periodStart,
        periodEnd,
        state: 'draft',
        createdByUserId: requestingUserId,
      },
    });

    await snapshotCategories(evaluation.id, orgId);

    return prisma.evaluation.findUnique({
      where: { id: evaluation.id },
      include: evaluationInclude,
    });
  },

  async updateScore(
    orgId: string,
    evaluationId: string,
    snapshotId: string,
    requestingUserId: string,
    requestingUserRole: string,
    data: UpdateScoreInput
  ) {
    const evaluation = await prisma.evaluation.findFirst({
      where: { id: evaluationId, orgId },
      include: { categorySnapshots: true, scores: true },
    });
    if (!evaluation) throw new NotFoundError('Evaluation not found');
    const snap = evaluation.categorySnapshots.find((s) => s.id === snapshotId);
    if (!snap) throw new NotFoundError('Score row not found');

    const admin = isAdminRole(requestingUserRole);
    const isManager = await userIsManagerOf(orgId, requestingUserId, evaluation.resourceId);
    const isResponsible = await userIsResponsibleFor(
      orgId,
      requestingUserId,
      evaluation.customerId,
      evaluation.projectId
    );
    const meId = await getRequestingResourceId(orgId, requestingUserId);
    const isSubject = meId === evaluation.resourceId;

    // Build a patch of allowed fields based on (state, role).
    const patch: Prisma.EvaluationScoreUpdateInput = {};
    const allowEmployee =
      evaluation.state === 'draft' && (isSubject || admin);
    const allowResponsible =
      evaluation.state === 'employee_submitted' && (isResponsible || admin);
    const allowManager =
      evaluation.state === 'responsible_submitted' && (isManager || admin);

    if (data.employeeScore !== undefined) {
      if (!allowEmployee) throw new ForbiddenError('Cannot edit employee score now');
      patch.employeeScore = data.employeeScore;
    }
    if (data.employeeComment !== undefined) {
      if (!allowEmployee) throw new ForbiddenError('Cannot edit employee comment now');
      patch.employeeComment = data.employeeComment ?? null;
    }
    if (data.responsibleScore !== undefined) {
      if (!allowResponsible) throw new ForbiddenError('Cannot edit responsible score now');
      patch.responsibleScore = data.responsibleScore;
    }
    if (data.responsibleComment !== undefined) {
      if (!allowResponsible) throw new ForbiddenError('Cannot edit responsible comment now');
      patch.responsibleComment = data.responsibleComment ?? null;
    }
    if (data.managerComment !== undefined) {
      if (!allowManager) throw new ForbiddenError('Cannot edit manager comment now');
      patch.managerComment = data.managerComment ?? null;
    }

    if (Object.keys(patch).length === 0) {
      // No-op
      return prisma.evaluationScore.findFirst({
        where: { evaluationId, categorySnapshotId: snapshotId },
      });
    }

    const createData: Prisma.EvaluationScoreUncheckedCreateInput = {
      evaluationId,
      categorySnapshotId: snapshotId,
      employeeScore: data.employeeScore ?? null,
      employeeComment: data.employeeComment ?? null,
      responsibleScore: data.responsibleScore ?? null,
      responsibleComment: data.responsibleComment ?? null,
      managerComment: data.managerComment ?? null,
    };
    const updated = await prisma.evaluationScore.upsert({
      where: {
        evaluationId_categorySnapshotId: {
          evaluationId,
          categorySnapshotId: snapshotId,
        },
      },
      update: patch,
      create: createData,
    });

    // Recompute computedFinal whenever responsibleScore changes.
    if (data.responsibleScore !== undefined) {
      const scores = await prisma.evaluationScore.findMany({
        where: { evaluationId },
        select: { categorySnapshotId: true, responsibleScore: true },
      });
      const computed = computeFinal(
        evaluation.categorySnapshots.map((s) => ({ id: s.id, weightSnapshot: s.weightSnapshot })),
        scores
      );
      await prisma.evaluation.update({
        where: { id: evaluationId },
        data: { computedFinal: computed },
      });
    }

    return updated;
  },

  async submitEmployee(
    orgId: string,
    id: string,
    requestingUserId: string,
    requestingUserRole: string
  ) {
    const evaluation = await prisma.evaluation.findFirst({ where: { id, orgId } });
    if (!evaluation) throw new NotFoundError('Evaluation not found');
    if (evaluation.state !== 'draft') {
      throw new ForbiddenError('Only draft evaluations can be submitted by the employee');
    }
    const admin = isAdminRole(requestingUserRole);
    const meId = await getRequestingResourceId(orgId, requestingUserId);
    const isSubject = meId === evaluation.resourceId;
    if (!admin && !isSubject) {
      throw new ForbiddenError('Only the target person can submit their self-assessment');
    }
    return prisma.evaluation.update({
      where: { id },
      data: { state: 'employee_submitted' },
      include: evaluationInclude,
    });
  },

  async submitResponsible(
    orgId: string,
    id: string,
    requestingUserId: string,
    requestingUserRole: string
  ) {
    const evaluation = await prisma.evaluation.findFirst({
      where: { id, orgId },
      include: { categorySnapshots: true, scores: true },
    });
    if (!evaluation) throw new NotFoundError('Evaluation not found');
    if (evaluation.state !== 'employee_submitted') {
      throw new ForbiddenError('Evaluation is not awaiting responsible submission');
    }
    const admin = isAdminRole(requestingUserRole);
    const isResponsible = await userIsResponsibleFor(
      orgId,
      requestingUserId,
      evaluation.customerId,
      evaluation.projectId
    );
    if (!admin && !isResponsible) {
      throw new ForbiddenError('Only the responsible person can submit scores');
    }

    // Every snapshot must have a non-null responsibleScore.
    for (const snap of evaluation.categorySnapshots) {
      const s = evaluation.scores.find((x) => x.categorySnapshotId === snap.id);
      if (!s || s.responsibleScore == null) {
        throw new ForbiddenError('All categories must be scored before submitting');
      }
    }

    const computed = computeFinal(
      evaluation.categorySnapshots.map((s) => ({ id: s.id, weightSnapshot: s.weightSnapshot })),
      evaluation.scores.map((s) => ({ categorySnapshotId: s.categorySnapshotId, responsibleScore: s.responsibleScore }))
    );

    return prisma.evaluation.update({
      where: { id },
      data: { state: 'responsible_submitted', computedFinal: computed },
      include: evaluationInclude,
    });
  },

  async finalize(
    orgId: string,
    id: string,
    requestingUserId: string,
    requestingUserRole: string,
    data: FinalizeEvaluationInput
  ) {
    const evaluation = await prisma.evaluation.findFirst({
      where: { id, orgId },
      include: evaluationInclude,
    });
    if (!evaluation) throw new NotFoundError('Evaluation not found');
    if (evaluation.state !== 'responsible_submitted') {
      throw new ForbiddenError('Evaluation is not awaiting finalization');
    }
    const admin = isAdminRole(requestingUserRole);
    const isManager = await userIsManagerOf(orgId, requestingUserId, evaluation.resourceId);
    if (!admin && !isManager) {
      throw new ForbiddenError('Only a manager can finalize an evaluation');
    }
    if (data.overrideFinal != null) {
      if (!data.overrideReason || !data.overrideReason.trim()) {
        throw new ForbiddenError('Override requires a reason');
      }
    }

    const updated = await prisma.evaluation.update({
      where: { id },
      data: {
        state: 'finalized',
        finalizedAt: new Date(),
        finalizedByUserId: requestingUserId,
        overrideFinal: data.overrideFinal ?? null,
        overrideReason: data.overrideFinal != null ? data.overrideReason ?? null : null,
      },
      include: evaluationInclude,
    });

    await tieLogs(updated);

    return updated;
  },

  async delete(orgId: string, id: string, requestingUserRole: string) {
    if (!isAdminRole(requestingUserRole)) {
      throw new ForbiddenError('Only admins can delete evaluations');
    }
    const evaluation = await prisma.evaluation.findFirst({ where: { id, orgId } });
    if (!evaluation) throw new NotFoundError('Evaluation not found');
    await prisma.evaluation.delete({ where: { id } });
  },
};
