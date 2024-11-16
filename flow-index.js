const TokenTransferSync = require('./utils/TokenTransferSync');

// 配置参数
const config = {
    mode: 'flow',
    startBlock: 16176856,
    tokenAddress: '0x2EC5CfDE6F37029aa8cc018ED71CF4Ef67C704AE',
    tokenSymbol: 'USDC',
    toAddress: '0x7BAF75d206CA49B3454E1E54D9d563ff80f7492D',
    rpc: {
        main: 'https://testnet.evm.nodes.onflow.org',
        backups: [
        ]
    },
    sync: {
        batchSize: 2000,
        maxRetries: 3,
        retryDelay: 1000,
        batchDelay: 500,
        pollInterval: 5000  // interval 3s
    }
};

// 创建同步实例
const tokenSync = new TokenTransferSync(
    config.mode,
    config.startBlock,
    config.tokenAddress,
    config.tokenSymbol,  
    config.toAddress,     
    config.rpc.main,
    config.rpc.backups,
    {
        maxBatchSize: config.sync.batchSize,  
        maxRetries: config.sync.maxRetries,
        retryDelay: config.sync.retryDelay,
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