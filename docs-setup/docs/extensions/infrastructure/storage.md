---
id: storage
title: Storage Backends
sidebar_position: 1
---

# Storage Backends

The Storage extension provides multiple backend implementations for persisting Olocus Protocol blocks with different performance, durability, and deployment characteristics.

## Overview

The storage extension supports various backend types optimized for different use cases:

- **Memory**: High-performance in-memory storage for testing and caching
- **Filesystem**: Simple file-based storage for local development
- **RocksDB**: High-performance embedded key-value store
- **SQLite**: Lightweight relational database with SQL queries
- **Distributed**: Integration with distributed storage systems

```rust
use olocus_storage::*;

// Configure storage backend
let storage_config = StorageConfig {
    backend: StorageBackend::RocksDB {
        path: "./olocus_data".to_string(),
        compression: CompressionType::Zstd,
        cache_size: 64 * 1024 * 1024, // 64MB cache
    },
    wal_config: WALConfig {
        enabled: true,
        sync_interval: Duration::from_secs(5),
        max_log_size: 100 * 1024 * 1024, // 100MB
    },
    cache_config: CacheConfig {
        block_cache_size: 32 * 1024 * 1024, // 32MB
        index_cache_size: 8 * 1024 * 1024,  // 8MB
        eviction_policy: EvictionPolicy::LRU,
    },
};

let storage = Storage::new(storage_config).await?;
```

## Storage Trait Interface

### Core Storage Trait

```rust
use olocus_storage::traits::*;
use olocus_core::*;

#[async_trait::async_trait]
pub trait StorageBackend: Send + Sync {
    async fn store_block(&mut self, block: &Block<impl BlockPayload>) -> Result<BlockHash>;
    async fn retrieve_block(&self, hash: &BlockHash) -> Result<Option<Block<serde_json::Value>>>;
    async fn delete_block(&mut self, hash: &BlockHash) -> Result<bool>;
    async fn block_exists(&self, hash: &BlockHash) -> Result<bool>;
    
    // Batch operations
    async fn store_blocks(&mut self, blocks: &[Block<impl BlockPayload>]) -> Result<Vec<BlockHash>>;
    async fn retrieve_blocks(&self, hashes: &[BlockHash]) -> Result<Vec<Option<Block<serde_json::Value>>>>;
    
    // Iteration and querying
    async fn list_blocks(&self, options: &ListOptions) -> Result<Vec<BlockMetadata>>;
    async fn count_blocks(&self) -> Result<u64>;
    
    // Chain operations
    async fn get_chain_head(&self) -> Result<Option<BlockHash>>;
    async fn set_chain_head(&mut self, hash: &BlockHash) -> Result<()>;
    async fn get_blocks_by_range(&self, start: u64, end: u64) -> Result<Vec<Block<serde_json::Value>>>;
    
    // Maintenance
    async fn compact(&mut self) -> Result<()>;
    async fn vacuum(&mut self) -> Result<()>;
    async fn get_stats(&self) -> Result<StorageStats>;
    async fn close(&mut self) -> Result<()>;
}

#[derive(Debug, Clone)]
pub struct ListOptions {
    pub limit: Option<u64>,
    pub offset: Option<u64>,
    pub start_time: Option<SystemTime>,
    pub end_time: Option<SystemTime>,
    pub order: SortOrder,
    pub filter: Option<BlockFilter>,
}

#[derive(Debug, Clone)]
pub enum SortOrder {
    Ascending,
    Descending,
    ByTimestamp,
    ByIndex,
}

#[derive(Debug, Clone)]
pub struct BlockFilter {
    pub payload_type: Option<String>,
    pub public_key: Option<PublicKey>,
    pub min_index: Option<u64>,
    pub max_index: Option<u64>,
}

#[derive(Debug, Clone)]
pub struct BlockMetadata {
    pub hash: BlockHash,
    pub index: u64,
    pub timestamp: SystemTime,
    pub payload_type: String,
    pub public_key: PublicKey,
    pub size_bytes: u64,
}
```

### Storage Statistics

```rust
#[derive(Debug, Clone)]
pub struct StorageStats {
    pub total_blocks: u64,
    pub total_size_bytes: u64,
    pub oldest_block: Option<SystemTime>,
    pub newest_block: Option<SystemTime>,
    pub backend_specific: BackendStats,
}

#[derive(Debug, Clone)]
pub enum BackendStats {
    Memory {
        heap_usage: u64,
    },
    Filesystem {
        directory_size: u64,
        file_count: u64,
    },
    RocksDB {
        live_data_size: u64,
        total_data_size: u64,
        num_entries: u64,
        num_deletions: u64,
        compaction_stats: CompactionStats,
    },
    SQLite {
        database_size: u64,
        page_count: u64,
        page_size: u64,
        fragmentation_ratio: f64,
    },
}

#[derive(Debug, Clone)]
pub struct CompactionStats {
    pub bytes_read: u64,
    pub bytes_written: u64,
    pub compaction_time: Duration,
    pub last_compaction: SystemTime,
}
```

## Memory Backend

### In-Memory Implementation

```rust
use olocus_storage::memory::*;
use std::collections::BTreeMap;

pub struct MemoryBackend {
    blocks: BTreeMap<BlockHash, SerializedBlock>,
    metadata: BTreeMap<BlockHash, BlockMetadata>,
    index_to_hash: BTreeMap<u64, BlockHash>,
    chain_head: Option<BlockHash>,
    stats: StorageStats,
}

#[derive(Debug, Clone)]
pub struct SerializedBlock {
    pub data: Vec<u8>,
    pub format: WireFormat,
    pub stored_at: SystemTime,
}

impl MemoryBackend {
    pub fn new() -> Self {
        Self {
            blocks: BTreeMap::new(),
            metadata: BTreeMap::new(),
            index_to_hash: BTreeMap::new(),
            chain_head: None,
            stats: StorageStats::default(),
        }
    }
    
    pub fn with_capacity(capacity: usize) -> Self {
        // Pre-allocate memory for better performance
        let mut backend = Self::new();
        backend.blocks.reserve(capacity);
        backend.metadata.reserve(capacity);
        backend.index_to_hash.reserve(capacity);
        backend
    }
}

#[async_trait::async_trait]
impl StorageBackend for MemoryBackend {
    async fn store_block(&mut self, block: &Block<impl BlockPayload>) -> Result<BlockHash> {
        let hash = block.hash();
        
        // Serialize block using default wire format
        let wire_format = WireFormat::default();
        let serialized_data = wire_format.encode(block)?;
        
        let serialized_block = SerializedBlock {
            data: serialized_data,
            format: wire_format,
            stored_at: SystemTime::now(),
        };
        
        // Create metadata
        let metadata = BlockMetadata {
            hash: hash.clone(),
            index: block.index,
            timestamp: block.timestamp,
            payload_type: std::any::type_name::<block::Payload>().to_string(),
            public_key: block.public_key.clone(),
            size_bytes: serialized_block.data.len() as u64,
        };
        
        // Store block and metadata
        self.blocks.insert(hash.clone(), serialized_block);
        self.metadata.insert(hash.clone(), metadata);
        self.index_to_hash.insert(block.index, hash.clone());
        
        // Update statistics
        self.stats.total_blocks += 1;
        self.stats.total_size_bytes += serialized_block.data.len() as u64;
        
        if self.stats.oldest_block.is_none() || 
           Some(block.timestamp) < self.stats.oldest_block {
            self.stats.oldest_block = Some(block.timestamp);
        }
        
        if self.stats.newest_block.is_none() || 
           Some(block.timestamp) > self.stats.newest_block {
            self.stats.newest_block = Some(block.timestamp);
        }
        
        Ok(hash)
    }
    
    async fn retrieve_block(&self, hash: &BlockHash) -> Result<Option<Block<serde_json::Value>>> {
        match self.blocks.get(hash) {
            Some(serialized_block) => {
                // Deserialize using the stored format
                let block = serialized_block.format.decode::<Block<serde_json::Value>>(&serialized_block.data)?;
                Ok(Some(block))
            },
            None => Ok(None),
        }
    }
    
    async fn delete_block(&mut self, hash: &BlockHash) -> Result<bool> {
        let metadata = self.metadata.remove(hash);
        let serialized = self.blocks.remove(hash);
        
        if let (Some(meta), Some(ser)) = (metadata, serialized) {
            // Update index mapping
            self.index_to_hash.remove(&meta.index);
            
            // Update statistics
            self.stats.total_blocks -= 1;
            self.stats.total_size_bytes -= ser.data.len() as u64;
            
            Ok(true)
        } else {
            Ok(false)
        }
    }
    
    async fn list_blocks(&self, options: &ListOptions) -> Result<Vec<BlockMetadata>> {
        let mut results: Vec<BlockMetadata> = self.metadata.values().cloned().collect();
        
        // Apply filters
        if let Some(ref filter) = options.filter {
            results.retain(|meta| {
                if let Some(ref payload_type) = filter.payload_type {
                    if meta.payload_type != *payload_type {
                        return false;
                    }
                }
                
                if let Some(ref public_key) = filter.public_key {
                    if meta.public_key != *public_key {
                        return false;
                    }
                }
                
                if let Some(min_index) = filter.min_index {
                    if meta.index < min_index {
                        return false;
                    }
                }
                
                if let Some(max_index) = filter.max_index {
                    if meta.index > max_index {
                        return false;
                    }
                }
                
                true
            });
        }
        
        // Apply time range filters
        if let Some(start_time) = options.start_time {
            results.retain(|meta| meta.timestamp >= start_time);
        }
        
        if let Some(end_time) = options.end_time {
            results.retain(|meta| meta.timestamp <= end_time);
        }
        
        // Sort results
        match options.order {
            SortOrder::Ascending => results.sort_by_key(|m| m.index),
            SortOrder::Descending => results.sort_by(|a, b| b.index.cmp(&a.index)),
            SortOrder::ByTimestamp => results.sort_by_key(|m| m.timestamp),
            SortOrder::ByIndex => results.sort_by_key(|m| m.index),
        }
        
        // Apply pagination
        if let Some(offset) = options.offset {
            results = results.into_iter().skip(offset as usize).collect();
        }
        
        if let Some(limit) = options.limit {
            results.truncate(limit as usize);
        }
        
        Ok(results)
    }
    
    async fn get_stats(&self) -> Result<StorageStats> {
        let heap_usage = self.blocks.values()
            .map(|b| b.data.len() as u64)
            .sum::<u64>()
            + self.metadata.len() as u64 * 200; // Rough estimate for metadata overhead
            
        Ok(StorageStats {
            total_blocks: self.stats.total_blocks,
            total_size_bytes: self.stats.total_size_bytes,
            oldest_block: self.stats.oldest_block,
            newest_block: self.stats.newest_block,
            backend_specific: BackendStats::Memory { heap_usage },
        })
    }
}
```

## Filesystem Backend

### File-based Implementation

```rust
use olocus_storage::filesystem::*;
use tokio::fs;
use std::path::PathBuf;

pub struct FilesystemBackend {
    base_path: PathBuf,
    index_file: IndexFile,
    compression: CompressionType,
}

#[derive(Debug, Clone)]
pub enum CompressionType {
    None,
    Gzip,
    Zstd,
    Lz4,
}

#[derive(Debug)]
pub struct IndexFile {
    path: PathBuf,
    entries: BTreeMap<BlockHash, IndexEntry>,
    dirty: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IndexEntry {
    pub hash: BlockHash,
    pub file_path: String,
    pub file_offset: u64,
    pub compressed_size: u64,
    pub uncompressed_size: u64,
    pub metadata: BlockMetadata,
}

impl FilesystemBackend {
    pub async fn new(base_path: impl Into<PathBuf>, compression: CompressionType) -> Result<Self> {
        let base_path = base_path.into();
        
        // Create base directory if it doesn't exist
        fs::create_dir_all(&base_path).await?;
        
        // Create subdirectories
        let blocks_dir = base_path.join("blocks");
        let index_dir = base_path.join("index");
        fs::create_dir_all(&blocks_dir).await?;
        fs::create_dir_all(&index_dir).await?;
        
        // Load or create index file
        let index_file_path = index_dir.join("blocks.idx");
        let index_file = IndexFile::load_or_create(index_file_path).await?;
        
        Ok(Self {
            base_path,
            index_file,
            compression,
        })
    }
    
    fn get_block_file_path(&self, hash: &BlockHash) -> PathBuf {
        let hash_str = hex::encode(hash);
        // Use first 2 characters for directory sharding
        let dir = &hash_str[0..2];
        let filename = &hash_str[2..];
        
        self.base_path
            .join("blocks")
            .join(dir)
            .join(format!("{}.blk", filename))
    }
    
    async fn compress_data(&self, data: &[u8]) -> Result<Vec<u8>> {
        match self.compression {
            CompressionType::None => Ok(data.to_vec()),
            CompressionType::Gzip => {
                use flate2::Compression;
                use flate2::write::GzEncoder;
                use std::io::Write;
                
                let mut encoder = GzEncoder::new(Vec::new(), Compression::default());
                encoder.write_all(data)?;
                Ok(encoder.finish()?)
            },
            CompressionType::Zstd => {
                use zstd::encode_all;
                Ok(encode_all(data, 3)?) // Level 3 compression
            },
            CompressionType::Lz4 => {
                use lz4_flex::compress_prepend_size;
                Ok(compress_prepend_size(data))
            }
        }
    }
    
    async fn decompress_data(&self, compressed: &[u8]) -> Result<Vec<u8>> {
        match self.compression {
            CompressionType::None => Ok(compressed.to_vec()),
            CompressionType::Gzip => {
                use flate2::read::GzDecoder;
                use std::io::Read;
                
                let mut decoder = GzDecoder::new(compressed);
                let mut data = Vec::new();
                decoder.read_to_end(&mut data)?;
                Ok(data)
            },
            CompressionType::Zstd => {
                use zstd::decode_all;
                Ok(decode_all(compressed)?)
            },
            CompressionType::Lz4 => {
                use lz4_flex::decompress_size_prepended;
                Ok(decompress_size_prepended(compressed)?)
            }
        }
    }
}

#[async_trait::async_trait]
impl StorageBackend for FilesystemBackend {
    async fn store_block(&mut self, block: &Block<impl BlockPayload>) -> Result<BlockHash> {
        let hash = block.hash();
        
        // Check if block already exists
        if self.index_file.entries.contains_key(&hash) {
            return Ok(hash);
        }
        
        // Serialize block
        let wire_format = WireFormat::default();
        let serialized_data = wire_format.encode(block)?;
        
        // Compress if enabled
        let compressed_data = self.compress_data(&serialized_data).await?;
        
        // Determine file path
        let file_path = self.get_block_file_path(&hash);
        
        // Create directory if needed
        if let Some(parent) = file_path.parent() {
            fs::create_dir_all(parent).await?;
        }
        
        // Write to file
        fs::write(&file_path, &compressed_data).await?;
        
        // Create index entry
        let index_entry = IndexEntry {
            hash: hash.clone(),
            file_path: file_path.to_string_lossy().to_string(),
            file_offset: 0,
            compressed_size: compressed_data.len() as u64,
            uncompressed_size: serialized_data.len() as u64,
            metadata: BlockMetadata {
                hash: hash.clone(),
                index: block.index,
                timestamp: block.timestamp,
                payload_type: std::any::type_name::<block::Payload>().to_string(),
                public_key: block.public_key.clone(),
                size_bytes: serialized_data.len() as u64,
            },
        };
        
        // Add to index
        self.index_file.entries.insert(hash.clone(), index_entry);
        self.index_file.dirty = true;
        
        // Periodically flush index
        if self.index_file.entries.len() % 100 == 0 {
            self.index_file.flush().await?;
        }
        
        Ok(hash)
    }
    
    async fn retrieve_block(&self, hash: &BlockHash) -> Result<Option<Block<serde_json::Value>>> {
        match self.index_file.entries.get(hash) {
            Some(entry) => {
                // Read compressed data
                let compressed_data = fs::read(&entry.file_path).await?;
                
                // Decompress
                let serialized_data = self.decompress_data(&compressed_data).await?;
                
                // Deserialize
                let wire_format = WireFormat::default();
                let block = wire_format.decode::<Block<serde_json::Value>>(&serialized_data)?;
                
                Ok(Some(block))
            },
            None => Ok(None),
        }
    }
    
    async fn delete_block(&mut self, hash: &BlockHash) -> Result<bool> {
        match self.index_file.entries.remove(hash) {
            Some(entry) => {
                // Delete file
                if let Err(e) = fs::remove_file(&entry.file_path).await {
                    // Log error but don't fail - file might already be deleted
                    eprintln!("Warning: Failed to delete block file {}: {}", entry.file_path, e);
                }
                
                self.index_file.dirty = true;
                Ok(true)
            },
            None => Ok(false),
        }
    }
    
    async fn get_stats(&self) -> Result<StorageStats> {
        let total_blocks = self.index_file.entries.len() as u64;
        
        let (total_size, oldest, newest) = self.index_file.entries.values()
            .fold((0u64, None, None), |(size, oldest, newest), entry| {
                let new_size = size + entry.uncompressed_size;
                let new_oldest = match oldest {
                    None => Some(entry.metadata.timestamp),
                    Some(old) => Some(old.min(entry.metadata.timestamp)),
                };
                let new_newest = match newest {
                    None => Some(entry.metadata.timestamp),
                    Some(new) => Some(new.max(entry.metadata.timestamp)),
                };
                (new_size, new_oldest, new_newest)
            });
        
        // Calculate directory size
        let directory_size = self.calculate_directory_size(&self.base_path).await?;
        let file_count = self.count_files(&self.base_path).await?;
        
        Ok(StorageStats {
            total_blocks,
            total_size_bytes: total_size,
            oldest_block: oldest,
            newest_block: newest,
            backend_specific: BackendStats::Filesystem {
                directory_size,
                file_count,
            },
        })
    }
    
    async fn compact(&mut self) -> Result<()> {
        // Flush index to ensure consistency
        self.index_file.flush().await?;
        
        // Remove any orphaned files
        self.cleanup_orphaned_files().await?;
        
        Ok(())
    }
}

impl IndexFile {
    async fn load_or_create(path: PathBuf) -> Result<Self> {
        let entries = if path.exists() {
            let data = fs::read(&path).await?;
            serde_json::from_slice(&data)?
        } else {
            BTreeMap::new()
        };
        
        Ok(Self {
            path,
            entries,
            dirty: false,
        })
    }
    
    async fn flush(&mut self) -> Result<()> {
        if !self.dirty {
            return Ok(());
        }
        
        let data = serde_json::to_vec_pretty(&self.entries)?;
        
        // Atomic write using temporary file
        let temp_path = self.path.with_extension("tmp");
        fs::write(&temp_path, &data).await?;
        fs::rename(&temp_path, &self.path).await?;
        
        self.dirty = false;
        Ok(())
    }
}
```

## RocksDB Backend

### High-Performance Key-Value Store

```rust
use olocus_storage::rocksdb::*;
use rocksdb::{DB, Options, WriteBatch, IteratorMode, Direction};

pub struct RocksDBBackend {
    db: DB,
    cf_blocks: rocksdb::ColumnFamily,
    cf_metadata: rocksdb::ColumnFamily,
    cf_index: rocksdb::ColumnFamily,
    compression: CompressionType,
}

#[derive(Debug, Clone)]
pub struct RocksDBConfig {
    pub path: String,
    pub compression: CompressionType,
    pub cache_size: usize,
    pub write_buffer_size: usize,
    pub max_write_buffer_number: i32,
    pub max_background_jobs: i32,
    pub enable_bloom_filter: bool,
    pub bloom_filter_bits: f64,
}

impl Default for RocksDBConfig {
    fn default() -> Self {
        Self {
            path: "./olocus_rocksdb".to_string(),
            compression: CompressionType::Zstd,
            cache_size: 64 * 1024 * 1024,      // 64MB
            write_buffer_size: 16 * 1024 * 1024, // 16MB
            max_write_buffer_number: 3,
            max_background_jobs: 4,
            enable_bloom_filter: true,
            bloom_filter_bits: 10.0,
        }
    }
}

impl RocksDBBackend {
    pub fn new(config: RocksDBConfig) -> Result<Self> {
        let mut opts = Options::default();
        opts.create_if_missing(true);
        opts.create_missing_column_families(true);
        
        // Performance tuning
        opts.set_write_buffer_size(config.write_buffer_size);
        opts.set_max_write_buffer_number(config.max_write_buffer_number);
        opts.set_max_background_jobs(config.max_background_jobs);
        
        // Compression
        match config.compression {
            CompressionType::None => opts.set_compression_type(rocksdb::DBCompressionType::None),
            CompressionType::Zstd => opts.set_compression_type(rocksdb::DBCompressionType::Zstd),
            CompressionType::Lz4 => opts.set_compression_type(rocksdb::DBCompressionType::Lz4),
            _ => opts.set_compression_type(rocksdb::DBCompressionType::Snappy),
        }
        
        // Block cache
        if config.cache_size > 0 {
            let cache = rocksdb::Cache::new_lru_cache(config.cache_size)?;
            let mut block_opts = rocksdb::BlockBasedOptions::default();
            block_opts.set_block_cache(&cache);
            
            if config.enable_bloom_filter {
                block_opts.set_bloom_filter(config.bloom_filter_bits, false);
            }
            
            opts.set_block_based_table_factory(&block_opts);
        }
        
        // Column family descriptors
        let cf_names = vec!["blocks", "metadata", "index"];
        let cf_descriptors: Vec<rocksdb::ColumnFamilyDescriptor> = cf_names
            .into_iter()
            .map(|name| {
                let mut cf_opts = Options::default();
                cf_opts.set_compression_type(opts.get_compression_type());
                rocksdb::ColumnFamilyDescriptor::new(name, cf_opts)
            })
            .collect();
        
        // Open database
        let db = DB::open_cf_descriptors(&opts, &config.path, cf_descriptors)?;
        
        let cf_blocks = db.cf_handle("blocks")
            .ok_or_else(|| StorageError::ColumnFamilyNotFound("blocks".to_string()))?;
        let cf_metadata = db.cf_handle("metadata")
            .ok_or_else(|| StorageError::ColumnFamilyNotFound("metadata".to_string()))?;
        let cf_index = db.cf_handle("index")
            .ok_or_else(|| StorageError::ColumnFamilyNotFound("index".to_string()))?;
        
        Ok(Self {
            db,
            cf_blocks,
            cf_metadata,
            cf_index,
            compression: config.compression,
        })
    }
    
    fn block_key(&self, hash: &BlockHash) -> Vec<u8> {
        format!("blk:{}", hex::encode(hash)).into_bytes()
    }
    
    fn metadata_key(&self, hash: &BlockHash) -> Vec<u8> {
        format!("meta:{}", hex::encode(hash)).into_bytes()
    }
    
    fn index_key(&self, index: u64) -> Vec<u8> {
        format!("idx:{:016x}", index).into_bytes()
    }
}

#[async_trait::async_trait]
impl StorageBackend for RocksDBBackend {
    async fn store_block(&mut self, block: &Block<impl BlockPayload>) -> Result<BlockHash> {
        let hash = block.hash();
        
        // Check if block already exists
        let block_key = self.block_key(&hash);
        if self.db.key_may_exist_cf(self.cf_blocks, &block_key) {
            if self.db.get_cf(self.cf_blocks, &block_key)?.is_some() {
                return Ok(hash);
            }
        }
        
        // Serialize block
        let wire_format = WireFormat::default();
        let serialized_data = wire_format.encode(block)?;
        
        // Create metadata
        let metadata = BlockMetadata {
            hash: hash.clone(),
            index: block.index,
            timestamp: block.timestamp,
            payload_type: std::any::type_name::<block::Payload>().to_string(),
            public_key: block.public_key.clone(),
            size_bytes: serialized_data.len() as u64,
        };
        let metadata_data = serde_json::to_vec(&metadata)?;
        
        // Prepare batch write for atomicity
        let mut batch = WriteBatch::default();
        
        // Store block data
        batch.put_cf(self.cf_blocks, &block_key, &serialized_data);
        
        // Store metadata
        let metadata_key = self.metadata_key(&hash);
        batch.put_cf(self.cf_metadata, &metadata_key, &metadata_data);
        
        // Store index mapping
        let index_key = self.index_key(block.index);
        batch.put_cf(self.cf_index, &index_key, &hash);
        
        // Atomic write
        self.db.write(batch)?;
        
        Ok(hash)
    }
    
    async fn retrieve_block(&self, hash: &BlockHash) -> Result<Option<Block<serde_json::Value>>> {
        let block_key = self.block_key(hash);
        
        match self.db.get_cf(self.cf_blocks, &block_key)? {
            Some(serialized_data) => {
                let wire_format = WireFormat::default();
                let block = wire_format.decode::<Block<serde_json::Value>>(&serialized_data)?;
                Ok(Some(block))
            },
            None => Ok(None),
        }
    }
    
    async fn store_blocks(&mut self, blocks: &[Block<impl BlockPayload>]) -> Result<Vec<BlockHash>> {
        let mut batch = WriteBatch::default();
        let mut hashes = Vec::new();
        
        for block in blocks {
            let hash = block.hash();
            
            // Serialize block
            let wire_format = WireFormat::default();
            let serialized_data = wire_format.encode(block)?;
            
            // Create metadata
            let metadata = BlockMetadata {
                hash: hash.clone(),
                index: block.index,
                timestamp: block.timestamp,
                payload_type: std::any::type_name::<block::Payload>().to_string(),
                public_key: block.public_key.clone(),
                size_bytes: serialized_data.len() as u64,
            };
            let metadata_data = serde_json::to_vec(&metadata)?;
            
            // Add to batch
            let block_key = self.block_key(&hash);
            batch.put_cf(self.cf_blocks, &block_key, &serialized_data);
            
            let metadata_key = self.metadata_key(&hash);
            batch.put_cf(self.cf_metadata, &metadata_key, &metadata_data);
            
            let index_key = self.index_key(block.index);
            batch.put_cf(self.cf_index, &index_key, &hash);
            
            hashes.push(hash);
        }
        
        // Atomic batch write
        self.db.write(batch)?;
        
        Ok(hashes)
    }
    
    async fn list_blocks(&self, options: &ListOptions) -> Result<Vec<BlockMetadata>> {
        let mut results = Vec::new();
        
        // Iterate through metadata column family
        let iter = self.db.iterator_cf(
            self.cf_metadata,
            IteratorMode::Start
        );
        
        for item in iter {
            let (_key, value) = item?;
            let metadata: BlockMetadata = serde_json::from_slice(&value)?;
            
            // Apply filters
            let mut include = true;
            
            if let Some(ref filter) = options.filter {
                if let Some(ref payload_type) = filter.payload_type {
                    if metadata.payload_type != *payload_type {
                        include = false;
                    }
                }
                
                if let Some(ref public_key) = filter.public_key {
                    if metadata.public_key != *public_key {
                        include = false;
                    }
                }
                
                if let Some(min_index) = filter.min_index {
                    if metadata.index < min_index {
                        include = false;
                    }
                }
                
                if let Some(max_index) = filter.max_index {
                    if metadata.index > max_index {
                        include = false;
                    }
                }
            }
            
            // Apply time range
            if let Some(start_time) = options.start_time {
                if metadata.timestamp < start_time {
                    include = false;
                }
            }
            
            if let Some(end_time) = options.end_time {
                if metadata.timestamp > end_time {
                    include = false;
                }
            }
            
            if include {
                results.push(metadata);
            }
        }
        
        // Sort results
        match options.order {
            SortOrder::Ascending => results.sort_by_key(|m| m.index),
            SortOrder::Descending => results.sort_by(|a, b| b.index.cmp(&a.index)),
            SortOrder::ByTimestamp => results.sort_by_key(|m| m.timestamp),
            SortOrder::ByIndex => results.sort_by_key(|m| m.index),
        }
        
        // Apply pagination
        if let Some(offset) = options.offset {
            results = results.into_iter().skip(offset as usize).collect();
        }
        
        if let Some(limit) = options.limit {
            results.truncate(limit as usize);
        }
        
        Ok(results)
    }
    
    async fn get_stats(&self) -> Result<StorageStats> {
        // Get RocksDB statistics
        let live_data_size = self.db.property_int_value("rocksdb.estimate-live-data-size")?
            .unwrap_or(0);
        let total_data_size = self.db.property_int_value("rocksdb.total-sst-files-size")?
            .unwrap_or(0);
        let num_entries = self.db.property_int_value("rocksdb.estimate-num-keys")?
            .unwrap_or(0);
        
        // Count blocks by iterating metadata
        let mut total_blocks = 0;
        let mut total_size_bytes = 0;
        let mut oldest_block = None;
        let mut newest_block = None;
        
        let iter = self.db.iterator_cf(self.cf_metadata, IteratorMode::Start);
        for item in iter {
            let (_key, value) = item?;
            let metadata: BlockMetadata = serde_json::from_slice(&value)?;
            
            total_blocks += 1;
            total_size_bytes += metadata.size_bytes;
            
            if oldest_block.is_none() || Some(metadata.timestamp) < oldest_block {
                oldest_block = Some(metadata.timestamp);
            }
            
            if newest_block.is_none() || Some(metadata.timestamp) > newest_block {
                newest_block = Some(metadata.timestamp);
            }
        }
        
        Ok(StorageStats {
            total_blocks,
            total_size_bytes,
            oldest_block,
            newest_block,
            backend_specific: BackendStats::RocksDB {
                live_data_size,
                total_data_size,
                num_entries,
                num_deletions: 0, // Would need to track this separately
                compaction_stats: CompactionStats {
                    bytes_read: 0,
                    bytes_written: 0,
                    compaction_time: Duration::ZERO,
                    last_compaction: SystemTime::now(),
                },
            },
        })
    }
    
    async fn compact(&mut self) -> Result<()> {
        // Trigger manual compaction
        self.db.compact_range::<&[u8], &[u8]>(None, None);
        Ok(())
    }
    
    async fn close(&mut self) -> Result<()> {
        // RocksDB automatically closes when dropped
        Ok(())
    }
}
```

## SQLite Backend

### Relational Database Implementation

```rust
use olocus_storage::sqlite::*;
use sqlx::{SqlitePool, Row};

pub struct SQLiteBackend {
    pool: SqlitePool,
    config: SQLiteConfig,
}

#[derive(Debug, Clone)]
pub struct SQLiteConfig {
    pub database_path: String,
    pub max_connections: u32,
    pub journal_mode: JournalMode,
    pub synchronous: SynchronousMode,
    pub cache_size: i64,
    pub temp_store: TempStore,
    pub enable_wal: bool,
}

#[derive(Debug, Clone)]
pub enum JournalMode {
    Delete,
    Truncate,
    Persist,
    Memory,
    WAL,
}

#[derive(Debug, Clone)]
pub enum SynchronousMode {
    Off,
    Normal,
    Full,
    Extra,
}

#[derive(Debug, Clone)]
pub enum TempStore {
    Default,
    File,
    Memory,
}

impl SQLiteBackend {
    pub async fn new(config: SQLiteConfig) -> Result<Self> {
        // Build connection string with pragmas
        let mut connection_string = format!("sqlite:{}", config.database_path);
        
        // Configure SQLite pragmas
        let pragmas = format!(
            "?{}{}{}{}{}",
            format!("journal_mode={}", config.journal_mode.to_string()),
            format!("&synchronous={}", config.synchronous.to_string()),
            format!("&cache_size={}", config.cache_size),
            format!("&temp_store={}", config.temp_store.to_string()),
            if config.enable_wal { "&wal_autocheckpoint=1000" } else { "" }
        );
        
        connection_string.push_str(&pragmas);
        
        // Create connection pool
        let pool = SqlitePool::connect(&connection_string).await?;
        
        // Create tables
        let mut backend = Self { pool, config };
        backend.create_tables().await?;
        backend.create_indices().await?;
        
        Ok(backend)
    }
    
    async fn create_tables(&self) -> Result<()> {
        // Blocks table
        sqlx::query(r#"
            CREATE TABLE IF NOT EXISTS blocks (
                hash TEXT PRIMARY KEY,
                block_index INTEGER NOT NULL,
                timestamp INTEGER NOT NULL,
                public_key BLOB NOT NULL,
                previous_hash TEXT,
                payload_type TEXT NOT NULL,
                payload_data BLOB NOT NULL,
                signature BLOB NOT NULL,
                size_bytes INTEGER NOT NULL,
                created_at INTEGER NOT NULL DEFAULT (unixepoch())
            )
        "#)
        .execute(&self.pool)
        .await?;
        
        // Chain metadata table
        sqlx::query(r#"
            CREATE TABLE IF NOT EXISTS chain_metadata (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            )
        "#)
        .execute(&self.pool)
        .await?;
        
        // Block statistics table for analytics
        sqlx::query(r#"
            CREATE TABLE IF NOT EXISTS block_stats (
                date TEXT PRIMARY KEY,
                block_count INTEGER NOT NULL DEFAULT 0,
                total_size INTEGER NOT NULL DEFAULT 0,
                unique_keys INTEGER NOT NULL DEFAULT 0
            )
        "#)
        .execute(&self.pool)
        .await?;
        
        Ok(())
    }
    
    async fn create_indices(&self) -> Result<()> {
        // Index on block_index for chain operations
        sqlx::query("CREATE INDEX IF NOT EXISTS idx_blocks_index ON blocks (block_index)")
            .execute(&self.pool)
            .await?;
        
        // Index on timestamp for time-based queries
        sqlx::query("CREATE INDEX IF NOT EXISTS idx_blocks_timestamp ON blocks (timestamp)")
            .execute(&self.pool)
            .await?;
        
        // Index on public_key for filtering
        sqlx::query("CREATE INDEX IF NOT EXISTS idx_blocks_public_key ON blocks (public_key)")
            .execute(&self.pool)
            .await?;
        
        // Index on payload_type for type-based queries
        sqlx::query("CREATE INDEX IF NOT EXISTS idx_blocks_payload_type ON blocks (payload_type)")
            .execute(&self.pool)
            .await?;
        
        // Composite index for common query patterns
        sqlx::query("CREATE INDEX IF NOT EXISTS idx_blocks_composite ON blocks (timestamp, payload_type, public_key)")
            .execute(&self.pool)
            .await?;
        
        Ok(())
    }
}

#[async_trait::async_trait]
impl StorageBackend for SQLiteBackend {
    async fn store_block(&mut self, block: &Block<impl BlockPayload>) -> Result<BlockHash> {
        let hash = block.hash();
        
        // Check if block already exists
        let exists = sqlx::query_scalar::<_, bool>("SELECT EXISTS(SELECT 1 FROM blocks WHERE hash = ?)")
            .bind(hex::encode(&hash))
            .fetch_one(&self.pool)
            .await?;
        
        if exists {
            return Ok(hash);
        }
        
        // Serialize payload
        let payload_data = serde_json::to_vec(&block.payload)?;
        let signature_data = block.signature.as_bytes();
        let public_key_data = block.public_key.as_bytes();
        let previous_hash_hex = block.previous_hash.as_ref().map(|h| hex::encode(h));
        
        // Insert block
        sqlx::query(r#"
            INSERT INTO blocks (
                hash, block_index, timestamp, public_key, previous_hash,
                payload_type, payload_data, signature, size_bytes
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        "#)
        .bind(hex::encode(&hash))
        .bind(block.index as i64)
        .bind(block.timestamp.duration_since(SystemTime::UNIX_EPOCH)?.as_secs() as i64)
        .bind(public_key_data)
        .bind(previous_hash_hex)
        .bind(std::any::type_name::<block::Payload>())
        .bind(payload_data)
        .bind(signature_data)
        .bind(block.size_bytes() as i64)
        .execute(&self.pool)
        .await?;
        
        // Update daily statistics
        self.update_daily_stats().await?;
        
        Ok(hash)
    }
    
    async fn retrieve_block(&self, hash: &BlockHash) -> Result<Option<Block<serde_json::Value>>> {
        let row = sqlx::query(r#"
            SELECT block_index, timestamp, public_key, previous_hash,
                   payload_data, signature
            FROM blocks 
            WHERE hash = ?
        "#)
        .bind(hex::encode(hash))
        .fetch_optional(&self.pool)
        .await?;
        
        match row {
            Some(row) => {
                let index: i64 = row.get("block_index");
                let timestamp_secs: i64 = row.get("timestamp");
                let public_key_bytes: Vec<u8> = row.get("public_key");
                let previous_hash_hex: Option<String> = row.get("previous_hash");
                let payload_data: Vec<u8> = row.get("payload_data");
                let signature_bytes: Vec<u8> = row.get("signature");
                
                let timestamp = SystemTime::UNIX_EPOCH + Duration::from_secs(timestamp_secs as u64);
                let public_key = PublicKey::from_bytes(&public_key_bytes)?;
                let previous_hash = previous_hash_hex.map(|h| hex::decode(h)).transpose()?
                    .map(|bytes| BlockHash::try_from(bytes.as_slice())).transpose()?;
                let payload: serde_json::Value = serde_json::from_slice(&payload_data)?;
                let signature = Signature::from_bytes(&signature_bytes)?;
                
                let block = Block {
                    index: index as u64,
                    timestamp,
                    public_key,
                    previous_hash,
                    payload,
                    signature,
                };
                
                Ok(Some(block))
            },
            None => Ok(None),
        }
    }
    
    async fn list_blocks(&self, options: &ListOptions) -> Result<Vec<BlockMetadata>> {
        let mut query = "SELECT hash, block_index, timestamp, payload_type, public_key, size_bytes FROM blocks".to_string();
        let mut conditions = Vec::new();
        let mut params = Vec::new();
        
        // Build WHERE clause
        if let Some(ref filter) = options.filter {
            if let Some(ref payload_type) = filter.payload_type {
                conditions.push("payload_type = ?");
                params.push(payload_type.as_str());
            }
            
            if let Some(min_index) = filter.min_index {
                conditions.push("block_index >= ?");
                params.push(&min_index.to_string());
            }
            
            if let Some(max_index) = filter.max_index {
                conditions.push("block_index <= ?");
                params.push(&max_index.to_string());
            }
        }
        
        if let Some(start_time) = options.start_time {
            conditions.push("timestamp >= ?");
            let timestamp = start_time.duration_since(SystemTime::UNIX_EPOCH)?.as_secs();
            params.push(&timestamp.to_string());
        }
        
        if let Some(end_time) = options.end_time {
            conditions.push("timestamp <= ?");
            let timestamp = end_time.duration_since(SystemTime::UNIX_EPOCH)?.as_secs();
            params.push(&timestamp.to_string());
        }
        
        if !conditions.is_empty() {
            query.push_str(" WHERE ");
            query.push_str(&conditions.join(" AND "));
        }
        
        // Add ORDER BY
        match options.order {
            SortOrder::Ascending => query.push_str(" ORDER BY block_index ASC"),
            SortOrder::Descending => query.push_str(" ORDER BY block_index DESC"),
            SortOrder::ByTimestamp => query.push_str(" ORDER BY timestamp ASC"),
            SortOrder::ByIndex => query.push_str(" ORDER BY block_index ASC"),
        }
        
        // Add LIMIT and OFFSET
        if let Some(limit) = options.limit {
            query.push_str(&format!(" LIMIT {}", limit));
        }
        
        if let Some(offset) = options.offset {
            query.push_str(&format!(" OFFSET {}", offset));
        }
        
        // Execute query
        let mut query_builder = sqlx::query(&query);
        for param in params {
            query_builder = query_builder.bind(param);
        }
        
        let rows = query_builder.fetch_all(&self.pool).await?;
        
        let mut results = Vec::new();
        for row in rows {
            let hash_hex: String = row.get("hash");
            let hash = BlockHash::try_from(hex::decode(hash_hex)?.as_slice())?;
            
            let index: i64 = row.get("block_index");
            let timestamp_secs: i64 = row.get("timestamp");
            let payload_type: String = row.get("payload_type");
            let public_key_bytes: Vec<u8> = row.get("public_key");
            let size_bytes: i64 = row.get("size_bytes");
            
            let metadata = BlockMetadata {
                hash,
                index: index as u64,
                timestamp: SystemTime::UNIX_EPOCH + Duration::from_secs(timestamp_secs as u64),
                payload_type,
                public_key: PublicKey::from_bytes(&public_key_bytes)?,
                size_bytes: size_bytes as u64,
            };
            
            results.push(metadata);
        }
        
        Ok(results)
    }
    
    async fn get_stats(&self) -> Result<StorageStats> {
        // Get basic counts and sizes
        let stats_row = sqlx::query(r#"
            SELECT 
                COUNT(*) as total_blocks,
                SUM(size_bytes) as total_size,
                MIN(timestamp) as oldest_timestamp,
                MAX(timestamp) as newest_timestamp
            FROM blocks
        "#)
        .fetch_one(&self.pool)
        .await?;
        
        let total_blocks: i64 = stats_row.get("total_blocks");
        let total_size: Option<i64> = stats_row.get("total_size");
        let oldest_timestamp: Option<i64> = stats_row.get("oldest_timestamp");
        let newest_timestamp: Option<i64> = stats_row.get("newest_timestamp");
        
        let oldest_block = oldest_timestamp.map(|ts| {
            SystemTime::UNIX_EPOCH + Duration::from_secs(ts as u64)
        });
        
        let newest_block = newest_timestamp.map(|ts| {
            SystemTime::UNIX_EPOCH + Duration::from_secs(ts as u64)
        });
        
        // Get database file size and page info
        let db_size_row = sqlx::query("PRAGMA page_count")
            .fetch_one(&self.pool)
            .await?;
        let page_count: i64 = db_size_row.get("page_count");
        
        let page_size_row = sqlx::query("PRAGMA page_size")
            .fetch_one(&self.pool)
            .await?;
        let page_size: i64 = page_size_row.get("page_size");
        
        let database_size = (page_count * page_size) as u64;
        
        // Calculate fragmentation (simplified)
        let freelist_row = sqlx::query("PRAGMA freelist_count")
            .fetch_one(&self.pool)
            .await?;
        let freelist_count: i64 = freelist_row.get("freelist_count");
        
        let fragmentation_ratio = if page_count > 0 {
            freelist_count as f64 / page_count as f64
        } else {
            0.0
        };
        
        Ok(StorageStats {
            total_blocks: total_blocks as u64,
            total_size_bytes: total_size.unwrap_or(0) as u64,
            oldest_block,
            newest_block,
            backend_specific: BackendStats::SQLite {
                database_size,
                page_count: page_count as u64,
                page_size: page_size as u64,
                fragmentation_ratio,
            },
        })
    }
    
    async fn vacuum(&mut self) -> Result<()> {
        sqlx::query("VACUUM").execute(&self.pool).await?;
        Ok(())
    }
    
    async fn close(&mut self) -> Result<()> {
        self.pool.close().await;
        Ok(())
    }
}

impl SQLiteBackend {
    async fn update_daily_stats(&self) -> Result<()> {
        let today = chrono::Utc::now().date().format("%Y-%m-%d").to_string();
        
        sqlx::query(r#"
            INSERT OR REPLACE INTO block_stats (date, block_count, total_size, unique_keys)
            SELECT 
                ? as date,
                COUNT(*) as block_count,
                SUM(size_bytes) as total_size,
                COUNT(DISTINCT public_key) as unique_keys
            FROM blocks 
            WHERE date(timestamp, 'unixepoch') = ?
        "#)
        .bind(&today)
        .bind(&today)
        .execute(&self.pool)
        .await?;
        
        Ok(())
    }
    
    pub async fn get_daily_stats(&self, date: &str) -> Result<Option<DailyStats>> {
        let row = sqlx::query(r#"
            SELECT block_count, total_size, unique_keys 
            FROM block_stats 
            WHERE date = ?
        "#)
        .bind(date)
        .fetch_optional(&self.pool)
        .await?;
        
        match row {
            Some(row) => {
                Ok(Some(DailyStats {
                    date: date.to_string(),
                    block_count: row.get::<i64, _>("block_count") as u64,
                    total_size: row.get::<i64, _>("total_size") as u64,
                    unique_keys: row.get::<i64, _>("unique_keys") as u64,
                }))
            },
            None => Ok(None),
        }
    }
}

#[derive(Debug, Clone)]
pub struct DailyStats {
    pub date: String,
    pub block_count: u64,
    pub total_size: u64,
    pub unique_keys: u64,
}
```

## Caching Layer

### LRU Cache Implementation

```rust
use olocus_storage::cache::*;
use std::collections::HashMap;
use lru::LruCache;

pub struct CachedStorageBackend<B: StorageBackend> {
    backend: B,
    block_cache: LruCache<BlockHash, Arc<Block<serde_json::Value>>>,
    metadata_cache: LruCache<BlockHash, BlockMetadata>,
    config: CacheConfig,
    stats: CacheStats,
}

#[derive(Debug, Clone)]
pub struct CacheConfig {
    pub block_cache_size: usize,
    pub metadata_cache_size: usize,
    pub ttl: Duration,
    pub eviction_policy: EvictionPolicy,
    pub write_through: bool,
    pub prefetch_enabled: bool,
    pub prefetch_size: usize,
}

#[derive(Debug, Clone)]
pub enum EvictionPolicy {
    LRU,
    LFU,
    FIFO,
    Random,
}

#[derive(Debug, Clone, Default)]
pub struct CacheStats {
    pub hits: u64,
    pub misses: u64,
    pub evictions: u64,
    pub writes: u64,
    pub hit_ratio: f64,
}

impl<B: StorageBackend> CachedStorageBackend<B> {
    pub fn new(backend: B, config: CacheConfig) -> Self {
        Self {
            backend,
            block_cache: LruCache::new(config.block_cache_size),
            metadata_cache: LruCache::new(config.metadata_cache_size),
            config,
            stats: CacheStats::default(),
        }
    }
    
    fn update_hit_ratio(&mut self) {
        let total = self.stats.hits + self.stats.misses;
        self.stats.hit_ratio = if total > 0 {
            self.stats.hits as f64 / total as f64
        } else {
            0.0
        };
    }
    
    async fn prefetch_related_blocks(&mut self, hash: &BlockHash) -> Result<()> {
        if !self.config.prefetch_enabled {
            return Ok(());
        }
        
        // Get metadata to find related blocks
        if let Some(metadata) = self.metadata_cache.get(hash) {
            // Prefetch blocks around this index
            let start_index = metadata.index.saturating_sub(self.config.prefetch_size as u64 / 2);
            let end_index = metadata.index + (self.config.prefetch_size as u64 / 2);
            
            let related_blocks = self.backend.get_blocks_by_range(start_index, end_index).await?;
            
            for block in related_blocks {
                let block_hash = block.hash();
                if !self.block_cache.contains(&block_hash) {
                    self.block_cache.put(block_hash, Arc::new(block));
                }
            }
        }
        
        Ok(())
    }
}

#[async_trait::async_trait]
impl<B: StorageBackend> StorageBackend for CachedStorageBackend<B> {
    async fn store_block(&mut self, block: &Block<impl BlockPayload>) -> Result<BlockHash> {
        let hash = self.backend.store_block(block).await?;
        
        // Cache the block if write-through is enabled
        if self.config.write_through {
            // Convert to JSON payload for caching
            let json_block = Block {
                index: block.index,
                timestamp: block.timestamp,
                public_key: block.public_key.clone(),
                previous_hash: block.previous_hash.clone(),
                payload: serde_json::to_value(&block.payload)?,
                signature: block.signature.clone(),
            };
            
            self.block_cache.put(hash.clone(), Arc::new(json_block));
            
            // Cache metadata
            let metadata = BlockMetadata {
                hash: hash.clone(),
                index: block.index,
                timestamp: block.timestamp,
                payload_type: std::any::type_name::<block::Payload>().to_string(),
                public_key: block.public_key.clone(),
                size_bytes: block.size_bytes(),
            };
            
            self.metadata_cache.put(hash.clone(), metadata);
        }
        
        self.stats.writes += 1;
        Ok(hash)
    }
    
    async fn retrieve_block(&self, hash: &BlockHash) -> Result<Option<Block<serde_json::Value>>> {
        // Check cache first
        if let Some(cached_block) = self.block_cache.get(hash) {
            self.stats.hits += 1;
            self.update_hit_ratio();
            return Ok(Some((**cached_block).clone()));
        }
        
        // Cache miss - fetch from backend
        self.stats.misses += 1;
        
        match self.backend.retrieve_block(hash).await? {
            Some(block) => {
                // Cache the result
                self.block_cache.put(hash.clone(), Arc::new(block.clone()));
                
                // Trigger prefetch if enabled
                if self.config.prefetch_enabled {
                    let _ = self.prefetch_related_blocks(hash).await;
                }
                
                self.update_hit_ratio();
                Ok(Some(block))
            },
            None => {
                self.update_hit_ratio();
                Ok(None)
            }
        }
    }
    
    async fn list_blocks(&self, options: &ListOptions) -> Result<Vec<BlockMetadata>> {
        // For list operations, we generally bypass cache and go to backend
        // unless we have a comprehensive metadata cache strategy
        self.backend.list_blocks(options).await
    }
    
    async fn get_stats(&self) -> Result<StorageStats> {
        let mut backend_stats = self.backend.get_stats().await?;
        
        // Add cache stats to backend stats
        match &mut backend_stats.backend_specific {
            BackendStats::Memory { ref mut heap_usage } => {
                *heap_usage += self.estimate_cache_memory_usage();
            },
            _ => {
                // For other backends, we could add cache-specific stats
            }
        }
        
        Ok(backend_stats)
    }
    
    async fn compact(&mut self) -> Result<()> {
        // Clear caches during compaction to ensure consistency
        self.block_cache.clear();
        self.metadata_cache.clear();
        
        self.backend.compact().await
    }
    
    async fn close(&mut self) -> Result<()> {
        self.block_cache.clear();
        self.metadata_cache.clear();
        self.backend.close().await
    }
}

impl<B: StorageBackend> CachedStorageBackend<B> {
    pub fn get_cache_stats(&self) -> CacheStats {
        self.stats.clone()
    }
    
    pub fn clear_cache(&mut self) {
        self.block_cache.clear();
        self.metadata_cache.clear();
        self.stats.evictions += self.stats.hits + self.stats.misses;
        self.stats.hits = 0;
        self.stats.misses = 0;
        self.update_hit_ratio();
    }
    
    fn estimate_cache_memory_usage(&self) -> u64 {
        // Rough estimation of cache memory usage
        let block_cache_size = self.block_cache.len() * 1024; // Estimate 1KB per cached block
        let metadata_cache_size = self.metadata_cache.len() * 200; // Estimate 200B per metadata
        
        (block_cache_size + metadata_cache_size) as u64
    }
    
    pub fn configure_cache(&mut self, new_config: CacheConfig) {
        // Resize caches if needed
        if new_config.block_cache_size != self.config.block_cache_size {
            self.block_cache.resize(new_config.block_cache_size);
        }
        
        if new_config.metadata_cache_size != self.config.metadata_cache_size {
            self.metadata_cache.resize(new_config.metadata_cache_size);
        }
        
        self.config = new_config;
    }
}
```

## Integration Examples

### Multi-Backend Storage Manager

```rust
use olocus_storage::manager::*;

pub struct StorageManager {
    primary: Box<dyn StorageBackend>,
    replicas: Vec<Box<dyn StorageBackend>>,
    config: StorageManagerConfig,
}

#[derive(Debug, Clone)]
pub struct StorageManagerConfig {
    pub replication_factor: u32,
    pub consistency_level: ConsistencyLevel,
    pub health_check_interval: Duration,
    pub auto_failover: bool,
    pub sync_writes: bool,
}

#[derive(Debug, Clone)]
pub enum ConsistencyLevel {
    One,        // Write to one backend
    Quorum,     // Write to majority
    All,        // Write to all backends
}

impl StorageManager {
    pub fn new(
        primary: Box<dyn StorageBackend>,
        replicas: Vec<Box<dyn StorageBackend>>,
        config: StorageManagerConfig
    ) -> Self {
        Self {
            primary,
            replicas,
            config,
        }
    }
    
    pub async fn store_with_replication(&mut self, block: &Block<impl BlockPayload>) -> Result<BlockHash> {
        let hash = self.primary.store_block(block).await?;
        
        // Replicate based on consistency level
        match self.config.consistency_level {
            ConsistencyLevel::One => {
                // Primary write is sufficient
                return Ok(hash);
            },
            ConsistencyLevel::Quorum => {
                let required_writes = (self.replicas.len() / 2) + 1;
                let mut successful_writes = 1; // Primary already succeeded
                
                for replica in &mut self.replicas[..required_writes.min(self.replicas.len())] {
                    if replica.store_block(block).await.is_ok() {
                        successful_writes += 1;
                    }
                }
                
                if successful_writes >= required_writes {
                    Ok(hash)
                } else {
                    Err(StorageError::InsufficientReplicas {
                        required: required_writes,
                        successful: successful_writes,
                    })
                }
            },
            ConsistencyLevel::All => {
                // Write to all replicas
                for replica in &mut self.replicas {
                    replica.store_block(block).await?;
                }
                Ok(hash)
            }
        }
    }
    
    pub async fn health_check(&self) -> HealthReport {
        let mut report = HealthReport {
            primary_healthy: false,
            healthy_replicas: 0,
            total_replicas: self.replicas.len(),
            issues: Vec::new(),
        };
        
        // Check primary
        match self.primary.get_stats().await {
            Ok(_) => report.primary_healthy = true,
            Err(e) => report.issues.push(format!("Primary backend error: {}", e)),
        }
        
        // Check replicas
        for (i, replica) in self.replicas.iter().enumerate() {
            match replica.get_stats().await {
                Ok(_) => report.healthy_replicas += 1,
                Err(e) => report.issues.push(format!("Replica {} error: {}", i, e)),
            }
        }
        
        report
    }
}

#[derive(Debug)]
pub struct HealthReport {
    pub primary_healthy: bool,
    pub healthy_replicas: usize,
    pub total_replicas: usize,
    pub issues: Vec<String>,
}

// Usage example
async fn setup_enterprise_storage() -> Result<StorageManager> {
    // Primary: High-performance RocksDB
    let primary = Box::new(RocksDBBackend::new(RocksDBConfig {
        path: "/data/primary/olocus".to_string(),
        cache_size: 256 * 1024 * 1024, // 256MB
        compression: CompressionType::Zstd,
        ..Default::default()
    })?);
    
    // Replica 1: SQLite for analytics
    let replica1 = Box::new(SQLiteBackend::new(SQLiteConfig {
        database_path: "/data/replica1/olocus.db".to_string(),
        enable_wal: true,
        journal_mode: JournalMode::WAL,
        ..Default::default()
    }).await?);
    
    // Replica 2: Filesystem for backup
    let replica2 = Box::new(FilesystemBackend::new(
        "/data/replica2/olocus",
        CompressionType::Zstd
    ).await?);
    
    let manager = StorageManager::new(
        primary,
        vec![replica1, replica2],
        StorageManagerConfig {
            replication_factor: 2,
            consistency_level: ConsistencyLevel::Quorum,
            health_check_interval: Duration::from_secs(30),
            auto_failover: true,
            sync_writes: false,
        }
    );
    
    Ok(manager)
}
```

## Performance Benchmarks

```rust
#[cfg(test)]
mod storage_benchmarks {
    use super::*;
    use criterion::{black_box, Criterion, BenchmarkId};
    
    async fn benchmark_storage_backends(c: &mut Criterion) {
        let backends = vec![
            ("Memory", create_memory_backend()),
            ("RocksDB", create_rocksdb_backend()),
            ("SQLite", create_sqlite_backend().await),
            ("Filesystem", create_filesystem_backend().await),
        ];
        
        let test_blocks = create_test_blocks(1000);
        
        for (name, mut backend) in backends {
            let group_name = format!("storage_{}", name);
            let mut group = c.benchmark_group(group_name);
            
            // Single block operations
            group.bench_function(BenchmarkId::new("store_single", name), |b| {
                b.iter(|| async {
                    backend.store_block(black_box(&test_blocks[0])).await
                });
            });
            
            group.bench_function(BenchmarkId::new("retrieve_single", name), |b| {
                let hash = test_blocks[0].hash();
                b.iter(|| async {
                    backend.retrieve_block(black_box(&hash)).await
                });
            });
            
            // Batch operations
            group.bench_function(BenchmarkId::new("store_batch", name), |b| {
                b.iter(|| async {
                    backend.store_blocks(black_box(&test_blocks[0..100])).await
                });
            });
            
            // Query operations
            group.bench_function(BenchmarkId::new("list_blocks", name), |b| {
                let options = ListOptions {
                    limit: Some(100),
                    order: SortOrder::ByIndex,
                    ..Default::default()
                };
                b.iter(|| async {
                    backend.list_blocks(black_box(&options)).await
                });
            });
            
            group.finish();
        }
    }
    
    fn create_test_blocks(count: usize) -> Vec<Block<TestPayload>> {
        (0..count).map(|i| {
            let payload = TestPayload {
                id: i as u64,
                data: format!("test_data_{}", i),
                timestamp: SystemTime::now(),
            };
            
            create_test_block(payload, i as u64)
        }).collect()
    }
}

// Performance results (approximate)
struct StoragePerformanceMetrics {
    memory: BackendMetrics {
        single_store: Duration::from_micros(10),     // 10μs
        single_retrieve: Duration::from_micros(5),   // 5μs
        batch_store_100: Duration::from_millis(1),   // 1ms
        list_100: Duration::from_micros(100),        // 100μs
    },
    rocksdb: BackendMetrics {
        single_store: Duration::from_micros(50),     // 50μs
        single_retrieve: Duration::from_micros(20),  // 20μs
        batch_store_100: Duration::from_millis(3),   // 3ms
        list_100: Duration::from_millis(1),          // 1ms
    },
    sqlite: BackendMetrics {
        single_store: Duration::from_micros(100),    // 100μs
        single_retrieve: Duration::from_micros(80),  // 80μs
        batch_store_100: Duration::from_millis(8),   // 8ms
        list_100: Duration::from_millis(2),          // 2ms
    },
    filesystem: BackendMetrics {
        single_store: Duration::from_millis(1),      // 1ms
        single_retrieve: Duration::from_micros(500), // 500μs
        batch_store_100: Duration::from_millis(100), // 100ms
        list_100: Duration::from_millis(10),         // 10ms
    },
}
```

## Related Documentation

- [Query Engine](./query-engine.md) - Advanced querying capabilities
- [HTTP API](./http-api.md) - REST API for storage operations
- [Metrics](./metrics.md) - Storage performance monitoring
- [Network](./network.md) - Distributed storage coordination
