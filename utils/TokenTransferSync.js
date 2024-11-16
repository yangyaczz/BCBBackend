const mysql = require('mysql2/promise');
const { ethers } = require('ethers');
require('dotenv').config();

class TokenTransferSync {
  constructor(mode, startBlock, tokenAddress, toAddress, rpcUrl, backupRpcUrls = [], options = {}) {
    this.mode = mode;
    this.startBlock = startBlock;
    this.tokenAddress = tokenAddress;
    this.toAddress = toAddress.toLowerCase();
    this.rpcUrl = rpcUrl;
    this.backupRpcUrls = backupRpcUrls || [];

    // 同步配置
    this.maxBatchSize = 1000;                        // 每次最多查询1000个区块
    this.maxRetries = options.maxRetries || 3;       // 最大重试次数
    this.retryDelay = options.retryDelay || 1000;    // 重试延迟
    this.pollInterval = options.pollInterval || 3000; // 轮询间隔，默认3秒

    this.isPolling = false; // 轮询状态标志

    // 初始化 provider
    this.initializeProvider();

    this.transferEventFragment = 'event Transfer(address indexed from, address indexed to, uint256 value)';

    this.dbConfig = {
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT, 10) || 3306,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_DATABASE
    };
  }

  // ... 其他基础方法保持不变 ...

  initializeProvider() {
    this.provider = new ethers.JsonRpcProvider(this.rpcUrl);
    this.backupProviders = this.backupRpcUrls.map(url =>
      new ethers.JsonRpcProvider(url)
    );
  }

  // 连接数据库
  async connectDB() {
    try {
      this.connection = await mysql.createConnection(this.dbConfig);
      console.log('Database connected successfully');
    } catch (error) {
      console.error('Database connection failed:', error);
      throw error;
    }
  }

  // 检查并创建表
  async initTable() {
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS ethglobal_token_transfers (
        id BIGINT PRIMARY KEY AUTO_INCREMENT,
        mode VARCHAR(20) NOT NULL,
        block_number BIGINT NOT NULL,
        transaction_hash VARCHAR(66) NOT NULL,
        from_address VARCHAR(42) NOT NULL,
        value VARCHAR(78) NOT NULL,
        timestamp BIGINT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_mode (mode),
        INDEX idx_block_number (block_number),
        INDEX idx_from_address (from_address),
        INDEX idx_timestamp (timestamp)
      )
    `;

    try {
      await this.connection.execute(createTableSQL);
      console.log('Table checked/created successfully');
    } catch (error) {
      console.error('Table creation failed:', error);
      throw error;
    }
  }

  async switchToBackupProvider() {
    if (this.backupProviders.length > 0) {
      this.provider = this.backupProviders.shift();
      console.log('Switched to backup RPC provider');
      return true;
    }
    return false;
  }

  // 获取合约实例
  getTokenContract() {
    const iface = new ethers.Interface([this.transferEventFragment]);
    return new ethers.Contract(this.tokenAddress, iface, this.provider);
  }

  async retry(fn, retries = this.maxRetries) {
    try {
      return await fn();
    } catch (error) {
      if (retries > 0) {
        console.log(`Retrying... ${retries} attempts remaining`);
        await new Promise(resolve => setTimeout(resolve, this.retryDelay));

        // 尝试切换到备用节点
        if (error.message.includes('no backend is currently healthy')) {
          const switched = await this.switchToBackupProvider();
          if (switched) {
            console.log('Retrying with backup provider...');
            return this.retry(fn, retries - 1);
          }
        }

        return this.retry(fn, retries - 1);
      }
      throw error;
    }
  }

  // 获取最新同步的区块
  async getLatestSyncedBlock() {
    try {
      const [rows] = await this.connection.execute(
        `SELECT MAX(block_number) as latest_block FROM ethglobal_token_transfers WHERE mode = ?`,
        [this.mode]
      );
      return rows[0].latest_block || 0;
    } catch (error) {
      console.error('Failed to get latest synced block:', error);
      throw error;
    }
  }

  async syncTransfers(fromBlock, toBlock) {
    const contract = this.getTokenContract();

    // 确保区块范围不超过批次大小
    const actualToBlock = Math.min(fromBlock + this.batchSize - 1, toBlock);

    try {
      const filter = contract.filters.Transfer(null, this.toAddress);

      const events = await this.retry(async () => {
        return await contract.queryFilter(filter, fromBlock, actualToBlock);
      });

      if (events.length > 0) {
        const values = await Promise.all(events.map(async event => {
          const block = await this.retry(() => event.getBlock());
          return [
            this.mode,
            event.blockNumber,
            event.transactionHash,
            event.args[0],
            event.args[2].toString(),
            block.timestamp
          ];
        }));

        const insertSQL = `
          INSERT INTO ethglobal_token_transfers 
          (mode, block_number, transaction_hash, from_address, value, timestamp)
          VALUES ?
        `;

        await this.connection.query(insertSQL, [values]);
        console.log(`Inserted ${events.length} transfers from block ${fromBlock} to ${actualToBlock}`);
      }

      // 如果还有更多区块需要同步，递归处理
      if (actualToBlock < toBlock) {
        await this.syncTransfers(actualToBlock + 1, toBlock);
      }
    } catch (error) {
      console.error('Sync failed:', error);
      throw error;
    }
  }

  async syncTransfersBatch(fromBlock, toBlock) {
    const contract = this.getTokenContract();

    try {
      const filter = contract.filters.Transfer(null, this.toAddress);
      console.log(`Querying blocks ${fromBlock} to ${toBlock} (${toBlock - fromBlock + 1} blocks)`);

      const events = await this.retry(async () => {
        return await contract.queryFilter(filter, fromBlock, toBlock);
      });

      if (events.length > 0) {
        const values = await Promise.all(events.map(async event => {
          const block = await this.retry(() => event.getBlock());
          return [
            this.mode,
            event.blockNumber,
            event.transactionHash,
            event.args[0],
            event.args[2].toString(),
            block.timestamp
          ];
        }));

        const insertSQL = `
          INSERT INTO ethglobal_token_transfers 
          (mode, block_number, transaction_hash, from_address, value, timestamp)
          VALUES ?
        `;

        await this.connection.query(insertSQL, [values]);
        console.log(`Inserted ${events.length} transfers from blocks ${fromBlock}-${toBlock}`);
      } else {
        console.log(`No transfers found in blocks ${fromBlock}-${toBlock}`);
      }

      return toBlock;
    } catch (error) {
      console.error(`Failed to sync blocks ${fromBlock}-${toBlock}:`, error);
      throw error;
    }
  }

  // 新的轮询方法
  async pollNewTransfers() {
    try {
      if (!this.connection) {
        await this.connectDB();
      }

      let lastSyncedBlock = await this.getLatestSyncedBlock();

      while (this.isPolling) {
        try {
          // 获取当前最新区块
          const currentBlock = await this.retry(() => this.provider.getBlockNumber());
          const blockDiff = currentBlock - lastSyncedBlock;

          if (blockDiff > 0) {
            console.log(`Found ${blockDiff} new blocks`);

            if (blockDiff > this.maxBatchSize) {
              // 如果差距大于1000个区块，按批次同步
              let fromBlock = lastSyncedBlock + 1;
              while (fromBlock <= currentBlock) {
                const toBlock = Math.min(fromBlock + this.maxBatchSize - 1, currentBlock);
                lastSyncedBlock = await this.syncTransfersBatch(fromBlock, toBlock);
                fromBlock = toBlock + 1;
              }
            } else {
              // 如果差距小于1000个区块，一次性同步
              lastSyncedBlock = await this.syncTransfersBatch(lastSyncedBlock + 1, currentBlock);
            }
          } else {
            console.log('No new blocks, waiting...');
          }

          // 等待下一次轮询
          await new Promise(resolve => setTimeout(resolve, this.pollInterval));
        } catch (error) {
          console.error('Error during polling:', error);

          // 尝试重新连接数据库
          if (!this.connection || this.connection.state === 'disconnected') {
            try {
              console.log('Reconnecting to database...');
              await this.connectDB();
            } catch (dbError) {
              console.error('Failed to reconnect to database:', dbError);
            }
          }

          // 如果是RPC错误，尝试切换节点
          if (error.message.includes('could not coalesce error')) {
            await this.switchToBackupProvider();
          }

          // 出错后等待一段时间再继续
          await new Promise(resolve => setTimeout(resolve, this.retryDelay));
        }
      }
    } catch (error) {
      console.error('Fatal error in polling:', error);
      throw error;
    }
  }

  // 启动历史同步
  async startSync() {
    try {
      await this.connectDB();
      await this.initTable();

      let lastSyncedBlock = await this.getLatestSyncedBlock();

      if (lastSyncedBlock === 0) {
        lastSyncedBlock = this.startBlock - 1;
      }

      const currentBlock = await this.retry(() => this.provider.getBlockNumber());
      console.log(`Starting historical sync from block ${lastSyncedBlock + 1} to ${currentBlock}`);

      let fromBlock = lastSyncedBlock + 1;
      while (fromBlock <= currentBlock) {
        const toBlock = Math.min(fromBlock + this.maxBatchSize - 1, currentBlock);
        await this.syncTransfersBatch(fromBlock, toBlock);
        fromBlock = toBlock + 1;
      }

      console.log('Historical sync completed');
    } catch (error) {
      console.error('Sync process failed:', error);
      throw error;
    }
  }

  // 启动轮询
  async startPolling() {
    if (this.isPolling) {
      console.log('Polling is already running');
      return;
    }

    console.log('Starting polling for new transfers...');
    this.isPolling = true;
    await this.pollNewTransfers();
  }

  // 停止轮询
  async stopPolling() {
    console.log('Stopping polling...');
    this.isPolling = false;
    if (this.connection) {
      await this.connection.end();
    }
  }





}

module.exports = TokenTransferSync;