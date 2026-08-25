/*
  Warnings:

  - You are about to drop the column `channel` on the `User` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "phone" TEXT NOT NULL,
    "name" TEXT,
    "language" TEXT NOT NULL DEFAULT 'he',
    "timezone" TEXT NOT NULL DEFAULT 'America/Los_Angeles',
    "sendHour" INTEGER NOT NULL DEFAULT 8,
    "secondSendHour" INTEGER,
    "streak" INTEGER NOT NULL DEFAULT 0,
    "lastAnsweredAt" DATETIME,
    "cadenceNotes" TEXT,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "verifyCode" TEXT,
    "verifyExpiresAt" DATETIME,
    "verifyAttempts" INTEGER NOT NULL DEFAULT 0,
    "optedOut" BOOLEAN NOT NULL DEFAULT false,
    "newWordsPerDay" INTEGER NOT NULL DEFAULT 2,
    "level" TEXT NOT NULL DEFAULT 'beginner',
    "placementDone" BOOLEAN NOT NULL DEFAULT false,
    "wordQueue" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_User" ("cadenceNotes", "createdAt", "id", "language", "lastAnsweredAt", "name", "newWordsPerDay", "optedOut", "phone", "secondSendHour", "sendHour", "streak", "timezone", "verified", "verifyAttempts", "verifyCode", "verifyExpiresAt") SELECT "cadenceNotes", "createdAt", "id", "language", "lastAnsweredAt", "name", "newWordsPerDay", "optedOut", "phone", "secondSendHour", "sendHour", "streak", "timezone", "verified", "verifyAttempts", "verifyCode", "verifyExpiresAt" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");
CREATE TABLE "new_Word" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "language" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "term" TEXT NOT NULL,
    "translation" TEXT NOT NULL,
    "transliteration" TEXT,
    "kind" TEXT NOT NULL DEFAULT 'word'
);
INSERT INTO "new_Word" ("id", "language", "rank", "term", "translation") SELECT "id", "language", "rank", "term", "translation" FROM "Word";
DROP TABLE "Word";
ALTER TABLE "new_Word" RENAME TO "Word";
CREATE UNIQUE INDEX "Word_language_rank_key" ON "Word"("language", "rank");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
