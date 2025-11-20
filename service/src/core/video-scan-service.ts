import { DetectedVideoFile } from './scanner'
import { FFProbeService, FFProbeResult } from './ffmpeg/ffprobe-service'
import { ProgramInfoService } from './metadata/program-info-service'

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

    // 3. DBに保存（未実装のため一時的にコメントアウト）
    // TODO: Repository層の実装後に有効化
    // await this.saveToDatabase({
    //   path: filePath,
    //   filename,
    //   size: fileSize,
    //   ffprobeMetadata: {
    //     duration: ffprobeResult.duration,
    //     videoCodec: ffprobeResult.videoCodec,
    //     audioCodec: ffprobeResult.audioCodec,
    //     width: ffprobeResult.width,
    //     height: ffprobeResult.height,
    //     frameRate: ffprobeResult.frameRate
    //   },
    //   programInfo,
    //   keyframeData: {
    //     timestamps: ffprobeResult.keyframes
    //   },
    //   chapterData: ffprobeResult.chapters.map((chapter) => ({
    //     title: chapter.title,
    //     startTime: chapter.startTime,
    //     endTime: chapter.endTime
    //   }))
    // })

    return {
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
   * @internal 将来の実装用。現在は未使用。
   */
  // @ts-expect-error 将来の実装用のメソッド。現在は未使用だが、実装時に使用する予定。
  private static async _saveToDatabase(
    result: VideoScanResult
  ): Promise<void> {
    // TODO: Repository層を使用してDBに保存
    // 1. Video テーブルに保存（または更新）
    // 2. VideoMetadata テーブルに保存（programInfo が存在する場合）
    // 3. Keyframe テーブルに保存（keyframeData が存在する場合）
    // 4. Chapter テーブルに保存（chapterData が存在する場合）
    throw new Error('未実装: VideoScanService._saveToDatabase')
  }
}

