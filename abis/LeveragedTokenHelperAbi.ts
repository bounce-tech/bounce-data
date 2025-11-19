export const LeveragedTokenHelperAbi = [
  {
    type: "constructor",
    inputs: [
      {
        name: "globalStorage_",
        type: "address",
        internalType: "address",
      },
    ],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "getLeveragedTokens",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "tuple[]",
        internalType: "struct ILeveragedTokenHelper.LeveragedTokenData[]",
        components: [
          {
            name: "leveragedToken",
            type: "address",
            internalType: "address",
          },
          {
            name: "marketId",
            type: "uint32",
            internalType: "uint32",
          },
          {
            name: "targetAsset",
            type: "string",
            internalType: "string",
          },
          {
            name: "targetLeverage",
            type: "uint256",
            internalType: "uint256",
          },
          {
            name: "isLong",
            type: "bool",
            internalType: "bool",
          },
          {
            name: "exchangeRate",
            type: "uint256",
            internalType: "uint256",
          },
          {
            name: "baseAssetBalance",
            type: "uint256",
            internalType: "uint256",
          },
          {
            name: "totalAssets",
            type: "uint256",
            internalType: "uint256",
          },
          {
            name: "userCredit",
            type: "uint256",
            internalType: "uint256",
          },
          {
            name: "credit",
            type: "uint256",
            internalType: "uint256",
          },
          {
            name: "agents",
            type: "address[3]",
            internalType: "address[3]",
          },
          {
            name: "balanceOf",
            type: "uint256",
            internalType: "uint256",
          },
        ],
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getLeveragedTokens",
    inputs: [
      {
        name: "user_",
        type: "address",
        internalType: "address",
      },
      {
        name: "onlyHeld_",
        type: "bool",
        internalType: "bool",
      },
    ],
    outputs: [
      {
        name: "",
        type: "tuple[]",
        internalType: "struct ILeveragedTokenHelper.LeveragedTokenData[]",
        components: [
          {
            name: "leveragedToken",
            type: "address",
            internalType: "address",
          },
          {
            name: "marketId",
            type: "uint32",
            internalType: "uint32",
          },
          {
            name: "targetAsset",
            type: "string",
            internalType: "string",
          },
          {
            name: "targetLeverage",
            type: "uint256",
            internalType: "uint256",
          },
          {
            name: "isLong",
            type: "bool",
            internalType: "bool",
          },
          {
            name: "exchangeRate",
            type: "uint256",
            internalType: "uint256",
          },
          {
            name: "baseAssetBalance",
            type: "uint256",
            internalType: "uint256",
          },
          {
            name: "totalAssets",
            type: "uint256",
            internalType: "uint256",
          },
          {
            name: "userCredit",
            type: "uint256",
            internalType: "uint256",
          },
          {
            name: "credit",
            type: "uint256",
            internalType: "uint256",
          },
          {
            name: "agents",
            type: "address[3]",
            internalType: "address[3]",
          },
          {
            name: "balanceOf",
            type: "uint256",
            internalType: "uint256",
          },
        ],
      },
    ],
    stateMutability: "view",
  },
];
