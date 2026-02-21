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
          
          // Parse bonding curve data with CORRECT offsets
          const creator = new PublicKey(data.slice(8, 40));
          const tokenMint = new PublicKey(data.slice(40, 72));
          
          // Read graduated flag (offset 187)
          const graduated = data[187] === 1;
          if (!graduated) return null;
          
          // Read real_sol_reserves (offset 152) - u64 little endian
          const realSolReserves = Number(data.readBigUInt64LE(152));
          
          // Read real_token_reserves (offset 160) - u64 little endian
          const realTokenReserves = Number(data.readBigUInt64LE(160));
          
          // Read dev_supply (offset 204) - u64 little endian
          const devSupply = Number(data.readBigUInt64LE(204));
          
          // Dev tokens are claimed if dev_supply is 0 (released to creator)
          const devTokensClaimed = devSupply === 0;
          
          console.log(`${pubkey.toBase58().slice(0, 8)}: dev_supply = ${devSupply / 1e6 / 1e6}M, claimed = ${devTokensClaimed}`);
          
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
          
          // Get graduation timestamp (approximate from block time)
          let graduatedAt = Math.floor(Date.now() / 1000);
          
          try {
            const accountInfo = await connection.getAccountInfoAndContext(pubkey);
            const slot = accountInfo.context.slot;
            const blockTime = await connection.getBlockTime(slot);
            graduatedAt = blockTime || graduatedAt;
          } catch (error) {
            console.log('Using current time for graduation timestamp');
          }
          
          return {
            mint: tokenMint.toBase58(),
            name,
            symbol,
            creator: creator.toBase58(),
            bondingCurve: pubkey.toBase58(),
            solInCurve: realSolReserves / 1e9,
            tokensInCurve: devTokensClaimed ? 200 : 230, // ✅ Correct: 200M if claimed, 230M if not
            graduatedAt,
            lpCreated: false,
            devTokensClaimed, // ✅ Based on dev_supply value
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