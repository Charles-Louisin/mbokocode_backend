export type ErrorCode =
  | "VALIDATION_ERROR"
  | "BAD_REQUEST"
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "PAYLOAD_TOO_LARGE"
  | "RATE_LIMITED"
  | "SERVICE_UNAVAILABLE"
  | "INTERNAL_ERROR";

export type FieldErrors = Record<string, string[] | undefined>;

export type ErrorBody = {
  error: { code: ErrorCode; message: string; fieldErrors?: FieldErrors };
  requestId?: string;
};

export class AppError extends Error {
  constructor(
    readonly status: number,
    readonly code: ErrorCode,
    message: string,
    readonly fieldErrors?: FieldErrors,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export const notFound = (message = "Ressource introuvable.") => new AppError(404, "NOT_FOUND", message);
