import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthUserPayload } from '../../common/types/auth-user-payload.type';
import {
  CreateVehicleDto,
  UpdateAddressesDto,
  UpdateCustomerProfileDto,
  UpdateVehicleDto,
} from './dto/customers.dto';

@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}

  private customerId(user: AuthUserPayload): string {
    if (!user.customerProfileId) {
      throw new ForbiddenException('Customer profile required');
    }
    return user.customerProfileId;
  }

  async getProfile(user: AuthUserPayload) {
    const id = this.customerId(user);
    const profile = await this.prisma.customerProfile.findUnique({
      where: { id },
    });
    if (!profile) {
      throw new NotFoundException('Customer profile not found');
    }
    return profile;
  }

  async updateProfile(user: AuthUserPayload, dto: UpdateCustomerProfileDto) {
    const id = this.customerId(user);
    return this.prisma.customerProfile.update({
      where: { id },
      data: dto,
    });
  }

  async getAddresses(user: AuthUserPayload) {
    const profile = await this.getProfile(user);
    return { addresses: profile.savedAddresses ?? [] };
  }

  async replaceAddresses(user: AuthUserPayload, dto: UpdateAddressesDto) {
    const id = this.customerId(user);
    const addresses = dto.addresses.map((address) => ({
      ...address,
      id: address.id ?? crypto.randomUUID(),
    }));

    const updated = await this.prisma.customerProfile.update({
      where: { id },
      data: { savedAddresses: addresses },
      select: { savedAddresses: true },
    });

    return { addresses: updated.savedAddresses ?? [] };
  }

  async getVehicles(user: AuthUserPayload) {
    const customerId = this.customerId(user);
    const items = await this.prisma.vehicle.findMany({
      where: { customerId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    return { items };
  }

  async createVehicle(user: AuthUserPayload, dto: CreateVehicleDto) {
    const customerId = this.customerId(user);
    return this.prisma.vehicle.create({
      data: {
        customerId,
        ...dto,
        registrationNumber: dto.registrationNumber.trim().toUpperCase(),
      },
    });
  }

  async updateVehicle(
    user: AuthUserPayload,
    id: string,
    dto: UpdateVehicleDto,
  ) {
    const customerId = this.customerId(user);
    const existing = await this.prisma.vehicle.findFirst({
      where: { id, customerId, deletedAt: null },
      select: { id: true },
    });
    if (!existing) {
      throw new NotFoundException('Vehicle not found');
    }

    return this.prisma.vehicle.update({
      where: { id },
      data: {
        ...dto,
        ...(dto.registrationNumber
          ? { registrationNumber: dto.registrationNumber.trim().toUpperCase() }
          : {}),
      },
    });
  }

  async deleteVehicle(user: AuthUserPayload, id: string) {
    const customerId = this.customerId(user);
    const existing = await this.prisma.vehicle.findFirst({
      where: { id, customerId, deletedAt: null },
      select: { id: true },
    });
    if (!existing) {
      throw new NotFoundException('Vehicle not found');
    }

    await this.prisma.vehicle.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    return { deleted: true };
  }
}
