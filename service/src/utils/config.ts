import { join, resolve } from 'node:path'

/**
 * 環境変数から録画ディレクトリのパスを取得します。
 * 環境変数 RECORDINGS_DIR が設定されていない場合は、
 * プロジェクトルートの recordings ディレクトリをデフォルトとして使用します。
 * @returns 録画ディレクトリの絶対パス
 */
export function getRecordingsDirectory(): string {
  const recordingsDir = process.env.RECORDINGS_DIR
  if (recordingsDir) {
    return resolve(recordingsDir)
  }

  // プロジェクトルートの recordings ディレクトリをデフォルトとして使用
  // service ディレクトリから見て、一つ上のディレクトリの recordings
  // __dirname は dist/utils を指すので、3階層上がってプロジェクトルートに到達
  const projectRoot = resolve(__dirname, '..', '..', '..')
  return join(projectRoot, 'recoardings')
}

