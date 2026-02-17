import { NextRequest, NextResponse } from 'next/server';
import { Connection, PublicKey } from '@solana/web3.js';

const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
const BONDING_CURVE_PROGRAM_ID = new PublicKey('21ACVywCBCgrgAx8HpLJM6mJC8pxMzvvi58in5Xv7qej');
const TOKEN_FACTORY_PROGRAM_ID = new PublicKey('7F4JYKAEs7VhVd9P8E1wHhd8aiwtKYeo1tTxabDqpCvX');

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Fetching graduated tokens...');
    
    // Fetch all bonding curve accounts
    const curveAccounts = await connection.getProgramAccounts(BONDING_CURVE_PROGRAM_ID);
    
    console.log(`Found ${curveAccounts.length} bonding curves`);
    
    const graduatedTokens = await Promise.all(
      curveAccounts.map(async ({ pubkey, account }) => {
        try {
          const data = account.data;
          
          // Parse bonding curve data
          const graduated = data[187] === 1; // graduated boolean at offset 187
          if (!graduated) return null;
          
          const creator = new PublicKey(data.slice(8, 40));
          const tokenMint = new PublicKey(data.slice(40, 72));
          const realSolReserves = Number(data.readBigUInt64LE(96)) / 1_000_000_000;
          
          // Fetch token metadata
          const metadataAccounts = await connection.getProgramAccounts(TOKEN_FACTORY_PROGRAM_ID, {
            filters: [
              {
                memcmp: {
                  offset: 8,
                  bytes: tokenMint.toBase58(),
                },
              },
            ],
          });
          
          let name = 'Unknown';
          let symbol = 'UNKNOWN';
          
          if (metadataAccounts.length > 0) {
            const metaData = metadataAccounts[0].account.data;
            const nameLength = metaData.readUInt32LE(72);
            name = metaData.slice(76, 76 + nameLength).toString('utf8');
            
            const symbolOffset = 76 + nameLength;
            const symbolLength = metaData.readUInt32LE(symbolOffset);
            symbol = metaData.slice(symbolOffset + 4, symbolOffset + 4 + symbolLength).toString('utf8');
          }
          
          return {
            mint: tokenMint.toBase58(),
            name,
            symbol,
            creator: creator.toBase58(),
            bondingCurve: pubkey.toBase58(),
            solInCurve: realSolReserves,
            tokensInCurve: 200, // 200M LP tokens available
            graduatedAt: Date.now() / 1000, // You'd store this on-chain or in DB
            lpCreated: false, // Track this in a database
          };
        } catch (error) {
          console.error('Error parsing token:', error);
          return null;
        }
      })
    );
    
    const validTokens = graduatedTokens
      .filter(t => t !== null)
      .sort((a, b) => b!.graduatedAt - a!.graduatedAt);
    
    console.log(`✅ Found ${validTokens.length} graduated tokens`);
    
    return NextResponse.json({ tokens: validTokens });
  } catch (error) {
    console.error('Error fetching graduated tokens:', error);
    return NextResponse.json({ error: 'Failed to fetch graduated tokens' }, { status: 500 });
  }
}