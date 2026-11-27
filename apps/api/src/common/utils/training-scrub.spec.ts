import { scrubTrainingText } from '@weyro/api-contracts';

describe('scrubTrainingText (AI-training text cleaner)', () => {
  const cases: [string, string][] = [
    ['Call me on 98765 43210 after 6pm', 'Call me on [phone] after 6pm'],
    ['My number +91 98765-43210, thanks', 'My number [phone], thanks'],
    ['whatsapp 09876543210', 'whatsapp [phone]'],
    ['no spaces +919876543210 ok', 'no spaces [phone] ok'],
    ['upi 9876543210@ybl please', 'upi [upi] please'],
    ['Pay to ravi.k@okaxis once done', 'Pay to [upi] once done'],
    ['mail invoice to rohan.sharma@gmail.com', 'mail invoice to [email]'],
    ['Car KA01MJ4021 parked outside', 'Car [vehicle-number] parked outside'],
    ['reg no KA 01 MJ 4021', 'reg no [vehicle-number]'],
    ['new BH number 22BH1234AA', 'new BH number [vehicle-number]'],
    ['Aadhaar 1234 5678 9012 attached', 'Aadhaar [id-number] attached'],
    ['PAN ABCDE1234F for GST', 'PAN [id-number] for GST'],
    ['OTP 482913 is the start code', 'OTP [code] is the start code'],
    ['plate mh12a1234 typed small', 'plate [vehicle-number] typed small'],
    ['DL 01 1234 old number', '[vehicle-number] old number'],
  ];
  it.each(cases)('cleans %p', (input, expected) => {
    expect(scrubTrainingText(input)).toBe(expected);
  });

  it('removes the address lines the app writes into towing and delivery requests, keeps the rest', () => {
    const text = [
      "Vehicle condition: Won't start",
      'Equipment: Hook & chain / wheel-lift',
      'Pickup: 100ft Road, HAL 2nd Stage, Indiranagar, Bengaluru, Karnataka 560038',
      'Destination: Koramangala Motor Works, 5th Block',
      'Delivery address: 12, 3rd Cross, Jayanagar 560011',
    ].join('\n');
    expect(scrubTrainingText(text)).toBe(
      "Vehicle condition: Won't start Equipment: Hook & chain / wheel-lift Pickup: [address] Destination: [address] Delivery address: [address]",
    );
  });

  it('keeps the useful part: problem, car, parts, prices, years, distances', () => {
    for (const text of [
      'Front bumper dent on 2022 Hyundai Creta, scraping noise at 40 km/h. Quote ₹6,950 incl. 2 clips, 6 month warranty',
      'Service due at 10000 km, last done at 45000 km on 12/03/2025',
      'Speed up 10000 rpm warning, model XUV700 AX7, part no 86511-C9000',
      'Order 2 pieces, total ₹12,999 for 2 headlamps',
    ]) {
      expect(scrubTrainingText(text)).toBe(text);
    }
  });

  it('empty or missing text stays empty', () => {
    expect(scrubTrainingText('   ')).toBeNull();
    expect(scrubTrainingText(null)).toBeNull();
  });
});
