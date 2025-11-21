import { FastifyPluginAsync } from 'fastify'
import { DirectoryScanner } from '../../../core/scanner'

/**
 * 管理用API: 録画ディレクトリのスキャン
 * ディレクトリをスキャンし、検出されたファイルのスキャンとDB登録をバックグラウンドで実行します。
 */
const scan: FastifyPluginAsync = async (fastify, opts): Promise<void> => {
  fastify.post('/scan', async function (request, reply) {
    try {
      // ディレクトリをスキャンして、検出されたファイルをスキャンしてDB登録
      // エラーハンドリングはDirectoryScanner内で行われ、個別のファイルのエラーは処理を継続します
      DirectoryScanner.scanAndRegister()
        .then((results) => {
          const successCount = results.filter(
            (r) => r.ffprobeMetadata !== undefined
          ).length
          fastify.log.info(
            `[Scan API] スキャン完了: ${successCount}/${results.length}件のファイルをDBに登録しました。`
          )
        })
        .catch((error) => {
          fastify.log.error(
            error,
            '[Scan API] スキャン処理中に予期しないエラーが発生しました'
          )
        })

      // 即座に206レスポンスを返す
      return reply.code(206).send({
        success: true,
        message: 'スキャン処理を開始しました'
      })
    } catch (error) {
      fastify.log.error(error, '録画ディレクトリのスキャン開始中にエラーが発生しました')
      return reply.code(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  })
}

export default scan

