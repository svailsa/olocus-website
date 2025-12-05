---
id: web
title: Web Integration
sidebar_position: 3
---

# Web Integration

Integrate Olocus Protocol into web applications using WebAssembly (WASM). This guide covers compilation, JavaScript bindings, browser compatibility, and performance optimization for modern web applications.

## Prerequisites

- Rust toolchain with `wasm-pack` installed
- Node.js 16+ or modern browser with WebAssembly support
- Basic knowledge of JavaScript/TypeScript and WebAssembly

## Installation

### Install wasm-pack

```bash
# Install wasm-pack
curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf | sh

# Or via npm
npm install -g wasm-pack

# Or via cargo
cargo install wasm-pack
```

### Build WebAssembly Package

```bash
cd olocus-protocol

# Build for bundlers (Webpack, Rollup, etc.)
wasm-pack build extensions/olocus-ffi --target bundler --features wasm

# Build for browsers (with ES modules)
wasm-pack build extensions/olocus-ffi --target web --features wasm

# Build for Node.js
wasm-pack build extensions/olocus-ffi --target nodejs --features wasm

# Build with optimizations for production
wasm-pack build extensions/olocus-ffi --target bundler --features wasm --release
```

This generates a `pkg/` directory with:
- `olocus_ffi.wasm` - The WebAssembly binary
- `olocus_ffi.js` - JavaScript bindings
- `olocus_ffi.d.ts` - TypeScript definitions
- `package.json` - NPM package metadata

## JavaScript Integration

### Basic Setup

```javascript
// For bundlers (Webpack, Vite, etc.)
import init, * as olocus from './pkg/olocus_ffi.js';

// Initialize WebAssembly module
async function initializeOlocus() {
    await init();
    
    // Initialize the library
    const result = olocus.init();
    if (result !== 0) {
        throw new Error(`Failed to initialize Olocus: ${olocus.get_last_error_message()}`);
    }
    
    console.log('Olocus initialized successfully');
    return olocus;
}

// Usage
initializeOlocus().then(olocus => {
    // Use Olocus functions
    const keypair = olocus.keypair_generate();
    console.log('Generated keypair:', keypair);
}).catch(error => {
    console.error('Initialization failed:', error);
});
```

### ES Modules (Modern Browsers)

```html
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Olocus Web Demo</title>
</head>
<body>
    <script type="module">
        import init, * as olocus from './pkg/olocus_ffi.js';
        
        async function main() {
            await init();
            
            const config = olocus.config_create();
            olocus.config_set_platform_web(config, true);
            
            const result = olocus.init_with_config(config);
            olocus.config_destroy(config);
            
            if (result !== 0) {
                console.error('Initialization failed:', olocus.get_last_error_message());
                return;
            }
            
            // Create a genesis block
            const payload = new TextEncoder().encode('Hello, Web!');
            const keypair = olocus.keypair_generate();
            const privateKey = olocus.keypair_get_private_key_bytes(keypair);
            
            const block = olocus.block_create_genesis(
                Date.now(),
                payload,
                0, // payload type
                privateKey
            );
            
            console.log('Created genesis block:', {
                index: olocus.block_get_index(block),
                timestamp: olocus.block_get_timestamp(block),
                payloadType: olocus.block_get_payload_type(block)
            });
            
            // Serialize to JSON
            const jsonData = olocus.block_to_json(block);
            console.log('Block JSON:', jsonData);
            
            // Cleanup
            olocus.block_destroy(block);
            olocus.keypair_destroy(keypair);
        }
        
        main();
    </script>
</body>
</html>
```

### Node.js Integration

```javascript
// Node.js usage
const olocus = require('./pkg/olocus_ffi.js');

async function nodeExample() {
    // Initialize
    const result = olocus.init();
    if (result !== 0) {
        throw new Error(`Initialization failed: ${olocus.get_last_error_message()}`);
    }
    
    // Create chain
    const chain = olocus.chain_create();
    
    // Generate key
    const keypair = olocus.keypair_generate();
    const privateKey = olocus.keypair_get_private_key_bytes(keypair);
    
    // Create and add blocks
    for (let i = 0; i < 5; i++) {
        const payload = Buffer.from(`Block ${i} payload`);
        
        let block;
        if (i === 0) {
            // Genesis block
            block = olocus.block_create_genesis(
                Date.now(),
                payload,
                0,
                privateKey
            );
        } else {
            // Regular block
            const lastBlock = olocus.chain_get_last_block(chain);
            const prevHash = olocus.block_get_hash_bytes(lastBlock);
            
            block = olocus.block_create(
                i,
                Date.now(),
                prevHash,
                payload,
                0,
                privateKey
            );
        }
        
        // Add to chain
        const addResult = olocus.chain_add_block(chain, block);
        if (addResult !== 0) {
            throw new Error(`Failed to add block: ${olocus.get_last_error_message()}`);
        }
        
        console.log(`Added block ${i}`);
    }
    
    // Verify chain
    const verifyResult = olocus.chain_verify(chain);
    console.log('Chain verification:', verifyResult === 0 ? 'PASSED' : 'FAILED');
    
    // Export chain
    const chainData = olocus.chain_to_json(chain);
    console.log('Chain length:', olocus.chain_get_length(chain));
    
    // Cleanup
    olocus.chain_destroy(chain);
    olocus.keypair_destroy(keypair);
    olocus.shutdown();
}

nodeExample().catch(console.error);
```

## TypeScript Integration

### Type Definitions

```typescript
// types/olocus.d.ts
declare module 'olocus-wasm' {
    // Initialization
    export function init(): number;
    export function init_with_config(config: Config): number;
    export function shutdown(): number;
    export function is_initialized(): boolean;
    
    // Configuration
    export class Config {
        free(): void;
        set_platform_web(enabled: boolean): void;
        set_network_enabled(enabled: boolean): void;
    }
    
    export function config_create(): Config;
    export function config_destroy(config: Config): void;
    
    // Key management
    export class KeyPair {
        free(): void;
        get_public_key_bytes(): Uint8Array;
        get_private_key_bytes(): Uint8Array;
    }
    
    export function keypair_generate(): KeyPair;
    export function keypair_from_bytes(privateKey: Uint8Array): KeyPair;
    export function keypair_destroy(keypair: KeyPair): void;
    
    // Block operations
    export class Block {
        free(): void;
        get_index(): number;
        get_timestamp(): number;
        get_payload_type(): number;
        get_hash_bytes(): Uint8Array;
        verify(): number;
        to_json(): string;
        to_wire_format(format: WireFormat): Uint8Array;
    }
    
    export function block_create_genesis(
        timestamp: number,
        payload: Uint8Array,
        payloadType: number,
        signingKey: Uint8Array
    ): Block;
    
    export function block_create(
        index: number,
        timestamp: number,
        previousHash: Uint8Array,
        payload: Uint8Array,
        payloadType: number,
        signingKey: Uint8Array
    ): Block;
    
    export function block_from_json(json: string): Block;
    export function block_from_wire_format(data: Uint8Array, format: WireFormat): Block;
    
    // Chain operations
    export class Chain {
        free(): void;
        add_block(block: Block): number;
        get_length(): number;
        is_empty(): boolean;
        get_block(index: number): Block | null;
        get_last_block(): Block | null;
        verify(): number;
        to_json(): string;
    }
    
    export function chain_create(): Chain;
    export function chain_create_with_limit(limit: number): Chain;
    
    // Wire format
    export class WireFormat {
        free(): void;
        get_content_type(): string;
    }
    
    export function wire_format_binary(): WireFormat;
    export function wire_format_json(): WireFormat;
    export function wire_format_msgpack(): WireFormat;
    export function wire_format_new(encoding: number, compression: number): WireFormat;
    export function wire_format_from_content_type(contentType: string): WireFormat | null;
    
    // Cryptographic operations
    export function sign(keypair: KeyPair, message: Uint8Array): Uint8Array;
    export function verify(publicKey: Uint8Array, message: Uint8Array, signature: Uint8Array): number;
    export function hash_sha256(data: Uint8Array): Uint8Array;
    export function random_bytes(length: number): Uint8Array;
    export function hkdf_derive(
        inputKey: Uint8Array,
        salt: Uint8Array,
        info: Uint8Array,
        outputLength: number
    ): Uint8Array;
    
    // Error handling
    export function get_last_error_code(): number;
    export function get_last_error_message(): string | null;
    export function clear_error(): void;
    
    // Constants
    export const enum EncodingFormat {
        Binary = 0,
        Json = 1,
        MessagePack = 2,
        Protobuf = 3,
        Ssz = 4
    }
    
    export const enum CompressionMethod {
        None = 0,
        Zstd = 1,
        Lz4 = 2,
        Gzip = 3
    }
}
```

### TypeScript Wrapper Class

```typescript
// olocus-manager.ts
import init, * as olocus from 'olocus-wasm';

export interface OlocusConfig {
    networkEnabled?: boolean;
    wasmPath?: string;
}

export interface BlockData {
    index: number;
    timestamp: number;
    payloadType: number;
    hash: Uint8Array;
    payload: Uint8Array;
}

export interface ChainInfo {
    length: number;
    isEmpty: boolean;
    lastBlock?: BlockData;
}

export class OlocusManager {
    private static instance: OlocusManager | null = null;
    private initialized = false;
    private chain: olocus.Chain | null = null;
    private keyPair: olocus.KeyPair | null = null;
    
    private constructor() {}
    
    static async getInstance(config: OlocusConfig = {}): Promise<OlocusManager> {
        if (!OlocusManager.instance) {
            OlocusManager.instance = new OlocusManager();
            await OlocusManager.instance.initialize(config);
        }
        return OlocusManager.instance;
    }
    
    private async initialize(config: OlocusConfig): Promise<void> {
        if (this.initialized) return;
        
        // Initialize WASM module
        if (config.wasmPath) {
            await init(config.wasmPath);
        } else {
            await init();
        }
        
        // Create configuration
        const olocusConfig = olocus.config_create();
        try {
            olocusConfig.set_platform_web(true);
            olocusConfig.set_network_enabled(config.networkEnabled ?? true);
            
            const result = olocus.init_with_config(olocusConfig);
            if (result !== 0) {
                throw new Error(`Failed to initialize Olocus: ${olocus.get_last_error_message()}`);
            }
            
            // Create chain and keypair
            this.chain = olocus.chain_create();
            this.keyPair = olocus.keypair_generate();
            this.initialized = true;
            
        } finally {
            olocus.config_destroy(olocusConfig);
        }
    }
    
    async createGenesisBlock(payload: Uint8Array, payloadType: number = 0): Promise<BlockData> {
        this.ensureInitialized();
        
        const privateKey = this.keyPair!.get_private_key_bytes();
        const block = olocus.block_create_genesis(
            Date.now(),
            payload,
            payloadType,
            privateKey
        );
        
        try {
            return this.extractBlockData(block);
        } finally {
            block.free();
        }
    }
    
    async createBlock(payload: Uint8Array, payloadType: number = 0): Promise<BlockData> {
        this.ensureInitialized();
        
        const chainLength = this.chain!.get_length();
        if (chainLength === 0) {
            throw new Error('Cannot create regular block on empty chain. Use createGenesisBlock first.');
        }
        
        const lastBlock = this.chain!.get_last_block();
        if (!lastBlock) {
            throw new Error('Failed to get last block from chain');
        }
        
        try {
            const previousHash = lastBlock.get_hash_bytes();
            const privateKey = this.keyPair!.get_private_key_bytes();
            
            const block = olocus.block_create(
                chainLength,
                Date.now(),
                previousHash,
                payload,
                payloadType,
                privateKey
            );
            
            try {
                return this.extractBlockData(block);
            } finally {
                block.free();
            }
        } finally {
            lastBlock.free();
        }
    }
    
    async addBlock(blockData: BlockData): Promise<void> {
        this.ensureInitialized();
        
        // Recreate block from data
        // This is a simplified approach - in practice you'd store the block differently
        const block = this.recreateBlock(blockData);
        try {
            const result = this.chain!.add_block(block);
            if (result !== 0) {
                throw new Error(`Failed to add block: ${olocus.get_last_error_message()}`);
            }
        } finally {
            block.free();
        }
    }
    
    async verifyChain(): Promise<boolean> {
        this.ensureInitialized();
        return this.chain!.verify() === 0;
    }
    
    getChainInfo(): ChainInfo {
        this.ensureInitialized();
        
        const length = this.chain!.get_length();
        const isEmpty = this.chain!.is_empty();
        
        let lastBlock: BlockData | undefined;
        if (!isEmpty) {
            const block = this.chain!.get_last_block();
            if (block) {
                try {
                    lastBlock = this.extractBlockData(block);
                } finally {
                    block.free();
                }
            }
        }
        
        return { length, isEmpty, lastBlock };
    }
    
    exportChain(format: 'json' | 'binary' | 'msgpack' = 'json'): Uint8Array {
        this.ensureInitialized();
        
        let wireFormat: olocus.WireFormat;
        switch (format) {
            case 'json':
                wireFormat = olocus.wire_format_json();
                break;
            case 'binary':
                wireFormat = olocus.wire_format_binary();
                break;
            case 'msgpack':
                wireFormat = olocus.wire_format_msgpack();
                break;
            default:
                throw new Error(`Unsupported format: ${format}`);
        }
        
        try {
            // Export each block and combine
            const length = this.chain!.get_length();
            const blocks: Uint8Array[] = [];
            
            for (let i = 0; i < length; i++) {
                const block = this.chain!.get_block(i);
                if (block) {
                    try {
                        const blockData = block.to_wire_format(wireFormat);
                        blocks.push(blockData);
                    } finally {
                        block.free();
                    }
                }
            }
            
            return this.combineBlocks(blocks);
        } finally {
            wireFormat.free();
        }
    }
    
    signData(data: Uint8Array): Uint8Array {
        this.ensureInitialized();
        return olocus.sign(this.keyPair!, data);
    }
    
    verifySignature(data: Uint8Array, signature: Uint8Array, publicKey?: Uint8Array): boolean {
        this.ensureInitialized();
        
        const pubKey = publicKey || this.keyPair!.get_public_key_bytes();
        return olocus.verify(pubKey, data, signature) === 0;
    }
    
    generateRandomBytes(length: number): Uint8Array {
        this.ensureInitialized();
        return olocus.random_bytes(length);
    }
    
    hashData(data: Uint8Array): Uint8Array {
        return olocus.hash_sha256(data);
    }
    
    destroy(): void {
        if (this.chain) {
            this.chain.free();
            this.chain = null;
        }
        
        if (this.keyPair) {
            this.keyPair.free();
            this.keyPair = null;
        }
        
        if (this.initialized) {
            olocus.shutdown();
            this.initialized = false;
        }
        
        OlocusManager.instance = null;
    }
    
    private ensureInitialized(): void {
        if (!this.initialized) {
            throw new Error('OlocusManager not initialized');
        }
    }
    
    private extractBlockData(block: olocus.Block): BlockData {
        return {
            index: block.get_index(),
            timestamp: block.get_timestamp(),
            payloadType: block.get_payload_type(),
            hash: block.get_hash_bytes(),
            payload: new Uint8Array() // Would need to extract payload from serialized data
        };
    }
    
    private recreateBlock(blockData: BlockData): olocus.Block {
        // This is a placeholder - you'd need to store the full block data
        // or recreate it from the stored information
        throw new Error('Block recreation not implemented');
    }
    
    private combineBlocks(blocks: Uint8Array[]): Uint8Array {
        // Simple concatenation with length prefixes
        let totalLength = 4; // 4 bytes for block count
        for (const block of blocks) {
            totalLength += 4 + block.length; // 4 bytes for length + block data
        }
        
        const result = new Uint8Array(totalLength);
        const view = new DataView(result.buffer);
        
        let offset = 0;
        
        // Write block count
        view.setUint32(offset, blocks.length, true);
        offset += 4;
        
        // Write blocks with length prefixes
        for (const block of blocks) {
            view.setUint32(offset, block.length, true);
            offset += 4;
            result.set(block, offset);
            offset += block.length;
        }
        
        return result;
    }
}

// Utility functions
export async function createOlocusManager(config?: OlocusConfig): Promise<OlocusManager> {
    return OlocusManager.getInstance(config);
}

export function encodeString(str: string): Uint8Array {
    return new TextEncoder().encode(str);
}

export function decodeString(data: Uint8Array): string {
    return new TextDecoder().decode(data);
}

export function bytesToHex(bytes: Uint8Array): string {
    return Array.from(bytes)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
}

export function hexToBytes(hex: string): Uint8Array {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < bytes.length; i++) {
        bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
    }
    return bytes;
}
```

## Web Workers Integration

### Worker Setup

```typescript
// olocus-worker.ts
import { createOlocusManager, OlocusManager } from './olocus-manager';

interface WorkerMessage {
    id: string;
    type: string;
    payload: any;
}

interface WorkerResponse {
    id: string;
    success: boolean;
    result?: any;
    error?: string;
}

let olocusManager: OlocusManager | null = null;

self.onmessage = async (event: MessageEvent<WorkerMessage>) => {
    const { id, type, payload } = event.data;
    
    try {
        let result: any;
        
        switch (type) {
            case 'initialize':
                olocusManager = await createOlocusManager(payload);
                result = { initialized: true };
                break;
                
            case 'createGenesisBlock':
                if (!olocusManager) throw new Error('Manager not initialized');
                result = await olocusManager.createGenesisBlock(
                    new Uint8Array(payload.payload),
                    payload.payloadType
                );
                break;
                
            case 'createBlock':
                if (!olocusManager) throw new Error('Manager not initialized');
                result = await olocusManager.createBlock(
                    new Uint8Array(payload.payload),
                    payload.payloadType
                );
                break;
                
            case 'addBlock':
                if (!olocusManager) throw new Error('Manager not initialized');
                await olocusManager.addBlock(payload);
                result = { added: true };
                break;
                
            case 'verifyChain':
                if (!olocusManager) throw new Error('Manager not initialized');
                result = { valid: await olocusManager.verifyChain() };
                break;
                
            case 'getChainInfo':
                if (!olocusManager) throw new Error('Manager not initialized');
                result = olocusManager.getChainInfo();
                break;
                
            case 'exportChain':
                if (!olocusManager) throw new Error('Manager not initialized');
                result = {
                    data: Array.from(olocusManager.exportChain(payload.format))
                };
                break;
                
            case 'signData':
                if (!olocusManager) throw new Error('Manager not initialized');
                result = {
                    signature: Array.from(olocusManager.signData(new Uint8Array(payload.data)))
                };
                break;
                
            case 'hashData':
                result = {
                    hash: Array.from(olocusManager!.hashData(new Uint8Array(payload.data)))
                };
                break;
                
            default:
                throw new Error(`Unknown message type: ${type}`);
        }
        
        const response: WorkerResponse = {
            id,
            success: true,
            result
        };
        
        self.postMessage(response);
        
    } catch (error) {
        const response: WorkerResponse = {
            id,
            success: false,
            error: error instanceof Error ? error.message : String(error)
        };
        
        self.postMessage(response);
    }
};
```

### Main Thread Wrapper

```typescript
// olocus-worker-client.ts
export class OlocusWorkerClient {
    private worker: Worker;
    private messageId = 0;
    private pendingMessages = new Map<string, { resolve: Function; reject: Function }>();
    
    constructor(workerScript: string) {
        this.worker = new Worker(workerScript, { type: 'module' });
        this.worker.onmessage = this.handleMessage.bind(this);
        this.worker.onerror = this.handleError.bind(this);
    }
    
    async initialize(config: any = {}): Promise<void> {
        await this.sendMessage('initialize', config);
    }
    
    async createGenesisBlock(payload: Uint8Array, payloadType: number = 0): Promise<any> {
        return this.sendMessage('createGenesisBlock', {
            payload: Array.from(payload),
            payloadType
        });
    }
    
    async createBlock(payload: Uint8Array, payloadType: number = 0): Promise<any> {
        return this.sendMessage('createBlock', {
            payload: Array.from(payload),
            payloadType
        });
    }
    
    async addBlock(blockData: any): Promise<void> {
        await this.sendMessage('addBlock', blockData);
    }
    
    async verifyChain(): Promise<boolean> {
        const result = await this.sendMessage('verifyChain', {});
        return result.valid;
    }
    
    async getChainInfo(): Promise<any> {
        return this.sendMessage('getChainInfo', {});
    }
    
    async exportChain(format: string = 'json'): Promise<Uint8Array> {
        const result = await this.sendMessage('exportChain', { format });
        return new Uint8Array(result.data);
    }
    
    async signData(data: Uint8Array): Promise<Uint8Array> {
        const result = await this.sendMessage('signData', {
            data: Array.from(data)
        });
        return new Uint8Array(result.signature);
    }
    
    async hashData(data: Uint8Array): Promise<Uint8Array> {
        const result = await this.sendMessage('hashData', {
            data: Array.from(data)
        });
        return new Uint8Array(result.hash);
    }
    
    destroy(): void {
        this.worker.terminate();
        
        // Reject all pending messages
        for (const { reject } of this.pendingMessages.values()) {
            reject(new Error('Worker terminated'));
        }
        this.pendingMessages.clear();
    }
    
    private sendMessage(type: string, payload: any): Promise<any> {
        return new Promise((resolve, reject) => {
            const id = String(++this.messageId);
            
            this.pendingMessages.set(id, { resolve, reject });
            
            this.worker.postMessage({
                id,
                type,
                payload
            });
            
            // Timeout after 30 seconds
            setTimeout(() => {
                if (this.pendingMessages.has(id)) {
                    this.pendingMessages.delete(id);
                    reject(new Error('Message timeout'));
                }
            }, 30000);
        });
    }
    
    private handleMessage(event: MessageEvent): void {
        const { id, success, result, error } = event.data;
        
        const pending = this.pendingMessages.get(id);
        if (!pending) {
            console.warn('Received response for unknown message ID:', id);
            return;
        }
        
        this.pendingMessages.delete(id);
        
        if (success) {
            pending.resolve(result);
        } else {
            pending.reject(new Error(error));
        }
    }
    
    private handleError(error: ErrorEvent): void {
        console.error('Worker error:', error);
        
        // Reject all pending messages
        for (const { reject } of this.pendingMessages.values()) {
            reject(new Error(`Worker error: ${error.message}`));
        }
        this.pendingMessages.clear();
    }
}
```

## React Integration

### React Hook

```typescript
// hooks/useOlocus.ts
import { useState, useEffect, useCallback, useRef } from 'react';
import { OlocusManager, createOlocusManager, BlockData } from '../olocus-manager';

interface UseOlocusState {
    manager: OlocusManager | null;
    initialized: boolean;
    loading: boolean;
    error: string | null;
    chainInfo: {
        length: number;
        isEmpty: boolean;
        lastBlock?: BlockData;
    } | null;
}

interface UseOlocusActions {
    initialize: () => Promise<void>;
    createGenesisBlock: (payload: string, payloadType?: number) => Promise<BlockData>;
    createBlock: (payload: string, payloadType?: number) => Promise<BlockData>;
    addBlock: (block: BlockData) => Promise<void>;
    verifyChain: () => Promise<boolean>;
    exportChain: (format?: 'json' | 'binary' | 'msgpack') => Uint8Array | null;
    signData: (data: string) => Uint8Array | null;
    refresh: () => void;
}

export function useOlocus(): UseOlocusState & UseOlocusActions {
    const [state, setState] = useState<UseOlocusState>({
        manager: null,
        initialized: false,
        loading: false,
        error: null,
        chainInfo: null
    });
    
    const managerRef = useRef<OlocusManager | null>(null);
    
    const initialize = useCallback(async () => {
        if (state.initialized) return;
        
        setState(prev => ({ ...prev, loading: true, error: null }));
        
        try {
            const manager = await createOlocusManager({
                networkEnabled: true
            });
            
            managerRef.current = manager;
            
            setState(prev => ({
                ...prev,
                manager,
                initialized: true,
                loading: false,
                chainInfo: manager.getChainInfo()
            }));
        } catch (error) {
            setState(prev => ({
                ...prev,
                loading: false,
                error: error instanceof Error ? error.message : String(error)
            }));
        }
    }, [state.initialized]);
    
    const createGenesisBlock = useCallback(async (
        payload: string,
        payloadType: number = 0
    ): Promise<BlockData> => {
        if (!managerRef.current) {
            throw new Error('Manager not initialized');
        }
        
        const payloadBytes = new TextEncoder().encode(payload);
        const block = await managerRef.current.createGenesisBlock(payloadBytes, payloadType);
        
        // Update chain info
        setState(prev => ({
            ...prev,
            chainInfo: managerRef.current!.getChainInfo()
        }));
        
        return block;
    }, []);
    
    const createBlock = useCallback(async (
        payload: string,
        payloadType: number = 0
    ): Promise<BlockData> => {
        if (!managerRef.current) {
            throw new Error('Manager not initialized');
        }
        
        const payloadBytes = new TextEncoder().encode(payload);
        const block = await managerRef.current.createBlock(payloadBytes, payloadType);
        
        setState(prev => ({
            ...prev,
            chainInfo: managerRef.current!.getChainInfo()
        }));
        
        return block;
    }, []);
    
    const addBlock = useCallback(async (block: BlockData): Promise<void> => {
        if (!managerRef.current) {
            throw new Error('Manager not initialized');
        }
        
        await managerRef.current.addBlock(block);
        
        setState(prev => ({
            ...prev,
            chainInfo: managerRef.current!.getChainInfo()
        }));
    }, []);
    
    const verifyChain = useCallback(async (): Promise<boolean> => {
        if (!managerRef.current) {
            throw new Error('Manager not initialized');
        }
        
        return managerRef.current.verifyChain();
    }, []);
    
    const exportChain = useCallback((
        format: 'json' | 'binary' | 'msgpack' = 'json'
    ): Uint8Array | null => {
        if (!managerRef.current) return null;
        return managerRef.current.exportChain(format);
    }, []);
    
    const signData = useCallback((data: string): Uint8Array | null => {
        if (!managerRef.current) return null;
        const dataBytes = new TextEncoder().encode(data);
        return managerRef.current.signData(dataBytes);
    }, []);
    
    const refresh = useCallback(() => {
        if (managerRef.current) {
            setState(prev => ({
                ...prev,
                chainInfo: managerRef.current!.getChainInfo()
            }));
        }
    }, []);
    
    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (managerRef.current) {
                managerRef.current.destroy();
                managerRef.current = null;
            }
        };
    }, []);
    
    return {
        ...state,
        initialize,
        createGenesisBlock,
        createBlock,
        addBlock,
        verifyChain,
        exportChain,
        signData,
        refresh
    };
}
```

### React Component Example

```tsx
// components/OlocusDemo.tsx
import React, { useState, useEffect } from 'react';
import { useOlocus } from '../hooks/useOlocus';
import { bytesToHex } from '../olocus-manager';

export const OlocusDemo: React.FC = () => {
    const {
        initialized,
        loading,
        error,
        chainInfo,
        initialize,
        createGenesisBlock,
        createBlock,
        verifyChain,
        exportChain,
        signData
    } = useOlocus();
    
    const [payload, setPayload] = useState('Hello, Olocus!');
    const [isVerifying, setIsVerifying] = useState(false);
    const [verificationResult, setVerificationResult] = useState<boolean | null>(null);
    const [signature, setSignature] = useState<string | null>(null);
    
    useEffect(() => {
        initialize();
    }, [initialize]);
    
    const handleCreateGenesisBlock = async () => {
        try {
            const block = await createGenesisBlock(payload);
            console.log('Created genesis block:', block);
        } catch (err) {
            console.error('Failed to create genesis block:', err);
        }
    };
    
    const handleCreateBlock = async () => {
        try {
            const block = await createBlock(payload);
            console.log('Created block:', block);
        } catch (err) {
            console.error('Failed to create block:', err);
        }
    };
    
    const handleVerifyChain = async () => {
        setIsVerifying(true);
        try {
            const result = await verifyChain();
            setVerificationResult(result);
        } catch (err) {
            console.error('Failed to verify chain:', err);
            setVerificationResult(false);
        } finally {
            setIsVerifying(false);
        }
    };
    
    const handleExportChain = () => {
        try {
            const chainData = exportChain('json');
            if (chainData) {
                const blob = new Blob([chainData], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'olocus-chain.json';
                a.click();
                URL.revokeObjectURL(url);
            }
        } catch (err) {
            console.error('Failed to export chain:', err);
        }
    };
    
    const handleSignData = () => {
        try {
            const signatureBytes = signData(payload);
            if (signatureBytes) {
                setSignature(bytesToHex(signatureBytes));
            }
        } catch (err) {
            console.error('Failed to sign data:', err);
        }
    };
    
    if (loading) {
        return <div className="loading">Initializing Olocus...</div>;
    }
    
    if (error) {
        return (
            <div className="error">
                <h3>Error</h3>
                <p>{error}</p>
                <button onClick={() => initialize()}>Retry</button>
            </div>
        );
    }
    
    if (!initialized) {
        return (
            <div className="not-initialized">
                <button onClick={() => initialize()}>Initialize Olocus</button>
            </div>
        );
    }
    
    return (
        <div className="olocus-demo">
            <h2>Olocus WebAssembly Demo</h2>
            
            <div className="chain-info">
                <h3>Chain Information</h3>
                <p>Length: {chainInfo?.length ?? 0}</p>
                <p>Empty: {chainInfo?.isEmpty ? 'Yes' : 'No'}</p>
                {chainInfo?.lastBlock && (
                    <div>
                        <h4>Last Block</h4>
                        <p>Index: {chainInfo.lastBlock.index}</p>
                        <p>Timestamp: {new Date(chainInfo.lastBlock.timestamp).toLocaleString()}</p>
                        <p>Hash: {bytesToHex(chainInfo.lastBlock.hash)}</p>
                    </div>
                )}
            </div>
            
            <div className="controls">
                <div className="input-group">
                    <label htmlFor="payload">Payload:</label>
                    <input
                        id="payload"
                        type="text"
                        value={payload}
                        onChange={(e) => setPayload(e.target.value)}
                        placeholder="Enter block payload"
                    />
                </div>
                
                <div className="buttons">
                    <button
                        onClick={handleCreateGenesisBlock}
                        disabled={!chainInfo?.isEmpty}
                    >
                        Create Genesis Block
                    </button>
                    
                    <button
                        onClick={handleCreateBlock}
                        disabled={chainInfo?.isEmpty}
                    >
                        Create Block
                    </button>
                    
                    <button
                        onClick={handleVerifyChain}
                        disabled={isVerifying || chainInfo?.isEmpty}
                    >
                        {isVerifying ? 'Verifying...' : 'Verify Chain'}
                    </button>
                    
                    <button
                        onClick={handleExportChain}
                        disabled={chainInfo?.isEmpty}
                    >
                        Export Chain
                    </button>
                    
                    <button onClick={handleSignData}>
                        Sign Data
                    </button>
                </div>
            </div>
            
            {verificationResult !== null && (
                <div className={`verification-result ${verificationResult ? 'valid' : 'invalid'}`}>
                    Chain is {verificationResult ? 'VALID' : 'INVALID'}
                </div>
            )}
            
            {signature && (
                <div className="signature-result">
                    <h4>Signature</h4>
                    <code>{signature}</code>
                </div>
            )}
        </div>
    );
};
```

## Performance Optimization

### Build Optimization

```toml
# Cargo.toml optimization
[profile.release]
codegen-units = 1
lto = true
opt-level = "z"
strip = true

[profile.release.package.olocus-ffi]
opt-level = 3
```

### Bundle Size Optimization

```bash
# Optimize WASM size
wasm-pack build --release --target web --out-dir pkg-optimized
wasm-opt -Oz pkg-optimized/olocus_ffi_bg.wasm -o pkg-optimized/olocus_ffi_bg.wasm

# Use wee_alloc for smaller memory footprint
cargo build --release --target wasm32-unknown-unknown --features wasm,wee_alloc
```

### Lazy Loading

```typescript
// lazy-olocus.ts
let olocusPromise: Promise<typeof import('olocus-wasm')> | null = null;

export async function loadOlocus() {
    if (!olocusPromise) {
        olocusPromise = import('olocus-wasm');
    }
    return olocusPromise;
}

export async function createLazyOlocusManager(config?: any) {
    const olocus = await loadOlocus();
    await olocus.default(); // Initialize WASM
    
    // Initialize library
    const result = olocus.init();
    if (result !== 0) {
        throw new Error(`Failed to initialize: ${olocus.get_last_error_message()}`);
    }
    
    return olocus;
}
```

## Browser Compatibility

### Feature Detection

```javascript
// compatibility.js
export function checkWebAssemblySupport() {
    if (typeof WebAssembly === 'undefined') {
        return {
            supported: false,
            reason: 'WebAssembly not supported'
        };
    }
    
    // Check for required features
    if (typeof WebAssembly.instantiate !== 'function') {
        return {
            supported: false,
            reason: 'WebAssembly.instantiate not supported'
        };
    }
    
    // Check for BigInt support (if needed)
    if (typeof BigInt === 'undefined') {
        return {
            supported: false,
            reason: 'BigInt not supported'
        };
    }
    
    return { supported: true };
}

export function loadWithFallback() {
    const support = checkWebAssemblySupport();
    
    if (!support.supported) {
        console.warn('WebAssembly not supported:', support.reason);
        // Load JavaScript fallback implementation
        return import('./fallback/olocus-js.js');
    }
    
    return import('olocus-wasm');
}
```

### Polyfill Support

```html
<!-- For older browsers -->
<script src="https://unpkg.com/@webassembly/wasm-polyfill@1.0.0/wasm-polyfill.js"></script>
<script>
    // Feature detection and polyfill loading
    if (!window.WebAssembly) {
        console.warn('WebAssembly not supported, using JavaScript fallback');
        // Load JS implementation
    }
</script>
```

## Best Practices

### Memory Management

1. **Always call `.free()`** on WASM objects when done
2. **Use try/finally blocks** to ensure cleanup
3. **Avoid long-lived references** to WASM objects
4. **Monitor memory usage** in production

### Error Handling

1. **Check return codes** from all WASM functions
2. **Use proper error boundaries** in React apps
3. **Provide fallbacks** for WASM failures
4. **Log errors** for debugging

### Performance

1. **Use Web Workers** for heavy operations
2. **Batch operations** when possible
3. **Optimize bundle size** with tree shaking
4. **Cache WASM modules** appropriately

## Troubleshooting

### Common Issues

1. **WASM module not loading**: Check file paths and CORS settings
2. **Memory access errors**: Ensure proper cleanup of WASM objects
3. **Performance issues**: Consider Web Workers for heavy computation
4. **Bundle size too large**: Use wasm-opt and code splitting
5. **Browser compatibility**: Implement feature detection and fallbacks
