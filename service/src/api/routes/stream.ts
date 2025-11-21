import { FastifyPluginAsync } from 'fastify'

/**
 * コーデック指定の型定義
 * 'auto': サーバー側で自動判定
 * 'h264': H.264/AVCを強制指定
 * 'h265': H.265/HEVCを強制指定
 */
export type CodecOption = 'auto' | 'h264' | 'h265'

/**
 * プレイリスト取得時のクエリパラメータ型定義
 */
export interface PlaylistQuery {
  /** コーデック指定（オプション、デフォルト: 'auto'） */
  codec?: CodecOption
}

/**
 * HLS配信APIルート
 * 動画ファイルをHLS形式でストリーミング配信するためのエンドポイントを提供します。
 * 端末の再生能力に応じてサーバー側で適切な単一画質を選択して配信します。
 */
const stream: FastifyPluginAsync = async (fastify, opts): Promise<void> => {
  // TODO: HLS配信エンドポイントの実装
  // - GET /api/stream/:videoId/playlist.m3u8?codec=auto|h264|h265 - メディアプレイリスト（単一品質）
  //   - codec: オプションのクエリパラメータ（'auto', 'h264', 'h265'のいずれか、デフォルト: 'auto'）
  //   - バリデーション: Zodスキーマでcodecパラメータを検証すること
  // - GET /api/stream/:videoId/:segment.ts - セグメントファイル
}

export default stream

