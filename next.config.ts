import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  /* config options here */
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
  // Genkit pulls in @opentelemetry/sdk-node's auto-instrumentation, which does
  // dynamic requires for optional deps (express, mongodb, aws-sdk, etc.) that
  // don't exist in this project. Bundling that via webpack corrupts shared
  // chunks and breaks static generation (e.g. "<Html> should not be imported
  // outside of pages/_document" on /404). Keep these as real Node requires.
  serverExternalPackages: [
    'genkit',
    '@genkit-ai/core',
    '@genkit-ai/google-genai',
    '@opentelemetry/sdk-node',
    '@opentelemetry/instrumentation',
    'require-in-the-middle',
  ],
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;
