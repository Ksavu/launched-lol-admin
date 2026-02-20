'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function AdminNav() {
  const pathname = usePathname();
  
  return (
    <nav className="bg-black border-b border-gray-800 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center space-x-8">
            <Link href="/" className="text-2xl font-bold text-yellow-400">
              Launched.lol Admin Dashboard
            </Link>
            
            <Link 
              href="/"
              className={`text-gray-300 hover:text-white transition font-medium ${
                pathname === '/' ? 'text-white' : ''
              }`}
            >
              Graduated Tokens
            </Link>
            
            <Link 
              href="/verification"
              className={`text-gray-300 hover:text-white transition font-medium ${
                pathname === '/verification' ? 'text-white' : ''
              }`}
            >
              🔐 Verification
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}