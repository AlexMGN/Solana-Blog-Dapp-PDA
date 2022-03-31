import * as anchor from "@project-serum/anchor";
import { BlogDapp } from '../target/types/blog_dapp'

export function getProgram(
    provider: anchor.Provider
): anchor.Program<BlogDapp> {
    const idl = require("../target/idl/blog_dapp.json");
    const programID = new anchor.web3.PublicKey(idl.metadata.address);
    return new anchor.Program(idl, programID, provider);
}

export function getProvider(
    connection: anchor.web3.Connection,
    keypair: anchor.web3.Keypair
): anchor.Provider {
    const wallet = new anchor.Wallet(keypair);
    return new anchor.Provider(
        connection,
        wallet,
        anchor.Provider.defaultOptions()
    );
}

export async function requestAirdrop(
    connection: anchor.web3.Connection,
    publicKey: anchor.web3.PublicKey
): Promise<void> {
    const airdropSignature = await connection.requestAirdrop(
        publicKey,
        anchor.web3.LAMPORTS_PER_SOL * 20
    );
    await connection.confirmTransaction(airdropSignature);
}
