import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Req,
  Res,
  UseGuards,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { z } from 'zod';
import {
  Db,
  AuthGuard,
  AuthedRequest,
  parse,
  rateLimit,
  quota,
  workspaceLock,
  token,
  hash,
  config,
  notify,
} from './core';
import { queueMail } from './auth';
import { dispatchWorkflows } from './resources';
import { Storage } from './storage';
@ApiTags('Public forms and stores')
@Controller('public')
export class PublicController {
  constructor(
    private db: Db,
    private storage: Storage,
  ) {}
  @Get('plans') plans() {
    return this.db.subscriptionPlan.findMany({
      where: { published: true },
      select: {
        id: true,
        name: true,
        description: true,
        priceMinor: true,
        currency: true,
        limits: true,
        features: true,
      },
    });
  }
  @Get('forms/:slug') async form(@Param('slug') slug: string) {
    const form = await this.db.leadForm.findFirst({
      where: { slug, published: true, workspace: { suspendedAt: null } },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        consentText: true,
        fields: true,
      },
    });
    if (!form) throw new NotFoundException('This form is not published');
    return form;
  }
  @Post('forms/:slug/visit') async visit(@Param('slug') slug: string, @Req() req: Request) {
    await rateLimit(`visit:${req.ip}:${slug}`, 1, 3600);
    await this.db.leadForm.updateMany({
      where: { slug, published: true },
      data: { visits: { increment: 1 } },
    });
    return { ok: true };
  }
  @Post('forms/:slug/submit') async submit(
    @Param('slug') slug: string,
    @Req() req: Request,
    @Body() input: unknown,
  ) {
    await rateLimit(`form:${req.ip}`, 10, 3600);
    const b = parse(
      z
        .object({
          name: z.string().trim().min(2).max(100),
          email: z.string().trim().toLowerCase().email().max(254),
          consent: z.boolean(),
          website: z.string().max(500).default(''),
          customFields: z
            .record(z.string(), z.union([z.string().max(1000), z.number()]))
            .default({}),
        })
        .strict(),
      input,
    );
    if (b.website) throw new BadRequestException('Submission rejected');
    const form = await this.db.leadForm.findFirst({
      where: { slug, published: true, workspace: { suspendedAt: null } },
    });
    if (!form) throw new NotFoundException('Form not found');
    const fields = form.fields as { key: string; required: boolean; type: string }[];
    for (const field of fields) {
      const v = b.customFields[field.key];
      if (field.required && (v === undefined || v === ''))
        throw new BadRequestException(`${field.key} is required`);
      if (v !== undefined && typeof v !== (field.type === 'number' ? 'number' : 'string'))
        throw new BadRequestException(`Invalid ${field.key}`);
    }
    if (Object.keys(b.customFields).some((k) => !fields.some((f) => f.key === k)))
      throw new BadRequestException('Unknown custom field');
    await this.db.$transaction(async (tx) => {
      await workspaceLock(tx, form.workspaceId);
      const existing = await tx.lead.findUnique({
        where: { workspaceId_email: { workspaceId: form.workspaceId, email: b.email } },
      });
      if (!existing)
        await quota(
          tx,
          form.workspaceId,
          'leads',
          await tx.lead.count({ where: { workspaceId: form.workspaceId } }),
        );
      const lead =
        existing ||
        (await tx.lead.create({
          data: {
            workspaceId: form.workspaceId,
            name: b.name,
            email: b.email,
            source: form.name,
            tags: [],
            customFields: b.customFields,
          },
        }));
      const submission = await tx.leadFormSubmission.create({
        data: { workspaceId: form.workspaceId, formId: form.id, leadId: lead.id },
      });
      await tx.leadConsent.create({
        data: {
          workspaceId: form.workspaceId,
          leadId: lead.id,
          purpose: 'marketing',
          granted: b.consent,
          wording: form.consentText,
          source: form.slug,
        },
      });
      const magnets = await tx.leadMagnet.findMany({
        where: { workspaceId: form.workspaceId, formId: form.id, published: true },
      });
      for (const magnet of magnets) {
        const t = token();
        await tx.resourceDelivery.create({
          data: {
            workspaceId: form.workspaceId,
            magnetId: magnet.id,
            leadId: lead.id,
            tokenHash: hash(t),
            expiresAt: new Date(Date.now() + 86400000),
          },
        });
        await queueMail(
          tx,
          b.email,
          `Your resource: ${magnet.name}`,
          `Here is the resource you requested: ${config.appUrl}/api/public/resources/${t}\nThis download link expires in 24 hours. This transactional email does not subscribe you to marketing.`,
        );
      }
      await notify(
        tx,
        form.workspaceId,
        'New form submission',
        `${b.name} submitted ${form.name}.`,
      );
      if (!existing) await dispatchWorkflows(tx, form.workspaceId, 'leadCreated', lead.id, lead.id);
      await dispatchWorkflows(tx, form.workspaceId, 'formSubmitted', submission.id, lead.id);
    });
    return {
      message:
        'Thank you! Your details were received. Any requested resources will be sent by email.',
    };
  }
  @Get('resources/:token') async resource(@Param('token') t: string, @Res() res: Response) {
    const delivery = await this.db.resourceDelivery.findUnique({
      where: { tokenHash: hash(t) },
      include: { magnet: { include: { file: true } } },
    });
    if (!delivery || delivery.expiresAt < new Date() || !delivery.magnet.published)
      throw new NotFoundException('Resource link is invalid or expired');
    const m = delivery.magnet;
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Referrer-Policy', 'no-referrer');
    if (m.file && m.file.status === 'READY')
      return res.redirect(await this.storage.download(m.file));
    if (m.resourceUrl) return res.redirect(m.resourceUrl);
    throw new NotFoundException('Resource unavailable');
  }
  @Get('stores/:slug') async store(@Param('slug') slug: string) {
    const store = await this.db.store.findFirst({
      where: { slug, published: true, workspace: { suspendedAt: null } },
      select: { name: true, description: true, accent: true, workspaceId: true, slug: true },
    });
    if (!store) throw new NotFoundException('Store is not published');
    return {
      ...store,
      products: await this.db.product.findMany({
        where: { workspaceId: store.workspaceId, published: true },
        select: {
          id: true,
          name: true,
          description: true,
          kind: true,
          priceMinor: true,
          currency: true,
        },
      }),
    };
  }
}
@ApiTags('Student access')
@Controller('learn')
@UseGuards(AuthGuard)
export class LearningController {
  constructor(
    private db: Db,
    private storage: Storage,
  ) {}
  @Get() async library(@Req() req: AuthedRequest) {
    if (!req.user.verifiedAt) throw new ForbiddenException('Verify your email');
    return {
      enrollments: await this.db.courseEnrollment.findMany({
        where: { email: req.user.email, course: { published: true } },
        include: { course: { select: { id: true, name: true, description: true } } },
      }),
      purchases: await this.db.digitalEntitlement.findMany({
        where: { email: req.user.email, revokedAt: null, order: { status: 'PAID' } },
        include: { product: { select: { id: true, name: true, kind: true, courseId: true } } },
      }),
    };
  }
  @Post('courses/:id/enroll') async enroll(@Req() req: AuthedRequest, @Param('id') id: string) {
    if (!req.user.verifiedAt) throw new ForbiddenException('Verify your email');
    const course = await this.db.course.findFirst({ where: { id, published: true } });
    if (!course) throw new NotFoundException('Course not found');
    if (
      !course.free &&
      !(await this.db.digitalEntitlement.findFirst({
        where: {
          workspaceId: course.workspaceId,
          email: req.user.email,
          revokedAt: null,
          product: { courseId: id },
          order: { status: 'PAID' },
        },
      }))
    )
      throw new ForbiddenException('Purchase this course to enroll');
    return this.db.courseEnrollment.upsert({
      where: { courseId_email: { courseId: id, email: req.user.email } },
      create: { courseId: id, workspaceId: course.workspaceId, email: req.user.email },
      update: {},
    });
  }
  private async access(req: AuthedRequest, id: string) {
    if (!req.user.verifiedAt) throw new ForbiddenException('Verify your email');
    const course = await this.db.course.findFirst({
      where: { id, published: true, enrollments: { some: { email: req.user.email } } },
      include: {
        modules: {
          orderBy: { position: 'asc' },
          include: { lessons: { orderBy: { position: 'asc' } } },
        },
      },
    });
    if (!course) throw new ForbiddenException('Enrollment required');
    if (
      !course.free &&
      !(await this.db.digitalEntitlement.findFirst({
        where: {
          email: req.user.email,
          revokedAt: null,
          product: { courseId: id },
          order: { status: 'PAID' },
        },
      }))
    )
      throw new ForbiddenException('An active paid entitlement is required');
    return course;
  }
  @Get('courses/:id') async course(@Req() req: AuthedRequest, @Param('id') id: string) {
    const course = await this.access(req, id);
    return {
      ...course,
      progress: await this.db.lessonProgress.findMany({
        where: { userId: req.user.id, lesson: { module: { courseId: id } } },
      }),
    };
  }
  @Post('courses/:id/lessons/:lessonId/complete') async complete(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
    @Param('lessonId') lessonId: string,
  ) {
    const course = await this.access(req, id);
    if (!course.modules.some((m) => m.lessons.some((l) => l.id === lessonId)))
      throw new NotFoundException('Lesson not found');
    return this.db.lessonProgress.upsert({
      where: { lessonId_userId: { lessonId, userId: req.user.id } },
      create: { lessonId, userId: req.user.id },
      update: { completedAt: new Date() },
    });
  }
  @Get('products/:id/download') async download(@Req() req: AuthedRequest, @Param('id') id: string) {
    if (!req.user.verifiedAt) throw new ForbiddenException('Verify your email');
    const entitlement = await this.db.digitalEntitlement.findFirst({
      where: { email: req.user.email, productId: id, revokedAt: null, order: { status: 'PAID' } },
      include: { product: { include: { file: true } } },
    });
    if (!entitlement?.product.file || entitlement.product.file.status !== 'READY')
      throw new ForbiddenException('A verified paid entitlement is required');
    return { url: await this.storage.download(entitlement.product.file) };
  }
}
