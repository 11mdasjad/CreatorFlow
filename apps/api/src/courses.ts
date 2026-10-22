import { Controller, Get, Post, Put, Req, Param, Body, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { Db, AuthGuard, TenantGuard, AuthedRequest, owned, parse } from './core';
@Controller('workspaces/:workspaceId/courses')
@UseGuards(AuthGuard, TenantGuard)
export class CoursesController {
  constructor(private db: Db) {}
  @Get(':id/curriculum') async get(@Req() req: AuthedRequest, @Param('id') id: string) {
    await owned(this.db, 'course', req.workspaceId, id);
    return this.db.courseModule.findMany({
      where: { workspaceId: req.workspaceId, courseId: id },
      include: { lessons: { orderBy: { position: 'asc' } } },
      orderBy: { position: 'asc' },
    });
  }
  @Post(':id/modules') async module(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
    @Body() input: unknown,
  ) {
    await owned(this.db, 'course', req.workspaceId, id);
    const b = parse(
      z
        .object({ name: z.string().min(2).max(120), position: z.number().int().min(0).max(100) })
        .strict(),
      input,
    );
    return this.db.courseModule.create({
      data: { ...b, workspaceId: req.workspaceId, courseId: id },
    });
  }
  @Post('modules/:id/lessons') async lesson(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
    @Body() input: unknown,
  ) {
    await owned(this.db, 'courseModule', req.workspaceId, id);
    const b = parse(
      z
        .object({
          name: z.string().min(2).max(120),
          body: z.string().max(50000),
          position: z.number().int().min(0).max(500),
          videoUrl: z.string().url().startsWith('https://').nullable().optional(),
        })
        .strict(),
      input,
    );
    return this.db.courseLesson.create({
      data: { ...b, workspaceId: req.workspaceId, moduleId: id },
    });
  }
  @Put('lessons/:id') async update(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
    @Body() input: unknown,
  ) {
    await owned(this.db, 'courseLesson', req.workspaceId, id);
    const b = parse(
      z
        .object({
          name: z.string().min(2).max(120),
          body: z.string().max(50000),
          position: z.number().int().min(0).max(500),
          videoUrl: z.string().url().startsWith('https://').nullable().optional(),
        })
        .strict(),
      input,
    );
    return this.db.courseLesson.update({ where: { id, workspaceId: req.workspaceId }, data: b });
  }
}
