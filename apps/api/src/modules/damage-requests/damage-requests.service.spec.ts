import { NotFoundException } from '@nestjs/common';
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
