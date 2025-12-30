/**
 * Wallet Service - Integración unificada con Beexo Wallet y MetaMask
 * 
 * - Beexo: Usa XO Connect, proporciona alias del usuario
 * - MetaMask: Usa window.ethereum, muestra dirección como alias
 */

import { BrowserProvider, JsonRpcProvider, formatUnits, Signer, Contract } from "ethers";

// @ts-expect-error - XO Connect types
import { XOConnectProvider, XOConnect } from "xo-connect";

export type WalletType = "beexo" | "metamask" | null;

export interface TokenInfo {
  symbol: string;
  name: string;
  address: string;
  decimals: number;
  balance: string;
  type: "native" | "erc20";
  icon?: string;
}

// Polygon Mainnet
const POLYGON_CHAIN_ID = 137;
const POLYGON_CHAIN_ID_HEX = "0x89";
const POLYGON_RPC = "https://polygon.drpc.org";

// Tokens soportados en Polygon Mainnet
const SUPPORTED_TOKENS: Omit<TokenInfo, "balance">[] = [
  { symbol: "POL", name: "Polygon", address: "native", decimals: 18, type: "native", icon: "🟣" },
  { symbol: "USDC", name: "USD Coin", address: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359", decimals: 6, type: "erc20", icon: "💵" },
  { symbol: "USDT", name: "Tether USD", address: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F", decimals: 6, type: "erc20", icon: "💲" },
];

// ERC20 ABI mínimo para consultar balances y aprobar
const ERC20_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
];

const XO_CONNECT_CONFIG = {
  defaultChainId: POLYGON_CHAIN_ID_HEX,
  rpcs: {
    "0x89": POLYGON_RPC,
    "0x1": "https://eth.drpc.org"
  }
};

class WalletService {
  private provider?: BrowserProvider;
  private signer?: Signer;
  private walletType: WalletType = null;
  private alias = "";
  private userAddress = "";
  private tokenBalances: TokenInfo[] = [];
  private initialized = false;
  private connecting = false;
  private connectionError: string | null = null;

  isMetaMaskAvailable(): boolean {
    const win = globalThis as unknown as { ethereum?: { isMetaMask?: boolean } };
    return win.ethereum !== undefined;
  }

  isBeexoAvailable(): boolean {
    return XOConnectProvider !== undefined;
  }

  isConnecting(): boolean {
    return this.connecting;
  }

  getConnectionError(): string | null {
    return this.connectionError;
  }

  getWalletType(): WalletType {
    return this.walletType;
  }

  async connectBeexo(): Promise<boolean> {
    if (this.connecting) return false;
    
    this.connecting = true;
    this.connectionError = null;

    try {
      const xoProvider = new XOConnectProvider(XO_CONNECT_CONFIG);
      this.provider = new BrowserProvider(xoProvider, "any");
      
      await this.provider.send("eth_requestAccounts", []);
      this.signer = await this.provider.getSigner();
      this.userAddress = await this.signer.getAddress();

      // Obtener alias de Beexo
      try {
        const client = await XOConnect.getClient();
        this.alias = client?.alias || this.formatAddress(this.userAddress);
      } catch {
        this.alias = this.formatAddress(this.userAddress);
      }

      this.walletType = "beexo";
      this.initialized = true;
      await this.fetchBalances();
      
      return true;
    } catch (error) {
      this.connectionError = error instanceof Error ? error.message : "Error conectando Beexo";
      this.initialized = false;
      return false;
    } finally {
      this.connecting = false;
    }
  }

  async connectMetaMask(): Promise<boolean> {
    if (this.connecting) return false;
    if (!this.isMetaMaskAvailable()) {
      this.connectionError = "MetaMask no está instalado";
      return false;
    }

    this.connecting = true;
    this.connectionError = null;

    try {
      const win = globalThis as unknown as { ethereum: { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> } };
      const ethereum = win.ethereum;
      
      // Request accounts
      await ethereum.request({ method: "eth_requestAccounts" });
      
      // Switch to Polygon Mainnet
      try {
        await ethereum.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: POLYGON_CHAIN_ID_HEX }]
        });
      } catch (switchError: unknown) {
        const err = switchError as { code?: number };
        if (err.code === 4902) {
          await ethereum.request({
            method: "wallet_addEthereumChain",
            params: [{
              chainId: POLYGON_CHAIN_ID_HEX,
              chainName: "Polygon Mainnet",
              nativeCurrency: { name: "POL", symbol: "POL", decimals: 18 },
              rpcUrls: [POLYGON_RPC],
              blockExplorerUrls: ["https://polygonscan.com/"]
            }]
          });
        }
      }

      this.provider = new BrowserProvider(ethereum, POLYGON_CHAIN_ID);
      this.signer = await this.provider.getSigner();
      this.userAddress = await this.signer.getAddress();
      
      // MetaMask uses address as alias
      this.alias = this.formatAddress(this.userAddress);
      
      this.walletType = "metamask";
      this.initialized = true;
      await this.fetchBalances();

      return true;
    } catch (error) {
      this.connectionError = error instanceof Error ? error.message : "Error conectando MetaMask";
      this.initialized = false;
      return false;
    } finally {
      this.connecting = false;
    }
  }

  async checkExistingConnection(): Promise<WalletType> {
    // Check Beexo first
    try {
      const client = await XOConnect.getClient();
      if (client?.alias) return "beexo";
    } catch { /* No Beexo session */ }

    // Check MetaMask
    if (this.isMetaMaskAvailable()) {
      try {
        const win = globalThis as unknown as { ethereum: { request: (args: { method: string }) => Promise<string[]> } };
        const ethereum = win.ethereum;
        const accounts = await ethereum.request({ method: "eth_accounts" });
        if (accounts && accounts.length > 0) return "metamask";
      } catch { /* No MetaMask session */ }
    }

    return null;
  }

  private formatAddress(address: string): string {
    if (!address || address.length < 10) return "Anon";
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  }

  private async fetchBalances(): Promise<void> {
    if (!this.userAddress) return;

    const provider = this.getReadProvider();
    const balances: TokenInfo[] = [];

    for (const token of SUPPORTED_TOKENS) {
      try {
        let balance: bigint;
        
        if (token.type === "native") {
          balance = await provider.getBalance(this.userAddress);
        } else {
          const contract = new Contract(token.address, ERC20_ABI, provider);
          balance = await contract.balanceOf(this.userAddress);
        }
        
        balances.push({
          ...token,
          balance: Number(formatUnits(balance, token.decimals)).toFixed(4)
        });
      } catch {
        balances.push({ ...token, balance: "0" });
      }
    }

    this.tokenBalances = balances;
  }

  // Public API
  getAlias(): string {
    return this.alias || "Anon";
  }

  getUserAddress(): string {
    return this.userAddress;
  }

  isConnected(): boolean {
    return this.initialized && !!this.userAddress;
  }

  getTokenBalance(symbol: string): string {
    return this.tokenBalances.find(t => t.symbol === symbol)?.balance || "0";
  }

  getTokens(): TokenInfo[] {
    return this.tokenBalances;
  }

  /**
   * Obtiene la dirección del contrato para un símbolo de token
   */
  getTokenAddress(symbol: string): string {
    const token = SUPPORTED_TOKENS.find(t => t.symbol.toLowerCase() === symbol.toLowerCase());
    if (!token) {
      throw new Error(`Token ${symbol} no soportado`);
    }
    return token.address === "native" ? "0x0000000000000000000000000000000000000000" : token.address;
  }

  /**
   * Obtiene información completa del token
   */
  getTokenInfo(symbol: string): Omit<TokenInfo, "balance"> | undefined {
    return SUPPORTED_TOKENS.find(t => t.symbol.toLowerCase() === symbol.toLowerCase());
  }

  /**
   * Aprueba tokens ERC20 para que el contrato pueda transferirlos
   * @param tokenAddress Dirección del contrato ERC20
   * @param spenderAddress Dirección del contrato que gastará los tokens (MatchManager)
   * @param amount Cantidad en unidades base (wei para POL, unidades mínimas para tokens)
   */
  async approveToken(tokenAddress: string, spenderAddress: string, amount: bigint): Promise<void> {
    const signer = await this.getSigner();
    const tokenContract = new Contract(tokenAddress, ERC20_ABI, signer);
    
    // Verificar allowance actual
    const owner = await signer.getAddress();
    const currentAllowance = await tokenContract.allowance(owner, spenderAddress);
    
    // Si ya tiene suficiente allowance, no hacer nada
    if (currentAllowance >= amount) {
      console.log("Ya tiene suficiente allowance");
      return;
    }
    
    // Aprobar tokens
    const tx = await tokenContract.approve(spenderAddress, amount);
    await tx.wait();
    console.log(`Aprobación exitosa: ${amount.toString()} tokens`);
  }

  getProvider(): BrowserProvider {
    if (!this.provider) throw new Error("Wallet no conectada");
    return this.provider;
  }

  getReadProvider(): JsonRpcProvider {
    return new JsonRpcProvider(POLYGON_RPC);
  }

  async getSigner(): Promise<Signer> {
    if (!this.signer) throw new Error("Wallet no conectada");
    return this.signer;
  }

  async disconnect(): Promise<void> {
    this.provider = undefined;
    this.signer = undefined;
    this.walletType = null;
    this.alias = "";
    this.userAddress = "";
    this.tokenBalances = [];
    this.initialized = false;
    this.connecting = false;
    this.connectionError = null;
  }

  reset(): void {
    this.initialized = false;
    this.connecting = false;
    this.connectionError = null;
  }

  // Alias for compatibility with old code
  async init(): Promise<void> {
    // No-op: wallet is already initialized on connect
  }

  async fetchTokenBalances(): Promise<TokenInfo[]> {
    await this.fetchBalances();
    return this.tokenBalances;
  }

  getAddress(): string {
    return this.userAddress;
  }
}

export const walletService = new WalletService();
