import axios from "axios";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3000";

export interface ApiErrorShape {
  message: string;
  status: number;
  code: string;
  details?: unknown;
}

export class ApiError extends Error {
  status: number;
  code: string;
  details?: unknown;

  constructor(payload: ApiErrorShape) {
    super(payload.message);
    this.status = payload.status;
    this.code = payload.code;
    this.details = payload.details;
  }
}

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15_000,
  headers: {
    "Content-Type": "application/json",
  },
});

api.interceptors.request.use((config) => {
  if (typeof window === "undefined") {
    return config;
  }

  const token = window.localStorage.getItem("a2_auth_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    if (axios.isAxiosError(error)) {
      const normalized = new ApiError({
        message:
          (error.response?.data as { error?: string } | undefined)?.error ??
          error.message ??
          "Request failed",
        status: error.response?.status ?? 500,
        code: error.code ?? "AXIOS_ERROR",
        details: error.response?.data,
      });
      return Promise.reject(normalized);
    }

    return Promise.reject(
      new ApiError({
        message: "Unknown request error",
        status: 500,
        code: "UNKNOWN_ERROR",
        details: error,
      })
    );
  }
);
