import type { NextConfig } from "next";
import { readWebEnvironment } from "./src/config/environment";

readWebEnvironment(process.env);

const nextConfig: NextConfig = {
  // Keep repository-owned engineering instructions unchanged during development.
  agentRules: false,
};

export default nextConfig;
