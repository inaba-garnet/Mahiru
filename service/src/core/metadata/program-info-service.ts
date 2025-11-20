import { existsSync, readFileSync } from 'node:fs'
import { basename, extname } from 'node:path'
import { ProgramInfo } from '../video-scan-service'

/**
 * 番組情報取得サービス
 * EDCBの.program.txtファイルから番組情報を取得する
 */
export class ProgramInfoService {
  /**
   * 動画ファイルパスから対応する.program.txtファイルを読み込み、番組情報を取得します。
   * ファイルが存在しない場合は、ファイル名から必須フィールドを推測して返却します。
   * @param videoFilePath - 動画ファイルの絶対パス
   * @returns 番組情報（ファイルが存在しない場合は推測値のみ）
   */
  static async getProgramInfo(
    videoFilePath: string
  ): Promise<ProgramInfo | undefined> {
    // .program.txtファイルのパスを生成
    const programTxtPath = this.getProgramTxtPath(videoFilePath)

    // ファイルの存在確認
    if (!existsSync(programTxtPath)) {
      // ファイルが存在しない場合は、ファイル名から推測
      return this.extractInfoFromFilename(videoFilePath)
    }

    try {
      // Shift-JISでファイルを読み込む
      // Node.jsの標準機能ではShift-JISを直接サポートしていないため、
      // Bufferとして読み込んでから変換する
      const buffer = readFileSync(programTxtPath)
      const text = this.convertShiftJisToUtf8(buffer)

      // ファイル内容をパース
      return this.parseProgramTxt(text, videoFilePath)
    } catch (error) {
      // ファイルの読み込みに失敗した場合は、ファイル名から推測
      console.warn(
        `.program.txtファイルの読み込みに失敗しました: ${programTxtPath}`,
        error
      )
      return this.extractInfoFromFilename(videoFilePath)
    }
  }

  /**
   * 動画ファイルパスから対応する.program.txtファイルのパスを生成します。
   * @param videoFilePath - 動画ファイルの絶対パス
   * @returns .program.txtファイルの絶対パス
   */
  private static getProgramTxtPath(videoFilePath: string): string {
    return `${videoFilePath}.program.txt`
  }

  /**
   * Shift-JISエンコードされたBufferをUTF-8文字列に変換します。
   * @param buffer - Shift-JISエンコードされたBuffer
   * @returns UTF-8文字列
   */
  private static convertShiftJisToUtf8(buffer: Buffer): string {
    // iconv-liteが利用可能な場合はそれを使用、なければ簡易的な変換を試みる
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const iconv = require('iconv-lite')
      return iconv.decode(buffer, 'shift_jis')
    } catch {
      // iconv-liteが利用できない場合は、UTF-8として解釈を試みる
      // （実際にはShift-JISなので文字化けする可能性があるが、エラーは出さない）
      return buffer.toString('utf-8')
    }
  }

  /**
   * .program.txtファイルの内容をパースして番組情報を抽出します。
   * @param content - .program.txtファイルの内容（UTF-8文字列）
   * @param videoFilePath - 動画ファイルのパス（ファイル名推測用）
   * @returns 番組情報
   */
  private static parseProgramTxt(
    content: string,
    videoFilePath: string
  ): ProgramInfo {
    const lines = content.split(/\r?\n/)
    const programInfo: ProgramInfo = {}

    // 1行目: 放送日時（例: 2025/10/12(日) 16:30〜17:00）
    if (lines[0]) {
      const onAirDate = this.parseOnAirDate(lines[0].trim())
      if (onAirDate) {
        programInfo.onAirDate = onAirDate
      }
    }

    // 2行目: チャンネル名
    if (lines[1]) {
      programInfo.channelName = this.convertToHalfWidth(lines[1].trim())
    }

    // 3行目と5行目: 番組名（改行を挟んで5行目）
    const titleParts: string[] = []
    if (lines[2]) {
      titleParts.push(lines[2].trim())
    }
    // 4行目が空行で、5行目が存在する場合
    if (lines[3]?.trim() === '' && lines[4]) {
      titleParts.push(lines[4].trim())
    }
    if (titleParts.length > 0) {
      const title = titleParts.join('\n')
      programInfo.title = this.convertToHalfWidth(title)
      programInfo.originalTitle = this.convertToHalfWidth(title)
    }

    // 「詳細情報」から始まる行の分を取得
    let detailStartIndex = -1
    for (let i = 0; i < lines.length; i++) {
      if (lines[i]?.trim().startsWith('詳細情報')) {
        detailStartIndex = i
        break
      }
    }

    if (detailStartIndex >= 0) {
      // 「ジャンル : 」の行を探す
      let genreStartIndex = -1
      for (let i = detailStartIndex; i < lines.length; i++) {
        if (lines[i]?.trim().startsWith('ジャンル :')) {
          genreStartIndex = i
          break
        }
      }

      // 詳細情報の終了位置（ジャンル行の前まで）
      const detailEndIndex =
        genreStartIndex >= 0 ? genreStartIndex : lines.length

      // 詳細情報を抽出
      const descriptionLines: string[] = []
      for (let i = detailStartIndex; i < detailEndIndex; i++) {
        const line = lines[i]?.trim()
        if (line) {
          descriptionLines.push(line)
        }
      }

      if (descriptionLines.length > 0) {
        programInfo.description = this.convertToHalfWidth(
          descriptionLines.join('\n')
        )
      }

      // ジャンル: 「ジャンル : 」の次の1行だけ
      if (genreStartIndex >= 0 && lines[genreStartIndex + 1]) {
        const genreLine = lines[genreStartIndex + 1]?.trim()
        if (genreLine) {
          programInfo.genre = this.convertToHalfWidth(genreLine)
        }
      }
    }

    // ファイル名からも情報を抽出（補完用）
    const filenameInfo = this.extractInfoFromFilename(videoFilePath)
    if (!programInfo.title && filenameInfo?.title) {
      programInfo.title = filenameInfo.title
    }
    if (!programInfo.originalTitle && filenameInfo?.originalTitle) {
      programInfo.originalTitle = filenameInfo.originalTitle
    }

    return programInfo
  }

  /**
   * 放送日時の文字列をパースしてDateオブジェクトに変換します。
   * @param dateStr - 放送日時の文字列（例: "2025/10/12(日) 16:30〜17:00"）
   * @returns Dateオブジェクト（パースに失敗した場合は undefined）
   */
  private static parseOnAirDate(dateStr: string): Date | undefined {
    try {
      // 例: "2025/10/12(日) 16:30〜17:00" から "2025/10/12 16:30" を抽出
      const match = dateStr.match(/(\d{4})\/(\d{1,2})\/(\d{1,2})[^\d]*(\d{1,2}):(\d{2})/)
      if (match) {
        const year = parseInt(match[1] ?? '0', 10)
        const month = parseInt(match[2] ?? '0', 10) - 1 // 月は0ベース
        const day = parseInt(match[3] ?? '0', 10)
        const hour = parseInt(match[4] ?? '0', 10)
        const minute = parseInt(match[5] ?? '0', 10)

        return new Date(year, month, day, hour, minute)
      }
    } catch (error) {
      // パースに失敗した場合は undefined を返す
    }
    return undefined
  }

  /**
   * 動画ファイル名から番組情報を推測して抽出します。
   * @param videoFilePath - 動画ファイルの絶対パス
   * @returns 推測された番組情報
   */
  private static extractInfoFromFilename(
    videoFilePath: string
  ): ProgramInfo | undefined {
    const filename = basename(videoFilePath, extname(videoFilePath))

    // ファイル名からタイトルを抽出
    // 例: "202510121630010102-ウマ娘　シンデレラグレイ　第１５話「僕達の物語」[字]"
    // 先頭の日時部分を除去
    const titleMatch = filename.match(/^\d{14}\d{4}-(.+)$/)
    if (titleMatch) {
      const title = titleMatch[1] ?? filename
      return {
        title: this.convertToHalfWidth(title),
        originalTitle: this.convertToHalfWidth(title)
      }
    }

    // マッチしない場合はファイル名全体をタイトルとして使用
    return {
      title: this.convertToHalfWidth(filename),
      originalTitle: this.convertToHalfWidth(filename)
    }
  }

  /**
   * ASCII文字を全角から半角に変換します。
   * @param str - 変換対象の文字列
   * @returns 変換後の文字列
   */
  private static convertToHalfWidth(str: string): string {
    return str
      .replace(/[！-～]/g, (char) => {
        // 全角ASCII文字（！～）を半角に変換
        return String.fromCharCode(char.charCodeAt(0) - 0xfee0)
      })
      .replace(/　/g, ' ') // 全角スペースを半角スペースに
      .replace(/[０-９]/g, (char) => {
        // 全角数字を半角に変換
        return String.fromCharCode(char.charCodeAt(0) - 0xfee0)
      })
      .replace(/[Ａ-Ｚ]/g, (char) => {
        // 全角英大文字を半角に変換
        return String.fromCharCode(char.charCodeAt(0) - 0xfee0)
      })
      .replace(/[ａ-ｚ]/g, (char) => {
        // 全角英小文字を半角に変換
        return String.fromCharCode(char.charCodeAt(0) - 0xfee0)
      })
  }
}

