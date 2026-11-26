import { createSparePartSchema, updateSparePartSchema } from './spare-parts.dto';
import { UpdateQuotationDto } from '../../quotations/dto/create-quotation.dto';

describe('partial updates save only what was sent (no create defaults)', () => {
  it('hiding a listing does not reset stock, condition, type or compatible cars', () => {
    // Zod 4 used to fill these in: stockQuantity 1, condition AFTERMARKET, kind PART, lists emptied.
    expect(updateSparePartSchema.parse({ isActive: false })).toEqual({ isActive: false });
    expect(updateSparePartSchema.parse({ price: 799 })).toEqual({ price: 799 });
  });

  it('a new listing still gets its defaults', () => {
    const created = createSparePartSchema.parse({ name: 'Air filter', partNumber: 'AF-1', price: 749 });
    expect(created).toMatchObject({ stockQuantity: 1, condition: 'AFTERMARKET', kind: 'PART', compatibleMakes: [] });
  });

  it('stock + / −: a change, never zero, never together with an exact stock', () => {
    expect(updateSparePartSchema.safeParse({ stockDelta: -1 }).success).toBe(true);
    expect(updateSparePartSchema.safeParse({ stockDelta: 0 }).success).toBe(false);
    expect(updateSparePartSchema.safeParse({ stockDelta: 1, stockQuantity: 3 }).success).toBe(false);
    expect(updateSparePartSchema.safeParse({ unknownField: 1 }).success).toBe(false);
  });

  it('editing only a quote note keeps its labour cost and warranty', () => {
    // Used to come out as { labourCost: 0, warrantyDays: 30, notes } and drop the total.
    expect((UpdateQuotationDto as any).schema.parse({ notes: 'Can also fix the scratch' })).toEqual({
      notes: 'Can also fix the scratch',
    });
  });
});
