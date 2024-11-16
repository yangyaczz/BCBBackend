const TokenTransferSync = require('./utils/TokenTransferSync');

// 配置参数
const config = {
    mode: 'base',
    startBlock: 17967960,
    tokenAddress: '0x042c946A08f313f0996C35C96A4fe1bb24EeA44D',
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
        pollInterval: 3000  // interval 3s
    }
};

// 创建同步实例
const tokenSync = new TokenTransferSync(
    config.mode,
    config.startBlock,
    config.tokenAddress,
    config.toAddress,
    config.rpc.main,
    config.rpc.backups,
    {
        batchSize: config.sync.batchSize,
        maxRetries: config.sync.maxRetries,
        retryDelay: config.sync.retryDelay,
        batchDelay: config.sync.batchDelay,
        pollInterval: config.sync.pollInterval
    }
);

// 启动同步和轮询
async function startSyncAndPoll() {
    try {
        console.log('Starting sync process...');
        console.log(`Mode: ${config.mode}`);
        console.log(`Token Address: ${config.tokenAddress}`);
        console.log(`Merchant Address: ${config.toAddress}`);

        // 首先同步历史数据
        await tokenSync.startSync();
        console.log('Historical sync completed, starting polling...');

        // 开始轮询新交易
        await tokenSync.startPolling();
    } catch (error) {
        console.error('Fatal error during startup:', error);
        await cleanup();
        process.exit(1);
    }
}

// 清理函数
async function cleanup() {
    console.log('Performing cleanup...');
    try {
        if (tokenSync) {
            await tokenSync.stopPolling();
        }
        console.log('Cleanup completed');
    } catch (error) {
        console.error('Error during cleanup:', error);
    }
}

// 错误处理
process.on('uncaughtException', async (error) => {
    console.error('Uncaught Exception:', error);
    await cleanup();
    process.exit(1);
});

process.on('unhandledRejection', async (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    await cleanup();
    process.exit(1);
});

// 优雅退出处理
process.on('SIGINT', async () => {
    console.log('\nReceived SIGINT signal...');
    await cleanup();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('\nReceived SIGTERM signal...');
    await cleanup();
    process.exit(0);
});

// 运行程序
console.log('Initializing application...');
startSyncAndPoll().catch(async (error) => {
    console.error('Failed to start application:', error);
    await cleanup();
    process.exit(1);
});