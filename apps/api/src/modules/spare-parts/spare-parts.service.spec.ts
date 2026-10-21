import { SparePartsService } from './spare-parts.service';

describe('SparePartsService public projection', () => {
  let service: SparePartsService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      sparePart: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue({
          id: 'part-1',
          provider: { id: 'prov-1', businessName: 'Parts Co' },
        }),
        create: jest.fn(),
      },
    };
    service = new SparePartsService(mockPrisma);
  });

  it('never selects KYC documents or user ids for the public list', async () => {
    await service.findAll({});

    const args = mockPrisma.sparePart.findMany.mock.calls[0][0];
    expect(args.include.provider.select).not.toHaveProperty(
      'verificationDocuments',
    );
    expect(args.include.provider.select).not.toHaveProperty('userId');
  });

  it('never selects KYC documents or user ids for public detail', async () => {
    await service.findOne('part-1');

    const args = mockPrisma.sparePart.findFirst.mock.calls[0][0];
    expect(args.include.provider.select).not.toHaveProperty(
      'verificationDocuments',
    );
    expect(args.include.provider.select).not.toHaveProperty('userId');
  });
});
