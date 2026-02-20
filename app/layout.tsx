import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { AdminNav } from '../components/AdminNav';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Admin Dashboard - Launched.lol',
  description: 'Platform admin panel',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <AdminNav />
        {children}
      </body>
    </html>
  );
}