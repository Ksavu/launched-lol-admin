import { Connection, Keypair, PublicKey, Transaction, SystemProgram } from '@solana/web3.js';
import { getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } from '@solana/spl-token';

const BONDING_CURVE_PROGRAM_ID = new PublicKey('21ACVywCBCgrgAx8HpLJM6mJC8pxMzvvi58in5Xv7qej');

export async function callGraduateToken(
  connection: Connection,
  platformKeypair: Keypair,
  mintAddress: string,
) {
  try {
    console.log('🎓 Calling graduate_token for:', mintAddress);
    
    const mintPubkey = new PublicKey(mintAddress);
    
    // Derive bonding curve PDA
    const [bondingCurvePDA] = PublicKey.findProgramAddressSync(
      [Buffer.from('bonding-curve'), mintPubkey.toBuffer()],
      BONDING_CURVE_PROGRAM_ID
    );
    
    // Get bonding curve data to find creator
    const curveAccount = await connection.getAccountInfo(bondingCurvePDA);
    if (!curveAccount) {
      throw new Error('Bonding curve not found');
    }
    
    const creator = new PublicKey(curveAccount.data.slice(8, 40));
    
    console.log('Creator:', creator.toBase58());
    
    // Get token accounts
    const bondingCurveTokenAccount = getAssociatedTokenAddressSync(
      mintPubkey,
      bondingCurvePDA,
      true
    );
    
    const platformTokenAccount = getAssociatedTokenAddressSync(
      mintPubkey,
      platformKeypair.publicKey
    );
    
    // Create graduate_token instruction
    // Discriminator for graduate_token (you need to get this from your IDL)
    const discriminator = Buffer.from([
      // Add your graduate_token discriminator here
      // You can get it by running: anchor idl parse
      0x9d, 0x4b, 0x8f, 0x3e, 0x5a, 0x7c, 0x1b, 0x2a // PLACEHOLDER - replace with actual
    ]);
    
    const keys = [
      { pubkey: platformKeypair.publicKey, isSigner: true, isWritable: true }, // platform_authority
      { pubkey: creator, isSigner: false, isWritable: true }, // creator
      { pubkey: bondingCurvePDA, isSigner: false, isWritable: true }, // bonding_curve
      { pubkey: mintPubkey, isSigner: false, isWritable: true }, // token_mint
      { pubkey: bondingCurveTokenAccount, isSigner: false, isWritable: true }, // bonding_curve_token_account
      { pubkey: platformTokenAccount, isSigner: false, isWritable: true }, // platform_token_account
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }, // system_program
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false }, // token_program
      { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false }, // associated_token_program
      { pubkey: new PublicKey('SysvarRent111111111111111111111111111111111'), isSigner: false, isWritable: false }, // rent
    ];
    
    const instruction = {
      keys,
      programId: BONDING_CURVE_PROGRAM_ID,
      data: discriminator,
    };
    
    const transaction = new Transaction().add(instruction);
    transaction.feePayer = platformKeypair.publicKey;
    transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    
    // Sign and send
    transaction.sign(platformKeypair);
    const txid = await connection.sendRawTransaction(transaction.serialize());
    await connection.confirmTransaction(txid, 'confirmed');
    
    console.log('✅ graduate_token called successfully! TX:', txid);
    
    return {
      success: true,
      txid,
      platformTokenAccount: platformTokenAccount.toBase58(),
    };
    
  } catch (error) {
    console.error('❌ Error calling graduate_token:', error);
    throw error;
  }
}