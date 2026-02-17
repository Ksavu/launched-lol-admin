'use client';

import { useState, useEffect } from 'react';
import { Connection, PublicKey } from '@solana/web3.js';

const BONDING_CURVE_PROGRAM_ID = new PublicKey('21ACVywCBCgrgAx8HpLJM6mJC8pxMzvvi58in5Xv7qej');

interface GraduatedToken {
  mint: string;
  name: string;
  symbol: string;
  creator: string;
  bondingCurve: string;
  solInCurve: number;
  tokensInCurve: number;
  graduatedAt: number;
  lpCreated: boolean;
  raydiumPool?: string;
}

export default function AdminDashboard() {
  const [tokens, setTokens] = useState<GraduatedToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);

  useEffect(() => {
    fetchGraduatedTokens();
    // Refresh every 30 seconds
    const interval = setInterval(fetchGraduatedTokens, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchGraduatedTokens = async () => {
    try {
      const response = await fetch('/api/admin/graduated-tokens');
      const data = await response.json();
      setTokens(data.tokens || []);
    } catch (error) {
      console.error('Error fetching graduated tokens:', error);
    } finally {
      setLoading(false);
    }
  };

  const createRaydiumPool = async (token: GraduatedToken) => {
    if (!confirm(`Create Raydium pool for ${token.name} (${token.symbol})?\n\nThis will:\n- Send 2 SOL to creator\n- Get 200M tokens\n- Create Raydium CPMM pool with 75 SOL\n- Burn LP tokens`)) {
      return;
    }
    
    setProcessing(token.mint);
    try {
      const response = await fetch('/api/admin/create-raydium-pool', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mint: token.mint }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        alert(`✅ Success!\n\nPool created: ${data.poolAddress}\n\nTX: ${data.txid}`);
        fetchGraduatedTokens();
      } else {
        alert(`❌ Error: ${data.error}`);
      }
    } catch (error) {
      alert(`❌ Error: ${error}`);
    } finally {
      setProcessing(null);
    }
  };

  return (
    <div className="min-h-screen bg-black p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2">🎓 Graduated Tokens Dashboard</h1>
            <p className="text-gray-400">Platform Admin Panel - Create Raydium Pools</p>
          </div>
          <button
            onClick={fetchGraduatedTokens}
            className="bg-yellow-400 hover:bg-yellow-500 text-black font-bold px-6 py-3 rounded-lg transition"
          >
            🔄 Refresh
          </button>
        </div>
        
        {loading ? (
          <div className="text-center py-20">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-yellow-400"></div>
            <p className="text-white mt-4">Loading graduated tokens...</p>
          </div>
        ) : tokens.length === 0 ? (
          <div className="bg-gray-900 rounded-xl p-12 text-center border border-gray-800">
            <p className="text-gray-400 text-lg">No graduated tokens yet</p>
            <p className="text-gray-500 text-sm mt-2">Tokens will appear here when they reach 81 SOL</p>
          </div>
        ) : (
          <div className="space-y-4">
            {tokens.map((token) => (
              <div key={token.mint} className="bg-gray-900 p-6 rounded-xl border-2 border-yellow-400/50 hover:border-yellow-400 transition">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h2 className="text-2xl font-bold text-white">{token.name}</h2>
                      <span className="bg-yellow-400/20 text-yellow-400 px-3 py-1 rounded-full text-sm font-bold">
                        ${token.symbol}
                      </span>
                    </div>
                    <p className="text-gray-500 text-sm font-mono mb-1">Mint: {token.mint}</p>
                    <p className="text-gray-500 text-sm font-mono mb-1">Curve: {token.bondingCurve}</p>
                    <p className="text-gray-500 text-sm font-mono">Creator: {token.creator}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-yellow-400 font-bold text-2xl">{token.solInCurve.toFixed(2)} SOL</p>
                    <p className="text-gray-400 text-lg">{token.tokensInCurve.toFixed(0)}M tokens</p>
                    <p className="text-gray-500 text-sm mt-2">
                      {new Date(token.graduatedAt * 1000).toLocaleString()}
                    </p>
                  </div>
                </div>
                
                {token.lpCreated ? (
                  <div className="bg-green-500/20 border-2 border-green-500 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-green-400 font-bold text-lg">✅ Raydium Pool Created</p>
                        <p className="text-gray-400 text-sm mt-1">LP tokens have been burned</p>
                      </div>
                      <a 
                        href={`https://solscan.io/account/${token.raydiumPool}?cluster=devnet`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="bg-green-500 hover:bg-green-600 text-white font-bold px-6 py-3 rounded-lg transition"
                      >
                        View Pool →
                      </a>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => createRaydiumPool(token)}
                    disabled={processing === token.mint}
                    className="w-full bg-gradient-to-r from-yellow-400 to-yellow-600 hover:from-yellow-500 hover:to-yellow-700 disabled:from-gray-600 disabled:to-gray-700 text-black font-bold py-4 rounded-lg transition text-lg"
                  >
                    {processing === token.mint ? (
                      <span className="flex items-center justify-center gap-2">
                        <div className="inline-block animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-black"></div>
                        Processing...
                      </span>
                    ) : (
                      '🚀 Create Raydium LP + Burn Tokens'
                    )}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
        
        <div className="mt-8 bg-gray-900 rounded-xl p-6 border border-gray-800">
          <h3 className="text-white font-bold mb-3">ℹ️ How it works</h3>
          <ul className="text-gray-400 space-y-2 text-sm">
            <li>• Tokens appear here automatically when they reach 81 SOL</li>
            <li>• Platform has already received 4 SOL graduation fee</li>
            <li>• Click button to: Send 2 SOL to creator, get 200M tokens, create Raydium pool, burn LP</li>
            <li>• Pool will have 75 SOL + 200M tokens liquidity</li>
            <li>• Creator can claim their 30M dev tokens from the token page</li>
          </ul>
        </div>
      </div>
    </div>
  );
}