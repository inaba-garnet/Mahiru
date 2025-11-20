import { getPrismaClient } from '../client'
import { VideoScanResult } from '../../core/video-scan-service'

/**
 * 動画リポジトリ
 * 動画ファイルのDB操作を担当
 */
export class VideoRepository {
  /**
   * スキャン結果をDBに保存します。
   * Video、VideoMetadata、Keyframe、Chapterテーブルに保存します。
   * @param result - スキャン結果
   * @returns 作成されたVideoのID
   * @throws {Error} DBへの保存に失敗した場合
   */
  static async saveScanResult(result: VideoScanResult): Promise<string> {
    const prisma = getPrismaClient()

    try {
      // トランザクションで一括保存
      const video = await prisma.$transaction(async (tx) => {
        // 1. Video テーブルに保存（または更新）
        const videoData = {
          path: result.path,
          filename: result.filename,
          duration: result.ffprobeMetadata?.duration ?? 0,
          size: BigInt(result.size),
          videoCodec: result.ffprobeMetadata?.videoCodec ?? 'unknown',
          audioCodec: result.ffprobeMetadata?.audioCodec ?? 'unknown',
          width: result.ffprobeMetadata?.width ?? null,
          height: result.ffprobeMetadata?.height ?? null,
          frameRate: result.ffprobeMetadata?.frameRate ?? null
        }

        const video = await tx.video.upsert({
          where: { path: result.path },
          update: videoData,
          create: videoData
        })

        // 2. VideoMetadata テーブルに保存（programInfo が存在する場合）
        if (result.programInfo) {
          const metadataData = {
            videoId: video.id,
            originalTitle: result.programInfo.originalTitle ?? result.programInfo.title ?? '',
            title: result.programInfo.title ?? null,
            episode: result.programInfo.episode ?? null,
            description: result.programInfo.description ?? null,
            genre: result.programInfo.genre ?? null,
            channelName: result.programInfo.channelName ?? null,
            onAirDate: result.programInfo.onAirDate ?? null
          }

          await tx.videoMetadata.upsert({
            where: { videoId: video.id },
            update: metadataData,
            create: metadataData
          })
        }

        // 3. Keyframe テーブルに保存（keyframeData が存在する場合）
        if (result.keyframeData && result.keyframeData.timestamps.length > 0) {
          await tx.keyframe.upsert({
            where: { videoId: video.id },
            update: {
              timestamps: result.keyframeData.timestamps
            },
            create: {
              videoId: video.id,
              timestamps: result.keyframeData.timestamps
            }
          })
        }

        // 4. Chapter テーブルに保存（chapterData が存在する場合）
        if (result.chapterData && result.chapterData.length > 0) {
          // 既存のチャプターを削除してから新規作成
          await tx.chapter.deleteMany({
            where: { videoId: video.id }
          })

          await tx.chapter.createMany({
            data: result.chapterData.map((chapter) => ({
              videoId: video.id,
              title: chapter.title ?? null,
              startTime: chapter.startTime,
              endTime: chapter.endTime ?? null
            }))
          })
        }

        return video
      })

      return video.id
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`DBへの保存に失敗しました: ${error.message}`)
      }
      throw error
    }
  }

  /**
   * ファイルパスから動画を検索します。
   * @param path - 動画ファイルの絶対パス
   * @returns 動画情報（存在しない場合は null）
   */
  static async findByPath(path: string): Promise<{
    id: string
    path: string
    filename: string
    duration: number
    size: bigint
    videoCodec: string
    audioCodec: string
    width: number | null
    height: number | null
    frameRate: number | null
  } | null> {
    const prisma = getPrismaClient()

    const video = await prisma.video.findUnique({
      where: { path }
    })

    if (!video) {
      return null
    }

    return {
      id: video.id,
      path: video.path,
      filename: video.filename,
      duration: video.duration,
      size: video.size,
      videoCodec: video.videoCodec,
      audioCodec: video.audioCodec,
      width: video.width,
      height: video.height,
      frameRate: video.frameRate
    }
  }
}

