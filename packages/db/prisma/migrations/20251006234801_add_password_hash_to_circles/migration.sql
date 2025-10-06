-- CreateTable
CREATE TABLE "user" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "expiresAt" DATETIME NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "userId" TEXT NOT NULL,
    CONSTRAINT "session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "account" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" DATETIME,
    "refreshTokenExpiresAt" DATETIME,
    "scope" TEXT,
    "password" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "verification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "circle" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "passwordHash" TEXT,
    "visibility" TEXT NOT NULL DEFAULT 'PRIVATE',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "circle_membership" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "circleId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'MEMBER',
    CONSTRAINT "circle_membership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "circle_membership_circleId_fkey" FOREIGN KEY ("circleId") REFERENCES "circle" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "layer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "circleId" TEXT NOT NULL,
    "pageKey" TEXT NOT NULL,
    "title" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "permissionLevel" TEXT,
    CONSTRAINT "layer_circleId_fkey" FOREIGN KEY ("circleId") REFERENCES "circle" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "element" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "layerId" TEXT NOT NULL,
    "parentId" TEXT,
    "elementType" TEXT NOT NULL,
    "data" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "element_layerId_fkey" FOREIGN KEY ("layerId") REFERENCES "layer" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "element_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "element" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "mark" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "layerId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "mark_layerId_fkey" FOREIGN KEY ("layerId") REFERENCES "layer" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "chat_message" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "layerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "chat_message_layerId_fkey" FOREIGN KEY ("layerId") REFERENCES "layer" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "chat_message_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "session_record" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "layerId" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "startedAt" DATETIME NOT NULL,
    "endedAt" DATETIME,
    "duration" INTEGER,
    "eventCount" INTEGER NOT NULL DEFAULT 0,
    "fileSize" INTEGER,
    "hasAudio" BOOLEAN NOT NULL DEFAULT false,
    "hasVideo" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "session_record_layerId_fkey" FOREIGN KEY ("layerId") REFERENCES "layer" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "invite" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "circleId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME,
    "maxUses" INTEGER,
    "useCount" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "invite_circleId_fkey" FOREIGN KEY ("circleId") REFERENCES "circle" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "anonymous_participant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "peerId" TEXT NOT NULL,
    "displayName" TEXT,
    "layerId" TEXT NOT NULL,
    "joinedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" DATETIME NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true
);

-- CreateTable
CREATE TABLE "peer_report" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "reporterId" TEXT NOT NULL,
    "reportedId" TEXT NOT NULL,
    "layerId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "description" TEXT,
    "evidence" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME NOT NULL,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "resolvedAt" DATETIME,
    "resolvedBy" TEXT
);

-- CreateTable
CREATE TABLE "peer_reputation" (
    "userId" TEXT NOT NULL PRIMARY KEY,
    "reputationScore" INTEGER NOT NULL DEFAULT 100,
    "reportCount" INTEGER NOT NULL DEFAULT 0,
    "isBlocked" BOOLEAN NOT NULL DEFAULT false,
    "blockedAt" DATETIME,
    "blockedReason" TEXT,
    "lastIncident" DATETIME,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

-- CreateIndex
CREATE UNIQUE INDEX "session_token_key" ON "session"("token");

-- CreateIndex
CREATE UNIQUE INDEX "circle_membership_userId_circleId_key" ON "circle_membership"("userId", "circleId");

-- CreateIndex
CREATE INDEX "layer_circleId_pageKey_idx" ON "layer"("circleId", "pageKey");

-- CreateIndex
CREATE UNIQUE INDEX "layer_circleId_pageKey_key" ON "layer"("circleId", "pageKey");

-- CreateIndex
CREATE INDEX "element_layerId_elementType_idx" ON "element"("layerId", "elementType");

-- CreateIndex
CREATE INDEX "element_parentId_idx" ON "element"("parentId");

-- CreateIndex
CREATE INDEX "chat_message_layerId_createdAt_idx" ON "chat_message"("layerId", "createdAt");

-- CreateIndex
CREATE INDEX "session_record_layerId_startedAt_idx" ON "session_record"("layerId", "startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "invite_code_key" ON "invite"("code");

-- CreateIndex
CREATE UNIQUE INDEX "anonymous_participant_peerId_key" ON "anonymous_participant"("peerId");

-- CreateIndex
CREATE INDEX "anonymous_participant_layerId_isActive_idx" ON "anonymous_participant"("layerId", "isActive");

-- CreateIndex
CREATE INDEX "anonymous_participant_lastSeenAt_idx" ON "anonymous_participant"("lastSeenAt");

-- CreateIndex
CREATE INDEX "peer_report_reportedId_createdAt_idx" ON "peer_report"("reportedId", "createdAt");

-- CreateIndex
CREATE INDEX "peer_report_expiresAt_idx" ON "peer_report"("expiresAt");

-- CreateIndex
CREATE INDEX "peer_reputation_reputationScore_idx" ON "peer_reputation"("reputationScore");
