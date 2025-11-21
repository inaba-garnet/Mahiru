import { DetectedVideoFile } from './scanner'
import { FFProbeService, FFProbeResult } from './ffmpeg/ffprobe-service'
import { ProgramInfoService } from './metadata/program-info-service'
import { VideoRepository } from '../db/repositories/video-repository'

/**
 * FFPROBEで取得した動画メタデータ
 * @deprecated 新しいコードでは FFProbeResult を直接使用してください
 */
export interface FFProbeMetadata {
  /** 動画の長さ（秒） */
  duration: number
  /** 動画コーデック */
  videoCodec: string
  /** 音声コーデック */
  audioCodec: string
  /** 動画の幅（ピクセル） */
  width?: number
  /** 動画の高さ（ピクセル） */
  height?: number
  /** フレームレート */
  frameRate?: number
}

/**
 * 番組情報（EDCBのtxtファイルから取得）
 */
export interface ProgramInfo {
  /** 番組名 */
  title?: string
  /** 話数表示 */
  episode?: string
  /** 番組内容詳細 */
  description?: string
  /** ジャンル */
  genre?: string
  /** チャンネル名 */
  channelName?: string
  /** 放送日時 */
  onAirDate?: Date
  /** メタデータ由来のタイトル */
  originalTitle?: string
}

/**
 * キーフレーム情報
 */
export interface KeyframeData {
  /** キーフレーム位置のリスト（秒単位） */
  timestamps: number[]
}

/**
 * チャプター情報
 */
export interface ChapterData {
  /** チャプタータイトル */
  title?: string
  /** 開始時刻（秒単位） */
  startTime: number
  /** 終了時刻（秒単位、省略可） */
  endTime?: number
}

/**
 * 動画ファイルのスキャン結果
 * FFPROBEとメタデータ取得の結果を統合した情報
 */
export interface VideoScanResult {
  /** ファイルの絶対パス */
  path: string
  /** ファイル名 */
  filename: string
  /** ファイルサイズ（バイト） */
  size: number
  /** FFPROBEで取得した動画メタデータ */
  ffprobeMetadata?: FFProbeMetadata
  /** EDCBのtxtファイルから取得した番組情報 */
  programInfo?: ProgramInfo
  /** キーフレームデータ */
  keyframeData?: KeyframeData
  /** チャプターデータ */
  chapterData?: ChapterData[]
}

/**
 * 動画ファイルスキャンサービス
 * 個別の動画ファイルに対して、FFPROBE実行と番組情報取得を統合して実行し、
 * 取得したデータをDBに保存する責務を持つ
 */
export class VideoScanService {
  /**
   * 単一の動画ファイルをスキャンし、メタデータ・キーフレーム・チャプター情報を取得してDBに保存します。
   * @param filePath - スキャン対象の動画ファイルの絶対パス
   * @param fileSize - ファイルサイズ（バイト）
   * @param filename - ファイル名
   * @returns スキャン結果（FFPROBEメタデータ、番組情報、キーフレーム、チャプターを含む）
   * @throws {Error} ファイルが存在しない、またはスキャン処理中にエラーが発生した場合
   */
  static async scanVideoFile(
    filePath: string,
    fileSize: number,
    filename: string
  ): Promise<VideoScanResult> {
    console.log(`[VideoScanService] ファイルのスキャンを開始: ${filename}`)
    console.log(`[VideoScanService] ファイルパス: ${filePath}`)

    // 1. FFPROBEで動画メタデータ・キーフレーム・チャプター情報を取得
    console.log(`[VideoScanService] FFPROBEメタデータの取得を開始...`)
    const ffprobeResult = await this.getFFProbeMetadata(filePath)
    console.log(
      `[VideoScanService] FFPROBEメタデータ取得完了: 長さ=${ffprobeResult.duration.toFixed(2)}秒, コーデック=${ffprobeResult.videoCodec}/${ffprobeResult.audioCodec}, キーフレーム数=${ffprobeResult.keyframes.length}, チャプター数=${ffprobeResult.chapters.length}`
    )

    // 2. 番組情報（.program.txt）を取得
    console.log(`[VideoScanService] 番組情報の取得を開始...`)
    const programInfo = await this.getProgramInfo(filePath)
    if (programInfo) {
      console.log(
        `[VideoScanService] 番組情報取得完了: タイトル=${programInfo.title ?? '(なし)'}, 話数=${programInfo.episode ?? '(なし)'}`
      )
    } else {
      console.log(`[VideoScanService] 番組情報は見つかりませんでした`)
    }

    // 3. スキャン結果を構築
    console.log(`[VideoScanService] スキャン結果を構築中...`)
    const scanResult: VideoScanResult = {
      path: filePath,
      filename,
      size: fileSize,
      ffprobeMetadata: {
        duration: ffprobeResult.duration,
        videoCodec: ffprobeResult.videoCodec,
        audioCodec: ffprobeResult.audioCodec,
        width: ffprobeResult.width,
        height: ffprobeResult.height,
        frameRate: ffprobeResult.frameRate
      },
      programInfo,
      keyframeData: {
        timestamps: ffprobeResult.keyframes
      },
      chapterData: ffprobeResult.chapters.map((chapter) => ({
        title: chapter.title,
        startTime: chapter.startTime,
        endTime: chapter.endTime
      }))
    }
    console.log(`[VideoScanService] スキャン結果の構築完了`)

    // 4. DBに保存
    console.log(`[VideoScanService] DBへの保存を開始...`)
    await this.saveToDatabase(scanResult)
    console.log(`[VideoScanService] ファイルのスキャン完了: ${filename}`)

    return scanResult
  }

  /**
   * 複数の動画ファイルを順次スキャンし、DBに保存します。
   * @param files - スキャン対象の動画ファイル情報の配列
   * @returns 各ファイルのスキャン結果の配列
   */
  static async scanVideoFiles(
    files: DetectedVideoFile[]
  ): Promise<VideoScanResult[]> {
    console.log(
      `[VideoScanService] 複数ファイルのスキャンを開始: ${files.length}件`
    )
    const results: VideoScanResult[] = []

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      console.log(
        `[VideoScanService] [${i + 1}/${files.length}] 処理中: ${file.filename}`
      )
      try {
        const result = await this.scanVideoFile(
          file.path,
          file.size,
          file.filename
        )
        results.push(result)
        console.log(
          `[VideoScanService] [${i + 1}/${files.length}] 完了: ${file.filename}`
        )
      } catch (error) {
        // 個別のファイルのスキャンエラーは記録するが、処理は継続
        const errorMessage =
          error instanceof Error ? error.message : String(error)
        const errorStack = error instanceof Error ? error.stack : undefined
        console.error(
          `[VideoScanService] [${i + 1}/${files.length}] ファイルのスキャン中にエラーが発生しました: ${file.path}`
        )
        console.error(`[VideoScanService] エラー内容: ${errorMessage}`)
        if (errorStack) {
          console.error(`[VideoScanService] スタックトレース:`, errorStack)
        }
        // エラーが発生したファイルも結果に含める（メタデータなし）
        results.push({
          path: file.path,
          filename: file.filename,
          size: file.size
        })
      }
    }

    const successCount = results.filter(
      (r) => r.ffprobeMetadata !== undefined
    ).length
    console.log(
      `[VideoScanService] 複数ファイルのスキャン完了: ${successCount}/${files.length}件成功`
    )

    return results
  }

  /**
   * FFPROBEサービスを呼び出して動画メタデータ・キーフレーム・チャプター情報を取得します。
   * @param filePath - 動画ファイルの絶対パス
   * @returns FFPROBEで取得したメタデータ、キーフレーム、チャプター情報
   * @throws {Error} FFPROBEの実行に失敗した場合
   */
  private static async getFFProbeMetadata(
    filePath: string
  ): Promise<FFProbeResult> {
    try {
      const result = await FFProbeService.analyzeVideo(filePath)
      return result
    } catch (error) {
      console.error(
        `[VideoScanService] FFPROBEメタデータ取得エラー: ${filePath}`,
        error
      )
      throw error
    }
  }

  /**
   * 番組情報サービスを呼び出して番組情報を取得します。
   * @param filePath - 動画ファイルの絶対パス
   * @returns 番組情報（存在しない場合は undefined）
   */
  private static async getProgramInfo(
    filePath: string
  ): Promise<ProgramInfo | undefined> {
    try {
      const result = await ProgramInfoService.getProgramInfo(filePath)
      return result
    } catch (error) {
      console.warn(
        `[VideoScanService] 番組情報取得エラー（続行）: ${filePath}`,
        error
      )
      // 番組情報の取得エラーは致命的ではないため、undefinedを返して続行
      return undefined
    }
  }


  /**
   * スキャン結果をDBに保存します。
   * @param result - スキャン結果
   * @throws {Error} DBへの保存に失敗した場合
   */
  private static async saveToDatabase(
    result: VideoScanResult
  ): Promise<void> {
    console.log(
      `[VideoScanService] DB保存開始: ${result.filename} (パス: ${result.path})`
    )
    try {
      const videoId = await VideoRepository.saveScanResult(result)
      console.log(
        `[VideoScanService] DBへの保存が完了しました: ${result.filename} (Video ID: ${videoId})`
      )
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error)
      const errorStack = error instanceof Error ? error.stack : undefined
      console.error(
        `[VideoScanService] DBへの保存に失敗しました: ${result.path}`
      )
      console.error(`[VideoScanService] エラー内容: ${errorMessage}`)
      if (errorStack) {
        console.error(`[VideoScanService] スタックトレース:`, errorStack)
      }
      throw error
    }
  }
}

