---
id: language-sdks
title: Language SDKs
sidebar_position: 1
---

# Language SDKs

Language SDKs provide idiomatic bindings for integrating Olocus Protocol into Python, Go, TypeScript, and other popular programming languages. Each SDK follows language-specific best practices while providing consistent functionality across platforms.

## SDK Architecture

All Olocus language SDKs follow a common architectural pattern:

```
┌─────────────────┐
│ Language SDK    │ ← Idiomatic API
├─────────────────┤
│ FFI Bridge      │ ← C interface bindings
├─────────────────┤
│ olocus-ffi      │ ← Rust C-compatible layer
├─────────────────┤
│ olocus-core     │ ← Core protocol implementation
└─────────────────┘
```

### Design Principles

1. **Idiomatic APIs**: Each language follows its own conventions
2. **Memory Safety**: Automatic resource management
3. **Error Handling**: Language-specific error patterns
4. **Type Safety**: Strong typing where supported
5. **Async Support**: Non-blocking operations for I/O
6. **Testing**: Comprehensive test suites per language

## Python SDK

The Python SDK uses ctypes for FFI binding and provides both synchronous and asynchronous APIs.

### Installation

```bash
# Install from PyPI
pip install olocus-python

# Or with specific features
pip install olocus-python[async,crypto,location]

# Development installation
git clone https://codeberg.org/olocus/olocus-python
cd olocus-python
pip install -e .[dev]
```

### Quick Start

```python
import olocus
from datetime import datetime

# Initialize the library
olocus.init()

# Generate a key pair
keypair = olocus.generate_keypair()

# Create a genesis block
payload = {"sensor": "temperature", "value": 23.5}
block = olocus.create_genesis_block(
    payload=payload,
    private_key=keypair.private_key,
    timestamp=datetime.now()
)

# Verify the block
is_valid = olocus.verify_block(block)
print(f"Block valid: {is_valid}")

# Create a chain
chain = olocus.Chain()
chain.add_block(block)

# Add more blocks
next_payload = {"sensor": "humidity", "value": 65.2}
next_block = olocus.create_block(
    payload=next_payload,
    previous_hash=block.hash,
    private_key=keypair.private_key,
    timestamp=datetime.now()
)
chain.add_block(next_block)

# Verify the entire chain
is_chain_valid = chain.verify()
print(f"Chain valid: {is_chain_valid}")
```

### Async API

```python
import asyncio
import olocus.async_api as olocus

async def main():
    # Initialize with async support
    await olocus.init_async()
    
    # Generate keypair asynchronously
    keypair = await olocus.generate_keypair_async()
    
    # Create block with async I/O
    block = await olocus.create_genesis_block_async(
        payload={"data": "async_value"},
        private_key=keypair.private_key
    )
    
    # Verify with background processing
    is_valid = await olocus.verify_block_async(block)
    print(f"Async verification: {is_valid}")

# Run the async example
asyncio.run(main())
```

### Extension Support

```python
import olocus
import olocus.extensions as ext

# Location extension
location_ext = ext.Location()
location_data = location_ext.get_current_location()

location_block = olocus.create_block(
    payload=location_data,
    private_key=keypair.private_key,
    payload_type=ext.PayloadType.LOCATION
)

# Trust extension
trust_ext = ext.Trust()
reputation = trust_ext.calculate_reputation(peer_id)

# Storage extension with backend selection
storage_ext = ext.Storage(backend='sqlite', path='./olocus.db')
storage_ext.store_block(block)
blocks = storage_ext.query_blocks({"sensor": "temperature"})
```

### Error Handling

```python
import olocus
from olocus.exceptions import (
    OlocusError,
    InvalidSignatureError, 
    InvalidHashError,
    NetworkError,
    StorageError
)

try:
    # This might fail
    block = olocus.create_block(
        payload=invalid_payload,
        private_key=malformed_key
    )
except InvalidSignatureError as e:
    print(f"Signature error: {e}")
    print(f"Error code: {e.error_code}")
except InvalidHashError as e:
    print(f"Hash error: {e}")
except OlocusError as e:
    # Base exception for all Olocus errors
    print(f"General error: {e}")
```

### Configuration

```python
import olocus

# Configure with settings
config = olocus.Config(
    max_threads=4,
    enable_secure_memory=True,
    crypto_backend='ring',  # or 'openssl'
    network_timeout=30.0
)

olocus.init(config=config)

# Platform-specific configuration
if olocus.platform.is_android():
    config.enable_android_keystore = True
elif olocus.platform.is_ios():
    config.enable_keychain = True
```

### Testing Support

```python
import olocus.testing as testing

# Mock implementations for testing
class TestCase:
    def setUp(self):
        self.mock_time = testing.MockTimeProvider()
        self.mock_crypto = testing.MockCryptoProvider()
        
        olocus.configure_mocks(
            time_provider=self.mock_time,
            crypto_provider=self.mock_crypto
        )
    
    def test_block_creation(self):
        # Set deterministic time
        self.mock_time.set_time(1000000000)
        
        # Create block with predictable values
        block = olocus.create_genesis_block(
            payload={"test": "data"},
            private_key=testing.TEST_PRIVATE_KEY
        )
        
        # Assert expected hash
        self.assertEqual(block.hash, testing.EXPECTED_HASH)
```

## Go SDK

The Go SDK uses CGO for FFI binding and provides Go-idiomatic APIs with proper resource management.

### Installation

```bash
go mod init your-project
go get codeberg.org/olocus/olocus-go

# Or with specific version
go get codeberg.org/olocus/olocus-go@v0.1.0
```

### Quick Start

```go
package main

import (
    "encoding/json"
    "fmt"
    "log"
    "time"

    "codeberg.org/olocus/olocus-go"
)

func main() {
    // Initialize the library
    if err := olocus.Init(); err != nil {
        log.Fatal(err)
    }
    defer olocus.Shutdown()

    // Generate a key pair
    keypair, err := olocus.GenerateKeypair()
    if err != nil {
        log.Fatal(err)
    }
    defer keypair.Free() // Important: free C memory

    // Create a genesis block
    payload := map[string]interface{}{
        "sensor": "temperature",
        "value":  23.5,
    }
    
    block, err := olocus.CreateGenesisBlock(
        payload,
        keypair.PrivateKey(),
        time.Now(),
    )
    if err != nil {
        log.Fatal(err)
    }
    defer block.Free()

    // Verify the block
    isValid, err := block.Verify()
    if err != nil {
        log.Fatal(err)
    }
    fmt.Printf("Block valid: %t\n", isValid)

    // Create a chain
    chain := olocus.NewChain()
    defer chain.Free()

    if err := chain.AddBlock(block); err != nil {
        log.Fatal(err)
    }

    // Add more blocks
    nextPayload := map[string]interface{}{
        "sensor": "humidity",
        "value":  65.2,
    }
    
    nextBlock, err := olocus.CreateBlock(
        nextPayload,
        block.Hash(),
        keypair.PrivateKey(),
        time.Now(),
    )
    if err != nil {
        log.Fatal(err)
    }
    defer nextBlock.Free()

    if err := chain.AddBlock(nextBlock); err != nil {
        log.Fatal(err)
    }

    // Verify the entire chain
    isChainValid, err := chain.Verify()
    if err != nil {
        log.Fatal(err)
    }
    fmt.Printf("Chain valid: %t\n", isChainValid)
}
```

### Context and Cancellation

```go
package main

import (
    "context"
    "fmt"
    "time"

    "codeberg.org/olocus/olocus-go"
)

func main() {
    olocus.Init()
    defer olocus.Shutdown()

    keypair, _ := olocus.GenerateKeypair()
    defer keypair.Free()

    // Create context with timeout
    ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
    defer cancel()

    // Long-running operation with cancellation
    payload := map[string]interface{}{"large": "dataset"}
    
    block, err := olocus.CreateGenesisBlockWithContext(
        ctx,
        payload,
        keypair.PrivateKey(),
        time.Now(),
    )
    if err != nil {
        if err == context.DeadlineExceeded {
            fmt.Println("Operation timed out")
            return
        }
        panic(err)
    }
    defer block.Free()

    // Verify with context
    isValid, err := block.VerifyWithContext(ctx)
    if err != nil {
        panic(err)
    }
    fmt.Printf("Block valid: %t\n", isValid)
}
```

### Extension Support

```go
package main

import (
    "codeberg.org/olocus/olocus-go"
    "codeberg.org/olocus/olocus-go/extensions"
)

func main() {
    olocus.Init()
    defer olocus.Shutdown()

    // Location extension
    locationExt, err := extensions.NewLocation()
    if err != nil {
        panic(err)
    }
    defer locationExt.Free()

    currentLocation, err := locationExt.GetCurrentLocation()
    if err != nil {
        panic(err)
    }

    keypair, _ := olocus.GenerateKeypair()
    defer keypair.Free()

    locationBlock, err := olocus.CreateBlock(
        currentLocation,
        nil, // genesis
        keypair.PrivateKey(),
        time.Now(),
        olocus.WithPayloadType(extensions.PayloadTypeLocation),
    )
    if err != nil {
        panic(err)
    }
    defer locationBlock.Free()

    // Trust extension
    trustExt, err := extensions.NewTrust()
    if err != nil {
        panic(err)
    }
    defer trustExt.Free()

    peerID := "peer123"
    reputation, err := trustExt.CalculateReputation(peerID)
    if err != nil {
        panic(err)
    }
    fmt.Printf("Peer %s reputation: %f\n", peerID, reputation)

    // Storage extension
    storageExt, err := extensions.NewStorage(
        extensions.StorageBackendSQLite,
        extensions.StoragePath("./olocus.db"),
    )
    if err != nil {
        panic(err)
    }
    defer storageExt.Free()

    if err := storageExt.StoreBlock(locationBlock); err != nil {
        panic(err)
    }

    query := map[string]interface{}{"sensor": "temperature"}
    blocks, err := storageExt.QueryBlocks(query)
    if err != nil {
        panic(err)
    }
    defer blocks.Free()

    fmt.Printf("Found %d blocks\n", blocks.Len())
}
```

### Error Handling

```go
package main

import (
    "errors"
    "fmt"

    "codeberg.org/olocus/olocus-go"
)

func main() {
    olocus.Init()
    defer olocus.Shutdown()

    // Error handling with typed errors
    _, err := olocus.CreateGenesisBlock(
        nil, // invalid payload
        []byte("invalid_key"),
        time.Now(),
    )

    if err != nil {
        var invalidSigErr *olocus.InvalidSignatureError
        var invalidHashErr *olocus.InvalidHashError
        var networkErr *olocus.NetworkError

        switch {
        case errors.As(err, &invalidSigErr):
            fmt.Printf("Signature error: %s (code: %d)\n", 
                invalidSigErr.Message, invalidSigErr.Code)
        case errors.As(err, &invalidHashErr):
            fmt.Printf("Hash error: %s (code: %d)\n",
                invalidHashErr.Message, invalidHashErr.Code)
        case errors.As(err, &networkErr):
            fmt.Printf("Network error: %s (code: %d)\n",
                networkErr.Message, networkErr.Code)
        default:
            fmt.Printf("Unknown error: %s\n", err)
        }
    }
}
```

### Resource Management

```go
package main

import (
    "codeberg.org/olocus/olocus-go"
)

// ResourceManager helps track and cleanup resources
type ResourceManager struct {
    resources []olocus.Freeable
}

func NewResourceManager() *ResourceManager {
    return &ResourceManager{
        resources: make([]olocus.Freeable, 0),
    }
}

func (rm *ResourceManager) Track(resource olocus.Freeable) {
    rm.resources = append(rm.resources, resource)
}

func (rm *ResourceManager) FreeAll() {
    for _, resource := range rm.resources {
        resource.Free()
    }
    rm.resources = rm.resources[:0]
}

func main() {
    olocus.Init()
    defer olocus.Shutdown()

    rm := NewResourceManager()
    defer rm.FreeAll()

    // Track resources automatically
    keypair, _ := olocus.GenerateKeypair()
    rm.Track(keypair)

    block, _ := olocus.CreateGenesisBlock(
        map[string]interface{}{"test": "data"},
        keypair.PrivateKey(),
        time.Now(),
    )
    rm.Track(block)

    chain := olocus.NewChain()
    rm.Track(chain)

    // All resources will be freed by defer rm.FreeAll()
}
```

## TypeScript SDK

The TypeScript SDK uses WebAssembly for browser compatibility and provides both Promise-based and async/await APIs.

### Installation

```bash
# npm
npm install @olocus/protocol

# yarn
yarn add @olocus/protocol

# pnpm
pnpm add @olocus/protocol
```

### Quick Start

```typescript
import { 
    init, 
    generateKeypair, 
    createGenesisBlock, 
    createBlock,
    verifyBlock,
    Chain 
} from '@olocus/protocol';

async function main() {
    // Initialize the WASM module
    await init();

    // Generate a key pair
    const keypair = await generateKeypair();

    // Create a genesis block
    const payload = { sensor: 'temperature', value: 23.5 };
    const block = await createGenesisBlock({
        payload,
        privateKey: keypair.privateKey,
        timestamp: new Date()
    });

    // Verify the block
    const isValid = await verifyBlock(block);
    console.log(`Block valid: ${isValid}`);

    // Create a chain
    const chain = new Chain();
    await chain.addBlock(block);

    // Add more blocks
    const nextPayload = { sensor: 'humidity', value: 65.2 };
    const nextBlock = await createBlock({
        payload: nextPayload,
        previousHash: block.hash,
        privateKey: keypair.privateKey,
        timestamp: new Date()
    });
    await chain.addBlock(nextBlock);

    // Verify the entire chain
    const isChainValid = await chain.verify();
    console.log(`Chain valid: ${isChainValid}`);
}

main().catch(console.error);
```

### Node.js Support

```typescript
import { init } from '@olocus/protocol/node';
import fs from 'fs/promises';

async function nodeExample() {
    // Initialize with Node.js-specific features
    await init({
        wasmPath: './node_modules/@olocus/protocol/olocus.wasm',
        enableFileSystem: true,
        enableNetwork: true
    });

    const keypair = await generateKeypair();
    
    // Read payload from file
    const payloadData = await fs.readFile('./data.json', 'utf-8');
    const payload = JSON.parse(payloadData);

    const block = await createGenesisBlock({
        payload,
        privateKey: keypair.privateKey,
        timestamp: new Date()
    });

    // Save block to file
    await fs.writeFile(
        './block.json', 
        JSON.stringify(block, null, 2)
    );

    console.log(`Block saved with hash: ${block.hash}`);
}
```

### Browser Integration

```typescript
import { 
    init, 
    generateKeypair,
    createGenesisBlock 
} from '@olocus/protocol/web';

class OlocusManager {
    private initialized = false;
    private keypair: Keypair | null = null;

    async initialize(): Promise<void> {
        if (this.initialized) return;

        await init({
            wasmUrl: '/assets/olocus.wasm',
            enableWorker: true, // Use Web Worker for heavy operations
            enableIndexedDB: true // Use IndexedDB for storage
        });

        this.keypair = await generateKeypair();
        this.initialized = true;
    }

    async createDataBlock(data: any): Promise<Block> {
        if (!this.initialized || !this.keypair) {
            throw new Error('Manager not initialized');
        }

        return createGenesisBlock({
            payload: data,
            privateKey: this.keypair.privateKey,
            timestamp: new Date()
        });
    }

    async storeInBrowser(block: Block): Promise<void> {
        // Store in IndexedDB
        const db = await this.openDatabase();
        const transaction = db.transaction(['blocks'], 'readwrite');
        const store = transaction.objectStore('blocks');
        
        await store.add({
            hash: block.hash,
            block: block,
            timestamp: Date.now()
        });
    }

    private async openDatabase(): Promise<IDBDatabase> {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('OlocusDB', 1);
            
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(request.result);
            
            request.onupgradeneeded = (event) => {
                const db = (event.target as IDBOpenDBRequest).result;
                const store = db.createObjectStore('blocks', { keyPath: 'hash' });
                store.createIndex('timestamp', 'timestamp');
            };
        });
    }
}

// Usage in web app
const manager = new OlocusManager();

async function handleUserData(formData: FormData) {
    await manager.initialize();
    
    const data = Object.fromEntries(formData.entries());
    const block = await manager.createDataBlock(data);
    await manager.storeInBrowser(block);
    
    console.log(`Data stored with hash: ${block.hash}`);
}
```

### Extension Support

```typescript
import { 
    init,
    generateKeypair,
    createBlock,
    extensions 
} from '@olocus/protocol';

async function extensionExample() {
    await init();
    const keypair = await generateKeypair();

    // Location extension
    const location = await extensions.location.getCurrentLocation();
    const locationBlock = await createBlock({
        payload: location,
        previousHash: null, // genesis
        privateKey: keypair.privateKey,
        payloadType: extensions.PayloadType.Location
    });

    // Trust extension
    const trustScore = await extensions.trust.calculateReputation('peer123');
    console.log(`Trust score: ${trustScore}`);

    // Storage extension with IndexedDB backend
    const storage = new extensions.Storage({
        backend: 'indexeddb',
        databaseName: 'OlocusBlocks'
    });
    
    await storage.storeBlock(locationBlock);
    
    const query = { sensor: 'temperature' };
    const blocks = await storage.queryBlocks(query);
    console.log(`Found ${blocks.length} temperature blocks`);

    // Privacy extension
    const privacy = new extensions.Privacy();
    const anonymizedData = await privacy.anonymize(sensitiveData, {
        technique: 'k-anonymity',
        k: 5
    });

    const privacyBlock = await createBlock({
        payload: anonymizedData,
        previousHash: locationBlock.hash,
        privateKey: keypair.privateKey
    });
}
```

### Type Definitions

```typescript
// Core types
export interface Keypair {
    publicKey: Uint8Array;
    privateKey: Uint8Array;
}

export interface Block {
    index: number;
    timestamp: Date;
    previousHash: string | null;
    hash: string;
    payload: any;
    payloadType: number;
    signature: Uint8Array;
    publicKey: Uint8Array;
}

export interface CreateBlockOptions {
    payload: any;
    previousHash: string | null;
    privateKey: Uint8Array;
    timestamp?: Date;
    payloadType?: number;
}

export interface InitOptions {
    wasmUrl?: string;
    wasmPath?: string;
    enableWorker?: boolean;
    enableIndexedDB?: boolean;
    enableFileSystem?: boolean;
    enableNetwork?: boolean;
    maxThreads?: number;
}

// Extension types
export namespace extensions {
    export interface LocationData {
        latitude: number;
        longitude: number;
        altitude?: number;
        accuracy: number;
        timestamp: Date;
    }

    export interface StorageOptions {
        backend: 'memory' | 'indexeddb' | 'localstorage';
        databaseName?: string;
        compress?: boolean;
    }

    export interface PrivacyOptions {
        technique: 'k-anonymity' | 'differential-privacy' | 'obfuscation';
        k?: number;
        epsilon?: number;
        delta?: number;
    }
}

// Error types
export class OlocusError extends Error {
    constructor(
        message: string, 
        public readonly code: number
    ) {
        super(message);
        this.name = 'OlocusError';
    }
}

export class InvalidSignatureError extends OlocusError {
    constructor(message: string) {
        super(message, 1001);
        this.name = 'InvalidSignatureError';
    }
}

export class InvalidHashError extends OlocusError {
    constructor(message: string) {
        super(message, 1002);
        this.name = 'InvalidHashError';
    }
}
```

### Error Handling

```typescript
import { 
    OlocusError,
    InvalidSignatureError,
    InvalidHashError,
    NetworkError 
} from '@olocus/protocol';

async function errorHandlingExample() {
    try {
        const invalidBlock = await createGenesisBlock({
            payload: null, // invalid
            privateKey: new Uint8Array([]), // invalid
            timestamp: new Date()
        });
    } catch (error) {
        if (error instanceof InvalidSignatureError) {
            console.error(`Signature error: ${error.message} (${error.code})`);
        } else if (error instanceof InvalidHashError) {
            console.error(`Hash error: ${error.message} (${error.code})`);
        } else if (error instanceof NetworkError) {
            console.error(`Network error: ${error.message} (${error.code})`);
        } else if (error instanceof OlocusError) {
            console.error(`Olocus error: ${error.message} (${error.code})`);
        } else {
            console.error('Unknown error:', error);
        }
    }
}
```

## Best Practices

### Memory Management

**Python:**
```python
# Use context managers for automatic cleanup
with olocus.BlockManager() as manager:
    block = manager.create_block(payload)
    # Automatically cleaned up on exit

# Or explicit cleanup
try:
    block = olocus.create_block(payload)
    # Use block
finally:
    block.free()  # Explicit cleanup
```

**Go:**
```go
// Always use defer for cleanup
func processBlock() error {
    block, err := olocus.CreateBlock(payload)
    if err != nil {
        return err
    }
    defer block.Free()  // Guaranteed cleanup
    
    // Process block
    return nil
}
```

**TypeScript:**
```typescript
// WASM automatically manages memory
// But clean up large objects explicitly
async function processLargeDataset(data: any[]) {
    const blocks = [];
    
    try {
        for (const item of data) {
            const block = await createBlock({...});
            blocks.push(block);
        }
        
        // Process blocks
        return processResults(blocks);
    } finally {
        // Clean up if needed
        blocks.forEach(block => block.free?.());
    }
}
```

### Performance Tips

1. **Batch Operations**: Process multiple blocks together
2. **Connection Pooling**: Reuse network connections
3. **Caching**: Cache verification results
4. **Async Processing**: Use async APIs for I/O
5. **Memory Limits**: Monitor memory usage in long-running processes

### Security Considerations

1. **Key Management**: Never log or expose private keys
2. **Input Validation**: Validate all inputs before processing
3. **Secure Storage**: Use platform keychain/keystore
4. **Network Security**: Always use TLS for network communication
5. **Error Handling**: Don't leak sensitive information in error messages

### Testing Strategies

1. **Unit Tests**: Test individual functions
2. **Integration Tests**: Test end-to-end workflows
3. **Property Tests**: Test invariants and edge cases
4. **Performance Tests**: Benchmark critical operations
5. **Security Tests**: Test against known attack vectors

## Platform-Specific Notes

### Python
- **Thread Safety**: Use threading locks for concurrent access
- **Virtual Environments**: Install in isolated environments
- **C Extensions**: May require compilation on some platforms
- **Memory**: Monitor memory usage with memory profilers

### Go
- **CGO**: Required for FFI binding
- **Cross Compilation**: May be limited due to C dependencies
- **Garbage Collection**: Minimal impact due to explicit resource management
- **Concurrency**: Safe for use with goroutines

### TypeScript/JavaScript
- **Browser Support**: Requires WebAssembly support (>95% coverage)
- **Bundle Size**: WASM adds ~500KB to bundle
- **Worker Support**: Use Web Workers for CPU-intensive operations
- **Node.js**: Requires Node.js 14+ for WebAssembly support

## Support and Resources

### Documentation
- [Python SDK Documentation](https://docs.olocus.dev/sdk/python)
- [Go SDK Documentation](https://docs.olocus.dev/sdk/go)
- [TypeScript SDK Documentation](https://docs.olocus.dev/sdk/typescript)

### Examples
- [Python Examples](https://codeberg.org/olocus/olocus-python/src/branch/main/examples)
- [Go Examples](https://codeberg.org/olocus/olocus-go/src/branch/main/examples)
- [TypeScript Examples](https://codeberg.org/olocus/olocus-typescript/src/branch/main/examples)

### Community
- [Codeberg Forum](https://codeberg.org/olocus/forum/issues)
- [Discord Community](https://discord.gg/olocus)
- [Stack Overflow](https://stackoverflow.com/questions/tagged/olocus)

### Getting Help

1. **Check Documentation**: Start with language-specific docs
2. **Search Issues**: Look for similar problems on Codeberg
3. **Ask Questions**: Use Codeberg Forum or Stack Overflow
4. **Report Bugs**: Create detailed issue reports
5. **Contribute**: Submit PRs for improvements

## Migration Guide

### From Native Rust
```rust
// Old: Direct Rust usage
use olocus_core::{Block, Keypair};

let keypair = Keypair::generate();
let block = Block::new_genesis(payload, &keypair)?;
```

```python
# New: Python SDK
import olocus

keypair = olocus.generate_keypair()
block = olocus.create_genesis_block(payload, keypair.private_key)
```

### From HTTP API
```bash
# Old: HTTP API
curl -X POST /blocks -d '{"payload": "data"}'
```

```typescript
// New: Direct SDK
const block = await createGenesisBlock({
    payload: "data",
    privateKey: keypair.privateKey
});
```

Language SDKs provide a more efficient, type-safe, and feature-rich alternative to HTTP APIs while maintaining the same core functionality.