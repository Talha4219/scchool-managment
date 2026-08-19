
import type {Metadata} from 'next';
import { Fraunces, Schibsted_Grotesk, Noto_Nastaliq_Urdu } from 'next/font/google';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import { ConfirmProvider } from '@/components/ui/confirm-dialog';
import { LanguageProvider } from '@/hooks/use-language';

const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-display',
  weight: 'variable',
  style: ['normal', 'italic'],
  axes: ['opsz', 'SOFT', 'WONK'],
  display: 'swap',
});

const schibsted = Schibsted_Grotesk({
  subsets: ['latin'],
  variable: '--font-sans',
  weight: ['400', '500', '600', '700'],
  display: 'swap',
});

const notoNastaliq = Noto_Nastaliq_Urdu({
  subsets: ['arabic'],
  variable: '--font-urdu',
  weight: ['400', '600', '700'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Classora | Modern School Management',
  description: 'The ultimate institution resource planning system for modern education.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${fraunces.variable} ${schibsted.variable} ${notoNastaliq.variable}`} suppressHydrationWarning>
      <head>
        <script
          // Runs before paint so theme + language/direction are correct on first frame — no flash.
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('theme');var dark=t?t==='dark':window.matchMedia('(prefers-color-scheme: dark)').matches;document.documentElement.classList.toggle('dark',dark);var lang=localStorage.getItem('lang')||'en';document.documentElement.setAttribute('lang',lang);document.documentElement.setAttribute('dir',lang==='ur'?'rtl':'ltr');document.documentElement.classList.toggle('font-urdu',lang==='ur');}catch(e){}})();`,
          }}
        />
      </head>
      <body className="font-sans antialiased bg-background text-foreground">
        <LanguageProvider>
          <ConfirmProvider>
            {children}
            <Toaster />
          </ConfirmProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}

