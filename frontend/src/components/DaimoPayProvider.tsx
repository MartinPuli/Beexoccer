'use client';

import React from 'react';
import { DaimoPayProvider as DaimoPay, getDefaultConfig } from '@daimo/pay';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider, createConfig } from 'wagmi';

// Configuración de Wagmi con soporte para múltiples chains de Daimo Pay
const config = createConfig(
  getDefaultConfig({
    appName: 'Beexoccer',
    appDescription: 'Table soccer on blockchain - 1v1 matches with crypto stakes',
    appUrl: 'https://beexoccer.com',
    appIcon: '/favicon.png',
  }),
);

const queryClient = new QueryClient();

interface DaimoPayProviderProps {
  children: React.ReactNode;
}

/**
 * Provider component that wraps the app with Daimo Pay, Wagmi, and React Query
 * This enables payments from any chain/token, settling to your preferred destination
 */
export function DaimoPayProviderWrapper({ children }: DaimoPayProviderProps) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <DaimoPay mode="dark">{children}</DaimoPay>
      </QueryClientProvider>
    </WagmiProvider>
  );
}

export { DaimoPayProviderWrapper as DaimoPayProvider };
