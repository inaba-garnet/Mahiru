import { exec } from 'node:child_process'
import { promisify } from 'node:util'
import { existsSync } from 'node:fs'

const execAsync = promisify(exec)

/**
 * FFPROBEで取得した動画メタデータ（キーフレーム・チャプター情報を含む）
 */
export interface FFProbeResult {
  /** 動画の長さ（秒） */
  duration: number
  /** 動画コーデック */
  videoCodec: string
  /** 音声コーデック */
  audioCodec: string
  /** 動画の幅（ピクセル） */
  width?: number
  /** 動画の高さ（ピクセル） */
  height?: number
  /** フレームレート */
  frameRate?: number
  /** キーフレーム位置のリスト（秒単位） */
  keyframes: number[]
  /** チャプター情報のリスト */
  chapters: FFProbeChapter[]
}

/**
 * FFPROBEで取得したチャプター情報
 */
export interface FFProbeChapter {
  /** チャプターID */
  id: number
  /** チャプタータイトル */
  title?: string
  /** 開始時刻（秒単位） */
  startTime: number
  /** 終了時刻（秒単位） */
  endTime: number
}

/**
 * FFPROBE実行サービス
 * 動画ファイルのメタデータ解析を行う
 */
export class FFProbeService {
  /**
   * 動画ファイルを解析し、メタデータ・キーフレーム・チャプター情報を取得します。
   * @param filePath - 解析対象の動画ファイルの絶対パス
   * @returns 動画メタデータ、キーフレーム情報、チャプター情報を含むオブジェクト
   * @throws {Error} ファイルが存在しない、またはFFPROBEの実行に失敗した場合
   */
  static async analyzeVideo(filePath: string): Promise<FFProbeResult> {
    // ファイルの存在確認
    if (!existsSync(filePath)) {
      throw new Error(`ファイルが存在しません: ${filePath}`)
    }

    // 1. 基本メタデータを取得
    const metadata = await this.getMetadata(filePath)

    // 2. キーフレーム情報を取得
    const keyframes = await this.getKeyframes(filePath)

    // 3. チャプター情報を取得
    const chapters = await this.getChapters(filePath)

    return {
      ...metadata,
      keyframes,
      chapters
    }
  }

  /**
   * 動画ファイルの基本メタデータを取得します。
   * @param filePath - 動画ファイルの絶対パス
   * @returns 基本メタデータ
   * @throws {Error} FFPROBEの実行に失敗した場合
   */
  private static async getMetadata(filePath: string): Promise<{
    duration: number
    videoCodec: string
    audioCodec: string
    width?: number
    height?: number
    frameRate?: number
  }> {
    const command = `ffprobe -v error -show_entries format=duration:stream=codec_name,width,height,r_frame_rate -select_streams v:0 -of json "${filePath}"`

    try {
      const { stdout } = await execAsync(command)
      const data = JSON.parse(stdout)

      // 動画ストリーム情報を取得
      const videoStream = data.streams?.[0]
      const format = data.format

      if (!videoStream) {
        throw new Error('動画ストリームが見つかりません')
      }

      // フレームレートを計算（例: "30/1" -> 30.0）
      let frameRate: number | undefined
      if (videoStream.r_frame_rate) {
        const [num, den] = videoStream.r_frame_rate.split('/').map(Number)
        frameRate = den !== 0 ? num / den : undefined
      }

      // 音声ストリームを取得
      const audioCommand = `ffprobe -v error -show_entries stream=codec_name -select_streams a:0 -of json "${filePath}"`
      const { stdout: audioStdout } = await execAsync(audioCommand)
      const audioData = JSON.parse(audioStdout)
      const audioStream = audioData.streams?.[0]

      return {
        duration: parseFloat(format?.duration ?? '0'),
        videoCodec: videoStream.codec_name ?? 'unknown',
        audioCodec: audioStream?.codec_name ?? 'unknown',
        width: videoStream.width ? parseInt(videoStream.width, 10) : undefined,
        height: videoStream.height
          ? parseInt(videoStream.height, 10)
          : undefined,
        frameRate
      }
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`FFPROBEメタデータ取得エラー: ${error.message}`)
      }
      throw error
    }
  }

  /**
   * 動画ファイルのキーフレーム位置を取得します。
   * @param filePath - 動画ファイルの絶対パス
   * @returns キーフレーム位置のリスト（秒単位）
   * @throws {Error} FFPROBEの実行に失敗した場合
   */
  private static async getKeyframes(filePath: string): Promise<number[]> {
    // 提供されたコマンドを使用してキーフレームを取得
    // ffprobe -loglevel error -select_streams v:0 -show_entries packet=pts_time,flags -of csv=print_section=0 input.mp4 | awk -F',' '/K/ {print $1}'
    const command = `ffprobe -loglevel error -select_streams v:0 -show_entries packet=pts_time,flags -of csv=print_section=0 "${filePath}" | awk -F',' '/K/ {print $1}'`

    try {
      const { stdout } = await execAsync(command)
      // 出力を改行で分割し、空行を除外して数値に変換
      const keyframes = stdout
        .trim()
        .split('\n')
        .filter((line) => line.trim() !== '')
        .map((line) => parseFloat(line.trim()))
        .filter((value) => !isNaN(value))

      return keyframes
    } catch (error) {
      // awkコマンドが失敗する可能性があるため、フォールバック処理
      // Windows環境ではawkが使えない可能性があるため、Node.jsで処理
      return this.getKeyframesFallback(filePath)
    }
  }

  /**
   * キーフレーム取得のフォールバック処理（awkが使えない環境用）
   * @param filePath - 動画ファイルの絶対パス
   * @returns キーフレーム位置のリスト（秒単位）
   */
  private static async getKeyframesFallback(
    filePath: string
  ): Promise<number[]> {
    const command = `ffprobe -loglevel error -select_streams v:0 -show_entries packet=pts_time,flags -of csv=print_section=0 "${filePath}"`

    try {
      const { stdout } = await execAsync(command)
      // CSV形式の出力を解析
      const lines = stdout.trim().split('\n')
      const keyframes: number[] = []

      for (const line of lines) {
        if (line.trim() === '') continue

        // CSV形式: pts_time,flags
        const parts = line.split(',')
        if (parts.length >= 2) {
          const ptsTime = parts[0]?.trim()
          const flags = parts[1]?.trim()

          // キーフレームフラグ（K）が含まれているか確認
          if (flags?.includes('K') && ptsTime) {
            const timestamp = parseFloat(ptsTime)
            if (!isNaN(timestamp)) {
              keyframes.push(timestamp)
            }
          }
        }
      }

      return keyframes
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`キーフレーム取得エラー: ${error.message}`)
      }
      throw error
    }
  }

  /**
   * 動画ファイルのチャプター情報を取得します。
   * @param filePath - 動画ファイルの絶対パス
   * @returns チャプター情報のリスト
   */
  private static async getChapters(filePath: string): Promise<FFProbeChapter[]> {
    // ffprobeのチャプター情報は、start/end（タイムベース単位）とstart_time/end_time（秒単位）の両方を提供
    // tags.title にタイトルが含まれる場合がある
    const command = `ffprobe -v error -show_entries chapter=id,start_time,end_time:chapter_tags=title -of json "${filePath}"`

    try {
      const { stdout } = await execAsync(command)
      const data = JSON.parse(stdout)

      if (!data.chapters || data.chapters.length === 0) {
        return []
      }

      return data.chapters.map((chapter: any, index: number) => {
        // チャプター情報の取得
        // start_time/end_time が存在する場合はそれを使用、なければ start/end を time_base で割る
        let startTime = 0
        let endTime = 0

        if (chapter.start_time !== undefined && chapter.start_time !== null) {
          startTime = parseFloat(chapter.start_time)
        } else if (chapter.start !== undefined && chapter.time_base !== undefined) {
          const timeBase = parseFloat(chapter.time_base)
          startTime = timeBase !== 0 ? parseFloat(chapter.start) * timeBase : 0
        }

        if (chapter.end_time !== undefined && chapter.end_time !== null) {
          endTime = parseFloat(chapter.end_time)
        } else if (chapter.end !== undefined && chapter.time_base !== undefined) {
          const timeBase = parseFloat(chapter.time_base)
          endTime = timeBase !== 0 ? parseFloat(chapter.end) * timeBase : 0
        }

        // タイトルは tags.title に含まれる場合がある
        const title = chapter.tags?.title ?? chapter.title ?? undefined

        return {
          id: chapter.id !== undefined ? parseInt(String(chapter.id), 10) : index,
          title,
          startTime,
          endTime
        }
      })
    } catch (error) {
      // チャプターが存在しない場合は空配列を返す
      // エラーをログに出力（デバッグ用）
      if (error instanceof Error) {
        console.warn(`チャプター情報の取得中にエラーが発生しました: ${error.message}`)
      }
      return []
    }
  }
}

