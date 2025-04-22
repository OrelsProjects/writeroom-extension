// src/types/global.d.ts

// Define a minimal Buffer interface for our needs
declare global {
  // Note: This is a simplified version of Node's Buffer
  // We're using Uint8Array instead for browser compatibility
  interface Window {
    btoa(binary: string): string;
  }
}

export {}; 