// Kept outside src/auth.tsx so presentational views and Storybook stories can
// use instanceof without importing Firebase or initializing the app.
export class GoogleLinkRequiredError extends Error {
  constructor(
    public readonly email: string,
    private readonly linkAccount: (password: string) => Promise<void>,
  ) {
    super(
      `Já existe uma conta com o email ${email}. Digite a senha dela para conectar o Google.`,
    );
  }

  link(password: string) {
    return this.linkAccount(password);
  }
}
