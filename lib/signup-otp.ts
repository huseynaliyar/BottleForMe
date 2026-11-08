export function authErrorCode(error: unknown) {
  if (error && typeof error === 'object' && 'code' in error) return error.code;
}

export function signupCodeError(error: unknown, action: 'verify' | 'resend') {
  switch (authErrorCode(error)) {
    case 'otp_expired':
      return 'That code is incorrect, expired, or already used. Check your latest email or request a new code.';
    case 'over_request_rate_limit':
    case 'over_email_send_rate_limit':
      return 'Too many requests. Wait before trying again.';
    case 'email_address_not_authorized':
      return 'This email address cannot receive verification emails from the current sender.';
    default:
      return error instanceof Error ? error.message : action === 'verify'
        ? 'Could not verify the code. Try again.'
        : 'Could not send another code. Try again.';
  }
}
