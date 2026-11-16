-- OTP sign-up used to invent "<phone>@weyro.in" placeholder addresses. Email is
-- now optional, and those placeholders are cleared.

-- AlterTable
ALTER TABLE "users" ALTER COLUMN "email" DROP NOT NULL;

-- Placeholders look like +919876543210@weyro.in or 9876543210@weyro.in
UPDATE "users"
SET "email" = NULL
WHERE "email" ~* '^\+?[0-9]+@weyro\.in$';
