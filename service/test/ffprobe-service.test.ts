import { FFProbeService } from '../src/core/ffmpeg/ffprobe-service'
import { resolve } from 'node:path'

/**
 * FFPROBEサービスの単機能テスト
 * 指定された動画ファイルを解析し、結果をコンソールに出力します
 */
async function testFFProbeService(): Promise<void> {
  // テスト対象の動画ファイルパス（絶対パス）
  // プロジェクトルートからの相対パスで指定
  const projectRoot = resolve(__dirname, '..', '..')
  const testVideoPath = resolve(
    projectRoot,
    'recoardings',
    '202510121630010102-ウマ娘　シンデレラグレイ　第１５話「僕達の物語」[字].mkv'
  )

  console.log('=== FFPROBEサービス単機能テスト ===')
  console.log('')
  console.log(`テスト対象ファイル: ${testVideoPath}`)
  console.log('')

  try {
    console.log('動画ファイルの解析を開始します...')
    console.log('')

    // FFPROBEサービスを実行
    const result = await FFProbeService.analyzeVideo(testVideoPath)

    // 結果をコンソールに出力
    console.log('=== 解析結果 ===')
    console.log('')

    // 基本メタデータ
    console.log('【基本メタデータ】')
    console.log(`  動画の長さ: ${result.duration.toFixed(2)} 秒`)
    console.log(`  動画コーデック: ${result.videoCodec}`)
    console.log(`  音声コーデック: ${result.audioCodec}`)
    if (result.width && result.height) {
      console.log(`  解像度: ${result.width} x ${result.height}`)
    }
    if (result.frameRate) {
      console.log(`  フレームレート: ${result.frameRate.toFixed(2)} fps`)
    }
    console.log('')

    // キーフレーム情報
    console.log('【キーフレーム情報】')
    console.log(`  キーフレーム数: ${result.keyframes.length}`)
    if (result.keyframes.length > 0) {
      console.log(`  最初のキーフレーム: ${result.keyframes[0].toFixed(2)} 秒`)
      console.log(`  最後のキーフレーム: ${result.keyframes[result.keyframes.length - 1].toFixed(2)} 秒`)
      console.log('')
      console.log('  キーフレーム位置（最初の10個）:')
      result.keyframes.slice(0, 10).forEach((timestamp, index) => {
        console.log(`    [${index + 1}] ${timestamp.toFixed(2)} 秒`)
      })
      if (result.keyframes.length > 10) {
        console.log(`    ... 他 ${result.keyframes.length - 10} 個`)
      }
    } else {
      console.log('  キーフレームが見つかりませんでした')
    }
    console.log('')

    // チャプター情報
    console.log('【チャプター情報】')
    console.log(`  チャプター数: ${result.chapters.length}`)
    if (result.chapters.length > 0) {
      result.chapters.forEach((chapter, index) => {
        console.log(`  [${index + 1}] ID: ${chapter.id}`)
        if (chapter.title) {
          console.log(`      タイトル: ${chapter.title}`)
        }
        console.log(`      開始時刻: ${chapter.startTime.toFixed(2)} 秒`)
        console.log(`      終了時刻: ${chapter.endTime.toFixed(2)} 秒`)
        const duration = chapter.endTime - chapter.startTime
        console.log(`      長さ: ${duration.toFixed(2)} 秒`)
        console.log('')
      })
    } else {
      console.log('  チャプターが見つかりませんでした')
    }
    console.log('')

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
testFFProbeService()
  .then(() => {
    console.log('')
    console.log('テストが正常に完了しました')
    process.exit(0)
  })
  .catch((error) => {
    console.error('')
    console.error('テストの実行中にエラーが発生しました:', error)
    process.exit(1)
  })

