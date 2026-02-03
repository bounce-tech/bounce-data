import { createPublicClient, http } from "viem";
import { readFileSync, writeFileSync } from "fs";
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
    const fileContent = readFileSync(filePath, "utf-8");
    const updatedContent = fileContent.replace(
        /export const BUILD_BLOCK = \d+;/,
        `export const BUILD_BLOCK = ${Number(blockNumber)};`
    );
    writeFileSync(filePath, updatedContent, "utf-8");
    console.log(`Updated BUILD_BLOCK to ${Number(blockNumber)} in ${filePath}`);
}

updateBuildBlock().catch((error) => {
    console.error("Error updating build block:", error);
    process.exit(1);
});
