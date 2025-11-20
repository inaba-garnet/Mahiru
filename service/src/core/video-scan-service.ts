import { DetectedVideoFile } from './scanner'

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
  ffprobeMetadata?: unknown
  /** EDCBのtxtファイルから取得した番組情報 */
  programInfo?: unknown
}

/**
 * 動画ファイルスキャンサービス
 * 個別の動画ファイルに対して、FFPROBE実行と番組情報取得を統合して実行する
 */
export class VideoScanService {
  /**
   * 単一の動画ファイルをスキャンし、メタデータと番組情報を取得します。
   * @param filePath - スキャン対象の動画ファイルの絶対パス
   * @returns スキャン結果（FFPROBEメタデータと番組情報を含む）
   * @throws {Error} ファイルが存在しない、またはスキャン処理中にエラーが発生した場合
   */
  static async scanVideoFile(filePath: string): Promise<VideoScanResult> {
    // TODO: FFPROBEサービスの呼び出し
    // TODO: 番組情報サービスの呼び出し
    // TODO: 結果の統合

    throw new Error('未実装: VideoScanService.scanVideoFile')
  }

  /**
   * 複数の動画ファイルを順次スキャンします。
   * @param files - スキャン対象の動画ファイル情報の配列
   * @returns 各ファイルのスキャン結果の配列
   */
  static async scanVideoFiles(
    files: DetectedVideoFile[]
  ): Promise<VideoScanResult[]> {
    const results: VideoScanResult[] = []

    for (const file of files) {
      try {
        const result = await this.scanVideoFile(file.path)
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
}

