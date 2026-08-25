-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "phone" TEXT NOT NULL,
    "name" TEXT,
    "language" TEXT NOT NULL DEFAULT 'es',
    "timezone" TEXT NOT NULL DEFAULT 'America/Los_Angeles',
    "sendHour" INTEGER NOT NULL DEFAULT 8,
    "secondSendHour" INTEGER,
    "streak" INTEGER NOT NULL DEFAULT 0,
    "lastAnsweredAt" DATETIME,
    "cadenceNotes" TEXT,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "verifyCode" TEXT,
    "optedOut" BOOLEAN NOT NULL DEFAULT false,
    "newWordsPerDay" INTEGER NOT NULL DEFAULT 2,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Word" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "language" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "term" TEXT NOT NULL,
    "translation" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "Card" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "wordId" TEXT NOT NULL,
    "due" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "stability" REAL NOT NULL DEFAULT 0,
    "difficulty" REAL NOT NULL DEFAULT 0,
    "reps" INTEGER NOT NULL DEFAULT 0,
    "lapses" INTEGER NOT NULL DEFAULT 0,
    "learningSteps" INTEGER NOT NULL DEFAULT 0,
    "state" INTEGER NOT NULL DEFAULT 0,
    "lastReview" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Card_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Card_wordId_fkey" FOREIGN KEY ("wordId") REFERENCES "Word" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "quizItems" TEXT,
    "answered" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Message_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "Word_language_rank_key" ON "Word"("language", "rank");

-- CreateIndex
CREATE UNIQUE INDEX "Card_userId_wordId_key" ON "Card"("userId", "wordId");
