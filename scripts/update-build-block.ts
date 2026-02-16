import { createPublicClient, http } from "viem";
import { writeFileSync } from "fs";
import { join } from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import { hyperEvm } from "viem/chains";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function updateBuildBlock() {
    const client = createPublicClient({
        chain: hyperEvm,
        transport: http(),
    });
    const blockNumber = await client.getBlockNumber();
    console.log(`Latest block number: ${blockNumber}`);
    const filePath = join(__dirname, "..", "src", "utils", "build-block.ts");
    const content = `// This file is auto-generated at build time. Do not edit or commit.\nexport const BUILD_BLOCK = ${Number(blockNumber)};\n`;
    writeFileSync(filePath, content, "utf-8");
    console.log(`Created BUILD_BLOCK = ${Number(blockNumber)} in ${filePath}`);
}

updateBuildBlock().catch((error) => {
    console.error("Error updating build block:", error);
    process.exit(1);
});
