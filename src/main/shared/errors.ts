import type { AppErrorCode, PublicError } from '../../shared/api'

export class AppError extends Error {
  readonly code: AppErrorCode
  readonly retryable: boolean

  constructor(
    code: AppErrorCode,
    message: string,
    options: { retryable?: boolean; cause?: unknown } = {}
  ) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause })
    this.name = 'AppError'
    this.code = code
    this.retryable = options.retryable ?? false
  }

  toPublic(): PublicError {
    return { code: this.code, message: this.message, retryable: this.retryable }
  }
}

/** Converts any thrown value into the safe subset exposed to the renderer. */
export function toPublicError(error: unknown): PublicError {
  if (error instanceof AppError) {
    return error.toPublic()
  }
  return {
    code: 'UNKNOWN',
    message: '发生未知错误，请稍后重试',
    retryable: false
  }
}
