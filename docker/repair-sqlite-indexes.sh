#!/bin/sh
set -eu

# Prisma 6 cannot rename SQLite UNIQUE constraints declared inline in a
# CREATE TABLE statement. Older databases contain two such constraints, so
# `prisma db push` attempts to DROP their sqlite_autoindex_* indexes and exits
# with "index associated with UNIQUE or PRIMARY KEY constraint cannot be
# dropped". Rebuild only those legacy tables, preserving every row, so Prisma
# can manage the UNIQUE indexes by their schema names.

DATABASE_FILE="${1:-/data/prisma/prod.db}"

if [ ! -f "$DATABASE_FILE" ]; then
  exit 0
fi

needs_certificate_repair="$(
  sqlite3 "$DATABASE_FILE" \
    "SELECT COUNT(*) FROM sqlite_master WHERE type = 'index' AND name = 'sqlite_autoindex_Certificate_2' AND sql IS NULL;"
)"
needs_score_report_repair="$(
  sqlite3 "$DATABASE_FILE" \
    "SELECT COUNT(*) FROM sqlite_master WHERE type = 'index' AND name = 'sqlite_autoindex_ScoreReport_2' AND sql IS NULL;"
)"

if [ "$needs_certificate_repair" = "0" ] && [ "$needs_score_report_repair" = "0" ]; then
  exit 0
fi

backup_file="${DATABASE_FILE}.pre-index-repair-$(date +%Y%m%d-%H%M%S).bak"
echo "检测到旧版 SQLite 唯一索引，升级前备份到：$backup_file"
sqlite3 "$DATABASE_FILE" ".backup '$backup_file'"

if [ "$needs_certificate_repair" != "0" ]; then
  sqlite3 -bail "$DATABASE_FILE" <<'SQL'
PRAGMA foreign_keys = OFF;
BEGIN IMMEDIATE;
CREATE TABLE "new_Certificate" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "certificateNo" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "level" TEXT NOT NULL,
  "finalScore" INTEGER NOT NULL,
  "issuedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Certificate_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Certificate" ("id", "userId", "certificateNo", "title", "level", "finalScore", "issuedAt")
SELECT "id", "userId", "certificateNo", "title", "level", "finalScore", "issuedAt" FROM "Certificate";
DROP TABLE "Certificate";
ALTER TABLE "new_Certificate" RENAME TO "Certificate";
CREATE UNIQUE INDEX "Certificate_certificateNo_key" ON "Certificate"("certificateNo");
COMMIT;
PRAGMA foreign_keys = ON;
SQL
fi

if [ "$needs_score_report_repair" != "0" ]; then
  sqlite3 -bail "$DATABASE_FILE" <<'SQL'
PRAGMA foreign_keys = OFF;
BEGIN IMMEDIATE;
CREATE TABLE "new_ScoreReport" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "sessionId" TEXT NOT NULL,
  "totalScore" INTEGER NOT NULL,
  "rawScore" INTEGER NOT NULL,
  "level" TEXT NOT NULL,
  "passStatus" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "reportJson" TEXT NOT NULL,
  "reviewedById" TEXT,
  "reviewedAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ScoreReport_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "TrainingSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ScoreReport_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_ScoreReport" ("id", "sessionId", "totalScore", "rawScore", "level", "passStatus", "summary", "reportJson", "reviewedById", "reviewedAt", "createdAt")
SELECT "id", "sessionId", "totalScore", "rawScore", "level", "passStatus", "summary", "reportJson", "reviewedById", "reviewedAt", "createdAt" FROM "ScoreReport";
DROP TABLE "ScoreReport";
ALTER TABLE "new_ScoreReport" RENAME TO "ScoreReport";
CREATE UNIQUE INDEX "ScoreReport_sessionId_key" ON "ScoreReport"("sessionId");
COMMIT;
PRAGMA foreign_keys = ON;
SQL
fi

integrity_result="$(sqlite3 "$DATABASE_FILE" "PRAGMA integrity_check;")"
if [ "$integrity_result" != "ok" ]; then
  echo "数据库升级后的完整性检查失败：$integrity_result" >&2
  echo "请从备份恢复：$backup_file" >&2
  exit 1
fi

foreign_key_errors="$(sqlite3 "$DATABASE_FILE" "PRAGMA foreign_key_check;")"
if [ -n "$foreign_key_errors" ]; then
  echo "数据库升级后的外键检查失败：" >&2
  echo "$foreign_key_errors" >&2
  echo "请从备份恢复：$backup_file" >&2
  exit 1
fi

echo "旧版 SQLite 唯一索引升级完成。"
