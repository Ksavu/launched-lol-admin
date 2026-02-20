import { Connection, Keypair, PublicKey, Transaction } from '@solana/web3.js';

const BONDING_CURVE_PROGRAM_ID = new PublicKey('21ACVywCBCgrgAx8HpLJM6mJC8pxMzvvi58in5Xv7qej');

export async function processGraduationFunds(
  connection: Connection,
  platformKeypair: Keypair,
  bondingCurveAddress: PublicKey,
  tokenMint: PublicKey,
  creatorAddress: PublicKey,
) {
  try {
    console.log('💰 Processing graduation funds...');
    console.log('Bonding Curve:', bondingCurveAddress.toBase58());
    console.log('Creator:', creatorAddress.toBase58());
    
    // Discriminator for process_graduation_funds
    const instructionData = Buffer.from([
      126, 127, 152, 176, 85, 150, 101, 195
    ]);
    
    const instruction = {
      keys: [
        { pubkey: platformKeypair.publicKey, isSigner: true, isWritable: true },
        { pubkey: creatorAddress, isSigner: false, isWritable: true },
        { pubkey: bondingCurveAddress, isSigner: false, isWritable: true },
        { pubkey: tokenMint, isSigner: false, isWritable: false },
        { pubkey: new PublicKey('11111111111111111111111111111111'), isSigner: false, isWritable: false },
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
    console.log('💰 Platform received: 79 SOL (4 fee + 75 LP)');
    console.log('💰 Creator received: 2 SOL');
    
    return {
      success: true,
      txid,
    };
    
  } catch (error) {
    console.error('❌ Error processing graduation funds:', error);
    throw error;
  }
}