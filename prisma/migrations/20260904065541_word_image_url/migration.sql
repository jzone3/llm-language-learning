-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "mediaUrl" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "wantsImages" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "Word" ADD COLUMN     "imageUrl" TEXT;
