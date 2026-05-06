/*
  Warnings:

  - Made the column `family_id` on table `service_records` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "service_records" DROP CONSTRAINT "service_records_family_id_fkey";

-- AlterTable
ALTER TABLE "account_credentials" ADD COLUMN     "password_hint_iv" TEXT;

-- AlterTable
ALTER TABLE "families" ADD COLUMN     "master_key_encrypted" TEXT,
ADD COLUMN     "master_key_iv" TEXT,
ADD COLUMN     "master_key_salt" TEXT;

-- AlterTable
ALTER TABLE "service_records" ALTER COLUMN "family_id" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "service_records" ADD CONSTRAINT "service_records_family_id_fkey" FOREIGN KEY ("family_id") REFERENCES "families"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
