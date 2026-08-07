import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * Emit `.next/standalone` — a self-contained server with only the modules
   * the traced build actually reaches.
   *
   * This is what makes the Docker runtime stage viable: the image copies the
   * traced output instead of a full `node_modules`, so the published image
   * carries no build toolchain and none of the dev dependencies. It has no
   * effect on `next dev` or `next start` outside a container.
   */
  output: "standalone",
};

export default nextConfig;
