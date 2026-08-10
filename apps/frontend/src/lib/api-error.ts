import { isAxiosError } from 'axios';

export interface ApiProblem {
  status: number | null;
  code: string;
  message: string;
  details: Record<string, unknown>;
}

export function getApiProblem(error: unknown, fallback = 'The request could not be completed'): ApiProblem {
  if (isAxiosError(error)) {
    const body = error.response?.data as {
      error?: { code?: unknown; message?: unknown; details?: unknown };
    } | undefined;
    const problem = body?.error;
    return {
      status: error.response?.status ?? null,
      code: typeof problem?.code === 'string' ? problem.code : 'REQUEST_FAILED',
      message: typeof problem?.message === 'string' ? problem.message : fallback,
      details: problem?.details && typeof problem.details === 'object'
        ? problem.details as Record<string, unknown>
        : {},
    };
  }
  return {
    status: null,
    code: 'CLIENT_ERROR',
    message: error instanceof Error && error.message ? error.message : fallback,
    details: {},
  };
}

export function getApiErrorMessage(error: unknown, fallback?: string) {
  return getApiProblem(error, fallback).message;
}
