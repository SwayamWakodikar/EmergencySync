/*
  Warnings:

  - Changed the type of `ambulanceId` on the `Assignment` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `emergencyId` on the `Assignment` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- AlterTable
ALTER TABLE "Assignment" DROP COLUMN "ambulanceId",
ADD COLUMN     "ambulanceId" INTEGER NOT NULL,
DROP COLUMN "emergencyId",
ADD COLUMN     "emergencyId" INTEGER NOT NULL;
