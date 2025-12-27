import React from 'react';
import { DaimoPayButton } from '@daimo/pay';
import { polygonUSDC, baseUSDC, arbitrumUSDC, optimismUSDC } from '@daimo/pay-common';
import { getAddress } from 'viem';

// Type alias for Ethereum addresses
type Address = `0x${string}`;

// Token configurations for different chains
export const SUPPORTED_TOKENS = {
  polygonUSDC: {
    chainId: polygonUSDC.chainId,
    token: getAddress(polygonUSDC.token) as Address,
    name: 'USDC on Polygon',
    symbol: 'USDC',
  },
  baseUSDC: {
    chainId: baseUSDC.chainId,
    token: getAddress(baseUSDC.token) as Address,
    name: 'USDC on Base',
    symbol: 'USDC',
  },
  arbitrumUSDC: {
    chainId: arbitrumUSDC.chainId,
    token: getAddress(arbitrumUSDC.token) as Address,
    name: 'USDC on Arbitrum',
    symbol: 'USDC',
  },
  optimismUSDC: {
    chainId: optimismUSDC.chainId,
    token: getAddress(optimismUSDC.token) as Address,
    name: 'USDC on Optimism',
    symbol: 'USDC',
  },
} as const;

// Default destination: Polygon USDC (your treasury address)
const DEFAULT_TREASURY_ADDRESS: Address = '0x8087441101595dd8FEcA1f02179a74ec2A1FeBBf'; // MatchManager contract
const DEFAULT_REFUND_ADDRESS: Address = '0x8087441101595dd8FEcA1f02179a74ec2A1FeBBf'; // Same as treasury

export interface BeexoccerPayButtonProps {
  /** Amount in USDC (e.g., "10.00" for 10 USDC) */
  amount: string;
  /** Recipient address (defaults to treasury) */
  toAddress?: Address;
  /** Refund address (defaults to treasury) */
  refundAddress?: Address;
  /** Settlement chain ID (defaults to Polygon) */
  settlementChainId?: number;
  /** Settlement token address (defaults to Polygon USDC) */
  settlementToken?: Address;
  /** Button intent text */
  intent?: string;
  /** Callback when payment starts */
  onPaymentStarted?: (event: unknown) => void;
  /** Callback when payment completes successfully */
  onPaymentCompleted?: (event: unknown) => void;
  /** Callback when payment bounces/fails */
  onPaymentBounced?: (event: unknown) => void;
  /** Custom metadata to attach to payment */
  metadata?: Record<string, string>;
  /** Whether to auto-open modal */
  defaultOpen?: boolean;
  /** Whether to close modal on success */
  closeOnSuccess?: boolean;
}

/**
 * Beexoccer payment button using Daimo Pay
 * 
 * Supports payments from any chain/token, settling to Polygon USDC by default.
 * Users can pay with:
 * - Any wallet (MetaMask, Rainbow, Coinbase Wallet, etc.)
 * - Any exchange (Coinbase, Binance)
 * - Any supported token on any chain
 * 
 * @example
 * ```tsx
 * <BeexoccerPayButton
 *   amount="10.00"
 *   intent="Stake"
 *   onPaymentCompleted={(e) => console.log('Paid!', e)}
 *   metadata={{ matchId: '123' }}
 * />
 * ```
 */
export function BeexoccerPayButton({
  amount,
  toAddress = DEFAULT_TREASURY_ADDRESS,
  refundAddress = DEFAULT_REFUND_ADDRESS,
  settlementChainId = SUPPORTED_TOKENS.polygonUSDC.chainId,
  settlementToken = SUPPORTED_TOKENS.polygonUSDC.token,
  intent = 'Stake',
  onPaymentStarted,
  onPaymentCompleted,
  onPaymentBounced,
  metadata,
  defaultOpen = false,
  closeOnSuccess = true,
}: BeexoccerPayButtonProps) {
  return (
    <DaimoPayButton
      appId="pay-demo" // Replace with your real appId for production
      intent={intent}
      toAddress={toAddress}
      toChain={settlementChainId}
      toToken={settlementToken}
      toUnits={amount}
      refundAddress={refundAddress}
      // Prefer popular chains for user convenience
      preferredChains={[
        SUPPORTED_TOKENS.polygonUSDC.chainId,
        SUPPORTED_TOKENS.baseUSDC.chainId,
        SUPPORTED_TOKENS.arbitrumUSDC.chainId,
        SUPPORTED_TOKENS.optimismUSDC.chainId,
      ]}
      // Prefer USDC on these chains
      preferredTokens={[
        { chain: SUPPORTED_TOKENS.polygonUSDC.chainId, address: SUPPORTED_TOKENS.polygonUSDC.token },
        { chain: SUPPORTED_TOKENS.baseUSDC.chainId, address: SUPPORTED_TOKENS.baseUSDC.token },
        { chain: SUPPORTED_TOKENS.arbitrumUSDC.chainId, address: SUPPORTED_TOKENS.arbitrumUSDC.token },
        { chain: SUPPORTED_TOKENS.optimismUSDC.chainId, address: SUPPORTED_TOKENS.optimismUSDC.token },
      ]}
      metadata={metadata}
      defaultOpen={defaultOpen}
      closeOnSuccess={closeOnSuccess}
      onPaymentStarted={onPaymentStarted}
      onPaymentCompleted={onPaymentCompleted}
      onPaymentBounced={onPaymentBounced}
    />
  );
}

/**
 * Custom-styled Beexoccer pay button for more control over appearance
 */
export function BeexoccerPayButtonCustom({
  amount,
  toAddress = DEFAULT_TREASURY_ADDRESS,
  refundAddress = DEFAULT_REFUND_ADDRESS,
  settlementChainId = SUPPORTED_TOKENS.polygonUSDC.chainId,
  settlementToken = SUPPORTED_TOKENS.polygonUSDC.token,
  intent = 'Stake',
  onPaymentStarted,
  onPaymentCompleted,
  onPaymentBounced,
  metadata,
  closeOnSuccess = true,
  children,
}: BeexoccerPayButtonProps & { children?: React.ReactNode }) {
  return (
    <DaimoPayButton.Custom
      appId="pay-demo" // Replace with your real appId for production
      toAddress={toAddress}
      toChain={settlementChainId}
      toToken={settlementToken}
      toUnits={amount}
      refundAddress={refundAddress}
      preferredChains={[
        SUPPORTED_TOKENS.polygonUSDC.chainId,
        SUPPORTED_TOKENS.baseUSDC.chainId,
        SUPPORTED_TOKENS.arbitrumUSDC.chainId,
        SUPPORTED_TOKENS.optimismUSDC.chainId,
      ]}
      metadata={metadata}
      closeOnSuccess={closeOnSuccess}
      onPaymentStarted={onPaymentStarted}
      onPaymentCompleted={onPaymentCompleted}
      onPaymentBounced={onPaymentBounced}
    >
      {({ show }) => (
        <button
          type="button"
          className="create-submit"
          onClick={show}
        >
          {children || `${intent} ${amount} USDC`}
        </button>
      )}
    </DaimoPayButton.Custom>
  );
}

export default BeexoccerPayButton;
