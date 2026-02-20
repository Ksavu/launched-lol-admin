import { NextRequest, NextResponse } from 'next/server';
import { Connection, Keypair, PublicKey, Transaction } from '@solana/web3.js';

const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
const SOCIAL_REGISTRY_PROGRAM_ID = new PublicKey('K3Fp6EiRsECtYbj63aG52D7rn2DiJdaLaxnN8MFpprh');

export async function POST(request: NextRequest) {
  try {
    const { registryAddress, tokenMint } = await request.json();

    // Load platform wallet
    const platformSecret = process.env.PLATFORM_WALLET_SECRET_KEY;
    if (!platformSecret) {
      throw new Error('Platform wallet not configured');
    }

    const platformKeypair = Keypair.fromSecretKey(
      Uint8Array.from(JSON.parse(platformSecret))
    );

    const registryPubkey = new PublicKey(registryAddress);
    const mintPubkey = new PublicKey(tokenMint);

    // Create verify_social instruction
    const instructionData = Buffer.from([
      0x01, // verify_social discriminator (update with actual)
    ]);

    const instruction = {
      keys: [
        { pubkey: platformKeypair.publicKey, isSigner: true, isWritable: false },
        { pubkey: registryPubkey, isSigner: false, isWritable: true },
        { pubkey: mintPubkey, isSigner: false, isWritable: false },
      ],
      programId: SOCIAL_REGISTRY_PROGRAM_ID,
      data: instructionData,
    };

    const transaction = new Transaction().add(instruction);
    transaction.feePayer = platformKeypair.publicKey;
    transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

    transaction.sign(platformKeypair);
    const txid = await connection.sendRawTransaction(transaction.serialize());
    await connection.confirmTransaction(txid, 'confirmed');

    return NextResponse.json({ success: true, txid });
  } catch (error: any) {
    console.error('Error verifying social:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}