-- CreateTable
CREATE TABLE "videos" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "path" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "duration" REAL NOT NULL,
    "size" BIGINT NOT NULL,
    "video_codec" TEXT NOT NULL,
    "audio_codec" TEXT NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "frame_rate" REAL,
    "series_id" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "videos_series_id_fkey" FOREIGN KEY ("series_id") REFERENCES "series" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "video_metadata" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "video_id" TEXT NOT NULL,
    "original_title" TEXT NOT NULL,
    "title" TEXT,
    "episode" TEXT,
    "description" TEXT,
    "genre" TEXT,
    "channel_name" TEXT,
    "on_air_date" DATETIME,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "video_metadata_video_id_fkey" FOREIGN KEY ("video_id") REFERENCES "videos" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "keyframes" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "video_id" TEXT NOT NULL,
    "timestamps" JSONB NOT NULL,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "keyframes_video_id_fkey" FOREIGN KEY ("video_id") REFERENCES "videos" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "series" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "chapters" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "video_id" TEXT NOT NULL,
    "title" TEXT,
    "start_time" REAL NOT NULL,
    "end_time" REAL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "chapters_video_id_fkey" FOREIGN KEY ("video_id") REFERENCES "videos" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "videos_path_key" ON "videos"("path");

-- CreateIndex
CREATE UNIQUE INDEX "video_metadata_video_id_key" ON "video_metadata"("video_id");

-- CreateIndex
CREATE UNIQUE INDEX "keyframes_video_id_key" ON "keyframes"("video_id");

-- CreateIndex
CREATE UNIQUE INDEX "series_title_key" ON "series"("title");

-- CreateIndex
CREATE INDEX "chapters_video_id_idx" ON "chapters"("video_id");
