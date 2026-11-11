export type PickedLocation = {
  /** Formatted address shown to the customer. */
  address: string;
  latitude: number;
  longitude: number;
  /** Optional short label, e.g. a saved address title or place name. */
  label?: string;
};

export type MapMarkerKind = 'pickup' | 'dropoff' | 'default';
