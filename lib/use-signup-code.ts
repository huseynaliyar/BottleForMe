import { useEffect, useRef, useState } from 'react';
import { authErrorCode } from './signup-otp';

const waitMs = 60_000;

export function useSignupCode() {
  const [resendUntil, setResendUntil] = useState(0);
  const [verifyUntil, setVerifyUntil] = useState(0);
  const [now, setNow] = useState(0);
  const failures = useRef<number[]>([]);
  const deadline = Math.max(resendUntil, verifyUntil);

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
    failures.current = [...failures.current.filter((attempt) => time - attempt < waitMs), time];
    if (failures.current.length >= 5 || code === 'over_request_rate_limit') {
      setNow(time);
      setVerifyUntil(time + waitMs);
    }
  }

  return {
    sent,
    verificationFailed,
    canResend: () => Date.now() >= resendUntil,
    canVerify: () => Date.now() >= verifyUntil,
    resendSeconds: Math.max(0, Math.ceil((resendUntil - now) / 1000)),
    verifySeconds: Math.max(0, Math.ceil((verifyUntil - now) / 1000)),
  };
}
