import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateSparePartDto } from './dto/spare-parts.dto';
import {
  buildCursorWhere,
  decodeCursor,
  encodeCursor,
} from '../../common/utils/cursor';

@Injectable()
export class SparePartsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(params: {
    search?: string;
    make?: string;
    model?: string;
    condition?: string;
    cursor?: string;
    limit?: number;
  }) {
    const boundedLimit = Math.min(50, Math.max(1, params.limit || 20));
    const where: any = { isActive: true };
    const cursorTuple = params.cursor ? decodeCursor(params.cursor) : null;

    if (params.condition) {
      where.condition = params.condition;
    }

    if (params.search) {
      where.OR = [
        { name: { contains: params.search, mode: 'insensitive' } },
        { partNumber: { contains: params.search, mode: 'insensitive' } },
      ];
    }

    if (params.make) {
      where.compatibleMakes = { has: params.make };
    }

    if (params.model) {
      where.compatibleModels = { has: params.model };
    }

    const items = await this.prisma.sparePart.findMany({
      where: {
        ...buildCursorWhere(cursorTuple),
        ...where,
      },
      take: boundedLimit,
      orderBy: { createdAt: 'desc', id: 'desc' },
      include: {
        provider: {
          select: {
            id: true,
            businessName: true,
            phone: true,
            address: true,
            avgRating: true,
          },
        },
      },
    });

    return {
      items,
      nextCursor:
        items.length === boundedLimit
          ? encodeCursor({
              createdAt: items[items.length - 1].createdAt.toISOString(),
              id: items[items.length - 1].id,
            })
          : null,
    };
  }

  async findOne(id: string) {
    const part = await this.prisma.sparePart.findFirst({
      where: { id, isActive: true },
      include: {
        provider: {
          select: {
            id: true,
            businessName: true,
            phone: true,
            address: true,
            avgRating: true,
          },
        },
      },
    });

    if (!part) {
      throw new NotFoundException(`Spare part with ID ${id} not found`);
    }

    return part;
  }

  async create(providerId: string, dto: CreateSparePartDto) {
    return this.prisma.sparePart.create({
      data: {
        providerId,
        name: dto.name,
        partNumber: dto.partNumber,
        compatibleMakes: dto.compatibleMakes,
        compatibleModels: dto.compatibleModels,
        condition: dto.condition as any,
        price: dto.price,
        stockQuantity: dto.stockQuantity,
        imageUrl: dto.imageUrl,
      },
    });
  }
}
