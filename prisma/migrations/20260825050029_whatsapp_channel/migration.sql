-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "phone" TEXT NOT NULL,
    "name" TEXT,
    "language" TEXT NOT NULL DEFAULT 'es',
    "channel" TEXT NOT NULL DEFAULT 'sms',
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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_User" ("cadenceNotes", "createdAt", "id", "language", "lastAnsweredAt", "name", "newWordsPerDay", "optedOut", "phone", "secondSendHour", "sendHour", "streak", "timezone", "verified", "verifyAttempts", "verifyCode", "verifyExpiresAt") SELECT "cadenceNotes", "createdAt", "id", "language", "lastAnsweredAt", "name", "newWordsPerDay", "optedOut", "phone", "secondSendHour", "sendHour", "streak", "timezone", "verified", "verifyAttempts", "verifyCode", "verifyExpiresAt" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
