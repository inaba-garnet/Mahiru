import { PrismaClient } from '../generated/prisma'

/**
 * Prismaクライアントのシングルトンインスタンス
 */
let prisma: PrismaClient | null = null

/**
 * Prismaクライアントのインスタンスを取得します。
 * シングルトンパターンで、複数回呼び出されても同じインスタンスを返します。
 * @returns Prismaクライアントのインスタンス
 */
export function getPrismaClient(): PrismaClient {
  if (!prisma) {
    prisma = new PrismaClient()
  }
  return prisma
}

/**
 * Prismaクライアントを切断します。
 * アプリケーション終了時に呼び出してください。
 */
export async function disconnectPrisma(): Promise<void> {
  if (prisma) {
    await prisma.$disconnect()
    prisma = null
  }
}

