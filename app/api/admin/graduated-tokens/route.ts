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
          
          // ✅ Validate data
          if (!data || data.length < 255) {
            return null;
          }
          
          // ✅ Check ownership
          if (account.owner.toBase58() !== BONDING_CURVE_PROGRAM_ID.toBase58()) {
            return null;
          }
          
          // Parse bonding curve data
          const creator = new PublicKey(data.slice(8, 40));
          const tokenMint = new PublicKey(data.slice(40, 72));
          
          // Read graduated flag (offset 187)
          const graduated = data[187] === 1;
          if (!graduated) return null;
          
          // Read reserves
          const realSolReserves = Number(data.readBigUInt64LE(152));
          const realTokenReserves = Number(data.readBigUInt64LE(160));
          
          // ✅ Only show tokens with enough SOL to process (81+ SOL)
          const solBalance = realSolReserves / 1e9;
          if (solBalance < 81) {
            console.log(`${pubkey.toBase58().slice(0, 8)}: Skip (only ${solBalance.toFixed(2)} SOL)`);
            return null;
          }
          
          // Read dev_supply (offset 204)
          const devSupply = Number(data.readBigUInt64LE(204));
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
          
          // Get graduation timestamp
          let graduatedAt = Math.floor(Date.now() / 1000);
          try {
            const accountInfo = await connection.getAccountInfoAndContext(pubkey);
            const slot = accountInfo.context.slot;
            const blockTime = await connection.getBlockTime(slot);
            graduatedAt = blockTime || graduatedAt;
          } catch (error) {
            // Use current time as fallback
          }
          
          return {
            mint: tokenMint.toBase58(),
            name,
            symbol,
            creator: creator.toBase58(),
            bondingCurve: pubkey.toBase58(),
            solInCurve: solBalance,
            tokensInCurve: devTokensClaimed ? 200 : 230,
            graduatedAt,
            lpCreated: false,
            devTokensClaimed,
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
    
    console.log(`✅ Found ${validTokens.length} graduated tokens (with 81+ SOL)`);
    
    return NextResponse.json({ tokens: validTokens });
  } catch (error) {
    console.error('Error fetching graduated tokens:', error);
    return NextResponse.json({ error: 'Failed to fetch graduated tokens' }, { status: 500 });
  }
}