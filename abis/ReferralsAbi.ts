export const ReferralsAbi = [
  {
    type: "constructor",
    inputs: [
      {
        name: "globalStorate_",
        type: "address",
        internalType: "address",
      },
    ],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "addReferrer",
    inputs: [
      {
        name: "referralCode_",
        type: "string",
        internalType: "string",
      },
      {
        name: "referrer_",
        type: "address",
        internalType: "address",
      },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "claimRebates",
    inputs: [
      {
        name: "user_",
        type: "address",
        internalType: "address",
      },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "donateRebates",
    inputs: [
      {
        name: "user_",
        type: "address",
        internalType: "address",
      },
      {
        name: "feeAmount_",
        type: "uint256",
        internalType: "uint256",
      },
    ],
    outputs: [
      {
        name: "",
        type: "uint256",
        internalType: "uint256",
      },
    ],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "getCodeFromReferrer",
    inputs: [
      {
        name: "referrer_",
        type: "address",
        internalType: "address",
      },
    ],
    outputs: [
      {
        name: "",
        type: "string",
        internalType: "string",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getCodeFromUser",
    inputs: [
      {
        name: "user_",
        type: "address",
        internalType: "address",
      },
    ],
    outputs: [
      {
        name: "",
        type: "string",
        internalType: "string",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getRebate",
    inputs: [
      {
        name: "user_",
        type: "address",
        internalType: "address",
      },
    ],
    outputs: [
      {
        name: "",
        type: "uint256",
        internalType: "uint256",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getReferrerFromCode",
    inputs: [
      {
        name: "referralCode_",
        type: "string",
        internalType: "string",
      },
    ],
    outputs: [
      {
        name: "",
        type: "address",
        internalType: "address",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getReferrerFromUser",
    inputs: [
      {
        name: "user_",
        type: "address",
        internalType: "address",
      },
    ],
    outputs: [
      {
        name: "",
        type: "address",
        internalType: "address",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "isJoined",
    inputs: [
      {
        name: "user_",
        type: "address",
        internalType: "address",
      },
    ],
    outputs: [
      {
        name: "",
        type: "bool",
        internalType: "bool",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "isReferrer",
    inputs: [
      {
        name: "referrer_",
        type: "address",
        internalType: "address",
      },
    ],
    outputs: [
      {
        name: "",
        type: "bool",
        internalType: "bool",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "isValidCode",
    inputs: [
      {
        name: "referralCode_",
        type: "string",
        internalType: "string",
      },
    ],
    outputs: [
      {
        name: "",
        type: "bool",
        internalType: "bool",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "joinWithReferral",
    inputs: [
      {
        name: "referralCode_",
        type: "string",
        internalType: "string",
      },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "removeReferrer",
    inputs: [
      {
        name: "referralCode_",
        type: "string",
        internalType: "string",
      },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "event",
    name: "AddReferrer",
    inputs: [
      {
        name: "referrer",
        type: "address",
        indexed: true,
        internalType: "address",
      },
      {
        name: "referralCode",
        type: "string",
        indexed: false,
        internalType: "string",
      },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "ClaimRebate",
    inputs: [
      {
        name: "sender",
        type: "address",
        indexed: true,
        internalType: "address",
      },
      {
        name: "to",
        type: "address",
        indexed: true,
        internalType: "address",
      },
      {
        name: "rebate",
        type: "uint256",
        indexed: false,
        internalType: "uint256",
      },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "DonateRebate",
    inputs: [
      {
        name: "sender",
        type: "address",
        indexed: true,
        internalType: "address",
      },
      {
        name: "to",
        type: "address",
        indexed: true,
        internalType: "address",
      },
      {
        name: "feeAmount",
        type: "uint256",
        indexed: false,
        internalType: "uint256",
      },
      {
        name: "referrerRebate",
        type: "uint256",
        indexed: false,
        internalType: "uint256",
      },
      {
        name: "referreeRebate",
        type: "uint256",
        indexed: false,
        internalType: "uint256",
      },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "JoinWithReferral",
    inputs: [
      {
        name: "referree",
        type: "address",
        indexed: true,
        internalType: "address",
      },
      {
        name: "referrer",
        type: "address",
        indexed: true,
        internalType: "address",
      },
      {
        name: "referralCode",
        type: "string",
        indexed: false,
        internalType: "string",
      },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "RemoveReferrer",
    inputs: [
      {
        name: "referrer",
        type: "address",
        indexed: true,
        internalType: "address",
      },
      {
        name: "referralCode",
        type: "string",
        indexed: false,
        internalType: "string",
      },
    ],
    anonymous: false,
  },
  {
    type: "error",
    name: "CodeAlreadyExists",
    inputs: [],
  },
  {
    type: "error",
    name: "CodeDoesNotExist",
    inputs: [],
  },
  {
    type: "error",
    name: "InvalidReferralCode",
    inputs: [],
  },
  {
    type: "error",
    name: "InvalidReferrer",
    inputs: [],
  },
  {
    type: "error",
    name: "NoRebate",
    inputs: [],
  },
  {
    type: "error",
    name: "NotOwner",
    inputs: [],
  },
  {
    type: "error",
    name: "SafeERC20FailedOperation",
    inputs: [
      {
        name: "token",
        type: "address",
        internalType: "address",
      },
    ],
  },
  {
    type: "error",
    name: "UserAlreadyJoined",
    inputs: [],
  },
  {
    type: "error",
    name: "UserAlreadyReferrer",
    inputs: [],
  },
] as const;
