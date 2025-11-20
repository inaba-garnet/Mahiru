# AGENTS.md

このドキュメントは、本プロジェクト（個人用動画配信Webアプリ）のコード生成および修正を行うAIアシスタント向けの開発ガイドラインです。
すべてのコード出力と対話は、以下のルールに厳格に従ってください。

## 1\. プロジェクト基本情報

  * **プロジェクト概要:** 録画データ（TS, MP4, MKV）を管理し、HLS形式でブラウザにストリーミング配信するWebアプリケーション。
  * **コア機能:** スマートトランスコード（コピー/エンコードの動的判定）、EDCBメタデータ連携、シリーズ管理、シーク最適化。
  * **開発環境:** Windows (WSL2) / Docker

## 2\. 技術スタック

  * **Runtime:** Node.js (LTS)
  * **Language:** TypeScript (Strict mode)
  * **Framework (Backend):** Fastify
  * **Framework (Frontend):** Vue.js 3 (Composition API)
  * **Database:** SQLite (via Kysely or better-sqlite3)
  * **Tools:** FFmpeg, ESLint, Prettier

## 3\. AI行動指針 (Behavior Rules)

1.  **出力言語:** 解説、コード内のコメント、コミットメッセージ案など、すべてのテキスト出力は **「日本語」** で行ってください。
2.  **TypeScript厳守:** `.js` ではなく `.ts` で記述し、`any` 型の使用は極力避けてください。適切な型定義（Interface/Type）を作成してください。
3.  **Lint準拠:** 生成するコードは、一般的なESLint/Prettierのルールに適合するように整形してください。使用されていない変数の放置や、不適切なインデントは禁止です。
4.  **安全性:** ユーザー入力（パスパラメータ、クエリ）は必ずバリデーション（Zod等を使用）を行ってください。

## 4\. コーディング規約 & JSDocルール

すべての関数、クラス、メソッド、複雑なロジックには、**必ず日本語でJSDoc形式のドキュメント**を記述してください。

### 4.1 JSDoc記述例

```typescript
/**
 * 動画ファイルのストリーム情報を取得し、トランスコードが必要か判定します。
 * * @param videoPath - 解析対象の動画ファイルの絶対パス
 * @param targetCodec - クライアントが要求するターゲットコーデック (デフォルト: 'h264')
 * @returns トランスコード要否と、映像・音声のストリーム情報を含むオブジェクト
 * @throws {FileNotFoundError} 指定されたファイルが存在しない場合
 */
async function analyzeVideoCodec(videoPath: string, targetCodec: string = 'h264'): Promise<AnalysisResult> {
  // ... implementation
}
```

### 4.2 命名規則

  * **変数/関数:** `camelCase` (例: `fetchMetadata`, `isTranscodingNeeded`)
  * **クラス/型:** `PascalCase` (例: `StreamManager`, `VideoEntity`)
  * **定数:** `UPPER_SNAKE_CASE` (例: `MAX_TRANSCODE_LIMIT`)
  * **ファイル名:** `kebab-case.ts` (例: `stream-manager.ts`, `video-controller.ts`)

## 5\. 実装プロセス (Workflow)

AIがコードを生成する際は、以下の思考プロセスを経て出力してください。

1.  **理解:** 要求仕様と既存のコードベース（`stream-manager` 等）との依存関係を理解する。
2.  **型定義:** 必要なインターフェースや型を先に定義する。
3.  **実装:** ロジックを実装する。この際、エッジケース（ファイルが無い、FFmpegが落ちた等）のエラーハンドリングを含める。
4.  **ドキュメント化:** 日本語のJSDocを追加する。
5.  **検証:** 「Lintエラーが出ないか」「型安全性は保たれているか」を自己レビューしてから出力する。

## 6\. ディレクトリ構造 (Backend推奨)

```text
src/
├── api/             # APIルート定義 (Fastify Routes)
│   ├── routes/
│   └── schemas/     # リクエスト/レスポンスのバリデーションスキーマ (Zod)
├── core/            # ビジネスロジック・コア機能
│   ├── ffmpeg/      # FFmpeg制御ラッパー
│   └── manager/     # StreamManagerなど状態管理
├── db/              # データベース接続・マイグレーション
│   ├── migrations/
│   └── repositories/ # データアクセス層
├── types/           # 型定義
└── utils/           # ユーティリティ関数
```

## 7. Git Commit Guidelines

コミットメッセージを生成または提案する場合は、以下のルールに従ってください。

1.  **Format:** `type(scope): subject` の形式を使用すること。
2.  **Types:** `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `chore` から適切なものを選択すること。
3.  **Subject:** 日本語で記述し、「～を追加」「～を修正」のように簡潔に終わらせること。
4.  **Scope:** 変更箇所が明確な場合（例: `api`, `db`, `player`）は記述すること。

**良い例:**
- `feat(core): FFmpegのトランスコード処理にタイムアウトを追加`
- `fix(db): 録画データのスキャン時に重複登録されるバグを修正`

**悪い例:**
- `Update logic` (具体性がない)
- `FFmpegの処理を修正しました。` (Typeがない、冗長)