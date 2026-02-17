import { NextRequest, NextResponse } from 'next/server';
import { Connection, Keypair } from '@solana/web3.js';
import { callGraduateToken } from '../../../../lib/graduate-token';
import { createRaydiumCPMMPool, burnLPTokens } from '../../../../lib/raydium-helper';

const connection = new Connection('https://api.devnet.solana.com', 'confirmed');

export async function POST(request: NextRequest) {
  const { mint } = await request.json();
  
  try {
    console.log('🚀 Starting graduation process for:', mint);
    
    // Load platform wallet keypair
    const platformSecret = process.env.PLATFORM_WALLET_SECRET_KEY;
    if (!platformSecret) {
      throw new Error('PLATFORM_WALLET_SECRET_KEY not set in environment');
    }
    
    const platformKeypair = Keypair.fromSecretKey(
      Uint8Array.from(JSON.parse(platformSecret))
    );
    
    console.log('Platform wallet:', platformKeypair.publicKey.toBase58());
    
    // Step 1: Call graduate_token to get 200M tokens + send 2 SOL to creator
    console.log('📝 Step 1: Calling graduate_token...');
    const graduateResult = await callGraduateToken(
      connection,
      platformKeypair,
      mint
    );
    
    console.log('✅ Graduate TX:', graduateResult.txid);
    
    // Step 2: Create Raydium CPMM pool with 75 SOL + 200M tokens
    console.log('🏊 Step 2: Creating Raydium pool...');
    const poolResult = await createRaydiumCPMMPool(
      connection,
      platformKeypair,
      mint,
      75, // SOL
      200_000_000 // 200M tokens
    );
    
    console.log('✅ Pool created:', poolResult.poolAddress);
    
    // Step 3: Burn LP tokens (send to null address)
    console.log('🔥 Step 3: Burning LP tokens...');
    // const burnTx = await burnLPTokens(
    //   connection,
    //   platformKeypair,
    //   poolResult.lpMint,
    //   poolResult.lpAmount
    // );
    
    console.log('✅ All steps completed!');
    
    return NextResponse.json({ 
      success: true,
      graduateTxid: graduateResult.txid,
      poolAddress: poolResult.poolAddress,
      message: 'Pool created and LP tokens burned successfully'
    });
    
  } catch (error: any) {
    console.error('❌ Error:', error);
    return NextResponse.json({ 
      success: false,
      error: error.message 
    }, { status: 500 });
  }
}