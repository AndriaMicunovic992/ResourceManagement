-- PM review sessions: dated records per customer (the customer-side 1:1).
CREATE TABLE "CustomerReview" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "authorUserId" TEXT NOT NULL,
    "reviewDate" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerReview_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "CustomerReview_orgId_idx" ON "CustomerReview"("orgId");
CREATE INDEX "CustomerReview_customerId_idx" ON "CustomerReview"("customerId");
ALTER TABLE "CustomerReview" ADD CONSTRAINT "CustomerReview_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CustomerReview" ADD CONSTRAINT "CustomerReview_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CustomerReview" ADD CONSTRAINT "CustomerReview_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Entries logged during a review session link back to it.
ALTER TABLE "Log" ADD COLUMN "customerReviewId" TEXT;
CREATE INDEX "Log_customerReviewId_idx" ON "Log"("customerReviewId");
ALTER TABLE "Log" ADD CONSTRAINT "Log_customerReviewId_fkey" FOREIGN KEY ("customerReviewId") REFERENCES "CustomerReview"("id") ON DELETE SET NULL ON UPDATE CASCADE;
