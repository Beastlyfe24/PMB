import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';

export const metadata: Metadata = {
  title: 'Polymarket Mirror Bot',
  description: 'Production copy trading bot for Polymarket',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
          <nav className="bg-white dark:bg-gray-800 shadow">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex justify-between h-16">
                <div className="flex space-x-8">
                  <Link
                    href="/leaders"
                    className="inline-flex items-center px-3 py-2 text-sm font-medium text-gray-900 dark:text-gray-100 hover:text-blue-600"
                  >
                    Leaders
                  </Link>
                  <Link
                    href="/feed"
                    className="inline-flex items-center px-3 py-2 text-sm font-medium text-gray-900 dark:text-gray-100 hover:text-blue-600"
                  >
                    Feed
                  </Link>
                  <Link
                    href="/positions"
                    className="inline-flex items-center px-3 py-2 text-sm font-medium text-gray-900 dark:text-gray-100 hover:text-blue-600"
                  >
                    Positions
                  </Link>
                  <Link
                    href="/health"
                    className="inline-flex items-center px-3 py-2 text-sm font-medium text-gray-900 dark:text-gray-100 hover:text-blue-600"
                  >
                    Health
                  </Link>
                </div>
              </div>
            </div>
          </nav>
          <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
