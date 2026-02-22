import { Connection, Keypair, PublicKey, Transaction, SystemProgram } from '@solana/web3.js';
import { getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } from '@solana/spl-token';

const BONDING_CURVE_PROGRAM_ID = new PublicKey('21ACVywCBCgrgAx8HpLJM6mJC8pxMzvvi58in5Xv7qej');

export async function callGraduateToken(
  connection: Connection,
  platformKeypair: Keypair,
  bondingCurveAddress: PublicKey,
  mintAddress: PublicKey
) {
  console.log('🎓 Calling graduate_token');
  console.log('Bonding Curve:', bondingCurveAddress.toBase58());
  console.log('Mint:', mintAddress.toBase58());
  
  // Get bonding curve data to find creator
  const curveAccount = await connection.getAccountInfo(bondingCurveAddress);
  if (!curveAccount) {
    throw new Error('Bonding curve not found');
  }
  
  // Parse creator from bonding curve account (offset 8, 32 bytes)
  const creator = new PublicKey(curveAccount.data.slice(8, 40));
  console.log('Creator:', creator.toBase58());
  
  // Get token accounts
  const bondingCurveTokenAccount = getAssociatedTokenAddressSync(
    mintAddress,
    bondingCurveAddress,
    true
  );
  
  const platformTokenAccount = getAssociatedTokenAddressSync(
    mintAddress,
    platformKeypair.publicKey
  );
  
  // Discriminator for graduate_token
  // SHA256("global:graduate_token")[0..8]
  const instructionData = Buffer.from([235, 199, 225, 44, 59, 251, 230, 25]);
    
  const instruction = {
    keys: [
      { pubkey: platformKeypair.publicKey, isSigner: true, isWritable: true },
      { pubkey: creator, isSigner: false, isWritable: true },
      { pubkey: bondingCurveAddress, isSigner: false, isWritable: true },
      { pubkey: mintAddress, isSigner: false, isWritable: true },
      { pubkey: bondingCurveTokenAccount, isSigner: false, isWritable: true },
      { pubkey: platformTokenAccount, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: new PublicKey('SysvarRent111111111111111111111111111111111'), isSigner: false, isWritable: false },
    ],
    programId: BONDING_CURVE_PROGRAM_ID,
    data: instructionData,
  };
  
  const transaction = new Transaction().add(instruction);
  transaction.feePayer = platformKeypair.publicKey;
  transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
  
  transaction.sign(platformKeypair);
  const txid = await connection.sendRawTransaction(transaction.serialize());
  await connection.confirmTransaction(txid, 'confirmed');
  
  console.log('✅ graduate_token complete! TX:', txid);
  console.log('📦 Platform received 200M tokens at:', platformTokenAccount.toBase58());
  
  return {
    success: true,
    txid,
    platformTokenAccount: platformTokenAccount.toBase58(),
  };
}