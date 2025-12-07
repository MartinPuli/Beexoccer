/**
 * XO Connect Service - Integración con Beexo Wallet
 * 
 * Este servicio maneja la conexión con Beexo Wallet a través de XO Connect,
 * permitiendo firmar mensajes, enviar transacciones e interactuar con smart contracts.
 */

import { BrowserProvider, JsonRpcProvider, Contract, parseUnits, formatUnits, Signer } from "ethers";
import { env } from "../config/env";

// Importar XO Connect
// @ts-expect-error - XO Connect types may not be fully available
import { XOConnectProvider, XOConnect } from "xo-connect";

// Token types supported by Beexo Wallet
export interface TokenInfo {
  symbol: string;
  name: string;
  address: string;
  decimals: number;
  balance: string;
  type: "native" | "erc20" | "custodial";
  icon?: string;
  chainId?: string;
}

// Client info from XO Connect
interface XOClient {
  alias: string;
  currencies: Array<{
    id: string;
    symbol: string;
    address: string;
    image: string;
    chainId: string;
    decimals?: number;
  }>;
}

// ERC20 ABI mínimo para consultar balances
const ERC20_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
  "function name() view returns (string)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)"
];

// Polygon Amoy chain config
const POLYGON_AMOY_CHAIN_ID = "0x13882"; // 80002 in hex
const POLYGON_AMOY_CONFIG = {
  chainId: POLYGON_AMOY_CHAIN_ID,
  chainName: "Polygon Amoy Testnet",
  nativeCurrency: {
    name: "POL",
    symbol: "POL",
    decimals: 18
  },
  rpcUrls: [
    "https://polygon-amoy.drpc.org",
    "https://rpc-amoy.polygon.technology"
  ],
  blockExplorerUrls: ["https://amoy.polygonscan.com"]
};

class XoConnectService {
  private xoProvider?: typeof XOConnectProvider;
  private ethersProvider?: BrowserProvider;
  private signer?: Signer;
  private alias = "";
  private userAddress = "";
  private tokenBalances: TokenInfo[] = [];
  private initialized = false;
  private isBeexoWallet = false;

  /**
   * Detect if we're running inside Beexo Wallet WebView
   */
  private detectBeexoWallet(): boolean {
    const browserWindow = globalThis as Window & typeof globalThis;
    
    // Check for XO Connect specific markers
    if (typeof XOConnectProvider !== 'undefined') {
      console.log("🐝 XOConnectProvider disponible");
      return true;
    }
    
    // Check user agent for Beexo
    if (navigator.userAgent.includes('Beexo') || navigator.userAgent.includes('XOConnect')) {
      console.log("🐝 Beexo Wallet detectada por User-Agent");
      return true;
    }
    
    // Check for injected XO Connect
    if ((browserWindow as unknown as Record<string, unknown>).XOConnect) {
      console.log("🐝 XOConnect inyectado en window");
      return true;
    }
    
    return false;
  }

  /**
   * Check if there's an existing wallet connection
   */
  async checkExistingConnection(): Promise<string | null> {
    const browserWindow = globalThis as Window & typeof globalThis;
    
    // Try XO Connect first
    if (this.detectBeexoWallet()) {
      try {
        const client = await XOConnect.getClient();
        if (client?.alias) {
          console.log("🐝 Sesión existente de Beexo:", client.alias);
          return client.alias;
        }
      } catch {
        console.log("No hay sesión XO Connect existente");
      }
    }
    
    // Fallback to MetaMask
    if (browserWindow.ethereum) {
      try {
        const provider = new BrowserProvider(browserWindow.ethereum);
        const accounts = await provider.send("eth_accounts", []) as string[];
        if (accounts.length > 0 && accounts[0] !== "0x" + "0".repeat(40)) {
          return accounts[0];
        }
      } catch (error) {
        console.error("Error checking MetaMask connection:", error);
      }
    }
    
    return null;
  }

  /**
   * Initialize connection - prefers XO Connect, falls back to MetaMask
   */
  async init() {
    if (this.initialized) return;
    
    console.log("🔌 Inicializando XO Connect Service...");
    
    this.isBeexoWallet = this.detectBeexoWallet();
    
    if (this.isBeexoWallet) {
      await this.initWithXOConnect();
    } else {
      await this.initWithMetaMask();
    }
    
    this.initialized = true;
    
    // Fetch token balances after connection
    await this.fetchTokenBalances();
    
    console.log("✅ XO Connect Service inicializado:", {
      alias: this.alias,
      address: this.userAddress,
      isBeexo: this.isBeexoWallet,
      tokens: this.tokenBalances.length
    });
  }

  /**
   * Initialize with XO Connect (Beexo Wallet)
   */
  private async initWithXOConnect() {
    console.log("🐝 Conectando con Beexo Wallet via XO Connect...");
    
    try {
      // Create XO Connect Provider
      this.xoProvider = new XOConnectProvider();
      
      // Wrap in ethers BrowserProvider
      // Note: ethers v6 uses BrowserProvider instead of Web3Provider
      this.ethersProvider = new BrowserProvider(this.xoProvider, "any");
      
      // Request accounts
      await this.ethersProvider.send("eth_requestAccounts", []);
      
      // Get signer
      this.signer = await this.ethersProvider.getSigner();
      this.userAddress = await this.signer.getAddress();
      
      // Get client info from XO Connect
      try {
        const client: XOClient = await XOConnect.getClient();
        this.alias = client.alias || this.formatAddress(this.userAddress);
        
        // Convert currencies to our TokenInfo format
        if (client.currencies && client.currencies.length > 0) {
          this.tokenBalances = client.currencies.map(c => ({
            symbol: c.symbol,
            name: c.symbol,
            address: c.address,
            decimals: c.decimals || 18,
            balance: "0",
            type: c.address === "0x0000000000000000000000000000000000000000" ? "native" : "erc20",
            icon: c.image,
            chainId: c.chainId
          }));
        }
        
        console.log("🐝 Cliente Beexo:", {
          alias: client.alias,
          currencies: client.currencies?.length || 0
        });
      } catch (clientError) {
        console.warn("No se pudo obtener info del cliente XO:", clientError);
        this.alias = this.formatAddress(this.userAddress);
      }
      
    } catch (error) {
      console.error("❌ Error conectando con XO Connect:", error);
      // Fall back to MetaMask if XO Connect fails
      await this.initWithMetaMask();
    }
  }

  /**
   * Initialize with MetaMask (fallback for browser testing)
   */
  private async initWithMetaMask() {
    const browserWindow = globalThis as Window & typeof globalThis;
    
    if (!browserWindow.ethereum) {
      console.warn("⚠️ No hay wallet detectada, usando RPC público");
      this.ethersProvider = undefined;
      this.userAddress = "0x" + "0".repeat(40);
      this.alias = "Sin wallet";
      
      // Set default token for display
      this.tokenBalances = [{
        symbol: "POL",
        name: "Polygon",
        address: "native",
        decimals: 18,
        balance: "0",
        type: "native",
        icon: "🟣"
      }];
      return;
    }

    console.log("🦊 MetaMask detectado, conectando...");
    this.ethersProvider = new BrowserProvider(browserWindow.ethereum);
    
    try {
      // Request accounts
      const accounts = await this.ethersProvider.send("eth_requestAccounts", []) as string[];
      console.log("✅ Cuentas conectadas:", accounts);
      
      // Switch to Polygon Amoy
      await this.switchToPolygonAmoy(browserWindow.ethereum);
      
      // Recreate provider after network switch
      this.ethersProvider = new BrowserProvider(browserWindow.ethereum);
      
      if (accounts.length > 0) {
        this.signer = await this.ethersProvider.getSigner();
        this.userAddress = await this.signer.getAddress();
        this.alias = this.formatAddress(this.userAddress);
      }
      
      // Default tokens for MetaMask
      this.tokenBalances = [{
        symbol: "POL",
        name: "Polygon",
        address: "native",
        decimals: 18,
        balance: "0",
        type: "native",
        icon: "🟣"
      }];
      
    } catch (connectError: unknown) {
      console.error("❌ Error conectando MetaMask:", connectError);
      const err = connectError as { code?: number };
      if (err.code === -32002) {
        throw new Error("Por favor abre MetaMask y aprueba la solicitud de conexión pendiente");
      }
      throw connectError;
    }
  }

  /**
   * Switch MetaMask to Polygon Amoy network
   */
  private async switchToPolygonAmoy(ethereum: unknown): Promise<void> {
    const eth = ethereum as { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> };
    
    try {
      await eth.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: POLYGON_AMOY_CHAIN_ID }]
      });
      console.log("✅ Cambiado a Polygon Amoy");
    } catch (switchError: unknown) {
      const err = switchError as { code?: number };
      if (err.code === 4902) {
        console.log("📡 Agregando Polygon Amoy...");
        await eth.request({
          method: "wallet_addEthereumChain",
          params: [POLYGON_AMOY_CONFIG]
        });
        console.log("✅ Polygon Amoy agregado");
      } else {
        console.warn("⚠️ No se pudo cambiar de red:", switchError);
      }
    }
  }

  /**
   * Format address to short form
   */
  private formatAddress(address: string): string {
    if (!address || address.length < 10) return "Anon";
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  }

  /**
   * Fetch token balances from the blockchain
   */
  async fetchTokenBalances(): Promise<TokenInfo[]> {
    if (!this.userAddress || this.userAddress === "0x" + "0".repeat(40)) {
      return this.tokenBalances;
    }

    const provider = this.getReadProvider();
    const updatedBalances: TokenInfo[] = [];

    for (const token of this.tokenBalances) {
      try {
        let balance = "0";
        
        if (token.type === "native" || token.address === "native") {
          const rawBalance = await provider.getBalance(this.userAddress);
          balance = formatUnits(rawBalance, token.decimals);
        } else if (token.type === "erc20" && token.address !== "native") {
          const contract = new Contract(token.address, ERC20_ABI, provider);
          const rawBalance = await contract.balanceOf(this.userAddress);
          balance = formatUnits(rawBalance, token.decimals);
        } else if (token.type === "custodial") {
          // Custodial tokens handled by Beexo backend
          balance = "0";
        }

        updatedBalances.push({
          ...token,
          balance: parseFloat(balance).toFixed(token.decimals > 2 ? 4 : 2)
        });
      } catch (error) {
        console.warn(`Error fetching balance for ${token.symbol}:`, error);
        updatedBalances.push({ ...token, balance: "0" });
      }
    }

    this.tokenBalances = updatedBalances;
    return updatedBalances;
  }

  // ==================== PUBLIC API ====================

  getAlias(): string {
    return this.alias || "Anon Player";
  }

  getAddress(): string {
    return this.userAddress;
  }

  getUserAddress(): string {
    return this.userAddress || "";
  }

  isConnectedToBeexo(): boolean {
    return this.isBeexoWallet;
  }

  getTokens(): TokenInfo[] {
    return this.tokenBalances;
  }

  getTokenBalance(symbol: string): string {
    const token = this.tokenBalances.find(t => t.symbol === symbol);
    return token?.balance || "0";
  }

  /**
   * Get the ethers provider (for contract interactions)
   */
  getProvider(): BrowserProvider {
    if (!this.ethersProvider) {
      throw new Error("XO Connect no inicializado. Llama a init() primero.");
    }
    return this.ethersProvider;
  }

  /**
   * Get a read-only provider for Polygon Amoy
   */
  getReadProvider(): JsonRpcProvider {
    return new JsonRpcProvider(env.polygonRpc);
  }

  /**
   * Get the signer for transactions
   */
  async getSigner(): Promise<Signer> {
    if (this.signer) {
      return this.signer;
    }
    
    if (!this.ethersProvider) {
      throw new Error("No hay provider disponible");
    }
    
    this.signer = await this.ethersProvider.getSigner();
    return this.signer;
  }

  /**
   * Sign a message
   */
  async signMessage(message: string): Promise<string> {
    const signer = await this.getSigner();
    return signer.signMessage(message);
  }

  /**
   * Approve token spending
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
   * Disconnect wallet
   */
  async disconnect() {
    this.ethersProvider = undefined;
    this.signer = undefined;
    this.xoProvider = undefined;
    this.alias = "";
    this.userAddress = "";
    this.tokenBalances = [];
    this.initialized = false;
    this.isBeexoWallet = false;
  }

  /**
   * Reset the service to allow re-initialization
   */
  reset() {
    this.initialized = false;
  }
}

export const xoConnectService = new XoConnectService();
