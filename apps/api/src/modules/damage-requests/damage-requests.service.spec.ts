import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { DamageRequestsService } from './damage-requests.service';

describe('DamageRequestsService', () => {
  let service: DamageRequestsService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      serviceRequest: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
      },
      $queryRaw: jest.fn(),
    };

    service = new DamageRequestsService(mockPrisma);
  });

  describe('create', () => {
    it('creates request and normalizes media records', async () => {
      const mockCreated = {
        id: 'req-1',
        title: 'Bumper repair',
        media: [{ url: 'https://img.com/1.jpg' }],
        vehicle: { id: 'veh-1' },
      };

      mockPrisma.serviceRequest.create.mockResolvedValue(mockCreated);

      const result = await service.create('cust-1', {
        vehicleId: 'veh-1',
        title: 'Bumper repair',
        description: 'Cracked bumper description',
        address: 'MG Road, Bengaluru, Karnataka',
        latitude: 12.9716,
        longitude: 77.5946,
        damagePhotos: ['https://img.com/1.jpg'],
      } as any);

      expect(mockPrisma.serviceRequest.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            customerId: 'cust-1',
            media: {
              create: [{ url: 'https://img.com/1.jpg', fileType: 'image/jpeg' }],
            },
          }),
        }),
      );

      expect(result.damagePhotos).toEqual(['https://img.com/1.jpg']);
    });
  });

  describe('getBroadcastFeed', () => {
    it('masks addresses and limits to max 50 items', async () => {
      const mockRequests = [
        {
          id: 'req-1',
          title: 'Engine Check',
          address: 'Flat 402, Sunset Heights, Indiranagar, Bengaluru',
          media: [{ url: 'https://img.com/1.jpg' }],
          customer: { id: 'c-1', firstName: 'Rohan', lastName: 'Sharma' },
          quotations: [],
        },
      ];

      mockPrisma.serviceRequest.findMany.mockResolvedValue(mockRequests);

      const result = await service.getBroadcastFeed({ limit: 100 });

      expect(mockPrisma.serviceRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 50, // Clamped to 50
        }),
      );

      expect(result.items[0].address).toBe('Indiranagar, Bengaluru');
      expect(result.items[0].damagePhotos).toEqual(['https://img.com/1.jpg']);
    });

    it('uses PostGIS query when provider coordinates are provided', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([
        {
          id: 'req-geo-1',
          title: 'Brake pad replacement',
          address: 'Koramangala, Bengaluru',
          distanceKm: 3.45,
        },
      ]);

      const result = await service.getBroadcastFeed({
        providerLat: 12.9352,
        providerLng: 77.6245,
        radiusKm: 10,
        category: 'MAINTENANCE',
      });

      expect(mockPrisma.$queryRaw).toHaveBeenCalled();
      expect(result.items[0].distanceKm).toBe(3.45);
    });
  });

  describe('findOne', () => {
    it('throws NotFoundException if request does not exist', async () => {
      mockPrisma.serviceRequest.findUnique.mockResolvedValue(null);

      await expect(
        service.findOne('invalid-id', { role: 'CUSTOMER', sub: 'usr-1' } as any),
      ).rejects.toThrow(NotFoundException);
    });

    it('masks customer phone and exact address for browsing providers', async () => {
      mockPrisma.serviceRequest.findUnique.mockResolvedValue({
        id: 'req-1',
        customerId: 'cust-1',
        address: '123 Tech Park, Whitefield, Bengaluru',
        customer: {
          id: 'cust-1',
          firstName: 'Ananya',
          lastName: 'Reddy',
          avatarUrl: null,
          user: { phone: '+919876543210', email: 'ananya@example.com' },
        },
        quotations: [],
      });

      const providerUser = {
        role: 'PROVIDER',
        sub: 'usr-prov',
        providerProfileId: 'prov-1',
      };

      const result = await service.findOne('req-1', providerUser as any);

      expect(result.address).toBe('Whitefield, Bengaluru');
      expect((result.customer as any).user).toBeUndefined();
    });
  });
});

describe('DamageRequestsService authorization regressions', () => {
  let service: DamageRequestsService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      serviceRequest: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
      },
      $queryRaw: jest.fn(),
    };
    service = new DamageRequestsService(mockPrisma);
  });

  const providerUser = {
    sub: 'usr-prov',
    email: 'prov@example.com',
    role: 'PROVIDER',
    providerProfileId: 'prov-1',
  };

  it('scopes feed quotations to the calling provider', async () => {
    mockPrisma.serviceRequest.findMany.mockResolvedValue([]);

    await service.getBroadcastFeed({ providerId: 'prov-1' });

    expect(mockPrisma.serviceRequest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          quotations: { where: { providerId: 'prov-1' } },
        }),
      }),
    );
  });

  it('hides competitors quotations from a provider request detail', async () => {
    mockPrisma.serviceRequest.findUnique.mockResolvedValue({
      id: 'req-1',
      customerId: 'cust-1',
      address: '1 Main Road, Whitefield, Bengaluru',
      customer: { id: 'cust-1', firstName: 'A', lastName: 'B', avatarUrl: null },
      quotations: [
        { id: 'q-own', providerId: 'prov-1', status: 'PENDING', booking: null },
        { id: 'q-rival', providerId: 'prov-2', status: 'PENDING', booking: null },
      ],
    });

    const result = await service.findOne('req-1', providerUser as any);

    expect(result.quotations).toHaveLength(1);
    expect(result.quotations[0].id).toBe('q-own');
  });

  it('allows the owning customer to see every quotation', async () => {
    mockPrisma.serviceRequest.findUnique.mockResolvedValue({
      id: 'req-1',
      customerId: 'cust-1',
      address: '1 Main Road, Whitefield, Bengaluru',
      customer: { id: 'cust-1', firstName: 'A', lastName: 'B', avatarUrl: null },
      quotations: [
        { id: 'q-1', providerId: 'prov-1', status: 'PENDING', booking: null },
        { id: 'q-2', providerId: 'prov-2', status: 'PENDING', booking: null },
      ],
    });

    const result = await service.findOne('req-1', {
      sub: 'usr-cust',
      email: 'c@example.com',
      role: 'CUSTOMER',
      customerProfileId: 'cust-1',
    } as any);

    expect(result.quotations).toHaveLength(2);
  });

  it('rejects a customer reading another customers request', async () => {
    mockPrisma.serviceRequest.findUnique.mockResolvedValue({
      id: 'req-1',
      customerId: 'cust-1',
      address: '1 Main Road, Whitefield, Bengaluru',
      customer: { id: 'cust-1', firstName: 'A', lastName: 'B', avatarUrl: null },
      quotations: [],
    });

    await expect(
      service.findOne('req-1', {
        sub: 'usr-x',
        email: 'x@example.com',
        role: 'CUSTOMER',
        customerProfileId: 'cust-999',
      } as any),
    ).rejects.toThrow(ForbiddenException);
  });

  it('returns only the calling customers own requests from findMine', async () => {
    mockPrisma.serviceRequest.findMany.mockResolvedValue([]);

    await service.findMine(
      {
        sub: 'usr-cust',
        email: 'c@example.com',
        role: 'CUSTOMER',
        customerProfileId: 'cust-1',
      } as any,
      undefined,
      10,
    );

    expect(mockPrisma.serviceRequest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { customerId: 'cust-1' } }),
    );
  });

  it('does not query when a provider has no customer profile', async () => {
    const result = await service.findMine(providerUser as any);

    expect(result).toEqual({ items: [], nextCursor: null });
    expect(mockPrisma.serviceRequest.findMany).not.toHaveBeenCalled();
  });
});
