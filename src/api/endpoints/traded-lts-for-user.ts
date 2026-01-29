import { db } from "ponder:api";
import schema from "ponder:schema";
import { eq } from "drizzle-orm";
import { Address } from "viem";

const getTradedLtsForUser = async (user: Address) => {
  try {
    const tradedLts = await db
      .select({
        leveragedToken: schema.transfer.leveragedToken,
      })
      .from(schema.transfer)
      .where(eq(schema.transfer.recipient, user))
      .groupBy(schema.transfer.leveragedToken);
    return tradedLts.map((lt) => lt.leveragedToken);
  } catch (error) {
    throw new Error("Failed to fetch traded leveraged tokens");
  }
};

export default getTradedLtsForUser;
