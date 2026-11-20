/**
 * Which cached queries each request/quote mutation refreshes. A missing key
 * leaves a mounted screen stale: after sending a quote the provider kept
 * seeing the empty quote form, because the screen reads myQuotations.
 */
const mockInvalidate = jest.fn();

jest.mock('@tanstack/react-query', () => ({
  useQuery: (options: unknown) => options,
  useMutation: (options: unknown) => options,
  useQueryClient: () => ({ invalidateQueries: mockInvalidate }),
}));
jest.mock('@/services/api-client', () => ({ apiClient: jest.fn() }), { virtual: true });
jest.mock(
  '@/services/offline-queue',
  () => ({ enqueueMutation: jest.fn(), isNetworkFailure: jest.fn() }),
  { virtual: true },
);

// eslint-disable-next-line import/first
import { useAcceptQuotation, useCancelRequest, useCreateQuotation } from '../src/hooks/useRequests';

const refreshedKeys = (mutation: any, ...args: unknown[]) => {
  mockInvalidate.mockClear();
  mutation.onSuccess(...args);
  return mockInvalidate.mock.calls.map(([arg]) => JSON.stringify(arg.queryKey));
};

describe('request and quotation cache refreshes', () => {
  it('sending a quote refreshes the provider’s own quotes and dashboard', () => {
    const keys = refreshedKeys(useCreateQuotation(), {}, { requestId: 'req-1' });
    expect(keys).toEqual(
      expect.arrayContaining(['["quotations","req-1"]', '["myQuotations"]', '["providerDashboard"]']),
    );
  });

  it('accepting a quote refreshes the request, request lists, quotes and bookings', () => {
    const keys = refreshedKeys(useAcceptQuotation(), {}, { quotationId: 'q-1', data: {} });
    expect(keys).toEqual(
      expect.arrayContaining(['["request"]', '["myRequests"]', '["quotations"]', '["bookings"]']),
    );
    expect(keys).not.toContain('["requests"]'); // no query uses this key
  });

  it('cancelling a request refreshes that request and the list', () => {
    const keys = refreshedKeys(useCancelRequest(), {}, 'req-9');
    expect(keys).toEqual(expect.arrayContaining(['["myRequests"]', '["request","req-9"]']));
  });
});
