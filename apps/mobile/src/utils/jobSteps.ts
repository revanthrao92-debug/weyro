/**
 * What a provider does next on a job, by its status and kind. Drop-off repairs
 * (the customer brings the car in) skip "on the way"; towing and roadside use
 * their own words. Completing needs a confirmation and notes, so it has no
 * direct `next`: the list opens the job for it.
 */
export type JobLike = {
  status: string;
  quotation?: { deliveryMethod?: string | null; request?: { category?: string } | null } | null;
};

export type JobStep = { label: string; title: string; next?: string };

export function nextJobStep(job: JobLike): JobStep | null {
  const category = job.quotation?.request?.category ?? '';
  const isTowing = category === 'TOWING';
  const isRoadside = category === 'ROADSIDE';
  const isDropOff = !isTowing && !isRoadside && job.quotation?.deliveryMethod === 'PICKUP';
  switch (job.status) {
    case 'CONFIRMED':
      return isDropOff
        ? { label: 'Booked', title: 'Start job', next: 'IN_PROGRESS' }
        : { label: 'Booked', title: 'On my way', next: 'PROVIDER_EN_ROUTE' };
    case 'PROVIDER_EN_ROUTE':
      return {
        label: 'On the way',
        title: isTowing ? 'Start tow' : isRoadside ? 'Arrived on site' : 'Start job',
        next: 'IN_PROGRESS',
      };
    case 'IN_PROGRESS':
      return { label: isTowing ? 'Towing' : isRoadside ? 'On site' : 'Working on it', title: isTowing ? 'Mark delivered' : 'Complete job' };
    default:
      return null;
  }
}
