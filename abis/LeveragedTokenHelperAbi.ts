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
    name: "getLeveragedTokenPositionData",
    inputs: [
      {
        name: "leveragedTokenAddress_",
        type: "address",
        internalType: "address",
      },
    ],
    outputs: [
      {
        name: "",
        type: "tuple",
        internalType: "struct ILeveragedTokenHelper.LeveragedTokenPositionData",
        components: [
          {
            name: "leveragedToken",
            type: "address",
            internalType: "address",
          },
          {
            name: "baseAssetContractBalance",
            type: "uint256",
            internalType: "uint256",
          },
          {
            name: "baseAssetUserCredit",
            type: "uint256",
            internalType: "uint256",
          },
          {
            name: "usdcSpotBalance",
            type: "uint256",
            internalType: "uint256",
          },
          {
            name: "usdcPerpBalance",
            type: "uint256",
            internalType: "uint256",
          },
          {
            name: "usdcMargin",
            type: "uint256",
            internalType: "uint256",
          },
          {
            name: "notionalValue",
            type: "uint256",
            internalType: "uint256",
          },
          {
            name: "effectiveLeverage",
            type: "uint256",
            internalType: "uint256",
          },
          {
            name: "targetLeverage",
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
            name: "agentData",
            type: "tuple[3]",
            internalType: "struct ILeveragedTokenHelper.AgentData[3]",
            components: [
              {
                name: "slot",
                type: "uint8",
                internalType: "uint8",
              },
              {
                name: "agent",
                type: "address",
                internalType: "address",
              },
              {
                name: "createdAt",
                type: "uint256",
                internalType: "uint256",
              },
            ],
          },
          {
            name: "balanceOf",
            type: "uint256",
            internalType: "uint256",
          },
          {
            name: "mintPaused",
            type: "bool",
            internalType: "bool",
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
            name: "agentData",
            type: "tuple[3]",
            internalType: "struct ILeveragedTokenHelper.AgentData[3]",
            components: [
              {
                name: "slot",
                type: "uint8",
                internalType: "uint8",
              },
              {
                name: "agent",
                type: "address",
                internalType: "address",
              },
              {
                name: "createdAt",
                type: "uint256",
                internalType: "uint256",
              },
            ],
          },
          {
            name: "balanceOf",
            type: "uint256",
            internalType: "uint256",
          },
          {
            name: "mintPaused",
            type: "bool",
            internalType: "bool",
          },
        ],
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getLeveragedTokensCoreData",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "tuple[]",
        internalType: "struct ILeveragedTokenHelper.LeveragedTokenCoreData[]",
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
            name: "baseAssetBalance",
            type: "uint256",
            internalType: "uint256",
          },
          {
            name: "credit",
            type: "uint256",
            internalType: "uint256",
          },
          {
            name: "agentData",
            type: "tuple[3]",
            internalType: "struct ILeveragedTokenHelper.AgentData[3]",
            components: [
              {
                name: "slot",
                type: "uint8",
                internalType: "uint8",
              },
              {
                name: "agent",
                type: "address",
                internalType: "address",
              },
              {
                name: "createdAt",
                type: "uint256",
                internalType: "uint256",
              },
            ],
          },
          {
            name: "mintPaused",
            type: "bool",
            internalType: "bool",
          },
        ],
      },
    ],
    stateMutability: "view",
  },
  {
    type: "error",
    name: "DivisionByZero",
    inputs: [],
  },
];
