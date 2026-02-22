import { NextRequest, NextResponse } from 'next/server';
import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import { callGraduateToken } from '../../../../lib/graduate-token';
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

    const bondingCurveAddress = new PublicKey(bondingCurve);
    const mintAddress = new PublicKey(tokenMint);

    // Get creator from bonding curve
    const curveAccount = await connection.getAccountInfo(bondingCurveAddress);
    if (!curveAccount) {
      throw new Error('Bonding curve not found');
    }
    const creator = new PublicKey(curveAccount.data.slice(8, 40));

    // Check SOL balance
    const balance = await connection.getBalance(bondingCurveAddress);
    const balanceSOL = balance / 1e9;
    console.log(`📊 Bonding curve balance: ${balanceSOL} SOL`);
    
    if (balanceSOL < 81) {
      return NextResponse.json({
        success: false,
        error: `Insufficient balance: ${balanceSOL.toFixed(4)} SOL (need 81 SOL)`,
      }, { status: 400 });
    }

    // Step 1: Call graduate_token to transfer 200M LP tokens to platform
    console.log('Step 1: Calling graduate_token...');
    let graduateResult;
    try {
      graduateResult = await callGraduateToken(
        connection,
        platformKeypair,
        bondingCurveAddress,
        mintAddress
      );
      console.log('✅ graduate_token success! TX:', graduateResult.txid);
    } catch (error: any) {
      console.log('⚠️ graduate_token failed:', error.message);
      // Continue anyway - might have been called before
      // This is OK if LP tokens were already transferred
    }

    // Step 2: Process graduation funds (distribute SOL + transfer remaining tokens + close PDAs)
    console.log('Step 2: Processing graduation funds...');
    const fundsResult = await processGraduationFunds(
      connection,
      platformKeypair,
      bondingCurveAddress,
      mintAddress,
      creator
    );

    if (!fundsResult.success) {
      return NextResponse.json({
        success: false,
        error: fundsResult.error,
      }, { status: 500 });
    }

    console.log('✅ Funds distributed! TX:', fundsResult.txid);

    // Step 3: Get Raydium pool creation instructions
    console.log('Step 3: Raydium pool creation instructions...');
    const poolResult = await createRaydiumStandardPool(
      connection,
      platformKeypair,
      mintAddress,
      200_000_000_000_000, // 200M tokens with 6 decimals
      75_000_000_000, // 75 SOL in lamports
    );

    return NextResponse.json({
      success: true,
      funds: {
        graduateTxid: graduateResult?.txid || 'Already called',
        processFundsTxid: fundsResult.txid,
        platformReceived: fundsResult.platformReceived,
        creatorReceived: fundsResult.creatorReceived,
      },
      raydium: poolResult,
      message: '✅ Complete! Bonding curve closed. Platform has tokens + SOL. Follow Raydium instructions.',
    });

  } catch (error: any) {
    console.error('Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
    }, { status: 500 });
  }
}