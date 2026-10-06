export class AppError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AppError";
  }
}

export function toUserMessage(error: unknown): string {
  if (error instanceof AppError) {
    return error.message;
  }
  return "İşlem tamamlanamadı.";
}
