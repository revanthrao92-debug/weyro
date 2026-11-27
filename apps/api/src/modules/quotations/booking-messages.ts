/**
 * Plain-language alerts for a job moving through its steps, written for the
 * person receiving them (the customer, or the provider when the customer acts).
 * Replaces "Booking Update: PROVIDER_EN_ROUTE" style system codes.
 */
export type BookingMessageInput = {
  status: string;
  jobTitle: string;
  providerName: string;
  category?: string | null;
  audience: 'customer' | 'provider';
  /** The job's Weyro reference number; added at the end so both sides can quote it. */
  ref?: string | null;
};

export function bookingUpdateMessage(input: BookingMessageInput) {
  const message = baseMessage(input);
  return input.ref ? { ...message, body: `${message.body} Ref ${input.ref}.` } : message;
}

function baseMessage({ status, jobTitle, providerName, category, audience }: BookingMessageInput) {
  const job = `"${jobTitle}"`;
  const isParts = category === 'SPARE_PART';
  const isTowing = category === 'TOWING';

  if (audience === 'provider') {
    if (status === 'CANCELLED') return { title: 'Booking cancelled', body: `The customer cancelled ${job}.` };
    if (status === 'DISPUTED') {
      return { title: 'Issue reported', body: `The customer reported an issue with ${job}. Weyro support will contact you.` };
    }
    return { title: 'Booking updated', body: `${job} has been updated.` };
  }

  switch (status) {
    case 'PROVIDER_EN_ROUTE':
      return { title: 'On the way', body: `${providerName} is on the way for ${job}.` };
    case 'IN_PROGRESS':
      return isParts
        ? { title: 'Order being packed', body: `${providerName} is packing your order for ${job}.` }
        : isTowing
          ? { title: 'Towing started', body: `${providerName} has started towing your vehicle.` }
          : { title: 'Work started', body: `${providerName} has started work on ${job}.` };
    case 'COMPLETED':
      return isParts
        ? { title: 'Order delivered', body: `${providerName} has delivered ${job}. Please rate your experience.` }
        : { title: 'Job completed', body: `${providerName} has completed ${job}. Please rate your experience.` };
    case 'CANCELLED':
      return { title: 'Booking cancelled', body: `${providerName} cancelled ${job}.` };
    case 'DISPUTED':
      return { title: 'Issue reported', body: `An issue was reported on ${job}. Weyro support will contact you.` };
    default:
      return { title: 'Booking updated', body: `${job} has been updated.` };
  }
}
