# Bounce Indexing

A [Ponder](https://ponder.sh) indexing project for tracking [Bounce Tech](https://bounce.tech/) leveraged tokens and trades on HyperEVM.

## Overview

This project indexes the **Bounce Tech leveraged token protocol**, a decentralized finance (DeFi) platform that enables leveraged trading through tokenized assets. The indexer tracks leveraged token contracts created by the Bounce Tech factory contract, monitoring:

- **Leveraged Tokens**: Token metadata including address, creator, market ID, leverage settings, and ERC-20 properties (symbol, name, decimals)
- **Trades**: All mint and redeem operations for leveraged tokens
- **Transfers**: ERC-20 token transfers for leveraged tokens
- **Fees**: Fees paid from leveraged tokens (currently sent to treasury, with support for multiple destinations in the future)
- **Referrals**: User referral registrations and relationships
- **Rebates**: Rebate claims from the referral system

## Setup

1. Install dependencies:

```bash
npm install
```

2. Set up environment variables in `.env.local`:

Create a `.env.local` file in the root directory with:

```bash
HYPER_EVM_RPC_URL=your_rpc_url_here
```

3. Start the development server:

```bash
npm run dev
```

The dev server will:

- Connect to the database
- Start indexing from the configured start block
- Serve the GraphQL API at `http://localhost:42069/graphql`
- Serve custom REST API endpoints at `http://localhost:42069`:
  - `/stats` - Protocol statistics
  - `/traded-lts` - Leveraged tokens traded by a user
  - `/users-trades` - All trades for a user
  - `/user-pnl` - Profit and loss for a user
  - `/latest-trades` - Latest 100 trades across all users

## Schema

### `leveragedToken`

Stores metadata for each leveraged token created by the factory.

- `address` (primary key): Token contract address
- `creator`: Address that created the token
- `marketId`: Market identifier
- `targetLeverage`: Target leverage amount
- `isLong`: Whether the token is a long position
- `symbol`: ERC-20 symbol
- `name`: ERC-20 name
- `decimals`: ERC-20 decimals
- `asset`: Base asset symbol

### `trade`

Stores all mint and redeem operations.

- `id` (primary key): Unique trade identifier
- `isBuy`: `true` for mints, `false` for redeems
- `leveragedToken`: Address of the leveraged token (references `leveragedToken.address`)
- `timestamp`: Block timestamp
- `sender`: Address initiating the trade
- `recipient`: Address receiving the tokens
- `baseAssetAmount`: Amount of base asset
- `leveragedTokenAmount`: Amount of leveraged tokens
- `txHash`: Transaction hash of the trade

### `transfer`

Stores ERC-20 token transfers for leveraged tokens.

- `id` (primary key): Unique transfer identifier
- `timestamp`: Block timestamp
- `leveragedToken`: Address of the leveraged token (references `leveragedToken.address`)
- `sender`: Address sending the tokens
- `recipient`: Address receiving the tokens
- `amount`: Amount of tokens transferred
- `txHash`: Transaction hash of the transfer

### `referral`

Stores user referral registrations.

- `id` (primary key): Unique referral identifier
- `user`: Address of the user who joined with a referral code
- `code`: Referral code used
- `referrer`: Address of the referrer

### `rebate`

Stores rebate claims from the referral system.

- `id` (primary key): Unique rebate identifier
- `sender`: Address that claimed the rebate
- `to`: Address that received the rebate
- `rebate`: Amount of rebate claimed

### `fee`

Stores fees paid from leveraged tokens.

- `id` (primary key): Unique fee identifier
- `leveragedToken`: Address of the leveraged token (references `leveragedToken.address`)
- `timestamp`: Block timestamp
- `amount`: Amount of fee paid
- `destination`: Destination of the fee (e.g., "treasury")

**Note:** Currently, all fees are sent to the treasury. The system is designed to support multiple fee destinations in the future.

### Relations

- Each `leveragedToken` can have many `trade` records
- Each `trade` belongs to one `leveragedToken`
- Each `leveragedToken` can have many `transfer` records
- Each `transfer` belongs to one `leveragedToken`
- Each `leveragedToken` can have many `fee` records
- Each `fee` belongs to one `leveragedToken`

## Indexing

The project indexes events from the Bounce Tech protocol:

1. **Bounce Tech Factory Contract** (address imported from `@bouncetech/contracts` package)

   - `CreateLeveragedToken`: Creates a new leveraged token record and reads token metadata (symbol, name, decimals) from the contract

2. **Bounce Tech LeveragedToken Contracts** (factory pattern, with 24 pre-configured addresses)

   - `Mint`: Records buy trades
   - `Redeem`: Records sell trades
   - `ExecuteRedeem`: Records executed redemption trades
   - `Transfer`: Records ERC-20 token transfers
   - `SendFeesToTreasury`: Records fees paid from leveraged tokens

3. **Bounce Tech Referrals Contract** (address imported from `@bouncetech/contracts` package)
   - `JoinWithReferral`: Records when users join with a referral code
   - `ClaimRebate`: Records rebate claims from the referral system

The indexer uses block-based indexing starting from block `21549398` and processes new blocks in real-time.

## Querying

### GraphQL

Visit `http://localhost:42069/graphql` to explore the auto-generated GraphQL API.

Example query:

```graphql
query MyQuery {
  trades {
    items {
      isBuy
      leveragedTokenAmount
      timestamp
      baseAssetAmount
      leveragedToken {
        address
        marketId
        isLong
        name
        symbol
      }
    }
  }
}
```

### API

The API provides custom REST endpoints for querying leveraged token data. All endpoints use GET requests.

**Live Endpoint:** The indexing API is available at `https://indexing.bounce.tech/`. For example:
- `https://indexing.bounce.tech/stats` - Get protocol statistics
- `https://indexing.bounce.tech/users-trades?user=0x...` - Get user trades

**Local Development:** When running locally, endpoints are served at `http://localhost:42069`.

#### Endpoints Summary

| Endpoint          | Method   | Description                            | Required Parameters |
| ----------------- | -------- | -------------------------------------- | ------------------- |
| `/stats`          | GET      | Get aggregated protocol statistics     | None                |
| `/traded-lts`     | GET      | Get leveraged tokens a user has traded | `user`              |
| `/users-trades`   | GET      | Get all trades for a user              | `user`              |
| `/user-pnl`       | GET      | Get profit and loss for a user         | `user`              |
| `/total-rebates`  | GET      | Get total rebates claimed by a user    | `user`              |
| `/total-referrals`| GET      | Get total referrals made by a user     | `user`              |
| `/latest-trades`  | GET      | Get latest 100 trades across all users | None                |
| `/graphql`        | GET/POST | GraphQL API endpoint                   | N/A                 |

#### Response Format

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
- Error responses return HTTP status code `400 Bad Request` for invalid or missing parameters
- CORS is enabled for specific origins: `http://localhost:5173`, `https://bounce.tech`, and Firebase web apps (`*.web.app`)

#### Stats Endpoint

Get aggregated protocol statistics.

**Live:** `https://indexing.bounce.tech/stats`  
**Local:** `http://localhost:42069/stats`

**Response Data:**

- `marginVolume`: Total margin volume (in base asset units)
- `notionalVolume`: Total notional volume (in base asset units)
- `averageLeverage`: Average leverage across all trades
- `supportedAssets`: Number of unique market IDs
- `leveragedTokens`: Total number of leveraged tokens created
- `uniqueUsers`: Number of unique users who have traded
- `totalValueLocked`: Current TVL across all leveraged tokens
- `openInterest`: Current open interest across all leveraged tokens
- `totalTrades`: Total number of trades (mints and redeems)
- `treasuryFees`: Total fees sent to treasury (in base asset units)

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

#### Traded LTs Endpoint

Get the list of leveraged tokens that a user has traded at `http://localhost:42069/traded-lts`.

**Query Parameters:**

- `user` (required): Ethereum address of the user

**Response Data:**

- Array of unique leveraged token addresses that the user has received transfers for

**Example Request:**

```
GET http://localhost:42069/traded-lts?user=0x1234567890123456789012345678901234567890
```

**Example Success Response:**

```json
{
  "status": "success",
  "data": [
    "0x1eefbacfea06d786ce012c6fc861bec6c7a828c1",
    "0x22a7a4a38a97ca44473548036f22a7bcd2c25457",
    "0x2525f0794a927df477292bee1bc1fd57b8a82614"
  ],
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

#### Users Trades Endpoint

Get all trades for a specific user at `http://localhost:42069/users-trades`.

**Query Parameters:**

- `user` (required): Ethereum address of the user
- `asset` (optional): Filter trades by asset (base asset symbol)
- `leveragedTokenAddress` (optional): Filter trades by specific leveraged token address

**Note:** You can combine `asset` and `leveragedTokenAddress` filters. If both are provided, trades must match both conditions.

**Response Data:**

- Array of trade objects, each containing:
  - `id`: Unique trade identifier
  - `txHash`: Transaction hash of the trade
  - `timestamp`: Block timestamp of the trade (as string, serialized from BigInt)
  - `isBuy`: `true` for mints (buys), `false` for redeems (sells)
  - `baseAssetAmount`: Amount of base asset (as string, serialized from BigInt)
  - `leveragedTokenAmount`: Amount of leveraged tokens (as string, serialized from BigInt)
  - `leveragedToken`: Address of the leveraged token
  - `targetLeverage`: Target leverage of the leveraged token (as string, serialized from BigInt)
  - `isLong`: Whether the leveraged token is a long position
  - `asset`: Base asset symbol

**Example Request:**

```
GET http://localhost:42069/users-trades?user=0x1234567890123456789012345678901234567890
```

**Example Request with Asset Filter:**

```
GET http://localhost:42069/users-trades?user=0x1234567890123456789012345678901234567890&asset=USDC
```

**Example Request with Leveraged Token Address Filter:**

```
GET http://localhost:42069/users-trades?user=0x1234567890123456789012345678901234567890&leveragedTokenAddress=0x1eefbacfea06d786ce012c6fc861bec6c7a828c1
```

**Example Request with Both Filters:**

```
GET http://localhost:42069/users-trades?user=0x1234567890123456789012345678901234567890&asset=USDC&leveragedTokenAddress=0x1eefbacfea06d786ce012c6fc861bec6c7a828c1
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
      "targetLeverage": "1000000000000000000",
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
      "targetLeverage": "1000000000000000000",
      "isLong": true,
      "asset": "USDC"
    }
  ],
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

- `400 Bad Request`: Missing or invalid user address parameter, or invalid leveraged token address parameter

#### User PnL Endpoint

Get profit and loss (PnL) information for a user across all leveraged tokens at `http://localhost:42069/user-pnl`.

**Query Parameters:**

- `user` (required): Ethereum address of the user

**Response Data:**

- `totalRealized`: Total realized PnL across all leveraged tokens (in base asset units)
- `totalUnrealized`: Total unrealized PnL across all leveraged tokens (in base asset units)
- `leveragedTokens`: Record (object) of PnL data keyed by leveraged token address:
  - Each key is a leveraged token address
  - Each value contains:
    - `realized`: Realized PnL for this leveraged token (in base asset units)
    - `unrealized`: Unrealized PnL for this leveraged token (in base asset units)
    - `unrealizedPercent`: Unrealized PnL as a percentage (e.g., 0.15 = 15%)

**Example Request:**

```
GET http://localhost:42069/user-pnl?user=0x1234567890123456789012345678901234567890
```

**Example Success Response:**

```json
{
  "status": "success",
  "data": {
    "totalRealized": 1234.56,
    "totalUnrealized": -567.89,
    "leveragedTokens": {
      "0x1eefbacfea06d786ce012c6fc861bec6c7a828c1": {
        "realized": 500.0,
        "unrealized": 200.0,
        "unrealizedPercent": 0.4
      },
      "0x22a7a4a38a97ca44473548036f22a7bcd2c25457": {
        "realized": 734.56,
        "unrealized": -767.89,
        "unrealizedPercent": -1.045
      }
    }
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

- `400 Bad Request`: Missing or invalid user address parameter

#### Total Rebates Endpoint

Get the number value of rebates a user has claimed at `http://localhost:42069/total-rebates`.

**Query Parameters:**

- `user` (required): Ethereum address of the user

**Response Data:**

- Number representing the value of rebates the user has claimed

**Example Request:**

```
GET http://localhost:42069/total-rebates?user=0x1234567890123456789012345678901234567890
```

**Example Success Response:**

```json
{ "status": "success", "data": 3.58269, "error": null }
```

**Example Error Response:**

```json
{ "status": "error", "error": "Missing user parameter", "data": null }
```

**Error Responses:**

- `400 Bad Request`: Missing or invalid user address parameter

#### Total Referrals Endpoint

Get the number value of referrals a user has made at `http://localhost:42069/total-referrals`.

**Query Parameters:**

- `user` (required): Ethereum address of the user

**Response Data:**

- Number representing the number of referrals a user has made

**Example Request:**

```
GET http://localhost:42069/total-referrals?user=0x1234567890123456789012345678901234567890
```

**Example Success Response:**

```json
{ "status": "success", "data": 3, "error": null }
```

**Example Error Response:**

```json
{ "status": "error", "error": "Missing user parameter", "data": null }
```

**Error Responses:**

- `400 Bad Request`: Missing or invalid user address parameter

#### Latest Trades Endpoint

Get the latest 100 trades across all users at `http://localhost:42069/latest-trades`.

**Query Parameters:**

- None

**Response Data:**

- Array of trade objects (up to 100), each containing:
  - `id`: Unique trade identifier
  - `txHash`: Transaction hash of the trade
  - `timestamp`: Block timestamp of the trade (as string, serialized from BigInt)
  - `isBuy`: `true` for mints (buys), `false` for redeems (sells)
  - `baseAssetAmount`: Amount of base asset (as string, serialized from BigInt)
  - `leveragedTokenAmount`: Amount of leveraged tokens (as string, serialized from BigInt)
  - `leveragedToken`: Address of the leveraged token
  - `sender`: Address initiating the trade
  - `recipient`: Address receiving the tokens
  - `targetLeverage`: Target leverage of the leveraged token (as string, serialized from BigInt)
  - `isLong`: Whether the leveraged token is a long position
  - `asset`: Base asset symbol

Trades are ordered by timestamp descending (newest first).

**Example Request:**

```
GET http://localhost:42069/latest-trades
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
      "targetLeverage": "1000000000000000000",
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
      "targetLeverage": "1000000000000000000",
      "isLong": true,
      "asset": "USDC"
    }
  ],
  "error": null
}
```

**Error Responses:**

- None (always returns success with an array, which may be empty if there are no trades)

## Scripts

- `npm run dev`: Start development server with hot reload
- `npm run start`: Start production server
- `npm run serve`: Serve API only (no indexing)
- `npm run db`: Database management commands
- `npm run codegen`: Generate TypeScript types
- `npm run lint`: Run ESLint
- `npm run typecheck`: Run TypeScript type checking
- `npm run test`: Run tests
- `npm run test:watch`: Run tests in watch mode

## Learn More

- [Bounce Tech](https://bounce.tech/) - The leveraged token protocol being indexed
- [Ponder Documentation](https://ponder.sh/docs)
- [Ponder GitHub](https://github.com/ponder-sh/ponder)
