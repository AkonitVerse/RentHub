import axios, { AxiosError } from 'axios';

export const api = axios.create({
  baseURL: '/api/v1',
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

let refreshPromise: Promise<void> | null = null;

const refreshSession = async (): Promise<void> => {
  if (!refreshPromise) {
    refreshPromise = api
      .post('/auth/refresh')
      .then(() => undefined)
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
};

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as (typeof error.config & { _retried?: boolean }) | undefined;
    if (
      error.response?.status === 401 &&
      original &&
      !original._retried &&
      original.url &&
      !original.url.includes('/auth/login') &&
      !original.url.includes('/auth/refresh')
    ) {
      original._retried = true;
      try {
        await refreshSession();
        return api.request(original);
      } catch {
        return Promise.reject(error);
      }
    }
    return Promise.reject(error);
  },
);

export const isApiError = (
  err: unknown,
): err is AxiosError<{ message: string | string[]; statusCode: number }> => axios.isAxiosError(err);

export const apiErrorMessage = (err: unknown, fallback = 'Ошибка запроса'): string => {
  if (!isApiError(err)) return fallback;
  const data = err.response?.data;
  if (!data) return err.message || fallback;
  const m = data.message;
  if (Array.isArray(m)) return m.join('. ');
  return m || fallback;
};
