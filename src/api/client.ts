export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export async function apiClient<T>(_path: string, _options?: unknown): Promise<T> {
  throw new ApiError("İstek tamamlanamadı.", 0);
}
