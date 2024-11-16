// api/index.js
const express = require('express');
const cors = require('cors');
const { body, validationResult } = require('express-validator');
const TokenTransferSync = require('../utils/TokenTransferSync');

const app = express();

// 启用 CORS
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type']
}));

// 添加 OPTIONS 请求处理
app.options('*', cors());

// Enable JSON parsing
app.use(express.json());

// 配置参数
const config = {
    mode: 'base',
    startBlock: 17987929,
    tokenAddress: '0xA7ab21686D40Aa35Cb51137A795D84A57352F593',
    tokenSymbol: 'USDC',
    toAddress: '0xbebaf2a9ad714feb9dd151d81dd6d61ae0535646',
    rpc: {
        main: 'https://sepolia.base.org',
        backups: [
            'https://1rpc.io/base-sepolia',
            'https://base-sepolia.blockpi.network/v1/rpc/public'
        ]
    },
    sync: {
        batchSize: 2000,
        maxRetries: 3,
        retryDelay: 1000,
        batchDelay: 500,
        pollInterval: 5000
    }
};

// 创建单个同步实例
const tokenSync = new TokenTransferSync(
    config.mode,
    config.startBlock,
    config.tokenAddress,
    config.tokenSymbol,
    config.toAddress,
    config.rpc.main,
    config.rpc.backups,
    config.sync
);


// 验证中间件
const validateLotteryRequest = [
    body('mode').isString().trim().notEmpty(),
    body('value').isString().trim().notEmpty(),
    body('toAddress').isString().trim()
        .matches(/^0x[a-fA-F0-9]{40}$/i)
        .customSanitizer(value => value.toLowerCase()),
    body('tokenAddress').isString().trim()
        .matches(/^0x[a-fA-F0-9]{40}$/i)
        .customSanitizer(value => value.toLowerCase()),
    body('lotteryNumber').isString().trim().notEmpty(),
    body('lotteryPeriod').isInt({ min: 0 }).toInt(),
];

app.post('/api/lottery/assign', validateLotteryRequest, async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                message: 'Validation error',
                errors: errors.array().map(err => ({
                    field: err.path,
                    message: `${err.path} ${err.msg}`,
                    value: err.value
                }))
            });
        }

        const {
            value,
            lotteryNumber,
            lotteryPeriod
        } = req.body;

        // 确保数据库连接
        if (!tokenSync.connection || tokenSync.connection.state === 'disconnected') {
            await tokenSync.connectDB();
        }

        const [transfers] = await tokenSync.connection.execute(
            `SELECT * FROM ethglobal_token_transfers 
             WHERE mode = ? 
             AND value = ? 
             AND to_address = ? 
             AND token_address = ? 
             AND status = ?
             AND lottery_numbers IS NULL
             ORDER BY block_number ASC
             LIMIT 1`,
            [config.mode, value, config.toAddress.toLowerCase(), config.tokenAddress.toLowerCase(), tokenSync.STATUS.PENDING]
        );

        if (!transfers || transfers.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'No matching transfer found'
            });
        }

        const transfer = transfers[0];
        const success = await tokenSync.assignLotteryNumbers(
            transfer.transaction_hash,
            lotteryNumber,
            lotteryPeriod
        );

        if (success) {
            res.json({
                success: true,
                message: 'Lottery numbers assigned successfully',
                data: {
                    transactionHash: transfer.transaction_hash,
                    blockNumber: transfer.block_number,
                    lotteryNumber,
                    lotteryPeriod
                }
            });
        } else {
            res.status(400).json({
                success: false,
                message: 'Failed to assign lottery numbers'
            });
        }

    } catch (error) {
        console.error('Error processing lottery assignment:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
});

app.get('/api/lottery/info', async (req, res) => {
    try {
        const { transactionHash } = req.query;

        if (!transactionHash) {
            return res.status(400).json({
                success: false,
                message: 'Transaction hash is required'
            });
        }

        if (!tokenSync.connection || tokenSync.connection.state === 'disconnected') {
            await tokenSync.connectDB();
        }

        const [transfers] = await tokenSync.connection.execute(
            `SELECT * FROM ethglobal_token_transfers 
             WHERE transaction_hash = ? 
             AND mode = ? 
             AND token_address = ?`,
            [transactionHash, config.mode, config.tokenAddress.toLowerCase()]
        );

        if (!transfers || transfers.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Transfer not found'
            });
        }

        const transfer = transfers[0];
        res.json({
            success: true,
            data: {
                transactionHash: transfer.transaction_hash,
                blockNumber: transfer.block_number,
                lotteryNumber: transfer.lottery_numbers,
                lotteryPeriod: transfer.lottery_period,
                status: transfer.status,
                timestamp: transfer.timestamp,
                value: transfer.value
            }
        });

    } catch (error) {
        console.error('Error fetching lottery info:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
});

// 添加根路径处理
app.get('/', (req, res) => {
    res.json({
        name: "Lottery Service API",
        version: "1.0.0",
        endpoints: {
            assign: {
                method: "POST",
                path: "/api/lottery/assign",
                description: "Assign lottery numbers to a transfer",
                params: {
                    mode: "string",
                    value: "string",
                    toAddress: "address",
                    tokenAddress: "address",
                    lotteryNumber: "string",
                    lotteryPeriod: "number"
                }
            },
            info: {
                method: "GET",
                path: "/api/lottery/info",
                description: "Get lottery information by transaction hash",
                params: {
                    transactionHash: "string (query parameter)"
                }
            }
        },
        status: "active"
    });
});

// 添加健康检查端点
app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});

// 添加 404 处理
app.use((req, res) => {
    res.status(404).json({
        error: "Not Found",
        message: "The requested endpoint does not exist"
    });
});

app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? err.message : 'Internal error'
    });
});

module.exports = app;