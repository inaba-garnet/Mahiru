import { ProgramInfoService } from '../src/core/metadata/program-info-service'
import { resolve } from 'node:path'

/**
 * 番組情報サービスの単機能テスト
 * 指定された動画ファイルパスから.program.txtファイルを読み込み、結果をコンソールに出力します
 */
async function testProgramInfoService(): Promise<void> {
  // テスト対象の動画ファイルパス（絶対パス）
  // プロジェクトルートからの相対パスで指定
  const projectRoot = resolve(__dirname, '..', '..')
  const testVideoPath = resolve(
    projectRoot,
    'recoardings',
    '202510121630010102-ウマ娘　シンデレラグレイ　第１５話「僕達の物語」[字].mkv'
  )

  console.log('=== 番組情報サービス単機能テスト ===')
  console.log('')
  console.log(`テスト対象ファイル: ${testVideoPath}`)
  console.log('')

  try {
    console.log('番組情報の取得を開始します...')
    console.log('')

    // 番組情報サービスを実行
    const result = await ProgramInfoService.getProgramInfo(testVideoPath)

    // 結果をコンソールに出力
    console.log('=== 取得結果 ===')
    console.log('')

    if (!result) {
      console.log('番組情報が取得できませんでした')
      console.log('')
    } else {
      // 番組名
      if (result.title) {
        console.log('【番組名】')
        console.log(`  ${result.title}`)
        console.log('')
      }

      // メタデータ由来のタイトル
      if (result.originalTitle && result.originalTitle !== result.title) {
        console.log('【メタデータ由来のタイトル】')
        console.log(`  ${result.originalTitle}`)
        console.log('')
      }

      // 話数表示
      if (result.episode) {
        console.log('【話数表示】')
        console.log(`  ${result.episode}`)
        console.log('')
      }

      // チャンネル名
      if (result.channelName) {
        console.log('【チャンネル名】')
        console.log(`  ${result.channelName}`)
        console.log('')
      }

      // 放送日時
      if (result.onAirDate) {
        console.log('【放送日時】')
        console.log(`  ${result.onAirDate.toLocaleString('ja-JP')}`)
        console.log('')
      }

      // ジャンル
      if (result.genre) {
        console.log('【ジャンル】')
        console.log(`  ${result.genre}`)
        console.log('')
      }

      // 番組内容詳細
      if (result.description) {
        console.log('【番組内容詳細】')
        // 長い場合は最初の500文字まで表示
        const description =
          result.description.length > 500
            ? `${result.description.substring(0, 500)}...`
            : result.description
        console.log(`  ${description.split('\n').join('\n  ')}`)
        console.log('')
      }

      // すべてのフィールドの有無を確認
      console.log('【取得されたフィールド】')
      console.log(`  番組名: ${result.title ? '✓' : '✗'}`)
      console.log(`  メタデータ由来のタイトル: ${result.originalTitle ? '✓' : '✗'}`)
      console.log(`  話数表示: ${result.episode ? '✓' : '✗'}`)
      console.log(`  チャンネル名: ${result.channelName ? '✓' : '✗'}`)
      console.log(`  放送日時: ${result.onAirDate ? '✓' : '✗'}`)
      console.log(`  ジャンル: ${result.genre ? '✓' : '✗'}`)
      console.log(`  番組内容詳細: ${result.description ? '✓' : '✗'}`)
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
testProgramInfoService()
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

