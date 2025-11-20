import { readdir, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { getRecordingsDirectory } from '../utils/config'

/**
 * 検出された動画ファイルの情報
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
 * 録画ディレクトリをスキャンし、動画ファイル（.ts, .mp4, .mkv）を検出します。
 * @param recordingsDir - スキャン対象の録画ディレクトリ（指定しない場合は環境変数から取得）
 * @returns 検出された動画ファイルの配列
 * @throws {Error} ディレクトリが存在しない、または読み取り権限がない場合
 */
export async function scanRecordingsDirectory(
  recordingsDir?: string
): Promise<DetectedVideoFile[]> {
  const targetDir = recordingsDir ?? getRecordingsDirectory()
  const videoExtensions = ['.ts', '.mp4', '.mkv']
  const detectedFiles: DetectedVideoFile[] = []

  /**
   * ディレクトリを再帰的にスキャンする内部関数
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
          if (videoExtensions.includes(ext)) {
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

