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

interface PoolInstructions {
  step1: {
    name: string;
    url: string;
    baseToken: string;
    quoteToken: string;
    minOrderSize: string;
    tickSize: string;
  };
  step2: {
    name: string;
    url: string;
    poolType: string;
    tokenMint: string;
    tokenAmount: string;
    solAmount: string;
  };
  step3: {
    name: string;
    burnAddress: string;
    note: string;
  };
}

export default function AdminDashboard() {
  const [tokens, setTokens] = useState<GraduatedToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [poolInstructions, setPoolInstructions] = useState<PoolInstructions | null>(null);
  const [fundsResult, setFundsResult] = useState<any | null>(null);

  useEffect(() => {
    fetchGraduatedTokens();
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

  const handleCreatePool = async (token: GraduatedToken) => {
    if (!confirm(`Process graduation for ${token.name} (${token.symbol})?\n\nThis will:\n- Send 79 SOL to platform (4 fee + 75 LP)\n- Send 2 SOL to creator\n- Platform already has 200M tokens\n- Show Raydium pool creation instructions`)) {
      return;
    }
    
    setProcessing(token.mint);
    try {
      const response = await fetch('/api/admin/create-raydium-pool', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bondingCurve: token.bondingCurve,
          tokenMint: token.mint,
        }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        setFundsResult(data.funds);
        setPoolInstructions(data.raydium.instructions);
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
            <p className="text-gray-400">Platform Admin Panel - Process Graduations</p>
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
                    onClick={() => handleCreatePool(token)}
                    disabled={processing === token.mint}
                    className="w-full bg-gradient-to-r from-yellow-400 to-yellow-600 hover:from-yellow-500 hover:to-yellow-700 disabled:from-gray-600 disabled:to-gray-700 text-black font-bold py-4 rounded-lg transition text-lg"
                  >
                    {processing === token.mint ? (
                      <span className="flex items-center justify-center gap-2">
                        <div className="inline-block animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-black"></div>
                        Processing...
                      </span>
                    ) : (
                      '🚀 Distribute Funds & Get Pool Instructions'
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
            <li>• Click button to distribute funds:</li>
            <li className="ml-6">- Platform receives 79 SOL (4 SOL fee + 75 SOL for LP)</li>
            <li className="ml-6">- Creator receives 2 SOL</li>
            <li className="ml-6">- Platform already has 200M tokens for LP</li>
            <li>• Follow instructions to create Raydium Standard AMM pool with 75 SOL + 200M tokens</li>
            <li>• Creator can claim their 30M dev tokens from the token page</li>
            <li>• Bonding curve keeps ~0.15 SOL as rent reserve</li>
          </ul>
        </div>
      </div>

      {/* Instructions Modal */}
      {poolInstructions && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-gray-900 rounded-xl p-8 max-w-4xl w-full my-8 border-2 border-yellow-400">
            <h2 className="text-3xl font-bold text-white mb-2">🏊 Raydium Standard AMM Pool</h2>
            
            {fundsResult && (
              <div className="mb-6 bg-green-500/20 border border-green-500 rounded-lg p-4">
                <p className="text-green-400 font-bold">✅ Funds Distributed!</p>
                <p className="text-gray-300 text-sm mt-1">Platform: {fundsResult.platformReceived}</p>
                <p className="text-gray-300 text-sm">Creator: {fundsResult.creatorReceived}</p>
                <a 
                  href={`https://solscan.io/tx/${fundsResult.txid}?cluster=devnet`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-400 hover:underline text-sm"
                >
                  View TX: {fundsResult.txid.slice(0, 8)}...
                </a>
              </div>
            )}
            
            {/* Step 1: OpenBook Market */}
            <div className="mb-6 bg-blue-500/10 border-2 border-blue-500 p-6 rounded-lg">
              <h3 className="text-2xl font-bold text-blue-400 mb-4">📖 Step 1: Create OpenBook Market</h3>
              <div className="space-y-3">
                <div>
                  <p className="text-gray-400 text-sm">URL:</p>
                  <a href={poolInstructions.step1.url} target="_blank" className="text-blue-400 hover:underline font-mono text-sm break-all">
                    {poolInstructions.step1.url}
                  </a>
                </div>
                <div>
                  <p className="text-gray-400 text-sm">Base Token (Your Token):</p>
                  <p className="text-white font-mono text-sm break-all">{poolInstructions.step1.baseToken}</p>
                </div>
                <div>
                  <p className="text-gray-400 text-sm">Quote Token:</p>
                  <p className="text-white font-mono text-sm">{poolInstructions.step1.quoteToken}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-gray-400 text-sm">Min Order Size:</p>
                    <p className="text-white font-bold">{poolInstructions.step1.minOrderSize}</p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-sm">Tick Size:</p>
                    <p className="text-white font-bold">{poolInstructions.step1.tickSize}</p>
                  </div>
                </div>
                <p className="text-yellow-400 text-sm mt-4">💾 Save the Market ID after creation!</p>
              </div>
            </div>

            {/* Step 2: Raydium Pool */}
            <div className="mb-6 bg-green-500/10 border-2 border-green-500 p-6 rounded-lg">
              <h3 className="text-2xl font-bold text-green-400 mb-4">🏊 Step 2: Create Raydium AMM Pool</h3>
              <div className="space-y-3">
                <div>
                  <p className="text-gray-400 text-sm">URL:</p>
                  <a href={poolInstructions.step2.url} target="_blank" className="text-blue-400 hover:underline font-mono text-sm">
                    {poolInstructions.step2.url}
                  </a>
                </div>
                <div>
                  <p className="text-gray-400 text-sm">Pool Type:</p>
                  <p className="text-white font-bold text-lg">{poolInstructions.step2.poolType}</p>
                </div>
                <div>
                  <p className="text-gray-400 text-sm">Market ID:</p>
                  <p className="text-yellow-400 font-bold">[Use Market ID from Step 1]</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-gray-400 text-sm">Token Amount:</p>
                    <p className="text-white font-bold text-lg">{poolInstructions.step2.tokenAmount}</p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-sm">SOL Amount:</p>
                    <p className="text-white font-bold text-lg">{poolInstructions.step2.solAmount}</p>
                  </div>
                </div>
                <p className="text-yellow-400 text-sm mt-4">💾 Save the LP Token Mint after creation!</p>
              </div>
            </div>

            {/* Step 3: Burn LP */}
            <div className="mb-6 bg-red-500/10 border-2 border-red-500 p-6 rounded-lg">
              <h3 className="text-2xl font-bold text-red-400 mb-4">🔥 Step 3: Burn LP Tokens</h3>
              <div className="space-y-3">
                <p className="text-gray-300">{poolInstructions.step3.note}</p>
                <div>
                  <p className="text-gray-400 text-sm">Burn Address:</p>
                  <p className="text-white font-mono text-sm break-all bg-black/50 p-2 rounded">
                    {poolInstructions.step3.burnAddress}
                  </p>
                </div>
                <div className="bg-black/50 p-4 rounded">
                  <p className="text-gray-400 text-sm mb-2">CLI Command:</p>
                  <code className="text-green-400 text-xs break-all">
                    spl-token transfer [LP_MINT] ALL {poolInstructions.step3.burnAddress} --owner [YOUR_WALLET]
                  </code>
                </div>
              </div>
            </div>

            <button
              onClick={() => {
                setPoolInstructions(null);
                setFundsResult(null);
                fetchGraduatedTokens();
              }}
              className="w-full bg-yellow-400 hover:bg-yellow-500 text-black font-bold py-4 rounded-lg transition text-lg"
            >
              ✅ Got it! Close Instructions
            </button>
          </div>
        </div>
      )}
    </div>
  );
}