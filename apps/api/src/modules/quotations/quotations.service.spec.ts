import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { QuotationsService } from './quotations.service';

describe('QuotationsService authorization and state regressions', () => {
  let service: QuotationsService;
  let mockPrisma: any;
  let mockNotifications: any;

  beforeEach(() => {
    mockPrisma = {
      quotation: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        updateMany: jest.fn(),
      },
      booking: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      serviceRequest: {
        findUnique: jest.fn(),
        updateMany: jest.fn(),
        update: jest.fn(),
      },
      providerProfile: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
      $transaction: jest.fn(),
    };

    mockNotifications = {
      sendPushNotification: jest.fn().mockResolvedValue({}),
    };

    service = new QuotationsService(mockPrisma, mockNotifications);
  });

  const owner = {
    sub: 'usr-owner',
    email: 'owner@example.com',
    role: 'CUSTOMER',
    customerProfileId: 'cust-1',
  } as any;

  const intruder = {
    sub: 'usr-intruder',
    email: 'intruder@example.com',
    role: 'CUSTOMER',
    customerProfileId: 'cust-2',
  } as any;

  function quoteForOwner(overrides: Record<string, any> = {}) {
    return {
      id: 'quote-1',
      requestId: 'req-1',
      providerId: 'prov-1',
      status: 'PENDING',
      request: {
        id: 'req-1',
        customerId: 'cust-1',
        status: 'QUOTES_RECEIVED',
        expiresAt: new Date(Date.now() + 60_000),
      },
      provider: { id: 'prov-1' },
      ...overrides,
    };
  }

  describe('accept', () => {
    it('rejects a non-owner before reading any booking (IDOR regression)', async () => {
      mockPrisma.quotation.findUnique.mockResolvedValue(quoteForOwner());

      await expect(
        service.accept('quote-1', intruder, {} as any),
      ).rejects.toThrow(ForbiddenException);

      expect(mockPrisma.booking.findUnique).not.toHaveBeenCalled();
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    it('returns an existing booking only after ownership is verified', async () => {
      const existingBooking = { id: 'booking-1', quotationId: 'quote-1' };
      mockPrisma.quotation.findUnique.mockResolvedValue(quoteForOwner());
      mockPrisma.booking.findUnique.mockResolvedValue(existingBooking);

      const result = await service.accept('quote-1', owner, {} as any);

      expect(result).toBe(existingBooking);
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    it('rejects acceptance when the service request has expired', async () => {
      mockPrisma.quotation.findUnique.mockResolvedValue(
        quoteForOwner({
          request: {
            id: 'req-1',
            customerId: 'cust-1',
            status: 'QUOTES_RECEIVED',
            expiresAt: new Date(Date.now() - 60_000),
          },
        }),
      );

      await expect(
        service.accept('quote-1', owner, {} as any),
      ).rejects.toThrow(BadRequestException);

      expect(mockPrisma.booking.findUnique).not.toHaveBeenCalled();
    });
  });

  describe('create', () => {
    function setupTransaction(currentStatus: string, createdQuote: any) {
      const tx = {
        serviceRequest: {
          findUnique: jest.fn().mockResolvedValue({
            status: currentStatus,
            expiresAt: new Date(Date.now() + 60_000),
          }),
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        },
        quotation: {
          create: jest.fn().mockResolvedValue(createdQuote),
        },
      };

      mockPrisma.$transaction.mockImplementation((callback: any) =>
        callback(tx),
      );
      return tx;
    }

    it('maps a duplicate quote unique-constraint error to 409', async () => {
      mockPrisma.serviceRequest.findUnique.mockResolvedValue({
        id: 'req-1',
        title: 'Bumper repair',
        status: 'OPEN',
        expiresAt: new Date(Date.now() + 60_000),
        customer: { userId: 'usr-cust' },
      });

      const duplicate = new Prisma.PrismaClientKnownRequestError(
        'Unique constraint failed',
        { code: 'P2002', clientVersion: '6.19.3', meta: {} },
      );

      const tx = {
        serviceRequest: {
          findUnique: jest.fn().mockResolvedValue({
            status: 'OPEN',
            expiresAt: new Date(Date.now() + 60_000),
          }),
          updateMany: jest.fn(),
        },
        quotation: {
          create: jest.fn().mockRejectedValue(duplicate),
        },
      };

      mockPrisma.$transaction.mockImplementation((callback: any) =>
        callback(tx),
      );

      await expect(
        service.create('req-1', 'prov-1', {
          partsCost: 100,
          labourCost: 50,
          shippingCost: 10,
        } as any),
      ).rejects.toThrow(ConflictException);

      expect(tx.serviceRequest.updateMany).not.toHaveBeenCalled();
      expect(mockNotifications.sendPushNotification).not.toHaveBeenCalled();
    });

    it('only promotes an OPEN request and labels a verified provider', async () => {
      mockPrisma.serviceRequest.findUnique.mockResolvedValue({
        id: 'req-1',
        title: 'Bumper repair',
        status: 'OPEN',
        expiresAt: new Date(Date.now() + 60_000),
        customer: { userId: 'usr-cust' },
      });

      const createdQuote = {
        id: 'quote-1',
        totalCost: 160,
        provider: { id: 'prov-1', verificationStatus: 'VERIFIED' },
      };
      const tx = setupTransaction('OPEN', createdQuote);

      const result = await service.create('req-1', 'prov-1', {
        partsCost: 100,
        labourCost: 50,
        shippingCost: 10,
      } as any);

      expect(result).toBe(createdQuote);
      expect(tx.serviceRequest.updateMany).toHaveBeenCalledWith({
        where: { id: 'req-1', status: 'OPEN' },
        data: { status: 'QUOTES_RECEIVED' },
      });
      expect(mockNotifications.sendPushNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.stringContaining('A verified provider'),
        }),
      );
    });

    it('does not claim verification when the provider row is not verified', async () => {
      mockPrisma.serviceRequest.findUnique.mockResolvedValue({
        id: 'req-1',
        title: 'Bumper repair',
        status: 'QUOTES_RECEIVED',
        expiresAt: new Date(Date.now() + 60_000),
        customer: { userId: 'usr-cust' },
      });

      setupTransaction('QUOTES_RECEIVED', {
        id: 'quote-1',
        totalCost: 100,
        provider: { id: 'prov-1', verificationStatus: 'PENDING' },
      });

      await service.create('req-1', 'prov-1', {
        partsCost: 100,
      } as any);

      expect(mockNotifications.sendPushNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.stringContaining('A provider submitted'),
        }),
      );
    });

    it('rejects a quote when the request is no longer open', async () => {
      mockPrisma.serviceRequest.findUnique.mockResolvedValue({
        id: 'req-1',
        title: 'Bumper repair',
        status: 'ACCEPTED',
        expiresAt: new Date(Date.now() + 60_000),
        customer: { userId: 'usr-cust' },
      });

      const tx = setupTransaction('ACCEPTED', { id: 'never' });

      await expect(
        service.create('req-1', 'prov-1', { partsCost: 100 } as any),
      ).rejects.toThrow(BadRequestException);

      expect(tx.quotation.create).not.toHaveBeenCalled();
    });

    it('prices towing quotations from distance and the provider tariff', async () => {
      mockPrisma.serviceRequest.findUnique.mockResolvedValue({
        id: 'req-tow',
        title: 'Tow to Whitefield',
        status: 'OPEN',
        category: 'TOWING',
        towingDistanceKm: 10,
        towingVehicleType: 'FLATBED',
        vehicleWeightKg: 1500,
        expiresAt: new Date(Date.now() + 60_000),
        customer: { userId: 'usr-cust' },
      });
      mockPrisma.providerProfile.findUnique.mockResolvedValue({
        providerType: 'TOWING',
        towingVehicleTypes: ['FLATBED'],
        maxVehicleWeightKg: 3000,
        towingBaseFee: 500,
        towingPerKmFee: 40,
      });

      const tx = setupTransaction('OPEN', {
        id: 'q-tow',
        provider: { verificationStatus: 'VERIFIED' },
      });

      await service.create('req-tow', 'prov-tow', {
        partsCost: 9999,
        labourCost: 9999,
        etaDescription: '30 min',
      } as any);

      const data = tx.quotation.create.mock.calls[0][0].data;
      expect(data.totalCost).toBe(900);
      expect(data.partsCost).toBe(0);
      expect(data.labourCost).toBe(900);
      expect(data.shippingCost).toBe(0);
    });

    it('rejects towing quotes when the equipment does not match', async () => {
      mockPrisma.serviceRequest.findUnique.mockResolvedValue({
        id: 'req-tow',
        title: 'Tow to Whitefield',
        status: 'OPEN',
        category: 'TOWING',
        towingDistanceKm: 10,
        towingVehicleType: 'MOTORCYCLE',
        expiresAt: new Date(Date.now() + 60_000),
        customer: { userId: 'usr-cust' },
      });
      mockPrisma.providerProfile.findUnique.mockResolvedValue({
        providerType: 'TOWING',
        towingVehicleTypes: ['FLATBED'],
        maxVehicleWeightKg: 3000,
        towingBaseFee: 500,
        towingPerKmFee: 40,
      });

      await expect(
        service.create('req-tow', 'prov-tow', {
          partsCost: 0,
          etaDescription: '30 min',
        } as any),
      ).rejects.toThrow(BadRequestException);

      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });
  });

  describe('live tracking', () => {
    const provider = {
      sub: 'usr-prov',
      email: 'prov@example.com',
      role: 'PROVIDER',
      providerProfileId: 'prov-1',
    } as any;

    it('computes a server-side ETA and persists the provider location', async () => {
      mockPrisma.booking.findUnique.mockResolvedValue({
        id: 'bk-1',
        status: 'PROVIDER_EN_ROUTE',
        customerId: 'cust-1',
        providerId: 'prov-1',
        etaMinutes: null,
        quotation: {
          request: {
            id: 'req-1',
            category: 'REPAIR',
            latitude: 12.9716,
            longitude: 77.5946,
          },
        },
      });
      mockPrisma.booking.update.mockImplementation(({ data }: any) =>
        Promise.resolve({
          id: 'bk-1',
          status: 'PROVIDER_EN_ROUTE',
          providerLatitude: data.providerLatitude,
          providerLongitude: data.providerLongitude,
          providerLocationUpdatedAt: data.providerLocationUpdatedAt,
          etaMinutes: data.etaMinutes,
        }),
      );

      const result = await service.updateLocation('bk-1', provider, {
        latitude: 12.9352,
        longitude: 77.6245,
      });

      expect(mockPrisma.booking.update).toHaveBeenCalled();
      expect(result.etaMinutes).toBeGreaterThan(0);
      expect(result.providerLatitude).toBe(12.9352);
    });

    it('forbids non-assigned providers from sharing a location', async () => {
      mockPrisma.booking.findUnique.mockResolvedValue({
        id: 'bk-1',
        status: 'IN_PROGRESS',
        customerId: 'cust-1',
        providerId: 'prov-2',
        quotation: { request: { id: 'req-1' } },
      });

      await expect(
        service.updateLocation('bk-1', provider, {
          latitude: 12.9,
          longitude: 77.6,
        }),
      ).rejects.toThrow(ForbiddenException);

      expect(mockPrisma.booking.update).not.toHaveBeenCalled();
    });

    it('blocks unrelated users from reading booking tracking', async () => {
      mockPrisma.booking.findUnique.mockResolvedValue({
        id: 'bk-1',
        status: 'IN_PROGRESS',
        customerId: 'cust-1',
        providerId: 'prov-1',
        providerLatitude: 12.9,
        providerLongitude: 77.6,
        providerLocationUpdatedAt: new Date(),
        etaMinutes: 8,
      });

      await expect(service.getTracking('bk-1', intruder)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });
});
