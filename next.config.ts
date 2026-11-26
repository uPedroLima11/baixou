import type { NextConfig } from 'next';
const config: NextConfig = {
  poweredByHeader: false,
  // Baileys (WhatsApp) carrega WebAssembly e protobuf em tempo de execução: manter fora do bundle.
  serverExternalPackages: ['baileys', 'whatsapp-rust-bridge', 'libsignal', 'pino'],
  async headers() { return [{ source: '/(.*)', headers: [
    {key:'X-Content-Type-Options',value:'nosniff'},
    {key:'Referrer-Policy',value:'strict-origin-when-cross-origin'},
    {key:'X-Frame-Options',value:'DENY'},
    {key:'Permissions-Policy',value:'camera=(), microphone=(), geolocation=()'}
  ]}]; }
};
export default config;
