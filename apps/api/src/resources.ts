import { resolveAnalyticsRange } from './analytics-range';
import {
  Controller,
  UseGuards,
  Get,
  Post,
  Patch,
  Delete,
  Req,
  Res,
  Body,
  Param,
  Query,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { z } from 'zod';
import {
  Db,
  AuthGuard,
  TenantGuard,
  AuthedRequest,
  parse,
  pageSchema,
  quota,
  workspaceLock,
  owned,
  audit,
  notify,
  csv,
} from './core';
import { schemas, models, Resource, keywordMatches, graphSchema, validateGraph } from './schemas';
export async function dispatchWorkflows(
  db: any,
  workspaceId: string,
  kind: string,
  eventKey: string,
  leadId: string,
) {
  const flows = await db.workflow.findMany({
    where: { workspaceId, status: 'ACTIVE' },
    include: { versions: { orderBy: { version: 'desc' }, take: 1 } },
  });
  for (const flow of flows) {
    const version = flow.versions[0];
    if (version && (version.graph as any).nodes.some((n: any) => n.type === kind))
      await db.workflowExecution.upsert({
        where: { versionId_eventKey: { versionId: version.id, eventKey } },
        create: { versionId: version.id, eventKey, leadId },
        update: {},
      });
  }
}
@ApiTags('Workspace resources')
@Controller('workspaces/:workspaceId')
@UseGuards(AuthGuard, TenantGuard)
export class ResourcesController {
  constructor(private db: Db) {}
  private resource(kind: string): Resource {
    if (!(kind in models)) throw new NotFoundException('Unknown resource');
    return kind as Resource;
  }
  private async validate(db: any, kind: Resource, wid: string, b: any, id?: string) {
    if (b.fileId) {
      const file = await owned<any>(db, 'fileAsset', wid, b.fileId);
      if (file.status !== 'READY') throw new BadRequestException('Complete the file upload first');
    }
    if (b.formId) await owned(db, 'leadForm', wid, b.formId);
    if (b.courseId) await owned(db, 'course', wid, b.courseId);
    if (kind === 'magnets' && b.published && (!b.formId || (!b.resourceUrl && !b.fileId)))
      throw new BadRequestException('A published resource needs a form and a file or HTTPS link');
    if (
      kind === 'products' &&
      b.published &&
      ((b.kind === 'DOWNLOAD' && !b.fileId) || (b.kind === 'COURSE' && !b.courseId))
    )
      throw new BadRequestException('Attach a file or course before publishing');
    if (kind === 'automations') {
      let account: any;
      if (b.accountId) account = await owned(db, 'connectedSocialAccount', wid, b.accountId);
      if (b.status === 'ACTIVE') {
        if (
          process.env.META_APPROVED !== 'true' ||
          process.env.META_PRIVATE_REPLY_POLICY_VERIFIED !== 'true'
        )
          throw new BadRequestException(
            'Meta app approval and current private-reply policy verification are required',
          );
        if (
          !account ||
          account.status !== 'CONNECTED' ||
          account.expiresAt < new Date() ||
          !account.webhookSubscribed
        )
          throw new BadRequestException(
            'Connect a healthy Instagram account with an active webhook first',
          );
        if (!account.permissions.includes('instagram_business_manage_comments'))
          throw new BadRequestException(
            'Instagram comment permission could not be verified. Reauthorize the account.',
          );
        if (!b.mediaId) throw new BadRequestException('Select a specific Instagram post or reel');
        await quota(
          db,
          wid,
          'automations',
          await db.automation.count({
            where: { workspaceId: wid, status: 'ACTIVE', ...(id ? { id: { not: id } } : {}) },
          }),
        );
      }
    }
  }
  @Get('resources/:kind/export') async export(
    @Req() req: AuthedRequest,
    @Param('kind') kind: string,
    @Res() res: Response,
  ) {
    const k = this.resource(kind);
    if (k !== 'leads') throw new BadRequestException('Only lead export is available here');
    const rows = await this.db.lead.findMany({
      where: { workspaceId: req.workspaceId },
      take: 10000,
      orderBy: { createdAt: 'desc' },
      select: {
        name: true,
        email: true,
        phone: true,
        source: true,
        status: true,
        tags: true,
        createdAt: true,
      },
    });
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="creatorflow-leads.csv"');
    res.send(csv(rows));
  }
  @Get('resources/:kind') async list(
    @Req() req: AuthedRequest,
    @Param('kind') kind: string,
    @Query() query: unknown,
  ) {
    const k = this.resource(kind);
    const p = parse(pageSchema.extend({ status: z.string().max(30).optional() }), query);
    const model = (this.db as any)[models[k]];
    const where: any = { workspaceId: req.workspaceId };
    if (p.search)
      where.OR = (k === 'leads' ? ['name', 'email'] : k === 'support' ? ['subject'] : ['name']).map(
        (field) => ({ [field]: { contains: p.search, mode: 'insensitive' } }),
      );
    if (p.status && k === 'leads') {
      where.status = parse(
        z.enum(['NEW', 'CONTACTED', 'QUALIFIED', 'CONVERTED', 'LOST']),
        p.status,
      );
    }
    const [items, total] = await Promise.all([
      model.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (p.page - 1) * p.limit,
        take: p.limit,
      }),
      model.count({ where }),
    ]);
    return { items, total, page: p.page, pages: Math.ceil(total / p.limit) };
  }
  @Get('resources/:kind/:id') async get(
    @Req() req: AuthedRequest,
    @Param('kind') kind: string,
    @Param('id') id: string,
  ) {
    return owned(this.db, models[this.resource(kind)], req.workspaceId, id);
  }
  @Post('resources/:kind') async create(
    @Req() req: AuthedRequest,
    @Param('kind') kind: string,
    @Body() input: unknown,
  ) {
    const k = this.resource(kind);
    const b = parse(schemas[k] as z.ZodType<any>, input);
    return this.db.$transaction(async (tx) => {
      await workspaceLock(tx, req.workspaceId);
      await this.validate(tx, k, req.workspaceId, b);
      if (k === 'leads')
        await quota(
          tx,
          req.workspaceId,
          'leads',
          await tx.lead.count({ where: { workspaceId: req.workspaceId } }),
        );
      const row = await (tx as any)[models[k]].create({
        data: { ...b, workspaceId: req.workspaceId },
      });
      await audit(tx, req.user.id, `${k.toUpperCase()}_CREATED`, req.workspaceId, row.id);
      if (k === 'leads') {
        await notify(
          tx,
          req.workspaceId,
          'New lead captured',
          `${row.name} was added to your CRM.`,
        );
        await dispatchWorkflows(tx, req.workspaceId, 'leadCreated', row.id, row.id);
      }
      return row;
    });
  }
  @Patch('resources/:kind/:id') async update(
    @Req() req: AuthedRequest,
    @Param('kind') kind: string,
    @Param('id') id: string,
    @Body() input: unknown,
  ) {
    const k = this.resource(kind);
    if (k === 'support')
      throw new BadRequestException('Support tickets are reviewed by the platform team');
    const partial = parse(schemas[k].partial().strict() as z.ZodType<any>, input);
    return this.db.$transaction(async (tx) => {
      await workspaceLock(tx, req.workspaceId);
      const row = await owned<any>(tx, models[k], req.workspaceId, id);
      const merged = { ...row, ...partial };
      await this.validate(tx, k, req.workspaceId, merged, id);
      const updated = await (tx as any)[models[k]].update({
        where: { id, workspaceId: req.workspaceId },
        data: { ...partial, ...(k === 'automations' ? { version: { increment: 1 } } : {}) },
      });
      await audit(tx, req.user.id, `${k.toUpperCase()}_UPDATED`, req.workspaceId, id);
      return updated;
    });
  }
  @Delete('resources/:kind/:id') async remove(
    @Req() req: AuthedRequest,
    @Param('kind') kind: string,
    @Param('id') id: string,
  ) {
    const k = this.resource(kind);
    await owned(this.db, models[k], req.workspaceId, id);
    await (this.db as any)[models[k]].delete({ where: { id, workspaceId: req.workspaceId } });
    await audit(this.db, req.user.id, `${k.toUpperCase()}_DELETED`, req.workspaceId, id);
    return { ok: true };
  }
  @Get('leads/:id/timeline') async timeline(@Req() req: AuthedRequest, @Param('id') id: string) {
    await owned(this.db, 'lead', req.workspaceId, id);
    return this.db.lead.findUnique({
      where: { id, workspaceId: req.workspaceId },
      include: { notes: { orderBy: { createdAt: 'desc' } }, consents: true, submissions: true },
    });
  }
  @Post('leads/:id/notes') async note(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
    @Body() input: unknown,
  ) {
    await owned(this.db, 'lead', req.workspaceId, id);
    const b = parse(z.object({ body: z.string().trim().min(1).max(5000) }).strict(), input);
    return this.db.leadNote.create({
      data: { ...b, leadId: id, workspaceId: req.workspaceId, authorId: req.user.id },
    });
  }
  @Post('automations/:id/simulate') async simulate(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
    @Body() input: unknown,
  ) {
    const b = parse(z.object({ comment: z.string().max(2000) }), input);
    const row = await owned<any>(this.db, 'automation', req.workspaceId, id);
    return {
      mode: 'Simulation',
      matched: keywordMatches(b.comment, row.keywords, row.matchMode),
      preview: row.message,
      notice: 'No message was sent. Live eligibility is checked separately at execution time.',
    };
  }
  @Post('automations/:id/duplicate') async duplicate(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
  ) {
    const row = await owned<any>(this.db, 'automation', req.workspaceId, id);
    const { id: _, createdAt, updatedAt, ...data } = row;
    return this.db.automation.create({
      data: { ...data, name: `${row.name} (copy)`.slice(0, 120), status: 'DRAFT', version: 1 },
    });
  }
  @Get('automations/:id/executions') async executions(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
  ) {
    await owned(this.db, 'automation', req.workspaceId, id);
    return this.db.automationExecution.findMany({
      where: { workspaceId: req.workspaceId, automationId: id },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }
  @Get('workflows') workflows(@Req() req: AuthedRequest) {
    return this.db.workflow.findMany({
      where: { workspaceId: req.workspaceId },
      orderBy: { updatedAt: 'desc' },
      take: 100,
    });
  }
  @Post('workflows') async saveWorkflow(@Req() req: AuthedRequest, @Body() input: unknown) {
    const b = parse(
      z
        .object({ id: z.string().optional(), name: z.string().min(2).max(100), graph: graphSchema })
        .strict(),
      input,
    );
    if (b.id) {
      await owned(this.db, 'workflow', req.workspaceId, b.id);
      return this.db.workflow.update({
        where: { id: b.id, workspaceId: req.workspaceId },
        data: { name: b.name, draft: b.graph },
      });
    }
    return this.db.workflow.create({
      data: { workspaceId: req.workspaceId, name: b.name, draft: b.graph },
    });
  }
  @Post('workflows/:id/publish') async publishWorkflow(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
  ) {
    return this.db.$transaction(async (tx) => {
      await workspaceLock(tx, req.workspaceId);
      const flow = await owned<any>(tx, 'workflow', req.workspaceId, id);
      const graph = parse(graphSchema, flow.draft);
      const errors = validateGraph(graph);
      if (errors.length) throw new BadRequestException(errors.join('. '));
      await quota(
        tx,
        req.workspaceId,
        'workflows',
        await tx.workflow.count({
          where: { workspaceId: req.workspaceId, status: 'ACTIVE', id: { not: id } },
        }),
      );
      const version = flow.publishedVersion + 1;
      await tx.workflowVersion.create({
        data: { workspaceId: req.workspaceId, workflowId: id, version, graph },
      });
      return tx.workflow.update({
        where: { id, workspaceId: req.workspaceId },
        data: { publishedVersion: version, status: 'ACTIVE' },
      });
    });
  }
  @Post('workflows/:id/pause') async pauseWorkflow(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
  ) {
    await owned(this.db, 'workflow', req.workspaceId, id);
    return this.db.workflow.update({
      where: { id, workspaceId: req.workspaceId },
      data: { status: 'PAUSED' },
    });
  }
  @Get('workflows/:id/executions') async workflowExecutions(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
  ) {
    await owned(this.db, 'workflow', req.workspaceId, id);
    return this.db.workflowExecution.findMany({
      where: { version: { workspaceId: req.workspaceId, workflowId: id } },
      take: 100,
      orderBy: { createdAt: 'desc' },
    });
  }
  @Get('analytics') async analytics(@Req() req: AuthedRequest, @Query() query: unknown) {
    const wid = req.workspaceId;
    const workspace = await this.db.workspace.findUniqueOrThrow({ where: { id: wid } });
    const range = resolveAnalyticsRange(query, workspace.timezone);
    const { days, startDate, endDate } = range;
    const createdAt = { gte: range.start, lt: range.endExclusive };
    const [
      leads,
      accounts,
      automations,
      accepted,
      failed,
      attempts,
      revenue,
      recent,
      leadRows,
      executionRows,
    ] = await Promise.all([
      this.db.lead.count({ where: { workspaceId: wid } }),
      this.db.connectedSocialAccount.count({
        where: { workspaceId: wid, status: 'CONNECTED', expiresAt: { gt: new Date() } },
      }),
      this.db.automation.count({ where: { workspaceId: wid, status: 'ACTIVE' } }),
      this.db.automationExecution.count({
        where: { workspaceId: wid, status: 'ACCEPTED', createdAt },
      }),
      this.db.automationExecution.count({
        where: { workspaceId: wid, status: 'FAILED', createdAt },
      }),
      this.db.automationExecution.count({
        where: { workspaceId: wid, attempts: { gt: 0 }, createdAt },
      }),
      this.db.order.groupBy({
        by: ['currency'],
        where: { workspaceId: wid, status: 'PAID', createdAt },
        _sum: { amountMinor: true },
        _count: true,
      }),
      this.db.auditLog.findMany({
        where: { workspaceId: wid },
        orderBy: { createdAt: 'desc' },
        take: 8,
      }),
      this.db.$queryRawUnsafe<any[]>(
        'SELECT to_char("createdAt" AT TIME ZONE \'UTC\' AT TIME ZONE $4,\'YYYY-MM-DD\') AS day, count(*)::int AS count FROM "Lead" WHERE "workspaceId"=$1 AND "createdAt">=$2 AND "createdAt"<$3 GROUP BY day',
        wid,
        range.start,
        range.endExclusive,
        workspace.timezone,
      ),
      this.db.$queryRawUnsafe<any[]>(
        'SELECT to_char("createdAt" AT TIME ZONE \'UTC\' AT TIME ZONE $4,\'YYYY-MM-DD\') AS day, count(*)::int AS count FROM "AutomationExecution" WHERE "workspaceId"=$1 AND "createdAt">=$2 AND "createdAt"<$3 AND status=\'ACCEPTED\' GROUP BY day',
        wid,
        range.start,
        range.endExclusive,
        workspace.timezone,
      ),
    ]);
    const series = Array.from({ length: days }, (_, i) => {
      const day = new Date(+new Date(startDate + 'T00:00:00Z') + i * 86400000)
        .toISOString()
        .slice(0, 10);
      return {
        day,
        leads: leadRows.find((r) => r.day === day)?.count || 0,
        messages: executionRows.find((r) => r.day === day)?.count || 0,
      };
    });
    return {
      leads,
      accounts,
      automations,
      accepted,
      failed,
      attempts,
      successRate: attempts ? Math.round((accepted / attempts) * 100) : null,
      revenue,
      recent,
      series,
      timezone: workspace.timezone,
      days,
      startDate,
      endDate,
      definitions: {
        accepted: 'Meta accepted the API request; this does not confirm delivery or reading.',
        revenue:
          'Gross paid orders grouped by currency. Full refunds are excluded; partial refunds are shown in payment monitoring.',
      },
    };
  }
}
