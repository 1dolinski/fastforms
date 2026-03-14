const APINOW_BASE = "https://www.apinow.fun/api/v1";

/**
 * Fetches a Twitter user profile via APINow x402 API.
 * Requires PRIVATE_KEY env var (Base network wallet with USDC).
 * Costs $0.01 per call.
 */
export async function fetchTwitterProfile(username) {
  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) {
    throw new Error(
      "PRIVATE_KEY not set.\n\n" +
      "  Twitter import uses x402 micropayments ($0.01 USDC on Base).\n" +
      "  Set your Base wallet private key:\n\n" +
      "    export PRIVATE_KEY=0x...\n\n" +
      "  Or add it to .fastforms/.env or .env"
    );
  }

  const { privateKeyToAccount } = await import("viem/accounts");
  const { createWalletClient, createPublicClient, http } = await import("viem");
  const { base } = await import("viem/chains");
  const { x402Client, wrapFetchWithPayment } = await import("@x402/fetch");
  const { ExactEvmScheme } = await import("@x402/evm/exact/client");
  const { toClientEvmSigner } = await import("@x402/evm");

  const account = privateKeyToAccount(privateKey);

  const walletClient = createWalletClient({
    account,
    chain: base,
    transport: http("https://mainnet.base.org"),
  });

  const publicClient = createPublicClient({
    chain: base,
    transport: http("https://mainnet.base.org"),
  });

  const signer = toClientEvmSigner(
    {
      address: account.address,
      signTypedData: (args) => walletClient.signTypedData(args),
    },
    {
      readContract: (args) => publicClient.readContract(args),
    }
  );

  const client = new x402Client();
  const scheme = new ExactEvmScheme(signer);
  client.register("eip155:8453", scheme);

  const paidFetch = wrapFetchWithPayment(globalThis.fetch, client);

  const url = `${APINOW_BASE}/twit/getUserByUsername?username=${encodeURIComponent(username)}`;

  console.log(`  Fetching @${username} via x402 ($0.01 USDC on Base)...`);
  console.log(`  Wallet: ${account.address}`);

  const res = await paidFetch(url, {
    headers: { "x-wallet-address": account.address },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Twitter API returned ${res.status}: ${body.slice(0, 200)}`);
  }

  const data = await res.json();
  return data;
}

/**
 * Maps raw Twitter API response to a fastforms user persona.
 */
export function twitterToPersona(data, username) {
  const user = data?.data || data?.user || data;

  const name = user.username || username;
  const fullName = user.name || "";
  const bio = user.description || "";
  const location = user.location || "";

  let website = "";
  if (user.entities?.url?.urls?.[0]?.expanded_url) {
    website = user.entities.url.urls[0].expanded_url;
  } else if (user.url) {
    website = user.url;
  }

  const metrics = user.public_metrics || {};

  const facts = {};
  facts["x handle"] = `@${name}`;
  if (metrics.followers_count) facts["twitter followers"] = String(metrics.followers_count);
  if (metrics.tweet_count) facts["tweet count"] = String(metrics.tweet_count);
  if (user.profile_image_url) facts["avatar"] = user.profile_image_url.replace("_normal", "");

  return {
    name,
    fullName,
    email: "",
    role: "",
    location,
    linkedIn: "",
    github: "",
    bio,
    portfolio: website,
    facts,
  };
}
