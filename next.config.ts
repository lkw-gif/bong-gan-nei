import type { NextConfig } from 'next';

// GitHub Pages serves static files from a repository sub-path. Keep the
// Cloudflare/Sites build unchanged, but emit a static export in GitHub Actions.
const isGitHubPagesBuild = process.env.GITHUB_ACTIONS === 'true';

const nextConfig: NextConfig = isGitHubPagesBuild
  ? {
      output: 'export',
      assetPrefix: '/bong-gan-nei/',
    }
  : {};

export default nextConfig;
