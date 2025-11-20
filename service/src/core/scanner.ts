import { readdir, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { getRecordingsDirectory } from '../utils/config'

/**
 * 検出された動画ファイルの情報
 * ディレクトリスキャンで取得される基本的なファイル情報のみを含む
 */
export interface DetectedVideoFile {
  /** ファイルの絶対パス */
  path: string
  /** ファイル名 */
  filename: string
  /** ファイルサイズ（バイト） */
  size: number
}

/**
 * ディレクトリスキャナー
 * 録画ディレクトリを再帰的にスキャンし、動画ファイルを検出する責務を持つ
 */
export class DirectoryScanner {
  /** スキャン対象の動画ファイル拡張子 */
  private static readonly VIDEO_EXTENSIONS = ['.ts', '.mp4', '.mkv'] as const

  /**
   * 録画ディレクトリをスキャンし、動画ファイル（.ts, .mp4, .mkv）を検出します。
   * この関数はディレクトリの走査とファイル検出のみを行い、メタデータの解析は行いません。
   * @param recordingsDir - スキャン対象の録画ディレクトリ（指定しない場合は環境変数から取得）
   * @returns 検出された動画ファイルの配列（パス、ファイル名、サイズのみ）
   * @throws {Error} ディレクトリが存在しない、または読み取り権限がない場合
   */
  static async scanRecordingsDirectory(
    recordingsDir?: string
  ): Promise<DetectedVideoFile[]> {
    const targetDir = recordingsDir ?? getRecordingsDirectory()
    const detectedFiles: DetectedVideoFile[] = []

    /**
     * ディレクトリを再帰的にスキャンする内部関数
     * @param dirPath - スキャン対象のディレクトリパス
     */
    async function scanDirectory(dirPath: string): Promise<void> {
      try {
        const entries = await readdir(dirPath, { withFileTypes: true })

        for (const entry of entries) {
          const fullPath = join(dirPath, entry.name)

          if (entry.isDirectory()) {
            // ディレクトリの場合は再帰的にスキャン
            await scanDirectory(fullPath)
          } else if (entry.isFile()) {
            // ファイルの場合は拡張子をチェック
            const ext = entry.name.toLowerCase().slice(entry.name.lastIndexOf('.'))
            if (
              DirectoryScanner.VIDEO_EXTENSIONS.includes(
                ext as (typeof DirectoryScanner.VIDEO_EXTENSIONS)[number]
              )
            ) {
              const stats = await stat(fullPath)
              detectedFiles.push({
                path: fullPath,
                filename: entry.name,
                size: stats.size
              })
            }
          }
        }
      } catch (error) {
        // ディレクトリの読み取りエラーは無視（権限エラーなど）
        if (error instanceof Error) {
          console.warn(`ディレクトリのスキャン中にエラーが発生しました: ${dirPath} - ${error.message}`)
        }
      }
    }

    await scanDirectory(targetDir)
    return detectedFiles
  }
}

/**
 * 録画ディレクトリをスキャンし、動画ファイルを検出します。
 * @deprecated この関数は後方互換性のために残されています。新しいコードでは `DirectoryScanner.scanRecordingsDirectory()` を使用してください。
 * @param recordingsDir - スキャン対象の録画ディレクトリ（指定しない場合は環境変数から取得）
 * @returns 検出された動画ファイルの配列
 */
export async function scanRecordingsDirectory(
  recordingsDir?: string
): Promise<DetectedVideoFile[]> {
  return DirectoryScanner.scanRecordingsDirectory(recordingsDir)
}

