import { Address } from "viem";

const addressMatch = (address1: Address, address2: Address) => {
    return address1.toLowerCase() === address2.toLowerCase();
}

export default addressMatch;