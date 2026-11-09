import { useEffect, useRef, useState } from 'react';
import { authErrorCode } from './signup-otp';

const waitMs = 60_000;
const verifyLockMs = 30 * 60_000;

function retrySeconds(error: unknown) {
  return error && typeof error === 'object' && 'retryAfter' in error && typeof error.retryAfter === 'number'
    ? error.retryAfter : undefined;
}

export function useSignupCode() {
  const [resendUntil, setResendUntil] = useState(0);
  const [verifyUntil, setVerifyUntil] = useState(0);
  const [resetUntil, setResetUntil] = useState(0);
  const [now, setNow] = useState(0);
  const failures = useRef<number[]>([]);
  const deadline = Math.max(resendUntil, verifyUntil, resetUntil);

  useEffect(() => {
    if (deadline <= Date.now()) return;
    const timer = setInterval(() => {
      const time = Date.now();
      setNow(time);
      if (time >= deadline) clearInterval(timer);
    }, 250);
    return () => clearInterval(timer);
  }, [deadline]);

  function sent() {
    const time = Date.now();
    setNow(time);
    setResendUntil(time + waitMs);
  }

  function verificationFailed(error: unknown) {
    const code = authErrorCode(error);
    if (code !== 'otp_expired' && code !== 'over_request_rate_limit') return;
    const time = Date.now();
    failures.current = [...failures.current.filter((attempt) => time - attempt < verifyLockMs), time];
    if (failures.current.length >= 5 || code === 'over_request_rate_limit') {
      setNow(time);
      setVerifyUntil(time + (retrySeconds(error) ?? (code === 'over_request_rate_limit' ? 60 : 1800)) * 1000);
    }
  }

  function resetRequested(error?: unknown) {
    const time = Date.now();
    setNow(time);
    setResetUntil(time + (retrySeconds(error) ?? 120) * 1000);
  }

  return {
    sent,
    resetRequested,
    resetSeconds: Math.max(0, Math.ceil((resetUntil - now) / 1000)),
    verificationFailed,
    canResend: () => Date.now() >= resendUntil,
    canVerify: () => Date.now() >= verifyUntil,
    resendSeconds: Math.max(0, Math.ceil((resendUntil - now) / 1000)),
    verifySeconds: Math.max(0, Math.ceil((verifyUntil - now) / 1000)),
  };
}
