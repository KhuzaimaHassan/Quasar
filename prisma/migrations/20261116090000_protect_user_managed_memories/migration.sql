-- Historical rows have no trustworthy origin marker. Protect all of them,
-- including manual corrections whose confidence was never updated.
-- New automatic extraction explicitly creates rows with this flag false.
ALTER TABLE "Memory" ADD COLUMN "isUserManaged" BOOLEAN NOT NULL DEFAULT true;
