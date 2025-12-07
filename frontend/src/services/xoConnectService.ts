import { BrowserProvider, Eip1193Provider, JsonRpcProvider, Wallet, Contract, parseUnits, formatUnits } from "ethers";
import { env } from "../config/env";

// xo-connect does not ship TypeScript definitions publicly yet (placeholder).
// The following type declarations keep the compiler satisfied while documenting
// the minimal API surface the UI consumes.

// Token types supported by Beexo Wallet
export interface TokenInfo {
  symbol: string;
  name: string;
  address: string; // "native" for ETH/MATIC, "custodial" for XO points
  decimals: number;
  balance: string;
  type: "native" | "erc20" | "custodial";
  icon?: string;
}

// eslint-disable-next-line @typescript-eslint/consistent-type-definitions
type XoConnectInstance = {
  connect: () => Promise<{ alias: string; provider: BrowserProvider }>;
  disconnect: () => Promise<void>;
  // Extended XO Connect API for tokens
  getBalances?: () => Promise<TokenInfo[]>;
  personalSign?: (message: string) => Promise<string>;
  transactionSign?: (tx: TransactionRequest) => Promise<string>;
};

interface TransactionRequest {
  to: string;
  value?: string;
  data?: string;
  gasLimit?: string;
}

declare const XOConnect: {
  new (config: { projectId: string }): XoConnectInstance;
};

// ERC20 ABI mínimo para consultar balances y aprobar transfers
const ERC20_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
  "function name() view returns (string)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function transfer(address to, uint256 amount) returns (bool)"
];

// Tokens soportados - Solo nativos para testnet (USDT/USDC no existen en Amoy)
const DEFAULT_TOKENS: Omit<TokenInfo, "balance">[] = [
  { symbol: "POL", name: "Polygon", address: "native", decimals: 18, type: "native", icon: "🟣" },
  { symbol: "XO", name: "XO Points", address: "custodial", decimals: 2, type: "custodial", icon: "⭐" },
];

/**
 * XO-CONNECT wrapper. Responsible for bootstrapping wallet identity, resolving the
 * user alias, and exposing signer/provider objects used by the match service.
 * Extended to support multiple tokens for betting.
 */
type AnyProvider = BrowserProvider | JsonRpcProvider;

declare global {
  interface Window {
    ethereum?: Eip1193Provider;
  }
}

class XoConnectService {
  private instance?: XoConnectInstance;
  private provider?: AnyProvider;
  private mockWallet?: Wallet;
  private alias = "";
  private userAddress = "";
  private tokenBalances: TokenInfo[] = [];
  private initialized = false;

  /**
   * Check if there's an existing wallet connection WITHOUT asking for permission.
   * Returns the connected address or null if not connected.
   */
  async checkExistingConnection(): Promise<string | null> {
    const browserWindow = globalThis as Window & typeof globalThis;
    if (!browserWindow.ethereum) {
      console.log("⚠️ No wallet detected");
      return null;
    }

    try {
      // eth_accounts doesn't trigger a popup - just checks existing connections
      const provider = new BrowserProvider(browserWindow.ethereum);
      const accounts = await provider.send("eth_accounts", []) as string[];
      console.log("🔍 Cuentas existentes:", accounts);
      
      if (accounts.length > 0 && accounts[0] !== "0x" + "0".repeat(40)) {
        return accounts[0];
      }
      return null;
    } catch (error) {
      console.error("Error checking existing connection:", error);
      return null;
    }
  }

  async init() {
    if (this.initialized) return;
    this.initialized = true;

    // Ir directo a MetaMask/wallet del navegador
    const browserWindow = globalThis as Window & typeof globalThis;
    if (browserWindow.ethereum) {
      console.log("🦊 MetaMask detectado, conectando...");
      this.provider = new BrowserProvider(browserWindow.ethereum);
      
      try {
        // Pedir conexión explícitamente
        const accounts = await this.provider.send("eth_requestAccounts", []) as string[];
        console.log("✅ Cuentas conectadas:", accounts);
        
        // Intentar cambiar a Polygon Amoy automáticamente
        await this.switchToPolygonAmoy(browserWindow.ethereum);
        
        // Recrear provider después de cambio de red
        this.provider = new BrowserProvider(browserWindow.ethereum);
        
        if (accounts.length > 0) {
          this.userAddress = accounts[0];
          const signer = await this.provider.getSigner();
          this.userAddress = await signer.getAddress();
          console.log("👛 Dirección del usuario:", this.userAddress);
        }
      } catch (connectError: unknown) {
        console.error("❌ Error conectando wallet:", connectError);
        const err = connectError as { code?: number };
        if (err.code === -32002) {
          alert("Por favor abre MetaMask y aprueba la solicitud de conexión pendiente");
        }
        this.userAddress = "0x" + "0".repeat(40);
      }
      
      // Crear alias desde la dirección
      this.alias = this.userAddress 
        ? `${this.userAddress.slice(0, 6)}...${this.userAddress.slice(-4)}`
        : "Sin conectar";
      
    } else {
      console.warn("⚠️ No hay wallet detectada, usando RPC público");
      this.provider = new JsonRpcProvider(env.polygonRpc);
      this.userAddress = "0x" + "0".repeat(40);
      this.alias = "Sin wallet";
    }
    
    // Fetch balances from chain (skip ERC20 tokens on testnet)
    // await this.fetchTokenBalances();
  }

  /**
   * Switch MetaMask to Polygon Amoy network
   */
  private async switchToPolygonAmoy(ethereum: Eip1193Provider): Promise<void> {
    const POLYGON_AMOY_CHAIN_ID = "0x13882"; // 80002 in hex
    
    try {
      // Try to switch to the network
      await ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: POLYGON_AMOY_CHAIN_ID }]
      });
      console.log("✅ Cambiado a Polygon Amoy");
    } catch (switchError: unknown) {
      const err = switchError as { code?: number };
      // Error 4902 means the chain is not added yet
      if (err.code === 4902) {
        console.log("📡 Agregando Polygon Amoy a MetaMask...");
        await ethereum.request({
          method: "wallet_addEthereumChain",
          params: [{
            chainId: POLYGON_AMOY_CHAIN_ID,
            chainName: "Polygon Amoy Testnet",
            nativeCurrency: {
              name: "POL",
              symbol: "POL",
              decimals: 18
            },
            rpcUrls: [
              "https://polygon-amoy.drpc.org",
              "https://rpc-amoy.polygon.technology",
              "https://polygon-amoy-bor-rpc.publicnode.com"
            ],
            blockExplorerUrls: ["https://amoy.polygonscan.com"]
          }]
        });
        console.log("✅ Polygon Amoy agregado y seleccionado");
      } else {
        console.warn("⚠️ No se pudo cambiar de red:", switchError);
      }
    }
  }

  /**
   * Fetch token balances from the blockchain
   */
  async fetchTokenBalances(): Promise<TokenInfo[]> {
    if (!this.provider || !this.userAddress) {
      // Return mock balances for demo
      this.tokenBalances = DEFAULT_TOKENS.map(t => ({
        ...t,
        balance: t.type === "custodial" ? "100.00" : t.type === "native" ? "0.5" : "25.00"
      }));
      return this.tokenBalances;
    }

    const balances: TokenInfo[] = [];

    for (const token of DEFAULT_TOKENS) {
      try {
        let balance = "0";
        
        if (token.type === "native") {
          const rawBalance = await this.provider.getBalance(this.userAddress);
          balance = formatUnits(rawBalance, token.decimals);
        } else if (token.type === "erc20") {
          const contract = new Contract(token.address, ERC20_ABI, this.provider);
          const rawBalance = await contract.balanceOf(this.userAddress);
          balance = formatUnits(rawBalance, token.decimals);
        } else if (token.type === "custodial") {
          // Custodial tokens are managed by Beexo backend - mock for now
          balance = "100.00";
        }

        balances.push({
          ...token,
          balance: parseFloat(balance).toFixed(token.decimals > 2 ? 4 : 2)
        });
      } catch (error) {
        console.warn(`Failed to fetch balance for ${token.symbol}:`, error);
        balances.push({ ...token, balance: "0" });
      }
    }

    this.tokenBalances = balances;
    return balances;
  }

  getAlias() {
    return this.alias || "Anon Player";
  }

  getAddress() {
    return this.userAddress;
  }

  getUserAddress() {
    return this.userAddress || "";
  }

  /**
   * Get all available tokens with balances
   */
  getTokens(): TokenInfo[] {
    return this.tokenBalances;
  }

  /**
   * Get balance for a specific token
   */
  getTokenBalance(symbol: string): string {
    const token = this.tokenBalances.find(t => t.symbol === symbol);
    return token?.balance || "0";
  }

  getProvider() {
    if (!this.provider) {
      throw new Error("XO-CONNECT not initialized. Call init() first.");
    }
    return this.provider;
  }

  /**
   * Get a read-only provider that always uses the correct RPC for Polygon Amoy.
   * This avoids issues when MetaMask is connected to a different network.
   */
  getReadProvider(): JsonRpcProvider {
    return new JsonRpcProvider(env.polygonRpc);
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

  /**
   * Sign a message using XO Connect personalSign or fallback
   */
  async signMessage(message: string): Promise<string> {
    if (this.instance?.personalSign) {
      return this.instance.personalSign(message);
    }
    const signer = await this.getSigner();
    return signer.signMessage(message);
  }

  /**
   * Approve token spending for betting contract
   */
  async approveToken(tokenSymbol: string, spenderAddress: string, amount: string): Promise<string> {
    const token = this.tokenBalances.find(t => t.symbol === tokenSymbol);
    if (!token) throw new Error(`Token ${tokenSymbol} not found`);
    if (token.type !== "erc20") throw new Error(`Token ${tokenSymbol} is not an ERC20 token`);

    const signer = await this.getSigner();
    const contract = new Contract(token.address, ERC20_ABI, signer);
    const amountWei = parseUnits(amount, token.decimals);
    
    const tx = await contract.approve(spenderAddress, amountWei);
    const receipt = await tx.wait();
    return receipt.hash;
  }

  /**
   * Send a bet transaction using XO Connect transactionSign
   */
  async sendBetTransaction(
    contractAddress: string,
    tokenSymbol: string,
    amount: string,
    matchId: number
  ): Promise<string> {
    const token = this.tokenBalances.find(t => t.symbol === tokenSymbol);
    if (!token) throw new Error(`Token ${tokenSymbol} not found`);

    // For custodial tokens, use XO Connect's internal API
    if (token.type === "custodial" && this.instance?.transactionSign) {
      // Custodial tokens use a special transaction format
      return this.instance.transactionSign({
        to: contractAddress,
        data: `bet:${matchId}:${amount}:${tokenSymbol}`
      });
    }

    const signer = await this.getSigner();
    
    if (token.type === "native") {
      // Send native token (MATIC)
      const tx = await signer.sendTransaction({
        to: contractAddress,
        value: parseUnits(amount, token.decimals)
      });
      const receipt = await tx.wait();
      return receipt?.hash || "";
    }

    // For ERC20, the contract should have transferFrom after approval
    // This is a simplified version - real implementation would call the betting contract
    const contract = new Contract(token.address, ERC20_ABI, signer);
    const amountWei = parseUnits(amount, token.decimals);
    const tx = await contract.transfer(contractAddress, amountWei);
    const receipt = await tx.wait();
    return receipt.hash;
  }

  async disconnect() {
    await this.instance?.disconnect();
    this.provider = undefined;
    this.mockWallet = undefined;
    this.alias = "";
    this.userAddress = "";
    this.tokenBalances = [];
    this.initialized = false;
  }

  /**
   * Reset the service to allow re-initialization
   */
  reset() {
    this.initialized = false;
  }
}

export const xoConnectService = new XoConnectService();
