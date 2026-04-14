/**
 * Circuit Breaker Pattern
 *
 * Responsabilidades:
 * - Impedir cascata de falhas
 * - Estados: CLOSED → OPEN → HALF_OPEN
 * - Timeout antes de HALF_OPEN
 * - Métricas de falhas/sucessos
 */

import { createLogger } from './logger';

const logger = createLogger('CircuitBreaker');

export type CircuitBreakerState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreakerConfig {
  failureThreshold: number;    // Falhas antes de abrir
  successThreshold: number;    // Sucessos para fechar
  timeout: number;             // ms antes de tentar HALF_OPEN
  name?: string;               // Para logging
}

export interface CircuitBreakerMetrics {
  state: CircuitBreakerState;
  failureCount: number;
  successCount: number;
  lastFailureTime: number | null;
  totalFailures: number;       // histórico
  totalSuccesses: number;      // histórico
}

export class CircuitBreaker {
  private state: CircuitBreakerState = 'CLOSED';
  private failureCount = 0;
  private successCount = 0;
  private lastFailureTime: number | null = null;
  private totalFailures = 0;
  private totalSuccesses = 0;
  private config: CircuitBreakerConfig;
  private name: string;

  constructor(config: CircuitBreakerConfig) {
    this.config = config;
    this.name = config.name || 'CircuitBreaker';

    logger.info(`${this.name} initialized`, {
      failureThreshold: config.failureThreshold,
      successThreshold: config.successThreshold,
      timeoutMs: config.timeout
    });
  }

  /**
   * Executa função com proteção do circuit breaker
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    // Se aberto, verificar se pode tentar HALF_OPEN
    if (this.state === 'OPEN') {
      const now = Date.now();
      const timeSinceLastFailure = now - (this.lastFailureTime || 0);

      if (timeSinceLastFailure >= this.config.timeout) {
        logger.info(`${this.name} transitioning to HALF_OPEN`, {
          timeSinceLastFailure,
          timeout: this.config.timeout
        });
        this.state = 'HALF_OPEN';
        this.successCount = 0; // Reset success counter
      } else {
        // Ainda aberto
        logger.warn(`${this.name} is OPEN, rejecting request`, {
          timeSinceLastFailure,
          willRetryIn: this.config.timeout - timeSinceLastFailure
        });
        const error = new Error(
          `${this.name} is OPEN. Service temporarily unavailable.`
        );
        (error as any).code = 'CIRCUIT_OPEN';
        throw error;
      }
    }

    // Executar função
    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  /**
   * Callback de sucesso
   */
  private onSuccess(): void {
    this.totalSuccesses++;

    if (this.state === 'CLOSED') {
      // Em CLOSED, reset counter de falhas em sucesso
      this.failureCount = 0;
      logger.debug(`${this.name}: success in CLOSED state`, {
        failureCount: this.failureCount
      });
    } else if (this.state === 'HALF_OPEN') {
      // Em HALF_OPEN, contar sucessos
      this.successCount++;

      logger.debug(`${this.name}: success in HALF_OPEN state`, {
        successCount: this.successCount,
        threshold: this.config.successThreshold
      });

      // Se atingiu threshold, fechar
      if (this.successCount >= this.config.successThreshold) {
        this.state = 'CLOSED';
        this.failureCount = 0;
        this.successCount = 0;

        logger.info(`${this.name} CLOSED (recovered)`, {
          totalSuccesses: this.totalSuccesses,
          totalFailures: this.totalFailures
        });
      }
    }
  }

  /**
   * Callback de falha
   */
  private onFailure(): void {
    this.totalFailures++;
    this.lastFailureTime = Date.now();

    if (this.state === 'CLOSED') {
      // Em CLOSED, contar falhas
      this.failureCount++;

      logger.warn(`${this.name}: failure in CLOSED state`, {
        failureCount: this.failureCount,
        threshold: this.config.failureThreshold
      });

      // Se atingiu threshold, abrir
      if (this.failureCount >= this.config.failureThreshold) {
        this.state = 'OPEN';
        logger.error(`${this.name} OPEN (threshold exceeded)`, {
          failureCount: this.failureCount,
          threshold: this.config.failureThreshold,
          willRetryIn: `${this.config.timeout}ms`
        });
      }
    } else if (this.state === 'HALF_OPEN') {
      // Em HALF_OPEN, qualquer erro volta para OPEN
      this.state = 'OPEN';
      this.failureCount = 0;
      this.successCount = 0;

      logger.warn(`${this.name} OPEN (failed while HALF_OPEN)`, {
        willRetryIn: `${this.config.timeout}ms`
      });
    }
  }

  /**
   * Retorna métricas atuais
   */
  getMetrics(): CircuitBreakerMetrics {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      lastFailureTime: this.lastFailureTime,
      totalFailures: this.totalFailures,
      totalSuccesses: this.totalSuccesses
    };
  }

  /**
   * Reset manual (para testes)
   */
  reset(): void {
    this.state = 'CLOSED';
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = null;
    logger.info(`${this.name} reset manually`);
  }
}

/**
 * Configuração padrão para API KIE
 */
export const kieApiCircuitBreakerConfig: CircuitBreakerConfig = {
  failureThreshold: 5,   // Abrir depois de 5 falhas
  successThreshold: 3,   // Fechar depois de 3 sucessos
  timeout: 30000,        // 30 segundos antes de tentar HALF_OPEN
  name: 'KIE-API'
};

/**
 * Instance para KIE API (singleton)
 */
export const kieApiBreaker = new CircuitBreaker(kieApiCircuitBreakerConfig);

export default { CircuitBreaker, kieApiBreaker };
