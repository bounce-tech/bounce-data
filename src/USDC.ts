import { ponder } from "ponder:registry";
import schema from "ponder:schema";
import { GLOBAL_STORAGE_ID } from "./constants";
import addressMatch from "./utils/address-match";
import { Address, FACTORY_ADDRESS } from "@bouncetech/contracts";
import { LEVERAGED_TOKENS } from "../ponder.config";


ponder.on("USDCTransferIn:Transfer", async ({ event, context }) => {
  const { from, to, value } = event.args;
  // const block = event.block.number;
  if (value === 0n) return;
  if (from === to) return;
  if (addressMatch(from, FACTORY_ADDRESS)) return;
  // if (addressMatch(to, "0xf445eb1c08ca4c300994450a120994062b0a1a84")) {
  //   console.log("USDCTransferIn:Transfer", { from, to, value, block });
  // }
  await context.db.update(schema.leveragedToken, { address: to }).set((row) => ({
    baseAssetBalance: row.baseAssetBalance + value,
  }));
});

ponder.on("USDCTransferOut:Transfer", async ({ event, context }) => {
  const { from, to, value } = event.args;
  // const block = event.block.number;
  if (value === 0n) return;
  if (from === to) return;
  if (addressMatch(from, FACTORY_ADDRESS)) return;
  // if (addressMatch(from, "0xf445eb1c08ca4c300994450a120994062b0a1a84")) {
  //   console.log("USDCTransferOut:Transfer", { from, to, value, block });
  // }
  await context.db.update(schema.leveragedToken, { address: from }).set((row) => ({
    baseAssetBalance: row.baseAssetBalance - value,
  }));
});
