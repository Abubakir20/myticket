/*
  Warnings:

  - The values [USER] on the enum `Role` will be removed. If these variants are still used in the database, this will fail.
  - The primary key for the `devices` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `id` on the `devices` table. All the data in the column will be lost.
  - Added the required column `device` to the `devices` table without a default value. This is not possible if the table is not empty.
  - The required column `deviceId` was added to the `devices` table with a prisma-level default value. This is not possible if the table is not empty. Please add this column as optional, then populate it before making it required.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "Role_new" AS ENUM ('CUSTOMER', 'ORGANIZER', 'CONTROLLER', 'ADMIN', 'SUPERADMIN');
ALTER TABLE "public"."users" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "users" ALTER COLUMN "role" TYPE "Role_new" USING ("role"::text::"Role_new");
ALTER TYPE "Role" RENAME TO "Role_old";
ALTER TYPE "Role_new" RENAME TO "Role";
DROP TYPE "public"."Role_old";
ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'CUSTOMER';
COMMIT;

-- AlterEnum
ALTER TYPE "UserStatus" ADD VALUE 'PENDING';

-- AlterTable
ALTER TABLE "devices" DROP CONSTRAINT "devices_pkey",
DROP COLUMN "id",
ADD COLUMN     "device" TEXT NOT NULL,
ADD COLUMN     "deviceId" UUID NOT NULL,
ADD CONSTRAINT "devices_pkey" PRIMARY KEY ("deviceId");

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "imageUrl" TEXT,
ADD COLUMN     "phone" TEXT,
ALTER COLUMN "fullName" DROP NOT NULL,
ALTER COLUMN "role" SET DEFAULT 'CUSTOMER';
