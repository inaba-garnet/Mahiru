import { FastifyPluginAsync } from 'fastify'
import { scanRecordingsDirectory } from '../../../core/scanner'

/**
 * 管理用API: 録画ディレクトリのスキャン
 */
const scan: FastifyPluginAsync = async (fastify, opts): Promise<void> => {
  fastify.post('/scan', async function (request, reply) {
    try {
      // 録画ディレクトリをスキャン
      const detectedFiles = await scanRecordingsDirectory()

      // 検出結果をコンソールに表示
      console.log('=== 録画ディレクトリスキャン結果 ===')
      console.log(`検出されたファイル数: ${detectedFiles.length}`)
      console.log('')

      if (detectedFiles.length === 0) {
        console.log('動画ファイルは検出されませんでした。')
      } else {
        console.log('検出されたファイル一覧:')
        detectedFiles.forEach((file, index) => {
          const sizeMB = (file.size / (1024 * 1024)).toFixed(2)
          console.log(
            `  [${index + 1}] ${file.filename} (${sizeMB} MB) - ${file.path}`
          )
        })
      }

      console.log('=====================================')

      // レスポンスを返す
      return {
        success: true,
        count: detectedFiles.length,
        files: detectedFiles.map((file) => ({
          path: file.path,
          filename: file.filename,
          size: file.size
        }))
      }
    } catch (error) {
      fastify.log.error(error, '録画ディレクトリのスキャン中にエラーが発生しました')
      return reply.code(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  })
}

export default scan

