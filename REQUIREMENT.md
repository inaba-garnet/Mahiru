# Mahiru 要件定義書

**Version:** 1.0
**Status:** Draft
**Date:** 2025-11-20

## 1. プロジェクト概要
### 1.1 目的
ローカルに保存されたテレビ録画データ（TS, MP4, MKV）を、ブラウザ経由で快適にストリーミング視聴するためのWebアプリケーション（メディアサーバー）を開発する。

### 1.2 主要な特徴
* **スマートトランスコード:** 不要な再エンコードを回避し、可能な限りストリームコピー（Remux）を行うことでCPU負荷を低減する。
* **HLS配信:** HTTP Live Streamingプロトコルを使用し、Web標準技術での再生を実現する。
* **シーク最適化:** 長時間動画でも、未生成部分への即座なシークを可能にする。
* **EDCB連携:** 録画データに付随する番組情報テキスト（EDCB出力）を自動で読み込み、ライブラリを構築する。

## 2. システム構成
### 2.1 技術スタック
| 区分 | 技術要素 | 備考 |
| :--- | :--- | :--- |
| **Backend** | Node.js + TypeScript | Framework: **Fastify** |
| **Frontend** | Vue.js | TypeScript使用 |
| **Database** | SQLite | `better-sqlite3` または `kysely` 利用 |
| **Media Engine** | FFmpeg / ffprobe | サーバーローカルにインストール |
| **OS/Env** | Linux (Docker) | 開発はWindows (WSL2) |

### 2.2 動作環境
* **Hardware Acceleration:** 未使用（CPUエンコードのみ）
* **Concurrency:** トランスコード最大同時実行数 **2**（ストリームコピーは制限対象外）

## 3. 機能要件

### 3.1 ストリーミング・配信ロジック
**プロトコル:** HLS (m3u8 + ts)

#### A. トランスコード判定フロー
リクエスト時に以下の条件で処理を分岐する。

1.  **ストリームコピー (Remux):**
    * **条件:** 入力が `H.264` である、または 入力が `H.265` かつクライアントが再生対応している場合。
    * **処理:** 映像は無劣化コピー。音声は `AAC 2ch` に変換。コンテナをMPEG-TSへ入れ替え。
2.  **トランスコード (Encode):**
    * **条件:** 上記以外（例: MPEG2-TS, クライアント非対応のH.265）。
    * **処理:** 映像を `H.264` (libx264, preset: veryfast) に変換。音声は `AAC 2ch` に変換。

#### B. プレイリスト生成戦略
1.  **コピー時:** 事前スキャンした「キーフレーム情報」に基づき、正確なセグメント分割点を持つプレイリストを生成。
2.  **トランスコード時:** 動画の総時間(`Duration`)に基づき、固定長（例: 6秒）で計算上の**仮想プレイリスト**を生成して返す。エンコード時は `-force_key_frames` で強制的にキーフレームを挿入し、ズレを防ぐ。

#### C. シーク最適化 (Smart Seek)
* **判定:** クライアントが要求したセグメントIDと、サーバーで処理中のセグメントIDの距離(`Distance`)を計算。
* **閾値:** 設定値 `SEEK_THRESHOLD_SEGMENTS` (初期値: 2)
* **挙動:**
    * `Distance < Threshold`: 既存プロセスを維持。ファイル生成を待機（Long Polling）。
    * `Distance >= Threshold`: **既存プロセスを破棄**し、要求された位置から新規エンコードプロセスを起動。

#### D. その他メディア処理
* **音声:** 常に `AAC 2ch` (Stereo) にダウンミックス・変換。
* **字幕:** 字幕ストリームがある場合、`WebVTT` 形式として抽出し、HLSマニフェストに記述（Softsub）。
* **一時ファイル:** 最終アクセスから一定時間（例: 2時間）経過したセグメント・プレイリストは自動削除。

### 3.2 セッション管理
* **識別:** フロントエンド生成のUUID (`X-Session-ID`) でユーザーを識別。
* **並列制限:**
    * トランスコードを伴うセッションのみ、同時実行数を **最大2** に制限。
    * 3つ目のリクエストが来た場合は `HTTP 503 Service Unavailable` を返却。
* **排他制御:** 同一セッションIDからの新規再生リクエストは、古いプロセスを強制終了して入れ替える（スロットを消費しない）。

### 3.3 ライブラリ・メタデータ管理
* **対象:** 指定ディレクトリ配下の動画ファイル (`.mp4`, `.mkv`, `.ts`)。
* **メタデータソース:** 同名の `.program.txt` (Shift-JIS)。
    * 項目: 番組名、放送日時、説明文、チャンネル名。
* **技術データ取得:** `ffprobe` を使用して以下を取得・DB保存。
    * Duration, Codec, Bitrate, **Keyframe Timestamps** (コピー判定用)。
* **シリーズ管理:** 「番組名」に基づく簡易グルーピング。
* **更新トリガー:**
    * ファイルシステム監視 (chokidar) による自動検知。
    * API経由の手動フルスキャン。

## 4. データモデル (SQLite)

### Tables
* **Videos**
    * `id` (PK, UUID)
    * `path` (Unique)
    * `filename`
    * `duration`
    * `video_codec` / `audio_codec`
    * `scan_status` (scanning, completed, error)
    * `series_id` (FK)
* **Metadata**
    * `video_id` (FK)
    * `title`
    * `description`
    * `on_air_date`
* **Keyframes** (JSONとしてVideosテーブルに持たせるか、別テーブル)
    * `video_id` (FK)
    * `timestamp` (List of seconds)
* **Series**
    * `id` (PK)
    * `title`

## 5. API インターフェース (概要)

### Library
* `GET /api/videos`: 動画一覧取得（検索・フィルタ）
* `GET /api/videos/:id`: 詳細情報取得
* `GET /api/series`: シリーズ一覧取得
* `POST /api/library/scan`: 手動スキャン実行

### Streaming
* `GET /api/stream/:id/index.m3u8`
    * Header: `X-Session-ID`
    * プレイリスト取得（エンコード開始トリガー含む）
* `GET /api/stream/:id/segments/:index.ts`
    * Header: `X-Session-ID`
    * セグメントファイル取得（Wait / Seek / Transcode 制御）
* `GET /api/stream/:id/subs/sub.vtt`: 字幕取得

### System
* `GET /api/config`: クライアント向け設定情報
* `GET /api/status`: 現在のエンコードスロット使用状況など

