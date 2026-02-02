import schema from "ponder:schema";
import { Address } from "viem";

export async function getTargetLeverage(
    db: any,
    leveragedTokenAddress: Address
): Promise<bigint> {
    // Try to get from database first
    const leveragedToken = await db.find(schema.leveragedToken, {
        address: leveragedTokenAddress,
    });

    if (!leveragedToken) throw new Error("Leveraged token not found");

    return leveragedToken.targetLeverage;

}
