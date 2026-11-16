import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { ProvidersService } from './providers.service';
import type { AuthUserPayload } from '../../common/types/auth-user-payload.type';

describe('ProvidersService.submitVerificationDocuments', () => {
  let service: ProvidersService;
  let prisma: any;
  let cache: { del: jest.Mock; getOrSet: jest.Mock };

  const user = {
    sub: 'user-provider-1',
    email: 'provider@example.com',
    phone: '9999999999',
    role: 'PROVIDER',
    providerProfileId: 'provider-1',
  } as AuthUserPayload;

  beforeEach(() => {
    prisma = {
      providerProfile: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    };
    prisma.uploadedObject = {
      findMany: jest
        .fn()
        .mockResolvedValue([{ key: 'verification-documents/user-provider-1/gst.pdf' }]),
    };
    cache = { del: jest.fn(), getOrSet: jest.fn() };
    service = new ProvidersService(prisma as any, cache as any);
  });

  it('rejects document keys owned by another account', async () => {
    prisma.providerProfile.findUnique.mockResolvedValue({
      verificationStatus: 'PENDING',
    });

    await expect(
      service.submitVerificationDocuments(user, {
        documents: [
          {
            label: 'GST certificate',
            key: 'verification-documents/user-attacker/doc.pdf',
          },
        ],
      }),
    ).rejects.toThrow('Document keys must be uploads owned by your account');

    expect(prisma.providerProfile.update).not.toHaveBeenCalled();
  });

  it('stores owned keys and returns the provider to the review queue', async () => {
    prisma.providerProfile.findUnique.mockResolvedValue({
      verificationStatus: 'REJECTED',
    });
    prisma.providerProfile.update.mockResolvedValue({
      verificationStatus: 'PENDING',
    });

    const result = await service.submitVerificationDocuments(user, {
      documents: [
        {
          label: 'GST certificate',
          key: 'verification-documents/user-provider-1/gst.pdf',
        },
      ],
    });

    expect(prisma.providerProfile.update).toHaveBeenCalledWith({
      where: { id: 'provider-1' },
      data: expect.objectContaining({
        verificationStatus: 'PENDING',
        verifiedAt: null,
        verifiedBy: null,
        verificationDocuments: {
          'GST certificate':
            'verification-documents/user-provider-1/gst.pdf',
        },
      }),
    });
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: 'provider.documents.submit',
        entityId: 'provider-1',
        newValues: { status: 'PENDING', documentCount: 1 },
      }),
    });
    expect(result).toEqual({
      verificationStatus: 'PENDING',
      documentCount: 1,
    });
  });

  it('H4: rejects document keys that were never finalized', async () => {
    prisma.providerProfile.findUnique.mockResolvedValue({ verificationStatus: 'PENDING' });
    prisma.uploadedObject.findMany.mockResolvedValue([]);

    await expect(
      service.submitVerificationDocuments(user, {
        documents: [{ label: 'GST certificate', key: 'verification-documents/user-provider-1/gst.pdf' }],
      }),
    ).rejects.toThrow(/not been finalized|not uploaded/);
    expect(prisma.providerProfile.update).not.toHaveBeenCalled();
  });

  it('refuses new documents from a suspended provider', async () => {
    prisma.providerProfile.findUnique.mockResolvedValue({
      verificationStatus: 'SUSPENDED',
    });

    await expect(
      service.submitVerificationDocuments(user, {
        documents: [
          {
            label: 'GST certificate',
            key: 'verification-documents/user-provider-1/gst.pdf',
          },
        ],
      }),
    ).rejects.toThrow('Suspended providers cannot submit');
  });
});
