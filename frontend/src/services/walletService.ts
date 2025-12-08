/**
 * Wallet Service - Integración unificada con Beexo Wallet y MetaMask
 * 
 * - Beexo: Usa XO Connect, proporciona alias del usuario
 * - MetaMask: Usa window.ethereum, muestra dirección como alias
 */

import { BrowserProvider, JsonRpcProvider, formatUnits, Signer } from "ethers";

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
    try {
      const balance = await provider.getBalance(this.userAddress);
      this.tokenBalances = [{
        symbol: "POL",
        name: "Polygon",
        address: "native",
        decimals: 18,
        balance: Number(formatUnits(balance, 18)).toFixed(4),
        type: "native",
        icon: "🟣"
      }];
    } catch {
      this.tokenBalances = [{ symbol: "POL", name: "Polygon", address: "native", decimals: 18, balance: "0", type: "native", icon: "🟣" }];
    }
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
