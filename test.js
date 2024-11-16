async function a() {
    const response = await fetch('https://testbk-zeta.vercel.app/api/notary/create', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            itemName: ['cocoa', 'chicken'],
            itemQuantity: [2, 3],
            itemPrice: [1, 5],
            tokenAddress: '0xA7ab21686D40Aa35Cb51137A795D84A57352F593',
            purchaser: '0xBEbAF2a9ad714fEb9Dd151d81Dd6d61Ae0535646',
            lotteryNumber: [6, 1, 3]
        })
    });

    const data = await response.json();
}

a()