-- Additive enum value: refunded spare-part orders get their own terminal
-- state instead of overloading CANCELLED. Existing rows are unaffected.
ALTER TYPE "SparePartOrderStatus" ADD VALUE 'REFUNDED';
