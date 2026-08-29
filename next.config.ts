import type { NextConfig } from "next";

const ORIGINES_RESEAU_LOCAL = ["192.168.1.*", "192.168.0.*", "10.0.0.*"];

const nextConfig: NextConfig = {
  allowedDevOrigins: ORIGINES_RESEAU_LOCAL,
};

export default nextConfig;
