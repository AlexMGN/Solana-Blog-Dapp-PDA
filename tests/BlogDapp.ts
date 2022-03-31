import assert from "assert";
import * as anchor from "@project-serum/anchor";
import * as helpers from "./helpers";

describe("BlogDapp", async () => {
    const connection = new anchor.web3.Connection(
        "http://localhost:8899",
        anchor.Provider.defaultOptions().preflightCommitment
    );

    const provider = helpers.getProvider(
        connection,
        anchor.web3.Keypair.generate()
    );

    const program = helpers.getProgram(provider);

    const [blogAccount, blogAccountBump] =
        await anchor.web3.PublicKey.findProgramAddress(
            [Buffer.from("blog_v0"), provider.wallet.publicKey.toBuffer()],
            program.programId
        );

    before(async () => {
        await helpers.requestAirdrop(connection, provider.wallet.publicKey)
    });

    const [postAccount, postAccountBump] =
        await anchor.web3.PublicKey.findProgramAddress(
            [
                 Buffer.from("post"),
                blogAccount.toBuffer(),
                new anchor.BN(0).toArrayLike(Buffer)
            ],
            program.programId
        )

    it("Initialize blog", async () => {
        await program.methods.initialize(blogAccountBump)
            .accounts({
            blogAccount,
            user: provider.wallet.publicKey,
            systemProgram: anchor.web3.SystemProgram.programId
            })
            .rpc()

        const blogState = await program.account.blog.fetch(blogAccount);
        assert.equal(0, blogState.postCount);
    });

    it("Create a new Post and increment the post counter", async () => {
        const [title, body] = ["Hello World", "gm, this is a test post"];

        await program.methods.createPost(postAccountBump, title, body)
          .accounts({
              blogAccount,
              postAccount,
              authority: provider.wallet.publicKey,
              systemProgram: anchor.web3.SystemProgram.programId
          })
          .rpc()

      const blogState = await program.account.blog.fetch(blogAccount);
      const postState = await program.account.post.fetch(postAccount);

      assert.equal(title, postState.title);
      assert.equal(body, postState.body);
      assert.equal(0, postState.entry);
      assert.equal(1, blogState.postCount);
  });

    it("Requires the correct signer to create a post", async () => {
        const [title, body] = ["Hello World", "gm, this is an unauthorized post"];

        const [secondPostAccount, secondPostAccountBump] =
            await anchor.web3.PublicKey.findProgramAddress(
                [
                    Buffer.from("post"),
                    blogAccount.toBuffer(),
                    new anchor.BN(1).toArrayLike(Buffer),
                ],
                program.programId
            );

        const newKeypair = anchor.web3.Keypair.generate();
        await helpers.requestAirdrop(connection, newKeypair.publicKey);

        const newProvider = helpers.getProvider(connection, newKeypair);
        const newProgram = helpers.getProgram(newProvider);

        let error;

        try {
            await newProgram.methods.createPost(secondPostAccountBump, title, body)
                .accounts({
                    blogAccount,
                    postAccount: secondPostAccount,
                    authority: provider.wallet.publicKey,
                    systemProgram: anchor.web3.SystemProgram.programId,
                })
                .rpc()
        } catch (err) {
            error = err;
        } finally {
            assert.equal(error.message, "Signature verification failed");
        }
    });

    it("Update a Post", async () => {
        const [title, body] = ["Hello World updated", "gm, this is an test post updated"];

        await program.methods.updatePost(title, body)
            .accounts({
                blogAccount,
                postAccount,
                authority: provider.wallet.publicKey,
            })
            .rpc()

        const blogState = await program.account.blog.fetch(blogAccount);
        const postState = await program.account.post.fetch(postAccount);

        assert.equal(1, blogState.postCount);
        assert.equal(title, postState.title);
        assert.equal(body, postState.body);
    });

    it("Bad authority try to update a Post", async () => {
        const badAuthority = anchor.web3.Keypair.generate();
        await helpers.requestAirdrop(connection, badAuthority.publicKey);

        const providerForBadAuthority = helpers.getProvider(connection, badAuthority);
        const programForBadAuthority = helpers.getProgram(providerForBadAuthority);

        const title = "Hello World updated bad authority";
        const body = "gm, this is a test post updated bad authority";

        let error;

        try {
            await programForBadAuthority.methods.updatePost(title, body)
                .accounts({
                    blogAccount,
                    postAccount,
                    authority: provider.wallet.publicKey,
                })
                .rpc()
        } catch (err) {
            error = err;
        } finally {
            assert.equal(error.message, "Signature verification failed");
        }
    });

    it("Bad authority try to delete a Post", async () => {
        const badAuthority = anchor.web3.Keypair.generate();
        await helpers.requestAirdrop(connection, badAuthority.publicKey);

        const providerForBadAuthority = helpers.getProvider(connection, badAuthority);
        const programForBadAuthority = helpers.getProgram(providerForBadAuthority);

        try {
            await programForBadAuthority.methods.deletePost()
                .accounts({
                    postAccount,
                    authority: provider.wallet.publicKey,
                })
                .rpc();
        } catch (err) {
            assert.equal(err.message, "Signature verification failed");
        }
    });

    it('Get All Posts for an account', async () => {
        // On recréer une autre PDA (BN(1), le premier était égal à 0)
        const [postAccount, postAccountBump] =
            await anchor.web3.PublicKey.findProgramAddress(
                [
                    Buffer.from("post"),
                    blogAccount.toBuffer(),
                    new anchor.BN(1).toArrayLike(Buffer),
                ],
                program.programId
            );

        const [title, body] = ["Deuxième article", "Deuxième body"];

        // On créer le poste
        await program.methods.createPost(postAccountBump, title, body)
            .accounts({
                blogAccount,
                postAccount,
                authority: provider.wallet.publicKey,
                systemProgram: anchor.web3.SystemProgram.programId
            })
            .rpc()

        // On récupère les posts
        const postsForOneWallet = await program.account.post.all([{
            memcmp: {
                offset: 8,
                bytes: provider.wallet.publicKey.toBase58(),
            }
        }]);

        console.log(postsForOneWallet)

        // On supprime le dernier post créer
        await program.methods.deletePost()
            .accounts({
                postAccount,
                authority: provider.wallet.publicKey,
            })
            .rpc();

        try {
            await program.account.post.fetch(postAccount);
        } catch (err) {
            assert.equal(err.message, "Account does not exist " + postAccount);
        }
    });

    it('It Delete a post', async () => {
        await program.methods.deletePost()
            .accounts({
                postAccount,
                authority: provider.wallet.publicKey,
            })
            .rpc();

        try {
            await program.account.post.fetch(postAccount);
        } catch (err) {
            assert.equal(err.message, "Account does not exist " + postAccount);
        }
    });

    it('Get All Posts created (before delete test)', async () => {
        const allPosts = await program.account.post.all();
        // console.log(allPosts)
    });

});
