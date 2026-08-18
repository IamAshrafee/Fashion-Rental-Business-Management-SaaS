export interface DomainRecoveryAction {
  code: string;
  label: string;
  href?: string;
}

export interface DomainBlocker {
  code: string;
  message: string;
  entityId?: string;
  count?: number;
  amountMinor?: number;
}

export class OperationsDomainError extends Error {
  readonly name = 'OperationsDomainError';

  constructor(
    readonly code: string,
    message: string,
    readonly blockers: DomainBlocker[] = [],
    readonly recoveryActions: DomainRecoveryAction[] = [],
    readonly currentVersion?: number,
  ) {
    super(message);
    Error.captureStackTrace(this, OperationsDomainError);
  }
}
