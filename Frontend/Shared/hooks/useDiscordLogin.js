import { useState, useCallback } from 'react';
import { useAuth } from '@Core/Services/AuthService';
import { useLocale } from '@Locales/LocaleProvider';
import { notify } from '@Shared/notifications/notifyCore';

// ─── useDiscordLogin ────────────────────────────────────────────────────────
// Wraps the auth provider's `login()` call with a busy flag and a localized
// error toast. Most call sites just need:
//   const { isLoggingIn, handleLogin } = useDiscordLogin(closeModal)

/**
 * @param {(() => void) | undefined} onSuccess Optional callback fired after
 *   a successful login (e.g. close a modal, navigate).
 * @returns {{ isLoggingIn: boolean, handleLogin: () => Promise<void> }}
 */
export function useDiscordLogin(onSuccess) {
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const { login } = useAuth();
  const t = useLocale();

  const handleLogin = useCallback(async () => {
    setIsLoggingIn(true);
    try {
      const res = await login();
      if (res?.success) {
        onSuccess?.();
      } else if (res?.error) {
        notify.error(t.auth.loginError, res.error);
      }
    } finally {
      setIsLoggingIn(false);
    }
  }, [login, onSuccess, t.auth.loginError]);

  return { isLoggingIn, handleLogin };
}
