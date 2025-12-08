/**
 * XO Connect Service - Integración con Beexo Wallet via XO Connect
 * 
 * Este servicio usa XO Connect para conectar con Beexo Wallet.
 * Funciona tanto dentro del WebView de Beexo como desde cualquier browser
 * (el usuario escanea QR o usa deep link para autorizar).
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

// XOConnectProvider requiere rpcs en v2.1.3
const XO_CONNECT_CONFIG = {
  rpcs: {
    // Polygon Amoy Testnet
    80002: POLYGON_AMOY_RPC,
    // Polygon Mainnet
    137: "https://polygon.drpc.org",
    // Ethereum Mainnet
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
  private _isConnecting = false;
  private _connectionError: string | null = null;

  /**
   * Check if XO Connect is available
   */
  isXOConnectAvailable(): boolean {
    return XOConnectProvider !== undefined;
  }

  /**
   * Check if currently connecting
   */
  isConnecting(): boolean {
    return this._isConnecting;
  }

  /**
   * Get connection error if any
   */
  getConnectionError(): string | null {
    return this._connectionError;
  }

  /**
   * Check if there's an existing wallet connection
   */
  async checkExistingConnection(): Promise<string | null> {
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
   * Check if we're inside Beexo WebView (not used anymore, XO Connect works everywhere)
   */
  isInWebView(): boolean {
    return true; // XO Connect should work in any context
  }

  /**
   * Get the URL for opening in Beexo WebView (for QR code) - not needed
   */
  getBeexoDeepLink(): string {
    return window.location.href;
  }

  /**
   * Connect with XO Connect - siguiendo el ejemplo exacto de la documentación
   * https://bitbucket.org/mellowwallet/xo-connect
   */
  async connect(): Promise<boolean> {
    if (this._isConnecting) {
      console.log("⏳ Ya hay una conexión en progreso...");
      return false;
    }

    this._isConnecting = true;
    this._connectionError = null;
    
    console.log("🔌 Iniciando conexión con XO Connect...");
    
    try {
      // XOConnectProvider v2.1.3 requiere rpcs config
      console.log("📡 Creando XOConnectProvider con rpcs config...");
      this.xoProvider = new XOConnectProvider(XO_CONNECT_CONFIG);
      
      // Wrap in ethers BrowserProvider (ethers v6 version of Web3Provider)
      // Usamos "any" como network como dice la documentación
      this.ethersProvider = new BrowserProvider(this.xoProvider, "any");
      
      // Request accounts - await provider.send("eth_requestAccounts", []);
      console.log("🔑 Solicitando eth_requestAccounts...");
      const accounts = await this.ethersProvider.send("eth_requestAccounts", []) as string[];
      console.log("✅ Cuentas conectadas:", accounts);
      
      if (!accounts || accounts.length === 0) {
        throw new Error("No se recibieron cuentas de Beexo Wallet");
      }
      
      // Get signer
      this.signer = await this.ethersProvider.getSigner();
      this.userAddress = await this.signer.getAddress();
      console.log("📍 Dirección:", this.userAddress);
      
      // Get client info from XO Connect
      await this.fetchClientInfo();
      
      // Fetch token balances
      await this.fetchTokenBalances();
      
      this.initialized = true;
      this._isConnecting = false;
      
      console.log("✅ XO Connect Service conectado:", {
        alias: this.alias,
        address: this.userAddress,
        tokens: this.tokenBalances.length
      });
      
      return true;
      
    } catch (error) {
      console.error("❌ Error conectando con XO Connect:", error);
      this._connectionError = error instanceof Error ? error.message : "Error de conexión";
      this._isConnecting = false;
      this.initialized = false;
      return false;
    }
  }

  /**
   * Fetch client info from XO Connect
   */
  private async fetchClientInfo() {
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
        this.setDefaultTokens();
      }
    } catch (clientError) {
      console.warn("No se pudo obtener info del cliente XO:", clientError);
      this.alias = this.formatAddress(this.userAddress);
      this.setDefaultTokens();
    }
  }

  /**
   * Set default POL token
   */
  private setDefaultTokens() {
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

  isConnected(): boolean {
    return this.initialized && !!this.userAddress;
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
      throw new Error("XO Connect no inicializado. Conectá tu Beexo Wallet primero.");
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
    if (!this.initialized) {
      throw new Error("Conectá tu Beexo Wallet primero");
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
    this._isConnecting = false;
    this._connectionError = null;
  }

  /**
   * Reset the service
   */
  reset() {
    this.initialized = false;
    this._isConnecting = false;
    this._connectionError = null;
  }
}

export const xoConnectService = new XoConnectService();
