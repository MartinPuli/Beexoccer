import { BrowserProvider, Eip1193Provider, JsonRpcProvider, Wallet } from "ethers";
import { env } from "../config/env";

// xo-connect does not ship TypeScript definitions publicly yet (placeholder).
// The following type declarations keep the compiler satisfied while documenting
// the minimal API surface the UI consumes.
// eslint-disable-next-line @typescript-eslint/consistent-type-definitions
type XoConnectInstance = {
  connect: () => Promise<{ alias: string; provider: BrowserProvider }>;
  disconnect: () => Promise<void>;
};

declare const XOConnect: {
  new (config: { projectId: string }): XoConnectInstance;
};

/**
 * XO-CONNECT wrapper. Responsible for bootstrapping wallet identity, resolving the
 * user alias, and exposing signer/provider objects used by the match service.
 * The real SDK is only available inside Beexo Wallet, so during development this
 * service fabricates a deterministic alias and a read-only provider.
 */
type AnyProvider = BrowserProvider | JsonRpcProvider;

declare global {
  // Extends the window object so TypeScript recognizes the injected provider.
  interface Window {
    ethereum?: Eip1193Provider;
  }
}

class XoConnectService {
  private instance?: XoConnectInstance;
  private provider?: AnyProvider;
  private mockWallet?: Wallet;
  private alias = "";

  async init() {
    if (this.provider) return;

    try {
      this.instance = new XOConnect({ projectId: env.xoProjectId });
      const session = await this.instance.connect();
      this.provider = session.provider;
      this.alias = session.alias;
    } catch (error) {
      console.warn("XO-CONNECT unavailable, using mock identity", error);

      // Attempt to reuse any injected wallet (e.g., MetaMask inside dev browsers) before falling back to RPC only mode.
      const browserWindow = globalThis as Window & typeof globalThis;
      if (browserWindow.ethereum) {
        this.provider = new BrowserProvider(browserWindow.ethereum);
      } else {
        this.provider = new JsonRpcProvider(env.polygonRpc);
      }
      this.alias = "Scout" + Math.floor(Math.random() * 999).toString().padStart(3, "0");
    }
  }

  getAlias() {
    return this.alias || "Anon Player";
  }

  getProvider() {
    if (!this.provider) {
      throw new Error("XO-CONNECT not initialized. Call init() first.");
    }
    return this.provider;
  }

  async getSigner() {
    const provider = this.getProvider();

    if (provider instanceof BrowserProvider) {
      return provider.getSigner();
    }

    if (!this.mockWallet) {
      const tempWallet = Wallet.createRandom();
      this.mockWallet = new Wallet(tempWallet.privateKey, provider);
    }

    return this.mockWallet;
  }

  async signMessage(message: string) {
    const signer = await this.getSigner();
    return signer.signMessage(message);
  }

  async disconnect() {
    await this.instance?.disconnect();
    this.provider = undefined;
    this.mockWallet = undefined;
    this.alias = "";
  }
}

export const xoConnectService = new XoConnectService();
