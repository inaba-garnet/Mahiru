import { DirectoryScanner } from '../src/core/scanner'
import { VideoScanService } from '../src/core/video-scan-service'
import { resolve } from 'node:path'

/**
 * 動画スキャン統合テスト
 * ディレクトリスキャンからファイル単位のスキャンまで一連の流れをテストします
 */
async function testVideoScanIntegration(): Promise<void> {
  // テスト対象の録画ディレクトリ
  const projectRoot = resolve(__dirname, '..', '..')
  const testRecordingsDir = resolve(projectRoot, 'recoardings')

  console.log('=== 動画スキャン統合テスト ===')
  console.log('')
  console.log(`テスト対象ディレクトリ: ${testRecordingsDir}`)
  console.log('')

  try {
    // 1. ディレクトリスキャン
    console.log('【ステップ1】ディレクトリスキャンを開始します...')
    console.log('')
    const detectedFiles = await DirectoryScanner.scanRecordingsDirectory(
      testRecordingsDir
    )
    console.log(`検出された動画ファイル数: ${detectedFiles.length}`)
    console.log('')

    if (detectedFiles.length === 0) {
      console.log('動画ファイルが見つかりませんでした。')
      return
    }

    // 検出されたファイル一覧を表示
    console.log('検出されたファイル一覧:')
    detectedFiles.forEach((file, index) => {
      const sizeMB = (file.size / (1024 * 1024)).toFixed(2)
      console.log(
        `  [${index + 1}] ${file.filename} (${sizeMB} MB) - ${file.path}`
      )
    })
    console.log('')

    // 2. ファイル単位のスキャン（最初の1ファイルのみテスト）
    const testFile = detectedFiles[0]
    console.log('【ステップ2】ファイル単位のスキャンを開始します...')
    console.log(`対象ファイル: ${testFile.filename}`)
    console.log('')

    const scanResult = await VideoScanService.scanVideoFile(
      testFile.path,
      testFile.size,
      testFile.filename
    )

    // 3. スキャン結果を表示
    console.log('=== スキャン結果 ===')
    console.log('')

    // 基本情報
    console.log('【基本情報】')
    console.log(`  ファイルパス: ${scanResult.path}`)
    console.log(`  ファイル名: ${scanResult.filename}`)
    console.log(`  ファイルサイズ: ${(scanResult.size / (1024 * 1024)).toFixed(2)} MB`)
    console.log('')

    // FFPROBEメタデータ
    if (scanResult.ffprobeMetadata) {
      console.log('【FFPROBEメタデータ】')
      const meta = scanResult.ffprobeMetadata
      console.log(`  動画の長さ: ${meta.duration.toFixed(2)} 秒`)
      console.log(`  動画コーデック: ${meta.videoCodec}`)
      console.log(`  音声コーデック: ${meta.audioCodec}`)
      if (meta.width && meta.height) {
        console.log(`  解像度: ${meta.width} x ${meta.height}`)
      }
      if (meta.frameRate) {
        console.log(`  フレームレート: ${meta.frameRate.toFixed(2)} fps`)
      }
      console.log('')
    } else {
      console.log('【FFPROBEメタデータ】')
      console.log('  取得できませんでした')
      console.log('')
    }

    // 番組情報
    if (scanResult.programInfo) {
      console.log('【番組情報】')
      const info = scanResult.programInfo
      if (info.title) {
        console.log(`  番組名: ${info.title}`)
      }
      if (info.episode) {
        console.log(`  話数: ${info.episode}`)
      }
      if (info.channelName) {
        console.log(`  チャンネル名: ${info.channelName}`)
      }
      if (info.onAirDate) {
        console.log(`  放送日時: ${info.onAirDate.toLocaleString('ja-JP')}`)
      }
      if (info.genre) {
        console.log(`  ジャンル: ${info.genre}`)
      }
      if (info.description) {
        const desc =
          info.description.length > 200
            ? `${info.description.substring(0, 200)}...`
            : info.description
        console.log(`  番組内容詳細: ${desc.split('\n').join(' ')}`)
      }
      console.log('')
    } else {
      console.log('【番組情報】')
      console.log('  取得できませんでした')
      console.log('')
    }

    // キーフレーム情報
    if (scanResult.keyframeData && scanResult.keyframeData.timestamps.length > 0) {
      console.log('【キーフレーム情報】')
      const keyframes = scanResult.keyframeData.timestamps
      console.log(`  キーフレーム数: ${keyframes.length}`)
      console.log(`  最初のキーフレーム: ${keyframes[0].toFixed(2)} 秒`)
      console.log(`  最後のキーフレーム: ${keyframes[keyframes.length - 1].toFixed(2)} 秒`)
      console.log('')
    } else {
      console.log('【キーフレーム情報】')
      console.log('  取得できませんでした')
      console.log('')
    }

    // チャプター情報
    if (scanResult.chapterData && scanResult.chapterData.length > 0) {
      console.log('【チャプター情報】')
      console.log(`  チャプター数: ${scanResult.chapterData.length}`)
      scanResult.chapterData.slice(0, 5).forEach((chapter, index) => {
        console.log(`  [${index + 1}] ${chapter.startTime.toFixed(2)}秒 - ${chapter.endTime?.toFixed(2) ?? '終了'}秒`)
        if (chapter.title) {
          console.log(`      タイトル: ${chapter.title}`)
        }
      })
      if (scanResult.chapterData.length > 5) {
        console.log(`    ... 他 ${scanResult.chapterData.length - 5} 個`)
      }
      console.log('')
    } else {
      console.log('【チャプター情報】')
      console.log('  取得できませんでした')
      console.log('')
    }

    console.log('=== テスト完了 ===')
  } catch (error) {
    console.error('=== エラーが発生しました ===')
    console.error('')
    if (error instanceof Error) {
      console.error(`エラーメッセージ: ${error.message}`)
      console.error('')
      if (error.stack) {
        console.error('スタックトレース:')
        console.error(error.stack)
      }
    } else {
      console.error('不明なエラー:', error)
    }
    process.exit(1)
  }
}

// スクリプトを実行
testVideoScanIntegration()
  .then(() => {
    console.log('')
    console.log('統合テストが正常に完了しました')
    process.exit(0)
  })
  .catch((error) => {
    console.error('')
    console.error('統合テストの実行中にエラーが発生しました:', error)
    process.exit(1)
  })

