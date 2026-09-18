'use client';
import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[GlobalError]', error);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ fontFamily: 'system-ui, sans-serif', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', gap: '1rem', padding: '2rem', textAlign: 'center', background: '#0f0f0f', color: '#f5f5f5' }}>
        <div style={{ fontSize: '2.5rem' }}>🍋</div>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Something went wrong</h1>
        <p style={{ color: '#a1a1aa', maxWidth: '400px' }}>An unexpected error occurred. Our team has been notified. Please try again.</p>
        {error.digest && <p style={{ fontSize: '0.75rem', color: '#52525b' }}>Error ID: {error.digest}</p>}
        <button
          onClick={reset}
          style={{ marginTop: '1rem', padding: '0.625rem 1.5rem', background: '#eab308', color: '#000', borderRadius: '0.5rem', border: 'none', fontWeight: 600, cursor: 'pointer', fontSize: '0.875rem' }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
