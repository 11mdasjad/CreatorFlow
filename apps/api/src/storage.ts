import {
  Controller,
  Injectable,
  Get,
  Post,
  Delete,
  Param,
  Body,
  Req,
  UseGuards,
  ServiceUnavailableException,
  BadRequestException,
} from '@nestjs/common';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { z } from 'zod';
import {
  Db,
  AuthGuard,
  TenantGuard,
  AuthedRequest,
  parse,
  owned,
  token,
  requireRole,
} from './core';
@Injectable()
export class Storage {
  private client() {
    if (!process.env.S3_BUCKET) throw new ServiceUnavailableException('S3 is not configured');
    return new S3Client({
      region: process.env.AWS_REGION || 'ap-south-1',
      ...(process.env.S3_ENDPOINT
        ? { endpoint: process.env.S3_ENDPOINT, forcePathStyle: true }
        : {}),
    });
  }
  async upload(file: any) {
    return getSignedUrl(
      this.client(),
      new PutObjectCommand({
        Bucket: process.env.S3_BUCKET,
        Key: file.key,
        ContentType: file.mimeType,
        ContentLength: file.size,
        ServerSideEncryption: 'AES256',
      }),
      { expiresIn: 300 },
    );
  }
  async inspect(file: any) {
    const h = await this.client().send(
      new HeadObjectCommand({ Bucket: process.env.S3_BUCKET, Key: file.key }),
    );
    if (h.ContentLength !== file.size || h.ContentType !== file.mimeType)
      throw new BadRequestException('Uploaded file does not match its declared type or size');
  }
  async download(file: any) {
    return getSignedUrl(
      this.client(),
      new GetObjectCommand({
        Bucket: process.env.S3_BUCKET,
        Key: file.key,
        ResponseContentDisposition: `attachment; filename="${file.filename.replace(/[^a-zA-Z0-9._-]/g, '_')}"`,
        ResponseContentType: 'application/octet-stream',
      }),
      { expiresIn: 60 },
    );
  }
  async remove(file: any) {
    await this.client().send(
      new DeleteObjectCommand({ Bucket: process.env.S3_BUCKET, Key: file.key }),
    );
  }
}
@Controller('workspaces/:workspaceId/files')
@UseGuards(AuthGuard, TenantGuard)
export class FilesController {
  constructor(
    private db: Db,
    private storage: Storage,
  ) {}
  @Get() list(@Req() req: AuthedRequest) {
    return this.db.fileAsset.findMany({
      where: { workspaceId: req.workspaceId },
      select: {
        id: true,
        filename: true,
        mimeType: true,
        size: true,
        status: true,
        createdAt: true,
      },
      take: 100,
    });
  }
  @Post('upload') async upload(@Req() req: AuthedRequest, @Body() input: unknown) {
    const b = parse(
      z
        .object({
          filename: z.string().min(1).max(150),
          mimeType: z.enum([
            'application/pdf',
            'application/zip',
            'image/png',
            'image/jpeg',
            'text/plain',
            'video/mp4',
          ]),
          size: z
            .number()
            .int()
            .min(1)
            .max(100 * 1024 * 1024),
        })
        .strict(),
      input,
    );
    if (!process.env.S3_BUCKET) throw new ServiceUnavailableException('S3 is not configured');
    const file = await this.db.fileAsset.create({
      data: { ...b, workspaceId: req.workspaceId, key: `workspaces/${req.workspaceId}/${token()}` },
    });
    return {
      id: file.id,
      url: await this.storage.upload(file),
      headers: { 'Content-Type': b.mimeType, 'x-amz-server-side-encryption': 'AES256' },
    };
  }
  @Post(':id/complete') async complete(@Req() req: AuthedRequest, @Param('id') id: string) {
    const file = await owned<any>(this.db, 'fileAsset', req.workspaceId, id);
    await this.storage.inspect(file);
    return this.db.fileAsset.update({
      where: { id, workspaceId: req.workspaceId },
      data: { status: 'READY' },
    });
  }
  @Get(':id/download') async download(@Req() req: AuthedRequest, @Param('id') id: string) {
    const file = await owned<any>(this.db, 'fileAsset', req.workspaceId, id);
    if (file.status !== 'READY') throw new BadRequestException('Upload is not complete');
    return { url: await this.storage.download(file) };
  }
  @Delete(':id') async remove(@Req() req: AuthedRequest, @Param('id') id: string) {
    requireRole(req, ['OWNER', 'ADMIN']);
    const file = await owned<any>(this.db, 'fileAsset', req.workspaceId, id);
    const refs =
      (await this.db.product.count({ where: { workspaceId: req.workspaceId, fileId: id } })) +
      (await this.db.leadMagnet.count({ where: { workspaceId: req.workspaceId, fileId: id } }));
    if (refs)
      throw new BadRequestException('Detach this file from its products and lead magnets first');
    await this.storage.remove(file);
    await this.db.fileAsset.delete({ where: { id, workspaceId: req.workspaceId } });
    return { ok: true };
  }
}
