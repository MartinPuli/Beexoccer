/**
 * XO Connect Service - Integración EXCLUSIVA con Beexo Wallet
 * 
 * Este servicio SOLO funciona con Beexo Wallet via XO Connect.
 * Si el usuario no tiene Beexo Wallet, se muestra pantalla de descarga.
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
const POLYGON_AMOY_CHAIN_ID = 80002;
const POLYGON_AMOY_RPC = "https://polygon-amoy.drpc.org";

// XOConnectProvider configuration with REQUIRED rpcs
const XO_CONNECT_CONFIG = {
  rpcs: {
    // Polygon Amoy Testnet
    80002: POLYGON_AMOY_RPC,
    // Polygon Mainnet (por si acaso)
    137: "https://polygon.drpc.org",
    // Ethereum Mainnet (por si acaso)
    1: "https://eth.drpc.org"
  }
};

class XoConnectService {
  private xoProvider?: typeof XOConnectProvider;
  private ethersProvider?: BrowserProvider;
  private signer?: Signer;
  private alias = "";
  private userAddress = "";
  private tokenBalances: TokenInfo[] = [];
  private initialized = false;
  private _needsBeexo = false;
  private initError: string | null = null;

  /**
   * Check if we're running inside Beexo Wallet WebView
   * This is the ONLY check - no MetaMask fallback
   */
  detectBeexoWallet(): boolean {
    const browserWindow = globalThis as Window & typeof globalThis;
    
    // Check 1: XOConnectProvider is available (injected by Beexo)
    if (XOConnectProvider !== undefined) {
      console.log("🐝 XOConnectProvider disponible");
      return true;
    }
    
    // Check 2: User agent includes Beexo
    if (navigator.userAgent.includes('Beexo') || navigator.userAgent.includes('XOConnect')) {
      console.log("🐝 Beexo detectado por User-Agent");
      return true;
    }
    
    // Check 3: XOConnect global object
    if ((browserWindow as unknown as Record<string, unknown>).XOConnect) {
      console.log("🐝 XOConnect global detectado");
      return true;
    }

    // Check 4: window.xoconnect (otra variante)
    if ((browserWindow as unknown as Record<string, unknown>).xoconnect) {
      console.log("🐝 xoconnect global detectado");
      return true;
    }
    
    console.log("❌ Beexo Wallet NO detectada");
    return false;
  }

  /**
   * Returns true if user needs to download Beexo Wallet
   */
  needsBeexoWallet(): boolean {
    return this._needsBeexo;
  }

  /**
   * Get initialization error if any
   */
  getInitError(): string | null {
    return this.initError;
  }

  /**
   * Check if there's an existing wallet connection
   */
  async checkExistingConnection(): Promise<string | null> {
    if (!this.detectBeexoWallet()) {
      console.log("❌ No hay Beexo Wallet - no se puede verificar conexión");
      return null;
    }
    
    try {
      const client = await XOConnect.getClient();
      if (client?.alias) {
        console.log("🐝 Sesión existente de Beexo:", client.alias);
        return client.alias;
      }
    } catch {
      console.log("No hay sesión XO Connect existente");
    }
    
    return null;
  }

  /**
   * Initialize connection - ONLY XO Connect, no fallbacks
   */
  async init(): Promise<boolean> {
    if (this.initialized) return !this._needsBeexo;
    
    console.log("🔌 Inicializando XO Connect Service (SOLO BEEXO)...");
    
    const isBeexo = this.detectBeexoWallet();
    
    if (!isBeexo) {
      console.log("❌ Beexo Wallet NO detectada - mostrando pantalla de descarga");
      this._needsBeexo = true;
      this.initialized = true;
      return false;
    }
    
    try {
      await this.initWithXOConnect();
      this._needsBeexo = false;
      this.initialized = true;
      
      // Fetch token balances after connection
      await this.fetchTokenBalances();
      
      console.log("✅ XO Connect Service inicializado:", {
        alias: this.alias,
        address: this.userAddress,
        tokens: this.tokenBalances.length
      });
      
      return true;
    } catch (error) {
      console.error("❌ Error inicializando XO Connect:", error);
      this.initError = error instanceof Error ? error.message : "Error desconocido";
      this._needsBeexo = true;
      this.initialized = true;
      return false;
    }
  }

  /**
   * Initialize with XO Connect (Beexo Wallet)
   */
  private async initWithXOConnect() {
    console.log("🐝 Conectando con Beexo Wallet via XO Connect...");
    console.log("📡 Config:", XO_CONNECT_CONFIG);
    
    // Create XO Connect Provider with REQUIRED rpcs config
    this.xoProvider = new XOConnectProvider(XO_CONNECT_CONFIG);
    
    // Wrap in ethers BrowserProvider
    this.ethersProvider = new BrowserProvider(this.xoProvider, POLYGON_AMOY_CHAIN_ID);
    
    // Request accounts (triggers connection popup in Beexo)
    console.log("🔑 Solicitando cuentas...");
    const accounts = await this.ethersProvider.send("eth_requestAccounts", []) as string[];
    console.log("✅ Cuentas recibidas:", accounts);
    
    if (!accounts || accounts.length === 0) {
      throw new Error("No se recibieron cuentas de Beexo Wallet");
    }
    
    // Get signer
    this.signer = await this.ethersProvider.getSigner();
    this.userAddress = await this.signer.getAddress();
    console.log("📍 Dirección:", this.userAddress);
    
    // Get client info from XO Connect
    try {
      const client: XOClient = await XOConnect.getClient();
      console.log("🐝 Cliente Beexo:", client);
      
      this.alias = client.alias || this.formatAddress(this.userAddress);
      
      // Convert currencies to our TokenInfo format
      if (client.currencies && client.currencies.length > 0) {
        this.tokenBalances = client.currencies.map(c => ({
          symbol: c.symbol,
          name: c.symbol,
          address: c.address,
          decimals: c.decimals || 18,
          balance: "0",
          type: c.address === "0x0000000000000000000000000000000000000000" ? "native" as const : "erc20" as const,
          icon: c.image,
          chainId: c.chainId
        }));
      } else {
        // Default POL token if no currencies from client
        this.tokenBalances = [{
          symbol: "POL",
          name: "Polygon",
          address: "native",
          decimals: 18,
          balance: "0",
          type: "native",
          icon: "🟣"
        }];
      }
    } catch (clientError) {
      console.warn("No se pudo obtener info del cliente XO:", clientError);
      this.alias = this.formatAddress(this.userAddress);
      
      // Default POL token
      this.tokenBalances = [{
        symbol: "POL",
        name: "Polygon",
        address: "native",
        decimals: 18,
        balance: "0",
        type: "native",
        icon: "🟣"
      }];
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
        }

        updatedBalances.push({
          ...token,
          balance: Number.parseFloat(balance).toFixed(token.decimals > 2 ? 4 : 2)
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
    return !this._needsBeexo && !!this.userAddress;
  }

  isInitialized(): boolean {
    return this.initialized;
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
      throw new Error("XO Connect no inicializado. Necesitas Beexo Wallet.");
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
    if (this._needsBeexo) {
      throw new Error("Necesitas Beexo Wallet para firmar transacciones");
    }
    
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
    this._needsBeexo = false;
    this.initError = null;
  }

  /**
   * Reset the service to allow re-initialization
   */
  reset() {
    this.initialized = false;
    this._needsBeexo = false;
    this.initError = null;
  }
}

export const xoConnectService = new XoConnectService();
