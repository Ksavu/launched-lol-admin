import { Connection, Keypair, PublicKey, Transaction, SystemProgram } from '@solana/web3.js';
import { getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID } from '@solana/spl-token';

const BONDING_CURVE_PROGRAM_ID = new PublicKey('21ACVywCBCgrgAx8HpLJM6mJC8pxMzvvi58in5Xv7qej');

export async function processGraduationFunds(
  connection: Connection,
  platformKeypair: Keypair,
  bondingCurveAddress: PublicKey,
  mintAddress: PublicKey,
  creator: PublicKey
): Promise<{ success: boolean; txid: string; platformReceived: string; creatorReceived: string; error?: string }> {
  
  console.log('💰 Processing graduation funds...');
  console.log('Bonding Curve:', bondingCurveAddress.toBase58());
  console.log('Creator:', creator.toBase58());

  // Check SOL balance
  const balance = await connection.getBalance(bondingCurveAddress);
  const balanceSOL = balance / 1e9;
  
  console.log(`📊 Bonding curve balance: ${balanceSOL} SOL`);
  
  if (balanceSOL < 81) {
    const error = `Insufficient balance: ${balanceSOL.toFixed(4)} SOL (need 81 SOL)`;
    console.log(`⚠️ ${error}`);
    return {
      success: false,
      txid: '',
      platformReceived: '0 SOL',
      creatorReceived: '0 SOL',
      error
    };
  }

  try {
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

    // Discriminator for process_graduation_funds
    // SHA256("global:process_graduation_funds")[0..8]
    const instructionData = Buffer.from([126, 127, 152, 176, 85, 150, 101, 195]);

    const instruction = {
      keys: [
        { pubkey: bondingCurveAddress, isSigner: false, isWritable: true },
        { pubkey: mintAddress, isSigner: false, isWritable: true },
        { pubkey: bondingCurveTokenAccount, isSigner: false, isWritable: true },
        { pubkey: platformTokenAccount, isSigner: false, isWritable: true },
        { pubkey: platformKeypair.publicKey, isSigner: true, isWritable: true },
        { pubkey: creator, isSigner: false, isWritable: true },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
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

    console.log('✅ Funds distributed! TX:', txid);
    
    return {
      success: true,
      txid,
      platformReceived: '79.005 SOL + all remaining tokens',
      creatorReceived: '2 SOL',
    };

  } catch (error: any) {
    console.error('❌ Error processing graduation funds:', error);
    return {
      success: false,
      txid: '',
      platformReceived: '0 SOL',
      creatorReceived: '0 SOL',
      error: error.message,
    };
  }
}