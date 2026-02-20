import { NextResponse } from 'next/server';
import { Connection, PublicKey } from '@solana/web3.js';

const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
const SOCIAL_REGISTRY_PROGRAM_ID = new PublicKey('K3Fp6EiRsECtYbj63aG52D7rn2DiJdaLaxnN8MFpprh');
const TOKEN_FACTORY_PROGRAM_ID = new PublicKey('7F4JYKAEs7VhVd9P8E1wHhd8aiwtKYeo1tTxabDqpCvX');

export async function GET() {
  try {
    // Get all social registry accounts
    const registryAccounts = await connection.getProgramAccounts(SOCIAL_REGISTRY_PROGRAM_ID);

    const requests = await Promise.all(
      registryAccounts.map(async ({ pubkey, account }) => {
        try {
          const data = account.data;

          // Parse data
          const tokenMint = new PublicKey(data.slice(8, 40));
          const creator = new PublicKey(data.slice(40, 72));
          const platform = data[72];
          const verified = data[127] === 1; // Approximate offset
          const registeredAt = Number(data.readBigInt64LE(196)); // Approximate

          const platformNames = ['Twitter', 'Telegram', 'Discord', 'Website'];

          // Fetch token metadata
          const tokenAccounts = await connection.getProgramAccounts(TOKEN_FACTORY_PROGRAM_ID, {
            filters: [
              {
                memcmp: {
                  offset: 8,
                  bytes: tokenMint.toBase58(),
                },
              },
            ],
          });

          let tokenName = 'Unknown';
          let tokenSymbol = 'UNKNOWN';
          let tokenImage = '';

          if (tokenAccounts.length > 0) {
            const metaData = tokenAccounts[0].account.data;
            const nameLength = metaData.readUInt32LE(72);
            tokenName = metaData.slice(76, 76 + nameLength).toString('utf8');

            const symbolOffset = 76 + nameLength;
            const symbolLength = metaData.readUInt32LE(symbolOffset);
            tokenSymbol = metaData
              .slice(symbolOffset + 4, symbolOffset + 4 + symbolLength)
              .toString('utf8');

            const uriOffset = symbolOffset + 4 + symbolLength;
            const uriLength = metaData.readUInt32LE(uriOffset);
            const uri = metaData
              .slice(uriOffset + 4, uriOffset + 4 + uriLength)
              .toString('utf8');

            // Fetch metadata from IPFS
            if (uri) {
              try {
                const metaResponse = await fetch(uri);
                const metadata = await metaResponse.json();
                tokenImage = metadata.image || '';
              } catch (e) {
                // Skip if metadata fetch fails
              }
            }
          }

          // Parse handle from data (simplified)
          const handleLength = data.readUInt32LE(73);
          const handle = data.slice(77, 77 + handleLength).toString('utf8');

          return {
            tokenMint: tokenMint.toBase58(),
            tokenName,
            tokenSymbol,
            tokenImage,
            creator: creator.toBase58(),
            platform: platformNames[platform],
            handle,
            registryAddress: pubkey.toBase58(),
            verified,
            registeredAt,
          };
        } catch (error) {
          console.error('Error parsing registry account:', error);
          return null;
        }
      })
    );

    const validRequests = requests.filter((r) => r !== null);

    return NextResponse.json({ requests: validRequests });
  } catch (error) {
    console.error('Error fetching verification requests:', error);
    return NextResponse.json({ requests: [] });
  }
}