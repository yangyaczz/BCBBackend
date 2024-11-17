async function a() {
    const response = await fetch('https://testbk-zeta.vercel.app/api/notary/create', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        // body: JSON.stringify({
        //     itemName: ['Fries', 'chicken'],
        //     itemQuantity: [2, 3],
        //     itemPrice: [1.5, 0.5],
        //     tokenAddress: '0xA7ab21686D40Aa35Cb51137A795D84A57352F593',
        //     purchaser: '0xBEbAF2a9ad714fEb9Dd151d81Dd6d61Ae0535646',
        //     lotteryNumber: [6, 1, 3]
        // })
        body: JSON.stringify({ "itemName": ["Fries", "Chicken"], "itemPrice": [0.5, 2.0], "itemQuantity": [1, 1], "lotteryNumber": [8, 7, 9], "purchaser": "0xB4F205238b7556790dACef577D371Cb8f6C87215", "tokenAddress": "0x7BAF75d206CA49B3454E1E54D9d563ff80f7492D" })
    });

    const data = await response.json();

    console.log(data)
}

a()