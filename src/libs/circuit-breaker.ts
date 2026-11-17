export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreakerOptions {
  failureThreshold?: number;
  resetTimeoutMs?: number;
  nowFn?: () => number;
  onStateChange?: (from: CircuitState, to: CircuitState) => void;
  onOpenTrip?: () => void;
}

export class CircuitOpenError extends Error {
  constructor(message = 'Circuit breaker is OPEN; skipping request') {
    super(message);
    this.name = 'CircuitOpenError';
  }
}

export class CircuitBreaker {
  private readonly failureThreshold: number;
  private readonly resetTimeoutMs: number;
  private readonly nowFn: () => number;
  private readonly onStateChange?: (from: CircuitState, to: CircuitState) => void;
  private readonly onOpenTrip?: () => void;

  private state: CircuitState = 'CLOSED';
  private consecutiveFailures = 0;
  private openedAtMs = 0;

  constructor(options: CircuitBreakerOptions = {}) {
    this.failureThreshold = options.failureThreshold ?? 5;
    this.resetTimeoutMs = options.resetTimeoutMs ?? 10_000;
    this.nowFn = options.nowFn ?? (() => Date.now());
    this.onStateChange = options.onStateChange;
    this.onOpenTrip = options.onOpenTrip;
  }

  public getState(): CircuitState {
    if (this.state === 'OPEN' && this.nowFn() - this.openedAtMs >= this.resetTimeoutMs) {
      this.transition('HALF_OPEN');
    }
    return this.state;
  }

  public allowRequest(): boolean {
    const current = this.getState();
    return current === 'CLOSED' || current === 'HALF_OPEN';
  }

  public recordSuccess(): void {
    this.consecutiveFailures = 0;
    if (this.state !== 'CLOSED') {
      this.transition('CLOSED');
    }
  }

  public recordFailure(): void {
    this.consecutiveFailures++;
    if (this.state === 'HALF_OPEN' || this.consecutiveFailures >= this.failureThreshold) {
      this.openedAtMs = this.nowFn();
      if (this.state !== 'OPEN') {
        this.transition('OPEN');
        this.onOpenTrip?.();
      }
    }
  }

  private transition(next: CircuitState): void {
    const prev = this.state;
    this.state = next;
    this.onStateChange?.(prev, next);
  }
}
