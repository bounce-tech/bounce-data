# Bounce Indexing

A [Ponder](https://ponder.sh) indexing project for tracking [Bounce Tech](https://bounce.tech/) leveraged tokens and trades on HyperEVM.

## Overview

This project indexes the **Bounce Tech leveraged token protocol**, a decentralized finance (DeFi) platform that enables leveraged trading through tokenized assets. The indexer tracks leveraged token contracts created by the Bounce Tech factory contract, monitoring:

- **Leveraged Tokens**: Token metadata including address, creator, market ID, leverage settings, and ERC-20 properties (symbol, name, decimals)
- **Trades**: All mint and redeem operations for leveraged tokens
- **Transfers**: ERC-20 token transfers for leveraged tokens
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
- Serve SQL over HTTP at `http://localhost:42069/sql`
- Serve custom API endpoints (including `/stats` and `/traded-lts`) at `http://localhost:42069`

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

### `transfer`

Stores ERC-20 token transfers for leveraged tokens.

- `id` (primary key): Unique transfer identifier
- `timestamp`: Block timestamp
- `leveragedToken`: Address of the leveraged token (references `leveragedToken.address`)
- `sender`: Address sending the tokens
- `recipient`: Address receiving the tokens
- `amount`: Amount of tokens transferred

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

### Relations

- Each `leveragedToken` can have many `trade` records
- Each `trade` belongs to one `leveragedToken`
- Each `leveragedToken` can have many `transfer` records
- Each `transfer` belongs to one `leveragedToken`

## Indexing

The project indexes events from the Bounce Tech protocol:

1. **Bounce Tech Factory Contract** (`0xaBD5D943b4Bb1D25C6639dD264243b246CC3aA51`)

   - `CreateLeveragedToken`: Creates a new leveraged token record and reads token metadata (symbol, name, decimals) from the contract

2. **Bounce Tech LeveragedToken Contracts** (factory pattern)

   - `Mint`: Records buy trades
   - `Redeem`: Records sell trades
   - `ExecuteRedeem`: Records executed redemption trades
   - `Transfer`: Records ERC-20 token transfers

3. **Bounce Tech Referrals Contract** (`0x82A4063f4d05bb7BF18DF314DC5B63b655E86cBD`)
   - `JoinWithReferral`: Records when users join with a referral code
   - `ClaimRebate`: Records rebate claims from the referral system

The indexer uses block-based indexing starting from block `16731647` and processes new blocks in real-time.

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

### SQL over HTTP

Query tables directly using SQL over HTTP at `http://localhost:42069/sql`.

### API

All API endpoints follow a consistent response structure.

#### Response Format

All API endpoints return responses in the following format:

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

#### Stats Endpoint

Get aggregated protocol statistics at `http://localhost:42069/stats`.

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
    "totalTrades": 1234
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

## Scripts

- `npm run dev`: Start development server with hot reload
- `npm run start`: Start production server
- `npm run serve`: Serve API only (no indexing)
- `npm run db`: Database management commands
- `npm run codegen`: Generate TypeScript types
- `npm run lint`: Run ESLint
- `npm run typecheck`: Run TypeScript type checking

## Learn More

- [Bounce Tech](https://bounce.tech/) - The leveraged token protocol being indexed
- [Ponder Documentation](https://ponder.sh/docs)
- [Ponder GitHub](https://github.com/ponder-sh/ponder)
