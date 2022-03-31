use anchor_lang::prelude::*;

declare_id!("Gy2T8gX6mcgVe57vxmMUg888iRTsLUtR8GDXpHHYox2W");

#[program]
pub mod blog_dapp {
    use super::*;
    pub fn initialize(ctx: Context<Initialize>, blog_account_bump: u8) -> Result<()> {
        *ctx.accounts.blog_account = Blog {
            bump: blog_account_bump,
            authority: ctx.accounts.user.to_account_info().key(),
            post_count: 0
        };

        Ok(())
    }

    pub fn create_post(ctx: Context<CreatePost>, post_account_bump: u8, title: String, body: String) -> Result<()> {
        *ctx.accounts.post_account = Post {
            bump: post_account_bump,
            authority: ctx.accounts.authority.to_account_info().key(),
            title,
            body,
            entry: ctx.accounts.blog_account.post_count
        };

        // On pourrait ajouter une vérification de taille pour le titre et le body pour mettre une erreur custom

        ctx.accounts.blog_account.post_count += 1;

        Ok(())
    }

    pub fn update_post(ctx: Context<UpdatePost>, title: String, body: String) -> Result<()> {
        ctx.accounts.post_account.title = title;
        ctx.accounts.post_account.body = body;

        Ok(())
    }

    pub fn delete_post(_ctx: Context<DeletePost>) -> Result<()> { Ok(()) }
}

/*
   Le compte blog (blog_account) sera une PDA dérivé de la seed :
   "blog_v0" et de l'addresse de l'utilisateur
   bump indique que ce sera une PDA
 */
#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init,
        seeds = [
            b"blog_v0".as_ref(),
            user.key().as_ref()
        ],
        bump,
        payer = user,
        space = Blog::LEN
    )]
    blog_account: Account<'info, Blog>,
    #[account(mut)]
    user: Signer<'info>,
    system_program: Program<'info, System>
}

/*
   Le compte post (post_account) sera une PDA dérivé de la seed :
   "post", de l'addresse du blog et de son "id" représenté par l'article crée précédemment connu par le compteur
   bump indique que ce sera une PDA
 */
#[derive(Accounts)]
#[instruction(post_account_bump: u8, title: String, body: String)]
pub struct CreatePost<'info> {
    #[account(mut, has_one = authority)]
    blog_account: Account<'info, Blog>,
    #[account(
        init,
        seeds = [
            b"post".as_ref(),
            blog_account.key().as_ref(),
            &[blog_account.post_count as u8].as_ref()
        ],
        bump,
        payer = authority,
        space = Post::LEN + (title.len() * 2) + (body.len() * 2)
    )]
    post_account: Account<'info, Post>,
    #[account(mut)]
    authority: Signer<'info>,
    system_program: Program<'info, System>
}

#[derive(Accounts)]
pub struct UpdatePost<'info> {
    #[account(mut, has_one = authority)]
    pub blog_account: Account<'info, Blog>,
    #[account(mut, has_one = authority)]
    post_account: Account<'info, Post>,
    authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct DeletePost<'info> {
    #[account(mut, has_one = authority, close = authority)]
    post_account: Account<'info, Post>,
    authority: Signer<'info>,
}

/*
Structure du Blog
Il y aura une quantité de poste
Une authorité
Un bump indiquant que le blog sera une PDA
 */
#[account]
pub struct Blog {
    pub bump: u8,
    pub post_count: u8,
    pub authority: Pubkey
}

#[account]
pub struct Post {
    pub authority: Pubkey,
    pub title: String,
    pub body: String,
    pub bump: u8,
    pub entry: u8
}

const DISCRIMINATOR_LENGTH: usize = 8;
const BUMP: usize = 1; // u8 donc 8 bits donc 1 byte
const COUNTER: usize = 1; // u8 = 1 (u8 = 8 bits = 1 byte. u16 = 16 bits = 2 bytes, u32 = 32 bits = 4 bytes, u64 = 64 bits = 8 bytes)
const PUBKEY: usize = 32;

impl Blog {
    const LEN: usize =
        DISCRIMINATOR_LENGTH
        + BUMP
        + COUNTER
        + PUBKEY;
}

const POST_DISCRIMINATOR_LENGTH: usize = 8;
const POST_BUMP: usize = 1; // u8 donc 8 bits donc 1 byte
const POST_ENTRY: usize = 1;
const POST_TITLE_LENGTH_PREFIX: usize = 4; // Prefix d'une string = 4
const POST_CONTENT_LENGTH_PREFIX: usize = 4;
const POST_PUBKEY: usize = 32;

impl Post {
    const LEN: usize =
        POST_DISCRIMINATOR_LENGTH
            + POST_BUMP
            + POST_ENTRY
            + POST_TITLE_LENGTH_PREFIX
            + POST_CONTENT_LENGTH_PREFIX
            + POST_PUBKEY;
}