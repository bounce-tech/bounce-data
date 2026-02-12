# Bounce Indexing API

A REST API for querying data from the Bounce Tech leveraged token protocol on HyperEVM. This API provides access to leveraged token information, user trades, portfolio data, referral statistics, protocol-wide metrics, and global storage configuration.

**Base URL:** `https://indexing.bounce.tech`

## API Usage Terms

This API is publicly available for use by anyone. However, to ensure fair access and maintain service quality for all users, please observe the following guidelines:

**Fair Use Policy:**

- Use the API respectfully and avoid excessive or unnecessary requests
- Implement appropriate caching mechanisms to reduce redundant API calls
- Do not attempt to scrape, overload, or abuse the service
- For high-volume or commercial use cases, please contact us to discuss appropriate arrangements

**Service Availability:**

- The API is provided "as-is" without warranty
- We reserve the right to monitor usage patterns and implement rate limiting as needed
- Access may be restricted or suspended for users who violate these terms or engage in abusive behavior
- We are not responsible for any downtime, errors, or data inconsistencies

By using this API, you agree to use it in a manner that respects the service and other users. Thank you for your cooperation.

## Response Format

All API endpoints follow a consistent response structure.

**Success Response:**

```json
{
  "status": "success",
  "data": {
    /* endpoint-specific data */
  },
  "error": null
}
```

**Error Response:**

```json
{
  "status": "error",
  "data": null,
  "error": "Error message describing what went wrong"
}
```

**Important Notes:**

- All endpoints return JSON responses
- BigInt values are automatically serialized to strings in responses (e.g., `"1234567890123456789"` instead of a number)
- Error responses return HTTP status code `400 Bad Request` for invalid or missing parameters, `404 Not Found` for missing resources, and `500 Internal Server Error` for server errors
- CORS is enabled for specific origins: `http://localhost:5173`, `https://bounce.tech`, and Firebase web apps (`*.web.app`)

## Endpoints

### Stats

Get aggregated protocol statistics.

**Endpoint:** `GET https://indexing.bounce.tech/stats`

**Query Parameters:** None

**Response Data:**

- `marginVolume`: Total margin volume
- `notionalVolume`: Total notional volume
- `averageLeverage`: Average leverage across all trades
- `supportedAssets`: Number of unique market IDs
- `leveragedTokens`: Total number of leveraged tokens created
- `uniqueUsers`: Number of unique users who have traded
- `totalValueLocked`: Current TVL across all leveraged tokens
- `openInterest`: Current open interest across all leveraged tokens
- `totalTrades`: Total number of trades (mints and redeems)
- `treasuryFees`: Total fees sent to treasury

**Example Response:**

```json
{
  "status": "success",
  "data": {
    "marginVolume": 1234567.89,
    "notionalVolume": 12345678.9,
    "averageLeverage": 10.0,
    "supportedAssets": 5,
    "leveragedTokens": 10,
    "uniqueUsers": 150,
    "totalValueLocked": 500000.0,
    "openInterest": 5000000.0,
    "totalTrades": 1234,
    "treasuryFees": 12345.67
  },
  "error": null
}
```

### Global Storage

Get the current global storage configuration (owner, pause state, fee parameters, and rebates). Values are indexed from the GlobalStorage contract. When `data` is present, all fields are always set; fee and amount fields are returned as strings (BigInt serialized).

**Endpoint:** `GET https://indexing.bounce.tech/global-storage`

**Query Parameters:** None

**Response Data:**

- `owner`: Global storage contract owner address
- `allMintsPaused`: Whether all mints are paused (boolean)
- `minTransactionSize`: Minimum transaction size (string, BigInt)
- `minLockAmount`: Minimum lock amount (string, BigInt)
- `redemptionFee`: Redemption fee (string, BigInt)
- `executeRedemptionFee`: Execute redemption fee (string, BigInt)
- `streamingFee`: Streaming fee (string, BigInt)
- `treasuryFeeShare`: Treasury fee share (string, BigInt)
- `referrerRebate`: Referrer rebate (string, BigInt)
- `refereeRebate`: Referee rebate (string, BigInt)

**Example Request:**

```
GET https://indexing.bounce.tech/global-storage
```

**Example Success Response:**

```json
{
  "status": "success",
  "data": {
    "owner": "0x1234567890123456789012345678901234567890",
    "allMintsPaused": false,
    "minTransactionSize": "1000000",
    "minLockAmount": "10000000",
    "redemptionFee": "10000000000000000",
    "executeRedemptionFee": "5000000000000000",
    "streamingFee": "10000000000000000",
    "treasuryFeeShare": "500000000000000000",
    "referrerRebate": "30000000000000000",
    "refereeRebate": "20000000000000000"
  },
  "error": null
}
```

**Note:** If no global storage row has been indexed yet, `data` will be `null`.

**Error Responses:**

- `500 Internal Server Error`: Failed to fetch global storage

### Portfolio

Get portfolio data for a user including balances, unrealized profit, and realized profit across all leveraged tokens.

**Endpoint:** `GET https://indexing.bounce.tech/portfolio/:user`

**Path Parameters:**

- `user` (required): Ethereum address of the user

**Response Data:**

- `unrealizedProfit`: Total unrealized profit across all leveraged tokens
- `realizedProfit`: Total realized profit across all leveraged tokens
- `leveragedTokens`: Array of leveraged token objects, each containing:
  - `address`: Leveraged token contract address
  - `targetLeverage`: Target leverage amount (number)
  - `isLong`: Whether the token is a long position (boolean)
  - `symbol`: ERC-20 symbol (string)
  - `name`: ERC-20 name (string)
  - `decimals`: ERC-20 decimals (integer)
  - `targetAsset`: Leveraged token target asset
  - `mintPaused`: Whether minting is currently paused for this leveraged token (boolean)
  - `exchangeRate`: Current exchange rate (as string, serialized from BigInt)
  - `userBalance`: User's balance of this leveraged token (as string, serialized from BigInt)
- `unrealizedProfit`: Unrealized profit for this leveraged token (number)
- `unrealizedPercent`: Unrealized profit as a percentage (number, e.g., 0.15 = 15%)
- `pnlChart`: Array of PnL chart data points showing the cumulative profit and loss over time. Each data point contains:
  - `timestamp`: Unix timestamp in milliseconds (number)
  - `value`: Cumulative PnL value at that timestamp (number)

  The chart includes:
  - Historical points: Cumulative realized PnL from sell/redeem trades (all trades with realized profit or loss are included, ordered by timestamp ascending)
  - Latest point: Current total PnL (realized + unrealized) with timestamp of now

**Example Request:**

```
GET https://indexing.bounce.tech/portfolio/0x1234567890123456789012345678901234567890
```

**Example Success Response:**

```json
{
  "status": "success",
  "data": {
    "unrealizedProfit": 1234.56,
    "realizedProfit": 567.89,
    "leveragedTokens": [
      {
        "address": "0x1eefbacfea06d786ce012c6fc861bec6c7a828c1",
        "targetLeverage": 3.0,
        "isLong": true,
        "symbol": "3L-USDC",
        "name": "3x Long USDC",
        "decimals": 18,
        "targetAsset": "USDC",
        "mintPaused": false,
        "exchangeRate": "1050000000000000000",
        "userBalance": "5000000000000000000",
        "unrealizedProfit": 200.0,
        "unrealizedPercent": 0.4
      }
    ],
    "pnlChart": [
      {
        "timestamp": 1704067200000,
        "value": 50.0
      },
      {
        "timestamp": 1704153600000,
        "value": 567.89
      },
      {
        "timestamp": 1704240000000,
        "value": 1802.45
      }
    ]
  },
  "error": null
}
```

**Error Responses:**

- `400 Bad Request`: Missing or invalid user address parameter
- `500 Internal Server Error`: Failed to fetch portfolio

### User Trades

Get all trades for a specific user with optional filtering by asset or leveraged token address.

**Endpoint:** `GET https://indexing.bounce.tech/user-trades`

**Query Parameters:**

- `user` (required): Ethereum address of the user
- `symbol` (optional): Filter trades by leveraged token symbol
- `address` (optional): Filter trades by specific leveraged token address
- `sortBy` (optional): Field to sort by. Values: `date`, `symbol`, `activity`, `nomVal`. Default: `date`
- `sortOrder` (optional): Sort direction. Values: `asc` (ascending) or `desc` (descending). Default: `desc`
- `page` (optional): Page number, starting from 1 (default: 1)
- `limit` (optional): Number of items per page (default: 100, max: 100)

**Note:** You can combine `symbol` and `address` filters. If both are provided, trades must match both conditions.

**Sorting:**

- `date`: Sort by trade timestamp (default)
- `symbol`: Sort by leveraged token symbol
- `activity`: Sort by trade type (buys/sells)
- `nomVal`: Sort by nominal value (baseAssetAmount)

Default behavior (no sort parameters): returns trades ordered by date descending (most recent first).

When `sortBy = date`, trades are primarily ordered by timestamp (with ID as a secondary tie-breaker). When sorting by `symbol`, `activity`, or `nomVal`, results are ordered by that field first, then by timestamp as a secondary sort key, and ID as a tertiary sort key for stable ordering.

**Pagination:**

This endpoint uses offset pagination. Use the `page` and `limit` parameters to navigate through results.

- `page` controls which page of results to return (default: 1)
- `limit` controls how many items are returned per page (default: 100, maximum: 100)
- The response includes `totalCount` and `totalPages` so you can calculate how many pages are available

**Response Data:**

Paginated response containing:

- `items`: Array of trade objects, each containing:
  - `id`: Unique trade identifier
  - `txHash`: Transaction hash of the trade
  - `timestamp`: Block timestamp of the trade (as string, serialized from BigInt)
  - `isBuy`: `true` for mints (buys), `false` for redeems (sells)
  - `baseAssetAmount`: Amount of USDC
  - `leveragedTokenAmount`: Amount of leveraged tokens (as string, serialized from BigInt)
  - `leveragedToken`: Address of the leveraged token
  - `targetLeverage`: Target leverage of the leveraged token (number)
  - `isLong`: Whether the leveraged token is a long position
  - `targetAsset`: Leveraged token target asset (e.g. BTC, ETH)
  - `profitAmount`: Profit amount for this trade (number, null if not applicable)
  - `profitPercent`: Profit percentage for this trade (number, null if not applicable)
- `totalCount`: Total number of records matching the query
- `page`: Current page number
- `totalPages`: Total number of pages available

**Example Request (First Page):**

```
GET https://indexing.bounce.tech/user-trades?user=0x1234567890123456789012345678901234567890&limit=10
```

**Example Request with Symbol Filter:**

```
GET https://indexing.bounce.tech/user-trades?user=0x1234567890123456789012345678901234567890&symbol=ETH2L&limit=20
```

**Example Request (Page 2):**

```
GET https://indexing.bounce.tech/user-trades?user=0x1234567890123456789012345678901234567890&page=2&limit=10
```

**Example Request with Both Filters:**

```
GET https://indexing.bounce.tech/user-trades?user=0x1234567890123456789012345678901234567890&symbol=ETH2L&address=0x1eefbacfea06d786ce012c6fc861bec6c7a828c1
```

**Example Request with Custom Sorting (oldest first):**

```
GET https://indexing.bounce.tech/user-trades?user=0x1234567890123456789012345678901234567890&sortBy=date&sortOrder=asc
```

**Example Request Sorted by Nominal Value (highest first):**

```
GET https://indexing.bounce.tech/user-trades?user=0x1234567890123456789012345678901234567890&sortBy=nomVal&sortOrder=desc
```

**Example Success Response:**

```json
{
  "status": "success",
  "data": {
    "items": [
      {
        "id": "0xghi789...",
        "txHash": "0xjkl012...",
        "timestamp": "1704153600",
        "isBuy": false,
        "baseAssetAmount": "500000000",
        "leveragedTokenAmount": "2500000000000000000",
        "leveragedToken": "0x1eefbacfea06d786ce012c6fc861bec6c7a828c1",
        "targetLeverage": 3.0,
        "isLong": true,
        "targetAsset": "USDC",
        "profitAmount": 50.0,
        "profitPercent": 0.1
      },
      {
        "id": "0xabc123...",
        "txHash": "0xdef456...",
        "timestamp": "1704067200",
        "isBuy": true,
        "baseAssetAmount": "1000000000",
        "leveragedTokenAmount": "5000000000000000000",
        "leveragedToken": "0x1eefbacfea06d786ce012c6fc861bec6c7a828c1",
        "targetLeverage": 3.0,
        "isLong": true,
        "targetAsset": "USDC",
        "profitAmount": null,
        "profitPercent": null
      }
    ],
    "totalCount": 42,
    "page": 1,
    "totalPages": 5
  },
  "error": null
}
```

**Example Error Response:**

```json
{
  "status": "error",
  "data": null,
  "error": "Missing user parameter"
}
```

**Error Responses:**

- `400 Bad Request`: Missing or invalid user address parameter, invalid address parameter, invalid page parameter (must be at least 1), invalid limit parameter (must be between 1 and 100), or invalid sort parameters (sortBy must be one of: date, symbol, activity, nomVal; sortOrder must be 'asc' or 'desc')
- `500 Internal Server Error`: Failed to fetch user trades

### User Referrals

Get referral data for a user including their referral code, referrer information, referred user count, and rebates breakdown.

**Endpoint:** `GET https://indexing.bounce.tech/user-referrals/:user`

**Path Parameters:**

- `user` (required): Ethereum address of the user

**Response Data:**

- `address`: User's Ethereum address
- `referralCode`: The user's own referral code (string or null if not registered)
- `referrerCode`: The referral code the user signed up with (string or null)
- `referrerAddress`: The address of the user who referred them (string or null)
- `isJoined`: Whether the user has joined via a referral (boolean)
- `referredUserCount`: Number of users this user has referred (integer)
- `referrerRebates`: Rebates earned as a referrer (number)
- `refereeRebates`: Rebates earned as a referee (number)
- `totalRebates`: Total rebates earned (number)
- `claimedRebates`: Rebates already claimed (number)
- `claimableRebates`: Rebates available to claim (number)

**Note:** If the user has not been seen on chain, a default response is returned with null/zero values and `isJoined` set to `false`.

**Example Request:**

```
GET https://indexing.bounce.tech/user-referrals/0x1234567890123456789012345678901234567890
```

**Example Success Response:**

```json
{
  "status": "success",
  "data": {
    "address": "0x1234567890123456789012345678901234567890",
    "referralCode": "ABC123",
    "referrerCode": "XYZ789",
    "referrerAddress": "0x9876543210987654321098765432109876543210",
    "isJoined": true,
    "referredUserCount": 5,
    "referrerRebates": 2.5,
    "refereeRebates": 1.08269,
    "totalRebates": 3.58269,
    "claimedRebates": 1.0,
    "claimableRebates": 2.58269
  },
  "error": null
}
```

**Example Response (user not found):**

```json
{
  "status": "success",
  "data": {
    "address": "0x1234567890123456789012345678901234567890",
    "referralCode": null,
    "referrerCode": null,
    "referrerAddress": null,
    "isJoined": false,
    "referredUserCount": 0,
    "referrerRebates": 0,
    "refereeRebates": 0,
    "totalRebates": 0,
    "claimedRebates": 0,
    "claimableRebates": 0
  },
  "error": null
}
```

**Error Responses:**

- `400 Bad Request`: Missing or invalid user address parameter
- `500 Internal Server Error`: Failed to fetch user referrals

### Validate Referral Code

Check whether a referral code exists and is valid.

**Endpoint:** `GET https://indexing.bounce.tech/is-valid-code/:code`

**Path Parameters:**

- `code` (required): The referral code to validate

**Response Data:**

- Boolean: `true` if the referral code exists, `false` otherwise

**Example Request:**

```
GET https://indexing.bounce.tech/is-valid-code/ABC123
```

**Example Success Response (valid code):**

```json
{
  "status": "success",
  "data": true,
  "error": null
}
```

**Example Success Response (invalid code):**

```json
{
  "status": "success",
  "data": false,
  "error": null
}
```

**Error Responses:**

- `400 Bad Request`: Missing code parameter
- `500 Internal Server Error`: Failed to check referral code validity

### Total Rebates (Deprecated)

> **Deprecated:** Use [`/user-referrals/:user`](#user-referrals) instead. This endpoint will be removed in a future release.

Get the total rebates earned by a user.

**Endpoint:** `GET https://indexing.bounce.tech/total-rebates`

**Query Parameters:**

- `user` (required): Ethereum address of the user

**Response Data:**

- Number representing the total rebates earned by the user (includes both referrer and referee rebates, in base asset units)

**Example Request:**

```
GET https://indexing.bounce.tech/total-rebates?user=0x1234567890123456789012345678901234567890
```

**Example Success Response:**

```json
{
  "status": "success",
  "data": 3.58269,
  "error": null
}
```

**Example Error Response:**

```json
{
  "status": "error",
  "data": null,
  "error": "Missing user parameter"
}
```

**Error Responses:**

- `400 Bad Request`: Missing or invalid user address parameter
- `500 Internal Server Error`: Failed to fetch total rebates

### Total Referrals (Deprecated)

> **Deprecated:** Use [`/user-referrals/:user`](#user-referrals) instead. This endpoint will be removed in a future release.

Get the number of referrals a user has made.

**Endpoint:** `GET https://indexing.bounce.tech/total-referrals`

**Query Parameters:**

- `user` (required): Ethereum address of the user

**Response Data:**

- Number representing the number of referrals a user has made

**Example Request:**

```
GET https://indexing.bounce.tech/total-referrals?user=0x1234567890123456789012345678901234567890
```

**Example Success Response:**

```json
{
  "status": "success",
  "data": 3,
  "error": null
}
```

**Example Error Response:**

```json
{
  "status": "error",
  "data": null,
  "error": "Missing user parameter"
}
```

**Error Responses:**

- `400 Bad Request`: Missing or invalid user address parameter
- `500 Internal Server Error`: Failed to fetch total referrals

### Latest Trades

Get the latest trades across all users.

**Endpoint:** `GET https://indexing.bounce.tech/latest-trades`

**Query Parameters:** None

**Response Data:**

- Array of trade objects (up to 100), each containing:
  - `id`: Unique trade identifier
  - `txHash`: Transaction hash of the trade
  - `timestamp`: Block timestamp of the trade (as string, serialized from BigInt)
  - `isBuy`: `true` for mints (buys), `false` for redeems (sells)
  - `baseAssetAmount`: Amount of USDC
  - `leveragedTokenAmount`: Amount of leveraged tokens (as string, serialized from BigInt)
  - `leveragedToken`: Address of the leveraged token
  - `sender`: Address initiating the trade
  - `recipient`: Address receiving the tokens
  - `targetLeverage`: Target leverage of the leveraged token (as string, serialized from BigInt)
  - `isLong`: Whether the leveraged token is a long position
  - `asset`: Leveraged token target asset (e.g. BTC, ETH)

Trades are ordered by timestamp descending (newest first).

**Example Request:**

```
GET https://indexing.bounce.tech/latest-trades
```

**Example Success Response:**

```json
{
  "status": "success",
  "data": [
    {
      "id": "0xabc123...",
      "txHash": "0xdef456...",
      "timestamp": "1704067200",
      "isBuy": true,
      "baseAssetAmount": "1000000000",
      "leveragedTokenAmount": "5000000000000000000",
      "leveragedToken": "0x1eefbacfea06d786ce012c6fc861bec6c7a828c1",
      "sender": "0x1234567890123456789012345678901234567890",
      "recipient": "0x9876543210987654321098765432109876543210",
      "targetLeverage": "3000000000000000000",
      "isLong": true,
      "asset": "USDC"
    },
    {
      "id": "0xghi789...",
      "txHash": "0xjkl012...",
      "timestamp": "1704153600",
      "isBuy": false,
      "baseAssetAmount": "500000000",
      "leveragedTokenAmount": "2500000000000000000",
      "leveragedToken": "0x1eefbacfea06d786ce012c6fc861bec6c7a828c1",
      "sender": "0x9876543210987654321098765432109876543210",
      "recipient": "0x1234567890123456789012345678901234567890",
      "targetLeverage": "3000000000000000000",
      "isLong": true,
      "asset": "USDC"
    }
  ],
  "error": null
}
```

**Error Responses:**

- None (always returns success with an array, which may be empty if there are no trades)

### Trade by Transaction Hash

Look up a specific trade by its originating transaction hash. This is useful for confirming that a trade has been indexed after submitting a transaction. If the trade has not been indexed yet, the endpoint returns `null` in the data field.

This endpoint provides a guaranteed exact match for the trade corresponding to the given transaction hash, eliminating the need to poll recent trades and perform fuzzy matching on the UI.

Polling this endpoint is also faster than polling the latest trades endpoint, since it performs a single lookup by transaction hash rather than fetching and filtering a list.

**Prepare Redeem Support:** This endpoint also works for prepare redeems. If you submit a prepare redeem transaction and poll with that transaction hash, the endpoint will keep returning `null` until the corresponding execute redeem has completed on chain. Once the execute redeem is processed, it will return the final trade data for the redeem, including exact PnL amounts after all fees.

**Endpoint:** `GET https://indexing.bounce.tech/trade/:txHash`

**Path Parameters:**

- `txHash` (required): The transaction hash to look up (must be a valid hex string)

**Response Data:**

Returns `null` if the trade has not been indexed yet, or a trade object containing:

- `id`: Unique trade identifier
- `isBuy`: `true` for mints (buys), `false` for redeems (sells)
- `leveragedToken`: Address of the leveraged token
- `timestamp`: Block timestamp of the trade (as string, serialized from BigInt)
- `sender`: Address initiating the trade
- `recipient`: Address receiving the tokens
- `baseAssetAmount`: Amount of base asset (as string, serialized from BigInt)
- `leveragedTokenAmount`: Amount of leveraged tokens (as string, serialized from BigInt)
- `profitAmount`: Profit amount for this trade (as string, serialized from BigInt; null for buys)
- `profitPercent`: Profit percentage for this trade (as string, serialized from BigInt; null for buys)
- `originTxHash`: The originating transaction hash used to look up this trade
- `txHash`: The transaction hash of the trade itself (same as `originTxHash` for direct mints and redeems; for prepare redeems, this will be the execute redeem transaction hash)

**Example Request:**

```
GET https://indexing.bounce.tech/trade/0xabc123def456789012345678901234567890123456789012345678901234abcd
```

**Example Success Response (trade found):**

```json
{
  "status": "success",
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "isBuy": false,
    "leveragedToken": "0x1eefbacfea06d786ce012c6fc861bec6c7a828c1",
    "timestamp": "1704153600",
    "sender": "0x1234567890123456789012345678901234567890",
    "recipient": "0x1234567890123456789012345678901234567890",
    "baseAssetAmount": "500000000",
    "leveragedTokenAmount": "2500000000000000000",
    "profitAmount": "50000000",
    "profitPercent": "100000000000000000",
    "originTxHash": "0xabc123def456789012345678901234567890123456789012345678901234abcd",
    "txHash": "0xabc123def456789012345678901234567890123456789012345678901234abcd"
  },
  "error": null
}
```

**Example Success Response (trade not yet indexed):**

```json
{
  "status": "success",
  "data": null,
  "error": null
}
```

**Example Error Response:**

```json
{
  "status": "error",
  "data": null,
  "error": "Invalid txHash"
}
```

**Error Responses:**

- `400 Bad Request`: Missing txHash parameter or invalid hex string
- `500 Internal Server Error`: Failed to fetch trade

### All Users

Get all users from the user table who have made at least one trade.

**Endpoint:** `GET https://indexing.bounce.tech/users`

**Query Parameters:** None

**Response Data:**

- Array of user objects, each containing trading and volume data:
  - `address`: User's Ethereum address (primary key)
  - `tradeCount`: Total number of trades made by the user (integer)
  - `mintVolumeNominal`: Total mint volume in nominal terms (number)
  - `redeemVolumeNominal`: Total redeem volume in nominal terms (number)
  - `totalVolumeNominal`: Total volume in nominal terms (number)
  - `mintVolumeNotional`: Total mint volume in notional terms (number)
  - `redeemVolumeNotional`: Total redeem volume in notional terms (number)
  - `totalVolumeNotional`: Total volume in notional terms (number)
  - `lastTradeTimestamp`: Timestamp of the user's last trade (number)
  - `realizedProfit`: Total realized profit (number)
  - `unrealizedProfit`: Total unrealized profit (number)
  - `totalProfit`: Total profit (realized + unrealized) (number)

Users are ordered by `lastTradeTimestamp` descending (most recently active first).

**Important Disclaimer:**

The `realizedProfit`, `unrealizedProfit`, and `totalProfit` fields can be manipulated through token transfers and should not be relied upon for use cases where accuracy is imperative.

- **Transfers out**: If a user transfers leveraged tokens out of their wallet, the balance decreases but the purchase cost basis remains unchanged, causing the unrealized PnL to appear artificially negative.
- **Transfers in**: If a user receives leveraged tokens via transfer (not through a trade), the balance increases but no purchase cost is associated with those tokens, causing the unrealized PnL to appear as pure profit.

These values are calculated based on on-chain balances and trade history, but do not account for external transfers. For our current use case this limitation is acceptable, but integrators should be aware of this behavior and avoid using these fields for critical financial calculations or auditing purposes.

**Example Request:**

```
GET https://indexing.bounce.tech/users
```

**Example Success Response:**

```json
{
  "status": "success",
  "data": [
    {
      "address": "0x9876543210987654321098765432109876543210",
      "tradeCount": 10,
      "mintVolumeNominal": 5000.0,
      "redeemVolumeNominal": 3000.0,
      "totalVolumeNominal": 8000.0,
      "mintVolumeNotional": 25000.0,
      "redeemVolumeNotional": 15000.0,
      "totalVolumeNotional": 40000.0,
      "lastTradeTimestamp": 1704153600,
      "realizedProfit": 100.5,
      "unrealizedProfit": 50.25,
      "totalProfit": 150.75
    },
    {
      "address": "0x1234567890123456789012345678901234567890",
      "tradeCount": 42,
      "mintVolumeNominal": 10000.0,
      "redeemVolumeNominal": 8000.0,
      "totalVolumeNominal": 18000.0,
      "mintVolumeNotional": 50000.0,
      "redeemVolumeNotional": 40000.0,
      "totalVolumeNotional": 90000.0,
      "lastTradeTimestamp": 1704067200,
      "realizedProfit": 500.0,
      "unrealizedProfit": 200.0,
      "totalProfit": 700.0
    }
  ],
  "error": null
}
```

**Error Responses:**

- `500 Internal Server Error`: Failed to fetch all users

### Referrers

Get all users who have registered a referral code.

**Endpoint:** `GET https://indexing.bounce.tech/referrers`

**Query Parameters:** None

**Response Data:**

- Array of referrer objects, each containing only referral-related fields:
  - `address`: User's Ethereum address (primary key)
  - `referralCode`: The user's own referral code
  - `referred`: Number of users referred by this user (integer)
  - `earned`: Rebates earned as a referrer (as string, serialized from BigInt)

**Note:** This endpoint only returns users who have a `referralCode` (i.e., they are referrers). Volume and trade count fields are excluded as they are not directly related to referrals.

**Example Request:**

```
GET https://indexing.bounce.tech/referrers
```

**Example Success Response:**

```json
{
  "status": "success",
  "data": [
    {
      "address": "0x1234567890123456789012345678901234567890",
      "referralCode": "ABC123",
      "referred": 5,
      "earned": "1000000000"
    },
    {
      "address": "0x9876543210987654321098765432109876543210",
      "referralCode": "XYZ789",
      "referred": 0,
      "earned": "200000000"
    }
  ],
  "error": null
}
```

**Error Responses:**

- `500 Internal Server Error`: Failed to fetch referrers

### All Leveraged Tokens

Get all leveraged tokens from the database.

**Endpoint:** `GET https://indexing.bounce.tech/leveraged-tokens`

**Query Parameters:** None

**Response Data:**

- Array of leveraged token objects, each containing:
  - `address`: Leveraged token contract address (primary key)
  - `targetLeverage`: Target leverage amount (number)
  - `isLong`: Whether the token is a long position (boolean)
  - `symbol`: ERC-20 symbol (string)
  - `name`: ERC-20 name (string)
  - `decimals`: ERC-20 decimals (integer)
  - `asset`: Leveraged token target asset (e.g. BTC, ETH)
  - `mintPaused`: Whether minting is currently paused for this leveraged token (boolean)
  - `exchangeRate`: Current exchange rate (as string, serialized from BigInt)
  - `totalSupply`: Total supply of leveraged tokens in existence (as string, serialized from BigInt)
  - `totalAssets`: Total USDC value of the leveraged token (as string, 6 decimals)

**Example Request:**

```
GET https://indexing.bounce.tech/leveraged-tokens
```

**Example Success Response:**

```json
{
  "status": "success",
  "data": [
    {
      "address": "0x1eefbacfea06d786ce012c6fc861bec6c7a828c1",
      "targetLeverage": 2,
      "isLong": true,
      "symbol": "BTC2L",
      "name": "BTC 2x Long",
      "decimals": 18,
      "asset": "BTC",
      "mintPaused": false,
      "exchangeRate": "1050000000000000000",
      "totalSupply": "1000000000000000000000",
      "totalAssets": "1000000000"
    },
    {
      "address": "0x22a7a4a38a97ca44473548036f22a7bcd2c25457",
      "targetLeverage": 3,
      "isLong": false,
      "symbol": "ETH3S",
      "name": "ETH 3x Short",
      "decimals": 18,
      "asset": "ETH",
      "mintPaused": true,
      "exchangeRate": "980000000000000000",
      "totalSupply": "500000000000000000000",
      "totalAssets": "500000000"
    }
  ],
  "error": null
}
```

**Error Responses:**

- `500 Internal Server Error`: Failed to fetch leveraged tokens

### Single Leveraged Token

Get data for a single leveraged token by symbol.

**Endpoint:** `GET https://indexing.bounce.tech/leveraged-tokens/:symbol`

**Path Parameters:**

- `symbol` (required): The ERC-20 symbol of the leveraged token (e.g. `3L-USDC`, `2S-BTC`)

**Response Data:**

- Leveraged token object containing:
  - `address`: Leveraged token contract address (primary key)
  - `targetLeverage`: Target leverage amount (number)
  - `isLong`: Whether the token is a long position (boolean)
  - `symbol`: ERC-20 symbol (string)
  - `name`: ERC-20 name (string)
  - `decimals`: ERC-20 decimals (integer)
  - `asset`: Leveraged token target asset (e.g. BTC, ETH)
  - `mintPaused`: Whether minting is currently paused for this leveraged token (boolean)
  - `exchangeRate`: Current exchange rate (as string, serialized from BigInt)
  - `totalSupply`: Total supply of leveraged tokens in existence (as string, serialized from BigInt)
  - `totalAssets`: Total USDC value of the leveraged token (as string, 6 decimals)

**Example Request:**

```
GET https://indexing.bounce.tech/leveraged-tokens/3L-USDC
```

**Example Success Response:**

```json
{
  "status": "success",
  "data": {
    "address": "0x1eefbacfea06d786ce012c6fc861bec6c7a828c1",
    "targetLeverage": 5,
    "isLong": true,
    "symbol": "HYPE5L",
    "name": "HYPE 5x Long",
    "decimals": 18,
    "asset": "HYPE",
    "mintPaused": false,
    "exchangeRate": "1050000000000000000",
    "totalSupply": "1000000000000000000000",
    "totalAssets": "1000000000"
  },
  "error": null
}
```

**Example Error Response:**

```json
{
  "status": "error",
  "data": null,
  "error": "Leveraged token not found"
}
```

**Error Responses:**

- `400 Bad Request`: Missing symbol parameter
- `404 Not Found`: Leveraged token not found in the database
- `500 Internal Server Error`: Failed to fetch leveraged token by symbol
