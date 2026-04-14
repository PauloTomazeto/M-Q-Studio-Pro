/**
 * Axios Retry Interceptor
 *
 * Responsabilidades:
 * - Retry automático com exponential backoff
 * - Jitter para evitar thundering herd
 * - Detecção de erros retryable
 * - Logging de tentativas
 */

import axios, { AxiosInstance, AxiosError } from 'axios';
import { createLogger } from './logger';

const logger = createLogger('AxiosRetry');

export interface RetryConfig {
  MAX_RETRIES: number;
  INITIAL_DELAY: number;      // ms
  MAX_DELAY: number;           // ms
  BACKOFF_MULTIPLIER: number;
  JITTER: boolean;
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  MAX_RETRIES: 3,
  INITIAL_DELAY: 1000,        // 1s
  MAX_DELAY: 10000,            // 10s
  BACKOFF_MULTIPLIER: 2,      // exponential
  JITTER: true                 // +/- 10%
};

// Códigos de status que devem ser retentados
const RETRYABLE_STATUS_CODES = [
  408, // Request Timeout
  429, // Too Many Requests
  500, // Internal Server Error
  502, // Bad Gateway
  503, // Service Unavailable
  504  // Gateway Timeout
];

/**
 * Verifica se erro é retryable
 */
function isRetryableError(error: any): boolean {
  // Network error (sem response) = retryable
  if (!error.response) {
    return true;
  }

  // Status code retryable
  return RETRYABLE_STATUS_CODES.includes(error.response.status);
}

/**
 * Calcula delay com exponential backoff + jitter
 */
function calculateDelay(
  attemptNumber: number,
  config: RetryConfig
): number {
  // Exponential backoff: initial * (multiplier ^ attempt)
  let delay = config.INITIAL_DELAY *
    Math.pow(config.BACKOFF_MULTIPLIER, attemptNumber);

  // Cap no máximo
  delay = Math.min(delay, config.MAX_DELAY);

  // Adicionar jitter (+/- 10%)
  if (config.JITTER) {
    const jitterAmount = delay * 0.1;
    delay += (Math.random() - 0.5) * 2 * jitterAmount;
  }

  return Math.round(delay);
}

/**
 * Sleep helper
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Cria cliente Axios com retry automático
 */
export function createRetryableClient(
  config: Partial<RetryConfig> = {}
): AxiosInstance {
  const mergedConfig: RetryConfig = {
    ...DEFAULT_RETRY_CONFIG,
    ...config
  };

  const client = axios.create();

  // Interceptor de resposta (tratamento de erro)
  client.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
      const config = error.config as any;

      // Inicializar retry count se necessário
      if (!config.retryCount) {
        config.retryCount = 0;
      }

      // Não retryable ou já excedeu limite
      if (
        !isRetryableError(error) ||
        config.retryCount >= mergedConfig.MAX_RETRIES
      ) {
        return Promise.reject(error);
      }

      // Incrementar tentativa
      config.retryCount++;

      // Calcular delay
      const delayMs = calculateDelay(
        config.retryCount - 1,
        mergedConfig
      );

      logger.warn('RETRY_ATTEMPT', {
        attempt: config.retryCount,
        maxRetries: mergedConfig.MAX_RETRIES,
        delayMs,
        statusCode: error.response?.status,
        errorMessage: error.message,
        url: config.url
      });

      // Aguardar antes de retry
      await sleep(delayMs);

      // Retry
      return client(config);
    }
  );

  return client;
}

export { isRetryableError, calculateDelay, sleep };
export default { createRetryableClient };
