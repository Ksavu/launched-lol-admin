'use client';

import { useState, useEffect } from 'react';
import { Connection, PublicKey, Keypair, Transaction } from '@solana/web3.js';
import Image from 'next/image';

const SOCIAL_REGISTRY_PROGRAM_ID = new PublicKey('K3Fp6EiRsECtYbj63aG52D7rn2DiJdaLaxnN8MFpprh');

interface VerificationRequest {
  tokenMint: string;
  tokenName: string;
  tokenSymbol: string;
  tokenImage: string;
  creator: string;
  platform: string;
  handle: string;
  registryAddress: string;
  verified: boolean;
  registeredAt: number;
}

export default function VerificationPanel() {
  const [requests, setRequests] = useState<VerificationRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);

  useEffect(() => {
    fetchRequests();
    const interval = setInterval(fetchRequests, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchRequests = async () => {
    try {
      const response = await fetch('/api/admin/verification-requests');
      const data = await response.json();
      
      // Sort: Pending first, then by date
      const sorted = data.requests.sort((a: VerificationRequest, b: VerificationRequest) => {
        if (a.verified !== b.verified) {
          return a.verified ? 1 : -1; // Unverified first
        }
        return b.registeredAt - a.registeredAt; // Newest first
      });
      
      setRequests(sorted);
    } catch (error) {
      console.error('Error fetching requests:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (request: VerificationRequest) => {
    if (!confirm(`Verify ${request.platform} for ${request.tokenName}?\n\nHandle: ${request.handle}`)) {
      return;
    }

    setProcessing(request.registryAddress);
    try {
      const response = await fetch('/api/admin/verify-social', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          registryAddress: request.registryAddress,
          tokenMint: request.tokenMint,
          platform: request.platform,
        }),
      });

      const data = await response.json();

      if (data.success) {
        alert(`✅ Verified!\n\nTX: ${data.txid}`);
        fetchRequests();
      } else {
        alert(`❌ Error: ${data.error}`);
      }
    } catch (error) {
      alert(`❌ Error: ${error}`);
    } finally {
      setProcessing(null);
    }
  };

  const handleRevoke = async (request: VerificationRequest) => {
    if (!confirm(`Revoke verification for ${request.platform} on ${request.tokenName}?`)) {
      return;
    }

    setProcessing(request.registryAddress);
    try {
      const response = await fetch('/api/admin/revoke-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          registryAddress: request.registryAddress,
        }),
      });

      const data = await response.json();

      if (data.success) {
        alert(`✅ Revoked!\n\nTX: ${data.txid}`);
        fetchRequests();
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
            <h1 className="text-4xl font-bold text-white mb-2">🔐 Verification Requests</h1>
            <p className="text-gray-400">Review and approve social account verifications</p>
          </div>
          <button
            onClick={fetchRequests}
            className="bg-yellow-400 hover:bg-yellow-500 text-black font-bold px-6 py-3 rounded-lg transition"
          >
            🔄 Refresh
          </button>
        </div>

        {loading ? (
          <div className="text-center py-20">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-yellow-400"></div>
            <p className="text-white mt-4">Loading requests...</p>
          </div>
        ) : requests.length === 0 ? (
          <div className="bg-gray-900 rounded-xl p-12 text-center border border-gray-800">
            <p className="text-gray-400 text-lg">No verification requests yet</p>
          </div>
        ) : (
          <div className="space-y-4">
            {requests.map((request) => (
              <div
                key={request.registryAddress}
                className={`bg-gray-900 p-6 rounded-xl border-2 transition ${
                  request.verified
                    ? 'border-green-500/50'
                    : 'border-yellow-400/50 hover:border-yellow-400'
                }`}
              >
                <div className="flex items-start gap-4">
                  {/* Token Image */}
                  <div className="relative w-16 h-16 rounded-lg overflow-hidden flex-shrink-0">
                    {request.tokenImage ? (
                      <Image
                        src={request.tokenImage}
                        alt={request.tokenName}
                        fill
                        className="object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-gray-800 flex items-center justify-center text-2xl">
                        🪙
                      </div>
                    )}
                  </div>

                  {/* Token Info */}
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h2 className="text-2xl font-bold text-white">{request.tokenName}</h2>
                      <span className="bg-yellow-400/20 text-yellow-400 px-3 py-1 rounded-full text-sm font-bold">
                        ${request.tokenSymbol}
                      </span>
                      {request.verified && (
                        <span className="bg-green-500/20 text-green-400 px-3 py-1 rounded-full text-sm font-bold">
                          ✅ VERIFIED
                        </span>
                      )}
                    </div>

                    <p className="text-gray-500 text-sm font-mono mb-3">
                      Mint: {request.tokenMint}
                    </p>

                    <div className="bg-black/50 rounded-lg p-4 mb-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-gray-400 text-sm">Platform</p>
                          <p className="text-white font-bold">{request.platform}</p>
                        </div>
                        <div>
                          <p className="text-gray-400 text-sm">Handle</p>
                          <a
                            href={request.handle}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-yellow-400 hover:text-yellow-300 font-mono text-sm"
                          >
                            {request.handle}
                          </a>
                        </div>
                        <div>
                          <p className="text-gray-400 text-sm">Creator</p>
                          <a
                            href={`https://solscan.io/account/${request.creator}?cluster=devnet`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-yellow-400 hover:text-yellow-300 font-mono text-sm"
                          >
                            {request.creator.slice(0, 8)}...
                          </a>
                        </div>
                        <div>
                          <p className="text-gray-400 text-sm">Requested</p>
                          <p className="text-white text-sm">
                            {new Date(request.registeredAt * 1000).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-3">
                      {!request.verified ? (
                        <>
                          <button
                            onClick={() => handleVerify(request)}
                            disabled={processing === request.registryAddress}
                            className="flex-1 bg-green-500 hover:bg-green-600 disabled:bg-gray-600 text-white font-bold py-3 rounded-lg transition"
                          >
                            {processing === request.registryAddress
                              ? 'Processing...'
                              : '✅ Verify'}
                          </button>
                          <button
                            onClick={() =>
                              window.open(request.handle, '_blank')
                            }
                            className="flex-1 bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 rounded-lg transition"
                          >
                            🔍 Check Account
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => handleRevoke(request)}
                          disabled={processing === request.registryAddress}
                          className="flex-1 bg-red-500 hover:bg-red-600 disabled:bg-gray-600 text-white font-bold py-3 rounded-lg transition"
                        >
                          {processing === request.registryAddress
                            ? 'Processing...'
                            : '❌ Revoke Verification'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}