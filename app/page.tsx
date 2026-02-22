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
  devTokensClaimed?: boolean;
}

interface PoolInstructions {
  step1: any;
  step2: any;
  step3: any;
}

// Helper to shorten addresses
const shortenAddress = (address: string) => {
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
};

// Copy to clipboard component
const CopyButton = ({ text }: { text: string }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className="ml-2 p-1 hover:bg-gray-700 rounded transition"
      title="Copy to clipboard"
    >
      {copied ? (
        <svg className="w-4 h-4 text-green-400" fill="currentColor" viewBox="0 0 20 20">
          <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z"/>
          <path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm9.707 5.707a1 1 0 00-1.414-1.414L9 12.586l-1.293-1.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
        </svg>
      ) : (
        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/>
        </svg>
      )}
    </button>
  );
};

// Add this helper function near the top
const checkDevTokensClaimed = async (bondingCurve: string, creator: string, tokenMint: string) => {
  try {
    const connection = new Connection(process.env.NEXT_PUBLIC_RPC_URL || 'https://api.devnet.solana.com', 'confirmed');
    const TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
    
    // Get creator's token account
    const mintPubkey = new PublicKey(tokenMint);
    const creatorPubkey = new PublicKey(creator);
    
    const [creatorTokenAccount] = PublicKey.findProgramAddressSync(
      [
        creatorPubkey.toBuffer(),
        TOKEN_PROGRAM_ID.toBuffer(),
        mintPubkey.toBuffer(),
      ],
      new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL')
    );
    
    const accountInfo = await connection.getAccountInfo(creatorTokenAccount);
    
    if (!accountInfo) return false;
    
    // Read token balance (8 bytes at offset 64)
    const balance = Number(accountInfo.data.readBigUInt64LE(64));
    
    // If creator has 30M+ tokens, they claimed
    return balance >= 30_000_000_000_000; // 30M with 6 decimals
  } catch (error) {
    console.error('Error checking dev tokens:', error);
    return false; // Assume not claimed if error
  }
};

export default function AdminDashboard() {
  const [tokens, setTokens] = useState<GraduatedToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [poolInstructions, setPoolInstructions] = useState<PoolInstructions | null>(null);
  const [fundsResult, setFundsResult] = useState<any | null>(null);
  const [processedTokens, setProcessedTokens] = useState<Set<string>>(new Set());

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
  if (!confirm(`Process graduation for ${token.name}?\n\nThis will:\n- Distribute 81 SOL (4 platform, 2 creator, 75 LP)\n- Transfer tokens to platform\n- Deactivate bonding curve`)) {
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

    if (!response.ok) {
      throw new Error(data.error || 'Failed to process graduation');
    }

    if (data.success) {
      // ✅ Show success message
      alert(`✅ Success!\n\nFunds distributed:\n- ${data.funds.platformReceived}\n- ${data.funds.creatorReceived}\n\nTX: ${data.funds.processFundsTxid}\n\n${data.message}`);
      
      // ✅ Refresh the token list
      fetchGraduatedTokens();
    } else {
      throw new Error(data.error || 'Unknown error');
    }

  } catch (error: any) {
    console.error('Error processing graduation:', error);
    alert(`❌ Error: ${error.message}`);
  } finally {
    setProcessing(null);
  }
};

  const isProcessed = (mint: string) => processedTokens.has(mint);

  return (
    <div className="min-h-screen bg-black p-4 sm:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 sm:mb-8 gap-4">
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2">🎓 Graduated Tokens</h1>
            <p className="text-gray-400 text-sm sm:text-base">Platform Admin Panel</p>
          </div>
          <button
            onClick={fetchGraduatedTokens}
            className="w-full sm:w-auto bg-yellow-400 hover:bg-yellow-500 text-black font-bold px-6 py-3 rounded-lg transition"
          >
            🔄 Refresh
          </button>
        </div>
        
        {loading ? (
          <div className="text-center py-20">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-yellow-400"></div>
            <p className="text-white mt-4">Loading...</p>
          </div>
        ) : tokens.length === 0 ? (
          <div className="bg-gray-900 rounded-xl p-12 text-center border border-gray-800">
            <p className="text-gray-400 text-lg">No graduated tokens yet</p>
          </div>
        ) : (
          <div className="space-y-4">
            {tokens.map((token) => (
              <div 
                key={token.mint} 
                className={`bg-gray-900 p-4 sm:p-6 rounded-xl border-2 transition ${
                  isProcessed(token.mint) 
                    ? 'border-green-500/50' 
                    : 'border-yellow-400/50 hover:border-yellow-400'
                }`}
              >
                {/* Token Header */}
                <div className="flex flex-col sm:flex-row justify-between items-start mb-4 gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <h2 className="text-xl sm:text-2xl font-bold text-white">{token.name}</h2>
                      <span className="bg-yellow-400/20 text-yellow-400 px-3 py-1 rounded-full text-sm font-bold whitespace-nowrap">
                        ${token.symbol}
                      </span>
                      {isProcessed(token.mint) && (
                        <span className="bg-green-500/20 text-green-400 px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap">
                          ✅ PROCESSED
                        </span>
                      )}
                    </div>
                    
                    {/* Addresses - Mobile Friendly */}
                    <div className="space-y-1 text-xs sm:text-sm">
                      <div className="flex items-center text-gray-500">
                        <span className="w-16 sm:w-20">Mint:</span>
                        <span className="font-mono text-gray-400">{shortenAddress(token.mint)}</span>
                        <CopyButton text={token.mint} />
                      </div>
                      <div className="flex items-center text-gray-500">
                        <span className="w-16 sm:w-20">Curve:</span>
                        <span className="font-mono text-gray-400">{shortenAddress(token.bondingCurve)}</span>
                        <CopyButton text={token.bondingCurve} />
                      </div>
                      <div className="flex items-center text-gray-500">
                        <span className="w-16 sm:w-20">Creator:</span>
                        <span className="font-mono text-gray-400">{shortenAddress(token.creator)}</span>
                        <CopyButton text={token.creator} />
                      </div>
                    </div>
                  </div>
                  
                  {/* Stats */}
                  <div className="text-left sm:text-right">
                    <p className="text-yellow-400 font-bold text-2xl">81.00 SOL</p>
                    <p className="text-gray-400 text-lg">
                      {token.devTokensClaimed ? '200M' : '230M'} tokens
                    </p>
                    {!token.devTokensClaimed && (
                      <p className="text-orange-400 text-xs mt-1">
                        ⚠️ Includes 30M dev tokens (unclaimed)
                      </p>
                    )}
                    <p className="text-gray-500 text-xs sm:text-sm mt-2">
                      {new Date(token.graduatedAt * 1000).toLocaleString()}
                    </p>
                  </div>
                </div>
                
                {/* Action Button */}
                {!isProcessed(token.mint) && (
                  <button
                    onClick={() => handleCreatePool(token)}
                    disabled={processing === token.mint}
                    className="w-full bg-gradient-to-r from-yellow-400 to-yellow-600 hover:from-yellow-500 hover:to-yellow-700 disabled:from-gray-600 disabled:to-gray-700 text-black font-bold py-3 sm:py-4 rounded-lg transition text-base sm:text-lg"
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
        
        {/* Info Section - Mobile Friendly */}
        <div className="mt-8 bg-gray-900 rounded-xl p-4 sm:p-6 border border-gray-800">
          <h3 className="text-white font-bold mb-3">ℹ️ How it works</h3>
          <ul className="text-gray-400 space-y-2 text-xs sm:text-sm">
            <li>• Tokens appear here when they reach 81 SOL</li>
            <li>• Click button to distribute funds:</li>
            <li className="ml-4 sm:ml-6">- Platform: 79 SOL (4 fee + 75 LP)</li>
            <li className="ml-4 sm:ml-6">- Creator: 2 SOL</li>
            <li>• Platform LP allocation:</li>
            <li className="ml-4 sm:ml-6">- If dev claimed: <span className="text-green-400">200M tokens</span></li>
            <li className="ml-4 sm:ml-6">- If dev NOT claimed: <span className="text-orange-400">230M tokens</span> (includes unclaimed 30M)</li>
            <li>• Follow instructions to create Raydium pool</li>
            <li>• Creator can claim 30M dev tokens from token page</li>
          </ul>
        </div>
      </div>

      {/* Instructions Modal - Mobile Friendly */}
      {poolInstructions && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-gray-900 rounded-xl p-4 sm:p-8 max-w-4xl w-full my-8 border-2 border-yellow-400 max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4">🏊 Raydium Pool Instructions</h2>
            
            {fundsResult && (
              <div className="mb-6 bg-green-500/20 border border-green-500 rounded-lg p-4">
                <p className="text-green-400 font-bold">✅ Funds Distributed!</p>
                <p className="text-gray-300 text-sm mt-1">Platform: {fundsResult.platformReceived}</p>
                <p className="text-gray-300 text-sm">Creator: {fundsResult.creatorReceived}</p>
                <a 
                  href={`https://solscan.io/tx/${fundsResult.txid}?cluster=devnet`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-400 hover:underline text-sm break-all"
                >
                  TX: {shortenAddress(fundsResult.txid)}
                </a>
              </div>
            )}
            
            {/* Steps - Simplified for Mobile */}
            <div className="space-y-4 text-sm sm:text-base">
              <div className="bg-blue-500/10 border-2 border-blue-500 p-4 rounded-lg">
                <h3 className="text-xl font-bold text-blue-400 mb-2">Step 1: OpenBook Market</h3>
                <p className="text-gray-300 mb-2">Go to openserum.io and create market</p>
                <div className="bg-black/50 p-2 rounded break-all">
                  <p className="text-xs text-gray-400">Base: {poolInstructions.step1.baseToken}</p>
                </div>
              </div>

              <div className="bg-green-500/10 border-2 border-green-500 p-4 rounded-lg">
                <h3 className="text-xl font-bold text-green-400 mb-2">Step 2: Raydium Pool</h3>
                <p className="text-gray-300">200M tokens + 75 SOL</p>
              </div>

              <div className="bg-red-500/10 border-2 border-red-500 p-4 rounded-lg">
                <h3 className="text-xl font-bold text-red-400 mb-2">Step 3: Burn LP</h3>
                <p className="text-gray-300">Send LP to burn address</p>
              </div>
            </div>

            <button
              onClick={() => {
                setPoolInstructions(null);
                setFundsResult(null);
                fetchGraduatedTokens();
              }}
              className="w-full bg-yellow-400 hover:bg-yellow-500 text-black font-bold py-3 sm:py-4 rounded-lg transition text-base sm:text-lg mt-6"
            >
              ✅ Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}