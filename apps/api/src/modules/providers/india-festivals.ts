/**
 * Major Indian festivals and national holidays that move parts sales.
 * closes: most shops shut that day. buildUpDays: busier in the days before (servicing,
 * travel and gifting before Diwali/Dussehra).
 * shortcut: fixed dates for 2026-2027 only, add the next year's dates each December (or move to a table).
 */
export type Festival = { date: string; name: string; closes: boolean; buildUpDays: number };

export const INDIA_FESTIVALS: Festival[] = [
  { date: '2026-01-14', name: 'Sankranti', closes: true, buildUpDays: 0 },
  { date: '2026-01-26', name: 'Republic Day', closes: true, buildUpDays: 0 },
  { date: '2026-03-04', name: 'Holi', closes: true, buildUpDays: 0 },
  { date: '2026-03-19', name: 'Ugadi', closes: true, buildUpDays: 3 },
  { date: '2026-03-20', name: 'Eid al-Fitr', closes: true, buildUpDays: 0 },
  { date: '2026-08-15', name: 'Independence Day', closes: true, buildUpDays: 0 },
  { date: '2026-09-14', name: 'Ganesh Chaturthi', closes: true, buildUpDays: 3 },
  { date: '2026-10-02', name: 'Gandhi Jayanti', closes: true, buildUpDays: 0 },
  { date: '2026-10-20', name: 'Dussehra', closes: true, buildUpDays: 7 },
  { date: '2026-11-08', name: 'Diwali', closes: true, buildUpDays: 7 },
  { date: '2026-12-25', name: 'Christmas', closes: true, buildUpDays: 0 },
  { date: '2027-01-14', name: 'Sankranti', closes: true, buildUpDays: 0 },
  { date: '2027-01-26', name: 'Republic Day', closes: true, buildUpDays: 0 },
  { date: '2027-03-10', name: 'Eid al-Fitr', closes: true, buildUpDays: 0 },
  { date: '2027-03-22', name: 'Holi', closes: true, buildUpDays: 0 },
  { date: '2027-04-07', name: 'Ugadi', closes: true, buildUpDays: 3 },
  { date: '2027-08-15', name: 'Independence Day', closes: true, buildUpDays: 0 },
  { date: '2027-09-04', name: 'Ganesh Chaturthi', closes: true, buildUpDays: 3 },
  { date: '2027-10-02', name: 'Gandhi Jayanti', closes: true, buildUpDays: 0 },
  { date: '2027-10-09', name: 'Dussehra', closes: true, buildUpDays: 7 },
  { date: '2027-10-29', name: 'Diwali', closes: true, buildUpDays: 7 },
  { date: '2027-12-25', name: 'Christmas', closes: true, buildUpDays: 0 },
];
