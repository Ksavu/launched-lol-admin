import { NextRequest, NextResponse } from 'next/server';
import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import { processGraduationFunds } from '../../../../lib/process-graduation-funds';
import { createRaydiumStandardPool } from '../../../../lib/raydium-helper';

const connection = new Connection('https://api.devnet.solana.com', 'confirmed');

export async function POST(request: NextRequest) {
  try {
    const { bondingCurve, tokenMint } = await request.json();

    const platformSecret = process.env.PLATFORM_WALLET_SECRET_KEY;
    if (!platformSecret) {
      throw new Error('Platform wallet not configured');
    }

    const platformKeypair = Keypair.fromSecretKey(
      Uint8Array.from(JSON.parse(platformSecret))
    );

    // Get creator from bonding curve
    const bondingCurveAddress = new PublicKey(bondingCurve);
    const curveAccount = await connection.getAccountInfo(bondingCurveAddress);
    if (!curveAccount) {
      throw new Error('Bonding curve not found');
    }
    const creator = new PublicKey(curveAccount.data.slice(8, 40));

    console.log('Step 1: Processing graduation funds (SOL distribution)...');
    const fundsResult = await processGraduationFunds(
      connection,
      platformKeypair,
      bondingCurveAddress,
      new PublicKey(tokenMint),
      creator,
    );

    console.log('✅ Funds distributed:', fundsResult.txid);

    // Step 2: Get Raydium pool creation instructions
    console.log('Step 2: Raydium pool creation instructions...');
    const poolResult = await createRaydiumStandardPool(
      connection,
      platformKeypair,
      new PublicKey(tokenMint),
      200_000_000_000_000, // 200M tokens with 6 decimals
      75_000_000_000, // 75 SOL in lamports
    );

    return NextResponse.json({
      success: true,
      funds: {
        txid: fundsResult.txid,
        platformReceived: '79 SOL (4 fee + 75 LP)',
        creatorReceived: '2 SOL',
      },
      raydium: poolResult,
      message: '✅ Funds distributed! Platform has 75 SOL + 200M tokens. Follow Raydium instructions.',
    });

  } catch (error: any) {
    console.error('Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
    }, { status: 500 });
  }
}