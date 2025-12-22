import { HttpException, HttpStatus } from '@nestjs/common';

export class InsufficientFundsException extends HttpException {
  constructor(message?: string) {
    super(
      {
        statusCode: HttpStatus.UNPROCESSABLE_ENTITY,
        error: 'INSUFFICIENT_FUNDS',
        message: message || 'Insufficient wallet balance',
      },
      HttpStatus.UNPROCESSABLE_ENTITY,
    );
  }
}

export class WalletNotFoundException extends HttpException {
  constructor(userId?: string) {
    super(
      {
        statusCode: HttpStatus.NOT_FOUND,
        error: 'WALLET_NOT_FOUND',
        message: userId
          ? `Wallet for user ${userId} not found`
          : 'Wallet not found',
      },
      HttpStatus.NOT_FOUND,
    );
  }
}

export class DuplicateTransactionException extends HttpException {
  constructor(referenceId?: string) {
    super(
      {
        statusCode: HttpStatus.CONFLICT,
        error: 'DUPLICATE_TRANSACTION',
        message: referenceId
          ? `Transaction with reference ${referenceId} already exists`
          : 'Duplicate transaction detected',
      },
      HttpStatus.CONFLICT,
    );
  }
}

export class WalletOperationFailedException extends HttpException {
  constructor(message?: string) {
    super(
      {
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        error: 'WALLET_OPERATION_FAILED',
        message: message || 'Wallet operation failed',
      },
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }
}

export class UserNotFoundException extends HttpException {
  constructor(userId?: string) {
    super(
      {
        statusCode: HttpStatus.NOT_FOUND,
        error: 'USER_NOT_FOUND',
        message: userId
          ? `User ${userId} not found`
          : 'User not found',
      },
      HttpStatus.NOT_FOUND,
    );
  }
}
