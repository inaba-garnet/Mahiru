import { DetectedVideoFile } from './scanner'

/**
 * FFPROBEで取得した動画メタデータ
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
    // 1. FFPROBEで動画メタデータを取得
    const ffprobeMetadata = await this.getFFProbeMetadata(filePath)

    // 2. 番組情報（.program.txt）を取得
    const programInfo = await this.getProgramInfo(filePath)

    // 3. キーフレームデータを取得
    const keyframeData = await this.getKeyframeData(filePath)

    // 4. チャプターデータを取得
    const chapterData = await this.getChapterData(filePath)

    // 5. DBに保存
    await this.saveToDatabase({
      path: filePath,
      filename,
      size: fileSize,
      ffprobeMetadata,
      programInfo,
      keyframeData,
      chapterData
    })

    return {
      path: filePath,
      filename,
      size: fileSize,
      ffprobeMetadata,
      programInfo,
      keyframeData,
      chapterData
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
   * FFPROBEサービスを呼び出して動画メタデータを取得します。
   * @param filePath - 動画ファイルの絶対パス
   * @returns FFPROBEで取得したメタデータ
   * @throws {Error} FFPROBEの実行に失敗した場合
   */
  private static async getFFProbeMetadata(
    filePath: string
  ): Promise<FFProbeMetadata> {
    // TODO: ffprobe-service.ts の呼び出し
    throw new Error('未実装: VideoScanService.getFFProbeMetadata')
  }

  /**
   * 番組情報サービスを呼び出して番組情報を取得します。
   * @param filePath - 動画ファイルの絶対パス
   * @returns 番組情報（存在しない場合は undefined）
   */
  private static async getProgramInfo(
    filePath: string
  ): Promise<ProgramInfo | undefined> {
    // TODO: program-info-service.ts の呼び出し
    // 番組情報が存在しない場合は undefined を返す
    return undefined
  }

  /**
   * キーフレームデータを取得します。
   * @param filePath - 動画ファイルの絶対パス
   * @returns キーフレームデータ（取得できない場合は undefined）
   */
  private static async getKeyframeData(
    filePath: string
  ): Promise<KeyframeData | undefined> {
    // TODO: FFPROBEまたはFFmpegを使用してキーフレーム位置を取得
    // キーフレームが取得できない場合は undefined を返す
    return undefined
  }

  /**
   * チャプターデータを取得します。
   * @param filePath - 動画ファイルの絶対パス
   * @returns チャプターデータの配列（存在しない場合は空配列）
   */
  private static async getChapterData(
    filePath: string
  ): Promise<ChapterData[]> {
    // TODO: FFPROBEまたはメタデータからチャプター情報を取得
    // チャプターが存在しない場合は空配列を返す
    return []
  }

  /**
   * スキャン結果をDBに保存します。
   * @param result - スキャン結果
   * @throws {Error} DBへの保存に失敗した場合
   */
  private static async saveToDatabase(
    result: VideoScanResult
  ): Promise<void> {
    // TODO: Repository層を使用してDBに保存
    // 1. Video テーブルに保存（または更新）
    // 2. VideoMetadata テーブルに保存（programInfo が存在する場合）
    // 3. Keyframe テーブルに保存（keyframeData が存在する場合）
    // 4. Chapter テーブルに保存（chapterData が存在する場合）
    throw new Error('未実装: VideoScanService.saveToDatabase')
  }
}

