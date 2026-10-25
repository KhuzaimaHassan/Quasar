-- Select the free model verified by the production browser smoke test.
-- Existing explicit model choices and historical records remain unchanged.
ALTER TABLE "conversations" ALTER COLUMN "model" SET DEFAULT 'gemini-3.5-flash-lite';
