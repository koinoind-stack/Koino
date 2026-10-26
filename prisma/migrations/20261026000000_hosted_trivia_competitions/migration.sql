-- Community-hosted trivia competitions: a group (church / youth group / etc.)
-- can host a trivia competition. Status "pending" = awaiting admin approval,
-- hidden from the public list until an admin approves it.
ALTER TABLE "TriviaCompetition" ADD COLUMN "hostGroupId" TEXT;

ALTER TABLE "TriviaCompetition"
  ADD CONSTRAINT "TriviaCompetition_hostGroupId_fkey"
  FOREIGN KEY ("hostGroupId") REFERENCES "Group"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "TriviaCompetition_hostGroupId_idx" ON "TriviaCompetition"("hostGroupId");
