import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

const ALLOWED_SLUGS = ['terms', 'personal-data', 'privacy'] as const;
export type LegalSlug = (typeof ALLOWED_SLUGS)[number];

@Injectable()
export class LegalService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.legalDocument.findMany({
      orderBy: { slug: 'asc' },
      select: { id: true, slug: true, title: true, updatedAt: true },
    });
  }

  async getBySlug(slug: string) {
    if (!ALLOWED_SLUGS.includes(slug as LegalSlug)) {
      throw new NotFoundException('Документ не найден');
    }
    const doc = await this.prisma.legalDocument.findUnique({ where: { slug } });
    if (!doc) throw new NotFoundException('Документ не найден');
    return doc;
  }

  async update(slug: string, data: { title: string; content: string }) {
    if (!ALLOWED_SLUGS.includes(slug as LegalSlug)) {
      throw new NotFoundException('Документ не найден');
    }
    return this.prisma.legalDocument.update({
      where: { slug },
      data,
    });
  }
}
