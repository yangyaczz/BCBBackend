const { SignProtocolClient, SpMode, EvmChains } = require("@ethsign/sp-sdk");
const { privateKeyToAccount } = require("viem/accounts");
const { parseEther } = require('viem')

require('dotenv').config();
const privateKey = process.env.PRIVATE_KEY

const client = new SignProtocolClient(SpMode.OnChain, {
    chain: EvmChains.baseSepolia,
    account: privateKeyToAccount(privateKey),
});


async function createNotaryAttestation(itemName, itemQuantity, itemPrice, tokenAddress, purchaser, lotteryNumber) {

    const itemPricesInEth = itemPrice.map(price => parseEther(price.toString()));

    const totalPrice = itemPricesInEth.reduce((sum, price, index) => {
        return sum + (price * BigInt(itemQuantity[index]));
    }, BigInt(0));

    const res = await client.createAttestation({
        schemaId: "0x4e4",
        data: {
            itemName: itemName,
            itemQuantity: itemQuantity,
            itemPrice: itemPricesInEth,
            purchaseTimestamp: Math.floor(Date.now() / 1000).toString(),
            tokenAddress: tokenAddress,
            purchaser: purchaser,
            totalPrice: totalPrice,
            lotteryNumber: lotteryNumber
        },
        indexingValue: purchaser
    });

    console.log('attestation result:', res)
    console.log(`https://testnet-scan.sign.global/attestation/onchain_evm_84532_${res.attestationId}`)
}

createNotaryAttestation(['cocoa', 'chicken'], [2, 1], [1, 2], '0xA7ab21686D40Aa35Cb51137A795D84A57352F593', '0xBEbAF2a9ad714fEb9Dd151d81Dd6d61Ae0535646', [2, 1, 3])

