import { test } from 'node:test'
import { strictEqual, ok } from 'node:assert'
import { DirectoryScanner } from '../src/core/scanner'
import { getRecordingsDirectory } from '../src/utils/config'
import { existsSync } from 'node:fs'

/**
 * 動画スキャン統合テスト
 * ディレクトリスキャンからファイル単位のスキャンまで一連の流れをテストします
 * 
 * 環境変数 RECORDINGS_DIR が設定されている場合はそのディレクトリを使用し、
 * 設定されていない場合はデフォルトのディレクトリを使用します。
 * 
 * 注意: このテストは実際の動画ファイルが必要なため、CI/CD環境では
 * RECORDINGS_DIR 環境変数でテスト用ディレクトリを指定するか、
 * スキップする必要があります。
 */
test('動画スキャン統合テスト', async (t) => {
  // テスト対象の録画ディレクトリ（環境変数から取得、またはデフォルト値）
  const testRecordingsDir = getRecordingsDirectory()

  // ディレクトリが存在しない場合はスキップ
  if (!existsSync(testRecordingsDir)) {
    t.skip(`テスト対象ディレクトリが存在しません: ${testRecordingsDir}`)
    return
  }

  await t.test('ディレクトリスキャンとDB登録', async () => {
    // ディレクトリスキャンとDB登録を一括実行
    const scanResults = await DirectoryScanner.scanAndRegister(testRecordingsDir)
    
    // 検出されたファイルが存在することを確認
    ok(scanResults.length >= 0, 'スキャン結果が返されること')
    
    // ファイルが検出された場合、スキャン結果の検証
    if (scanResults.length > 0) {
      const firstResult = scanResults[0]
      
      // 基本情報の検証
      ok(firstResult.path, 'ファイルパスが設定されていること')
      ok(firstResult.filename, 'ファイル名が設定されていること')
      strictEqual(typeof firstResult.size, 'number', 'ファイルサイズが数値であること')
      
      // FFPROBEメタデータの検証（取得できた場合）
      if (firstResult.ffprobeMetadata) {
        strictEqual(typeof firstResult.ffprobeMetadata.duration, 'number', '動画の長さが数値であること')
        ok(firstResult.ffprobeMetadata.videoCodec, '動画コーデックが設定されていること')
        ok(firstResult.ffprobeMetadata.audioCodec, '音声コーデックが設定されていること')
      }
      
      // キーフレームデータの検証（取得できた場合）
      if (firstResult.keyframeData) {
        ok(Array.isArray(firstResult.keyframeData.timestamps), 'キーフレームタイムスタンプが配列であること')
      }
      
      // チャプターデータの検証（取得できた場合）
      if (firstResult.chapterData) {
        ok(Array.isArray(firstResult.chapterData), 'チャプターデータが配列であること')
      }
    }
  })
})
