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
    // 1. FFPROBEで動画メタデータ・キーフレーム・チャプター情報を取得
    const ffprobeResult = await this.getFFProbeMetadata(filePath)

    // 2. 番組情報（.program.txt）を取得
    const programInfo = await this.getProgramInfo(filePath)

    // 3. スキャン結果を構築
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

    // 4. DBに保存
    await this.saveToDatabase(scanResult)

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
    const results: VideoScanResult[] = []

    for (const file of files) {
      try {
        const result = await this.scanVideoFile(
          file.path,
          file.size,
          file.filename
        )
        results.push(result)
      } catch (error) {
        // 個別のファイルのスキャンエラーは記録するが、処理は継続
        console.error(
          `ファイルのスキャン中にエラーが発生しました: ${file.path}`,
          error
        )
        // エラーが発生したファイルも結果に含める（メタデータなし）
        results.push({
          path: file.path,
          filename: file.filename,
          size: file.size
        })
      }
    }

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
    return FFProbeService.analyzeVideo(filePath)
  }

  /**
   * 番組情報サービスを呼び出して番組情報を取得します。
   * @param filePath - 動画ファイルの絶対パス
   * @returns 番組情報（存在しない場合は undefined）
   */
  private static async getProgramInfo(
    filePath: string
  ): Promise<ProgramInfo | undefined> {
    return ProgramInfoService.getProgramInfo(filePath)
  }


  /**
   * スキャン結果をDBに保存します。
   * @param result - スキャン結果
   * @throws {Error} DBへの保存に失敗した場合
   */
  private static async saveToDatabase(
    result: VideoScanResult
  ): Promise<void> {
    await VideoRepository.saveScanResult(result)
  }
}

