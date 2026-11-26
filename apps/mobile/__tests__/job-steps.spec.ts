import { nextJobStep } from '../src/utils/jobSteps';

const job = (status: string, category = 'REPAIR', deliveryMethod: string | null = null) => ({
  status,
  quotation: { deliveryMethod, request: { category } },
});

describe('nextJobStep', () => {
  it('on-site repair: on my way, then start, then complete (opens the job)', () => {
    expect(nextJobStep(job('CONFIRMED'))).toMatchObject({ title: 'On my way', next: 'PROVIDER_EN_ROUTE' });
    expect(nextJobStep(job('PROVIDER_EN_ROUTE'))).toMatchObject({ title: 'Start job', next: 'IN_PROGRESS' });
    expect(nextJobStep(job('IN_PROGRESS'))).toEqual({ label: 'Working on it', title: 'Complete job' });
  });
  it('drop-off repair skips "on the way"', () => {
    expect(nextJobStep(job('CONFIRMED', 'REPAIR', 'PICKUP'))).toMatchObject({ title: 'Start job', next: 'IN_PROGRESS' });
  });
  it('towing and roadside use their own words', () => {
    expect(nextJobStep(job('PROVIDER_EN_ROUTE', 'TOWING'))?.title).toBe('Start tow');
    expect(nextJobStep(job('IN_PROGRESS', 'TOWING'))?.title).toBe('Mark delivered');
    expect(nextJobStep(job('PROVIDER_EN_ROUTE', 'ROADSIDE'))?.title).toBe('Arrived on site');
  });
  it('finished jobs have no next step', () => {
    expect(nextJobStep(job('COMPLETED'))).toBeNull();
    expect(nextJobStep(job('CANCELLED'))).toBeNull();
  });
});
