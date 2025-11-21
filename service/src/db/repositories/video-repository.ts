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
    console.log(`[VideoRepository] saveScanResult 開始: ${result.filename}`)
    const prisma = getPrismaClient()

    try {
      // トランザクションで一括保存
      console.log(`[VideoRepository] トランザクション開始`)
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

        console.log(`[VideoRepository] Videoテーブルに保存/更新: ${result.path}`)
        const video = await tx.video.upsert({
          where: { path: result.path },
          update: videoData,
          create: videoData
        })
        console.log(`[VideoRepository] Videoテーブル保存完了: ID=${video.id}`)

        // 2. VideoMetadata テーブルに保存（programInfo が存在する場合）
        if (result.programInfo) {
          console.log(`[VideoRepository] VideoMetadataテーブルに保存`)
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
          console.log(`[VideoRepository] VideoMetadataテーブル保存完了`)
        } else {
          console.log(`[VideoRepository] VideoMetadataはスキップ（programInfoなし）`)
        }

        // 3. Keyframe テーブルに保存（keyframeData が存在する場合）
        if (result.keyframeData && result.keyframeData.timestamps.length > 0) {
          console.log(
            `[VideoRepository] Keyframeテーブルに保存: ${result.keyframeData.timestamps.length}個のキーフレーム`
          )
          // SQLiteではJSON型がサポートされていないため、JSON文字列として保存
          const timestampsJson = JSON.stringify(result.keyframeData.timestamps)
          await tx.keyframe.upsert({
            where: { videoId: video.id },
            update: {
              timestamps: timestampsJson
            },
            create: {
              videoId: video.id,
              timestamps: timestampsJson
            }
          })
          console.log(`[VideoRepository] Keyframeテーブル保存完了`)
        } else {
          console.log(`[VideoRepository] Keyframeはスキップ（データなし）`)
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
      const errorMessage = error instanceof Error ? error.message : String(error)
      const errorStack = error instanceof Error ? error.stack : undefined
      console.error(`[VideoRepository] DB保存エラー: ${result.filename}`)
      console.error(`[VideoRepository] エラー内容: ${errorMessage}`)
      if (errorStack) {
        console.error(`[VideoRepository] スタックトレース:`, errorStack)
      }
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

