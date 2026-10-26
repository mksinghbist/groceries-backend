ALTER TABLE "Category" ADD COLUMN "parentId" TEXT;

CREATE INDEX "Category_parentId_idx" ON "Category"("parentId");

ALTER TABLE "Category"
ADD CONSTRAINT "Category_parentId_fkey"
FOREIGN KEY ("parentId") REFERENCES "Category"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
