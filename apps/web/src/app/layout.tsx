import type { Metadata } from 'next';
import { ClerkProvider } from '@clerk/nextjs';
import { dark } from '@clerk/themes';
import './globals.css';

export const metadata: Metadata = {
  title: 'Xeno Copilot — the CRM that does the work',
  description:
    'AI-native mini CRM. Tell the copilot what you want — it finds the audience, drafts the message, picks the channel, and reports back.',
};

// Inline script runs before React hydrates — prevents a flash of the wrong
// theme on first paint by reading localStorage synchronously.
const themeScript = `
(function() {
  try {
    var t = localStorage.getItem('xeno-theme') || 'dark';
    document.documentElement.setAttribute('data-theme', t);
  } catch (e) {
    document.documentElement.setAttribute('data-theme', 'dark');
  }
})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider
      appearance={{
        baseTheme: dark,
        variables: {
          colorPrimary: '#7C3AED',
          fontFamily: 'Inter, system-ui, sans-serif',
          borderRadius: '12px',
        },
        elements: {
          card: 'shadow-2xl border border-white/10',
        },
      }}
    >
      <html lang="en" suppressHydrationWarning>
        <head>
          <script dangerouslySetInnerHTML={{ __html: themeScript }} />
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
          <link
            href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap"
            rel="stylesheet"
          />
        </head>
        <body className="min-h-screen">{children}</body>
      </html>
    </ClerkProvider>
  );
}
