import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep repository-owned engineering instructions unchanged during development.
  agentRules: false,
};

export default nextConfig;
