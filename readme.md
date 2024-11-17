# PermiumBuy Backend API Documentation

## Introduction
The Service provides three main components:
1. Index Service: Monitors merchant's receipt transactions and records lottery details off-chain in database
2. API Service: Handles requests from merchant's Android app and user's lottery redemption endpoints
3. Sign Protocol: Enables merchants to call Sign Protocol for on-chain verification of transaction and lottery details

## Base URL
```
https://testbk-zeta.vercel.app
```

## Endpoints

### 1. Assign Lottery Numbers
Assigns lottery numbers to a pending token transfer. Used by merchant's Android app to assign lottery numbers to customers.

```
POST /api/lottery/assign
```

**Parameters:**
- `mode`: String - Operation mode
- `value`: String - Transfer amount
- `toAddress`: String - Recipient address (hex format)  
- `tokenAddress`: String - Token contract address (hex format)
- `lotteryNumber`: String - Lottery number to assign
- `lotteryPeriod`: Number - Lottery period

### 2. Get Lottery Information 
Retrieves lottery information for a specific transaction. Can be used by both merchants and users to verify lottery details.

```
GET /api/lottery/info
```

**Parameters:**
- `transactionHash`: String - Transaction hash to query

### 3. Query Transfers
Query transfers based on specific parameters. Used by merchant app to track customer transactions.

```
GET /api/lottery/transfer
```

**Parameters:**
- `mode`: String - Operation mode
- `value`: String - Transfer amount
- `toAddress`: String - Recipient address (hex format)
- `tokenAddress`: String - Token contract address (hex format)

### 4. Get Latest Assignment
Retrieves the most recently assigned transfer for a specific address. Used for real-time tracking of lottery assignments.

```
GET /api/lottery/latest
```

**Parameters:**
- `mode`: String - Operation mode
- `fromAddress`: String - Sender address (hex format)

## Response Format
All endpoints return data in JSON format with the following structure:

**Success Response:**
```json
{
  "success": true,
  "message": "Operation description",
  "data": {
    // Response data
  }
}
```

**Error Response:**
```json
{
  "success": false,
  "message": "Error description",
  "error": "Error details"
}
```

## Status Codes
- 200: Success
- 400: Bad Request - Invalid parameters
- 404: Not Found - Resource not found
- 500: Internal Server Error

## Usage Notes
- All addresses should be in hex format with `0x` prefix
- Values should be provided in the token's smallest unit (e.g., Wei for ETH)
- Status transitions: PENDING -> ASSIGNED
- Merchants can use Sign Protocol to verify all transaction and lottery details on-chain