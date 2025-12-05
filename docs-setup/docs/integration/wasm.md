---
id: wasm
title: WebAssembly Guide
sidebar_position: 5
---

# WebAssembly Guide

Detailed guide for building and optimizing Olocus Protocol as WebAssembly (WASM) for use in web browsers and Node.js environments. This covers build configuration, JavaScript API design, performance optimization, and deployment strategies.

## Prerequisites

- Rust 1.70+ with `wasm32-unknown-unknown` target
- `wasm-pack` for building and packaging
- Node.js 16+ for testing and tooling
- Modern browser with WebAssembly support

## Installation and Setup

### Install Required Tools

```bash
# Install Rust if not already installed
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Add WebAssembly target
rustup target add wasm32-unknown-unknown

# Install wasm-pack
curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf | sh
# or via cargo
cargo install wasm-pack

# Install additional optimization tools
cargo install wasm-opt
npm install -g wasm-opt
```

### Configure Cargo.toml for WASM

```toml
# extensions/olocus-ffi/Cargo.toml
[package]
name = "olocus-ffi"
version = "1.16.1"
edition = "2021"

[lib]
crate-type = ["cdylib", "rlib"]

[dependencies]
olocus-core = { path = "../olocus-core" }
wasm-bindgen = { version = "0.2", optional = true }
js-sys = { version = "0.3", optional = true }
web-sys = { version = "0.3", optional = true, features = [
  "console",
  "Performance",
  "Window",
  "Worker",
  "WorkerGlobalScope"
] }
wee_alloc = { version = "0.4", optional = true }
console_error_panic_hook = { version = "0.1", optional = true }
serde = { version = "1.0", features = ["derive"], optional = true }
serde-wasm-bindgen = { version = "0.4", optional = true }
gloo-utils = { version = "0.2", optional = true }

[features]
default = []
wasm = [
  "wasm-bindgen",
  "js-sys",
  "web-sys",
  "serde",
  "serde-wasm-bindgen",
  "gloo-utils",
  "console_error_panic_hook"
]
wee_alloc = ["dep:wee_alloc"]
debug = ["console_error_panic_hook"]

[profile.release]
codegen-units = 1
lto = true
opt-level = "z"  # Optimize for size
strip = "symbols"
panic = "abort"

[profile.dev]
opt-level = "s"  # Some optimization for faster builds
strip = "none"
```

## Building WebAssembly

### Basic Build Commands

```bash
cd extensions/olocus-ffi

# Build for bundlers (Webpack, Vite, etc.)
wasm-pack build --target bundler --features wasm

# Build for web (ES modules)
wasm-pack build --target web --features wasm

# Build for Node.js
wasm-pack build --target nodejs --features wasm

# Build with optimizations
wasm-pack build --target web --features wasm --release

# Build with size optimization
wasm-pack build --target web --features wasm,wee_alloc --release

# Build with debug features
wasm-pack build --target web --features wasm,debug --dev
```

### Advanced Build Script

```bash
#!/bin/bash
# build-wasm.sh

set -e

TARGET=${1:-"web"}
MODE=${2:-"release"}
FEATURES="wasm"

echo "Building Olocus WASM for target: $TARGET, mode: $MODE"

# Clean previous builds
rm -rf pkg pkg-*

# Add size optimizations for release
if [ "$MODE" = "release" ]; then
    FEATURES="$FEATURES,wee_alloc"
    EXTRA_ARGS="--release"
else
    FEATURES="$FEATURES,debug"
    EXTRA_ARGS="--dev"
fi

# Build with wasm-pack
wasm-pack build \
    --target "$TARGET" \
    --features "$FEATURES" \
    --out-dir "pkg-$TARGET" \
    $EXTRA_ARGS

# Post-process optimization
if [ "$MODE" = "release" ]; then
    echo "Optimizing WASM binary..."
    
    # Use wasm-opt for further size reduction
    if command -v wasm-opt >/dev/null 2>&1; then
        wasm-opt -Oz "pkg-$TARGET/olocus_ffi_bg.wasm" -o "pkg-$TARGET/olocus_ffi_bg.wasm"
        echo "Applied wasm-opt -Oz optimization"
    fi
    
    # Optional: Use wasm-snip to remove unused functions
    if command -v wasm-snip >/dev/null 2>&1; then
        wasm-snip "pkg-$TARGET/olocus_ffi_bg.wasm" \
            --snip-rust-fmt-code \
            --snip-rust-panicking-code \
            -o "pkg-$TARGET/olocus_ffi_bg.wasm"
        echo "Applied wasm-snip optimization"
    fi
fi

# Generate package.json with correct metadata
cat > "pkg-$TARGET/package.json" << EOF
{
  "name": "@olocus/wasm-$TARGET",
  "version": "1.16.1",
  "description": "Olocus Protocol WebAssembly bindings for $TARGET",
  "main": "olocus_ffi.js",
  "types": "olocus_ffi.d.ts",
  "files": [
    "olocus_ffi_bg.wasm",
    "olocus_ffi.js",
    "olocus_ffi.d.ts"
  ],
  "repository": {
    "type": "git",
    "url": "https://codeberg.org/olocus/protocol"
  },
  "keywords": ["blockchain", "crypto", "wasm", "olocus"],
  "license": "MIT",
  "sideEffects": false
EOF

# Add target-specific fields
if [ "$TARGET" = "web" ]; then
    cat >> "pkg-$TARGET/package.json" << EOF
,
  "module": "olocus_ffi.js",
  "types": "olocus_ffi.d.ts"
}
EOF
elif [ "$TARGET" = "nodejs" ]; then
    cat >> "pkg-$TARGET/package.json" << EOF
,
  "main": "olocus_ffi.js",
  "types": "olocus_ffi.d.ts"
}
EOF
else
    echo "}" >> "pkg-$TARGET/package.json"
fi

echo "Build complete! Output in pkg-$TARGET/"
echo "WASM size: $(du -h "pkg-$TARGET/olocus_ffi_bg.wasm" | cut -f1)"
```

## Rust WASM Implementation

### Core WASM Module Structure

```rust
// src/wasm.rs
use wasm_bindgen::prelude::*;
use js_sys::{Array, Uint8Array};
use web_sys::console;
use std::collections::HashMap;
use std::sync::Mutex;

// Import the Olocus core types
use olocus_core::{
    Block, Chain, KeyPair, CryptoSuite,
    wire::{WireFormat, EncodingFormat, CompressionMethod},
    error::OlocusError
};

// Global panic hook for better error messages
#[cfg(feature = "debug")]
#[wasm_bindgen(start)]
pub fn main() {
    console_error_panic_hook::set_once();
    console::log_1(&"Olocus WASM module initialized with debug features".into());
}

// Global allocator for smaller binary size
#[cfg(feature = "wee_alloc")]
#[global_allocator]
static ALLOC: wee_alloc::WeeAlloc = wee_alloc::WeeAlloc::INIT;

// Global state management
lazy_static::lazy_static! {
    static ref GLOBAL_STATE: Mutex<WasmState> = Mutex::new(WasmState::new());
}

struct WasmState {
    initialized: bool,
    keypairs: HashMap<u32, KeyPair>,
    blocks: HashMap<u32, Block>,
    chains: HashMap<u32, Chain>,
    next_id: u32,
}

impl WasmState {
    fn new() -> Self {
        Self {
            initialized: false,
            keypairs: HashMap::new(),
            blocks: HashMap::new(),
            chains: HashMap::new(),
            next_id: 1,
        }
    }
    
    fn next_id(&mut self) -> u32 {
        let id = self.next_id;
        self.next_id += 1;
        id
    }
}

// Error handling
#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(js_namespace = console)]
    fn error(s: &str);
}

macro_rules! console_error {
    ($($t:tt)*) => (error(&format_args!($($t)*).to_string()))
}

// Result type for WASM
#[wasm_bindgen]
pub struct WasmResult {
    success: bool,
    error_message: Option<String>,
    data: Option<Vec<u8>>,
}

#[wasm_bindgen]
impl WasmResult {
    #[wasm_bindgen(getter)]
    pub fn success(&self) -> bool {
        self.success
    }
    
    #[wasm_bindgen(getter)]
    pub fn error_message(&self) -> Option<String> {
        self.error_message.clone()
    }
    
    #[wasm_bindgen(getter)]
    pub fn data(&self) -> Option<Vec<u8>> {
        self.data.clone()
    }
}

impl WasmResult {
    fn success(data: Option<Vec<u8>>) -> Self {
        Self {
            success: true,
            error_message: None,
            data,
        }
    }
    
    fn error(message: &str) -> Self {
        Self {
            success: false,
            error_message: Some(message.to_string()),
            data: None,
        }
    }
    
    fn from_result<T>(result: Result<T, OlocusError>, data_fn: impl FnOnce(T) -> Option<Vec<u8>>) -> Self {
        match result {
            Ok(value) => Self::success(data_fn(value)),
            Err(e) => Self::error(&e.to_string()),
        }
    }
}

// Initialization and configuration
#[wasm_bindgen]
pub fn init() -> WasmResult {
    let mut state = GLOBAL_STATE.lock().unwrap();
    
    if state.initialized {
        return WasmResult::error("Already initialized");
    }
    
    // Initialize the core library
    match olocus_core::init() {
        Ok(_) => {
            state.initialized = true;
            WasmResult::success(None)
        }
        Err(e) => WasmResult::error(&e.to_string())
    }
}

#[wasm_bindgen]
pub fn shutdown() {
    let mut state = GLOBAL_STATE.lock().unwrap();
    
    // Clear all stored objects
    state.keypairs.clear();
    state.blocks.clear();
    state.chains.clear();
    state.initialized = false;
    
    olocus_core::shutdown();
}

#[wasm_bindgen]
pub fn is_initialized() -> bool {
    let state = GLOBAL_STATE.lock().unwrap();
    state.initialized
}

#[wasm_bindgen]
pub fn get_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

// Key management
#[wasm_bindgen]
pub fn keypair_generate() -> u32 {
    let mut state = GLOBAL_STATE.lock().unwrap();
    
    if !state.initialized {
        return 0; // Error: not initialized
    }
    
    match KeyPair::generate(CryptoSuite::Ed25519) {
        Ok(keypair) => {
            let id = state.next_id();
            state.keypairs.insert(id, keypair);
            id
        }
        Err(_) => 0 // Error
    }
}

#[wasm_bindgen]
pub fn keypair_from_bytes(private_key: &[u8]) -> u32 {
    let mut state = GLOBAL_STATE.lock().unwrap();
    
    if !state.initialized {
        return 0;
    }
    
    if private_key.len() != 32 {
        return 0;
    }
    
    let mut key_array = [0u8; 32];
    key_array.copy_from_slice(private_key);
    
    match KeyPair::from_private_key(CryptoSuite::Ed25519, &key_array) {
        Ok(keypair) => {
            let id = state.next_id();
            state.keypairs.insert(id, keypair);
            id
        }
        Err(_) => 0
    }
}

#[wasm_bindgen]
pub fn keypair_get_public_key(keypair_id: u32) -> Option<Vec<u8>> {
    let state = GLOBAL_STATE.lock().unwrap();
    
    state.keypairs.get(&keypair_id)
        .map(|kp| kp.public_key().to_vec())
}

#[wasm_bindgen]
pub fn keypair_get_private_key(keypair_id: u32) -> Option<Vec<u8>> {
    let state = GLOBAL_STATE.lock().unwrap();
    
    state.keypairs.get(&keypair_id)
        .map(|kp| kp.private_key().to_vec())
}

#[wasm_bindgen]
pub fn keypair_destroy(keypair_id: u32) -> bool {
    let mut state = GLOBAL_STATE.lock().unwrap();
    state.keypairs.remove(&keypair_id).is_some()
}

// Block operations
#[wasm_bindgen]
pub fn block_create_genesis(
    timestamp: f64,
    payload: &[u8],
    payload_type: u32,
    signing_key: &[u8]
) -> u32 {
    let mut state = GLOBAL_STATE.lock().unwrap();
    
    if !state.initialized {
        return 0;
    }
    
    if signing_key.len() != 32 {
        return 0;
    }
    
    let mut key_array = [0u8; 32];
    key_array.copy_from_slice(signing_key);
    
    let keypair = match KeyPair::from_private_key(CryptoSuite::Ed25519, &key_array) {
        Ok(kp) => kp,
        Err(_) => return 0,
    };
    
    match Block::create_genesis(
        timestamp as i64,
        payload.to_vec(),
        payload_type,
        &keypair
    ) {
        Ok(block) => {
            let id = state.next_id();
            state.blocks.insert(id, block);
            id
        }
        Err(_) => 0
    }
}

#[wasm_bindgen]
pub fn block_create(
    index: u64,
    timestamp: f64,
    previous_hash: &[u8],
    payload: &[u8],
    payload_type: u32,
    signing_key: &[u8]
) -> u32 {
    let mut state = GLOBAL_STATE.lock().unwrap();
    
    if !state.initialized {
        return 0;
    }
    
    if previous_hash.len() != 32 || signing_key.len() != 32 {
        return 0;
    }
    
    let mut hash_array = [0u8; 32];
    hash_array.copy_from_slice(previous_hash);
    
    let mut key_array = [0u8; 32];
    key_array.copy_from_slice(signing_key);
    
    let keypair = match KeyPair::from_private_key(CryptoSuite::Ed25519, &key_array) {
        Ok(kp) => kp,
        Err(_) => return 0,
    };
    
    match Block::create(
        index,
        timestamp as i64,
        &hash_array,
        payload.to_vec(),
        payload_type,
        &keypair
    ) {
        Ok(block) => {
            let id = state.next_id();
            state.blocks.insert(id, block);
            id
        }
        Err(_) => 0
    }
}

#[wasm_bindgen]
pub fn block_verify(block_id: u32) -> bool {
    let state = GLOBAL_STATE.lock().unwrap();
    
    state.blocks.get(&block_id)
        .map(|block| block.verify().is_ok())
        .unwrap_or(false)
}

#[wasm_bindgen]
pub fn block_get_index(block_id: u32) -> Option<u64> {
    let state = GLOBAL_STATE.lock().unwrap();
    state.blocks.get(&block_id).map(|b| b.index())
}

#[wasm_bindgen]
pub fn block_get_timestamp(block_id: u32) -> Option<f64> {
    let state = GLOBAL_STATE.lock().unwrap();
    state.blocks.get(&block_id).map(|b| b.timestamp() as f64)
}

#[wasm_bindgen]
pub fn block_get_payload_type(block_id: u32) -> Option<u32> {
    let state = GLOBAL_STATE.lock().unwrap();
    state.blocks.get(&block_id).map(|b| b.payload_type())
}

#[wasm_bindgen]
pub fn block_get_hash(block_id: u32) -> Option<Vec<u8>> {
    let state = GLOBAL_STATE.lock().unwrap();
    state.blocks.get(&block_id).map(|b| b.hash().to_vec())
}

#[wasm_bindgen]
pub fn block_get_payload(block_id: u32) -> Option<Vec<u8>> {
    let state = GLOBAL_STATE.lock().unwrap();
    state.blocks.get(&block_id).map(|b| b.payload().clone())
}

#[wasm_bindgen]
pub fn block_destroy(block_id: u32) -> bool {
    let mut state = GLOBAL_STATE.lock().unwrap();
    state.blocks.remove(&block_id).is_some()
}

// Chain operations
#[wasm_bindgen]
pub fn chain_create() -> u32 {
    let mut state = GLOBAL_STATE.lock().unwrap();
    
    if !state.initialized {
        return 0;
    }
    
    let chain = Chain::new();
    let id = state.next_id();
    state.chains.insert(id, chain);
    id
}

#[wasm_bindgen]
pub fn chain_add_block(chain_id: u32, block_id: u32) -> bool {
    let mut state = GLOBAL_STATE.lock().unwrap();
    
    let block = match state.blocks.get(&block_id) {
        Some(b) => b.clone(),
        None => return false,
    };
    
    match state.chains.get_mut(&chain_id) {
        Some(chain) => chain.add_block(block).is_ok(),
        None => false,
    }
}

#[wasm_bindgen]
pub fn chain_get_length(chain_id: u32) -> u64 {
    let state = GLOBAL_STATE.lock().unwrap();
    state.chains.get(&chain_id)
        .map(|c| c.len() as u64)
        .unwrap_or(0)
}

#[wasm_bindgen]
pub fn chain_is_empty(chain_id: u32) -> bool {
    let state = GLOBAL_STATE.lock().unwrap();
    state.chains.get(&chain_id)
        .map(|c| c.is_empty())
        .unwrap_or(true)
}

#[wasm_bindgen]
pub fn chain_verify(chain_id: u32) -> bool {
    let state = GLOBAL_STATE.lock().unwrap();
    state.chains.get(&chain_id)
        .map(|c| c.verify().is_ok())
        .unwrap_or(false)
}

#[wasm_bindgen]
pub fn chain_get_block(chain_id: u32, index: u64) -> u32 {
    let mut state = GLOBAL_STATE.lock().unwrap();
    
    let block = match state.chains.get(&chain_id) {
        Some(chain) => match chain.get_block(index as usize) {
            Some(b) => b.clone(),
            None => return 0,
        },
        None => return 0,
    };
    
    let block_id = state.next_id();
    state.blocks.insert(block_id, block);
    block_id
}

#[wasm_bindgen]
pub fn chain_destroy(chain_id: u32) -> bool {
    let mut state = GLOBAL_STATE.lock().unwrap();
    state.chains.remove(&chain_id).is_some()
}

// Serialization
#[wasm_bindgen]
pub fn block_to_json(block_id: u32) -> Option<String> {
    let state = GLOBAL_STATE.lock().unwrap();
    
    state.blocks.get(&block_id)
        .and_then(|block| {
            let wire_format = WireFormat::new(
                EncodingFormat::Json,
                CompressionMethod::None
            );
            block.to_wire_format(&wire_format)
                .ok()
                .and_then(|bytes| String::from_utf8(bytes).ok())
        })
}

#[wasm_bindgen]
pub fn block_from_json(json: &str) -> u32 {
    let mut state = GLOBAL_STATE.lock().unwrap();
    
    if !state.initialized {
        return 0;
    }
    
    let wire_format = WireFormat::new(
        EncodingFormat::Json,
        CompressionMethod::None
    );
    
    match Block::from_wire_format(json.as_bytes(), &wire_format) {
        Ok(block) => {
            let id = state.next_id();
            state.blocks.insert(id, block);
            id
        }
        Err(_) => 0
    }
}

#[wasm_bindgen]
pub fn block_to_bytes(block_id: u32) -> Option<Vec<u8>> {
    let state = GLOBAL_STATE.lock().unwrap();
    
    state.blocks.get(&block_id)
        .and_then(|block| {
            let wire_format = WireFormat::new(
                EncodingFormat::Binary,
                CompressionMethod::None
            );
            block.to_wire_format(&wire_format).ok()
        })
}

#[wasm_bindgen]
pub fn block_from_bytes(bytes: &[u8]) -> u32 {
    let mut state = GLOBAL_STATE.lock().unwrap();
    
    if !state.initialized {
        return 0;
    }
    
    let wire_format = WireFormat::new(
        EncodingFormat::Binary,
        CompressionMethod::None
    );
    
    match Block::from_wire_format(bytes, &wire_format) {
        Ok(block) => {
            let id = state.next_id();
            state.blocks.insert(id, block);
            id
        }
        Err(_) => 0
    }
}

// Cryptographic utilities
#[wasm_bindgen]
pub fn sign(keypair_id: u32, data: &[u8]) -> Option<Vec<u8>> {
    let state = GLOBAL_STATE.lock().unwrap();
    
    state.keypairs.get(&keypair_id)
        .and_then(|kp| kp.sign(data).ok())
        .map(|sig| sig.to_vec())
}

#[wasm_bindgen]
pub fn verify(public_key: &[u8], data: &[u8], signature: &[u8]) -> bool {
    if public_key.len() != 32 || signature.len() != 64 {
        return false;
    }
    
    let mut pub_key_array = [0u8; 32];
    pub_key_array.copy_from_slice(public_key);
    
    let mut sig_array = [0u8; 64];
    sig_array.copy_from_slice(signature);
    
    olocus_core::crypto::verify_signature(
        &pub_key_array,
        data,
        &sig_array
    ).unwrap_or(false)
}

#[wasm_bindgen]
pub fn hash_sha256(data: &[u8]) -> Vec<u8> {
    use sha2::{Sha256, Digest};
    let mut hasher = Sha256::new();
    hasher.update(data);
    hasher.finalize().to_vec()
}

#[wasm_bindgen]
pub fn random_bytes(length: usize) -> Vec<u8> {
    use rand::RngCore;
    let mut rng = rand::thread_rng();
    let mut bytes = vec![0u8; length];
    rng.fill_bytes(&mut bytes);
    bytes
}

// Performance monitoring
#[wasm_bindgen]
pub fn get_memory_usage() -> JsValue {
    let state = GLOBAL_STATE.lock().unwrap();
    
    let usage = serde_json::json!({
        "keypairs": state.keypairs.len(),
        "blocks": state.blocks.len(),
        "chains": state.chains.len(),
        "next_id": state.next_id
    });
    
    serde_wasm_bindgen::to_value(&usage).unwrap_or(JsValue::NULL)
}

// Cleanup utility
#[wasm_bindgen]
pub fn cleanup_objects() -> u64 {
    let mut state = GLOBAL_STATE.lock().unwrap();
    
    let total_cleaned = state.keypairs.len() + state.blocks.len() + state.chains.len();
    
    state.keypairs.clear();
    state.blocks.clear();
    state.chains.clear();
    
    total_cleaned as u64
}

// Web-specific utilities
#[cfg(target_arch = "wasm32")]
#[wasm_bindgen]
pub fn get_performance_now() -> f64 {
    web_sys::window()
        .and_then(|w| w.performance())
        .map(|p| p.now())
        .unwrap_or(0.0)
}

#[cfg(target_arch = "wasm32")]
#[wasm_bindgen]
pub fn console_log(message: &str) {
    web_sys::console::log_1(&message.into());
}
```

## TypeScript Definitions

### Auto-generated TypeScript Types

```typescript
// Generated by wasm-pack - enhanced for better TypeScript support

export interface WasmResult {
  readonly success: boolean;
  readonly error_message?: string;
  readonly data?: Uint8Array;
}

export interface MemoryUsage {
  keypairs: number;
  blocks: number;
  chains: number;
  next_id: number;
}

// Initialization
export function init(): WasmResult;
export function shutdown(): void;
export function is_initialized(): boolean;
export function get_version(): string;

// Key management
export function keypair_generate(): number;
export function keypair_from_bytes(private_key: Uint8Array): number;
export function keypair_get_public_key(keypair_id: number): Uint8Array | undefined;
export function keypair_get_private_key(keypair_id: number): Uint8Array | undefined;
export function keypair_destroy(keypair_id: number): boolean;

// Block operations
export function block_create_genesis(
  timestamp: number,
  payload: Uint8Array,
  payload_type: number,
  signing_key: Uint8Array
): number;

export function block_create(
  index: number,
  timestamp: number,
  previous_hash: Uint8Array,
  payload: Uint8Array,
  payload_type: number,
  signing_key: Uint8Array
): number;

export function block_verify(block_id: number): boolean;
export function block_get_index(block_id: number): number | undefined;
export function block_get_timestamp(block_id: number): number | undefined;
export function block_get_payload_type(block_id: number): number | undefined;
export function block_get_hash(block_id: number): Uint8Array | undefined;
export function block_get_payload(block_id: number): Uint8Array | undefined;
export function block_destroy(block_id: number): boolean;

// Chain operations
export function chain_create(): number;
export function chain_add_block(chain_id: number, block_id: number): boolean;
export function chain_get_length(chain_id: number): number;
export function chain_is_empty(chain_id: number): boolean;
export function chain_verify(chain_id: number): boolean;
export function chain_get_block(chain_id: number, index: number): number;
export function chain_destroy(chain_id: number): boolean;

// Serialization
export function block_to_json(block_id: number): string | undefined;
export function block_from_json(json: string): number;
export function block_to_bytes(block_id: number): Uint8Array | undefined;
export function block_from_bytes(bytes: Uint8Array): number;

// Cryptographic operations
export function sign(keypair_id: number, data: Uint8Array): Uint8Array | undefined;
export function verify(public_key: Uint8Array, data: Uint8Array, signature: Uint8Array): boolean;
export function hash_sha256(data: Uint8Array): Uint8Array;
export function random_bytes(length: number): Uint8Array;

// Utilities
export function get_memory_usage(): MemoryUsage;
export function cleanup_objects(): number;
export function get_performance_now(): number;
export function console_log(message: string): void;

// Initialize WASM module
export default function init(module_or_path?: InitInput | Promise<InitInput>): Promise<InitOutput>;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;
export interface InitOutput {
  readonly memory: WebAssembly.Memory;
}
```

### Enhanced TypeScript Wrapper

```typescript
// olocus-wasm.ts - High-level TypeScript wrapper
import init, * as wasm from './pkg/olocus_ffi.js';

export interface OlocusConfig {
  wasmPath?: string;
  debug?: boolean;
  logLevel?: 'error' | 'warn' | 'info' | 'debug';
}

export interface BlockInfo {
  id: number;
  index: number;
  timestamp: Date;
  payloadType: number;
  hash: Uint8Array;
  payload: Uint8Array;
}

export interface ChainInfo {
  id: number;
  length: number;
  isEmpty: boolean;
  blocks: BlockInfo[];
}

export class OlocusError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
    public readonly details?: any
  ) {
    super(message);
    this.name = 'OlocusError';
  }
}

export class KeyPair {
  constructor(private id: number) {}
  
  get publicKey(): Uint8Array {
    const key = wasm.keypair_get_public_key(this.id);
    if (!key) {
      throw new OlocusError('Failed to get public key');
    }
    return key;
  }
  
  get privateKey(): Uint8Array {
    const key = wasm.keypair_get_private_key(this.id);
    if (!key) {
      throw new OlocusError('Failed to get private key');
    }
    return key;
  }
  
  sign(data: Uint8Array): Uint8Array {
    const signature = wasm.sign(this.id, data);
    if (!signature) {
      throw new OlocusError('Failed to sign data');
    }
    return signature;
  }
  
  destroy(): void {
    wasm.keypair_destroy(this.id);
  }
  
  static generate(): KeyPair {
    const id = wasm.keypair_generate();
    if (id === 0) {
      throw new OlocusError('Failed to generate keypair');
    }
    return new KeyPair(id);
  }
  
  static fromBytes(privateKey: Uint8Array): KeyPair {
    if (privateKey.length !== 32) {
      throw new OlocusError('Private key must be 32 bytes');
    }
    
    const id = wasm.keypair_from_bytes(privateKey);
    if (id === 0) {
      throw new OlocusError('Failed to create keypair from bytes');
    }
    return new KeyPair(id);
  }
}

export class Block {
  constructor(private id: number) {}
  
  get index(): number {
    const index = wasm.block_get_index(this.id);
    if (index === undefined) {
      throw new OlocusError('Failed to get block index');
    }
    return index;
  }
  
  get timestamp(): Date {
    const timestamp = wasm.block_get_timestamp(this.id);
    if (timestamp === undefined) {
      throw new OlocusError('Failed to get block timestamp');
    }
    return new Date(timestamp);
  }
  
  get payloadType(): number {
    const payloadType = wasm.block_get_payload_type(this.id);
    if (payloadType === undefined) {
      throw new OlocusError('Failed to get payload type');
    }
    return payloadType;
  }
  
  get hash(): Uint8Array {
    const hash = wasm.block_get_hash(this.id);
    if (!hash) {
      throw new OlocusError('Failed to get block hash');
    }
    return hash;
  }
  
  get payload(): Uint8Array {
    const payload = wasm.block_get_payload(this.id);
    if (!payload) {
      throw new OlocusError('Failed to get block payload');
    }
    return payload;
  }
  
  verify(): boolean {
    return wasm.block_verify(this.id);
  }
  
  toJSON(): string {
    const json = wasm.block_to_json(this.id);
    if (!json) {
      throw new OlocusError('Failed to serialize block to JSON');
    }
    return json;
  }
  
  toBytes(): Uint8Array {
    const bytes = wasm.block_to_bytes(this.id);
    if (!bytes) {
      throw new OlocusError('Failed to serialize block to bytes');
    }
    return bytes;
  }
  
  getInfo(): BlockInfo {
    return {
      id: this.id,
      index: this.index,
      timestamp: this.timestamp,
      payloadType: this.payloadType,
      hash: this.hash,
      payload: this.payload
    };
  }
  
  destroy(): void {
    wasm.block_destroy(this.id);
  }
  
  static createGenesis(
    payload: Uint8Array | string,
    payloadType: number = 0,
    keypair?: KeyPair
  ): Block {
    const kp = keypair || KeyPair.generate();
    const payloadBytes = typeof payload === 'string' 
      ? new TextEncoder().encode(payload)
      : payload;
    
    const id = wasm.block_create_genesis(
      Date.now(),
      payloadBytes,
      payloadType,
      kp.privateKey
    );
    
    if (id === 0) {
      throw new OlocusError('Failed to create genesis block');
    }
    
    return new Block(id);
  }
  
  static create(
    index: number,
    previousHash: Uint8Array,
    payload: Uint8Array | string,
    payloadType: number = 0,
    keypair?: KeyPair
  ): Block {
    if (previousHash.length !== 32) {
      throw new OlocusError('Previous hash must be 32 bytes');
    }
    
    const kp = keypair || KeyPair.generate();
    const payloadBytes = typeof payload === 'string'
      ? new TextEncoder().encode(payload)
      : payload;
    
    const id = wasm.block_create(
      index,
      Date.now(),
      previousHash,
      payloadBytes,
      payloadType,
      kp.privateKey
    );
    
    if (id === 0) {
      throw new OlocusError('Failed to create block');
    }
    
    return new Block(id);
  }
  
  static fromJSON(json: string): Block {
    const id = wasm.block_from_json(json);
    if (id === 0) {
      throw new OlocusError('Failed to deserialize block from JSON');
    }
    return new Block(id);
  }
  
  static fromBytes(bytes: Uint8Array): Block {
    const id = wasm.block_from_bytes(bytes);
    if (id === 0) {
      throw new OlocusError('Failed to deserialize block from bytes');
    }
    return new Block(id);
  }
}

export class Chain {
  constructor(private id: number) {}
  
  get length(): number {
    return wasm.chain_get_length(this.id);
  }
  
  get isEmpty(): boolean {
    return wasm.chain_is_empty(this.id);
  }
  
  addBlock(block: Block): void {
    const success = wasm.chain_add_block(this.id, (block as any).id);
    if (!success) {
      throw new OlocusError('Failed to add block to chain');
    }
  }
  
  getBlock(index: number): Block {
    const blockId = wasm.chain_get_block(this.id, index);
    if (blockId === 0) {
      throw new OlocusError(`No block at index ${index}`);
    }
    return new Block(blockId);
  }
  
  verify(): boolean {
    return wasm.chain_verify(this.id);
  }
  
  getBlocks(): Block[] {
    const blocks: Block[] = [];
    const length = this.length;
    
    for (let i = 0; i < length; i++) {
      try {
        blocks.push(this.getBlock(i));
      } catch (e) {
        // Block not found, skip
      }
    }
    
    return blocks;
  }
  
  getInfo(): ChainInfo {
    return {
      id: this.id,
      length: this.length,
      isEmpty: this.isEmpty,
      blocks: this.getBlocks().map(b => b.getInfo())
    };
  }
  
  destroy(): void {
    wasm.chain_destroy(this.id);
  }
  
  static create(): Chain {
    const id = wasm.chain_create();
    if (id === 0) {
      throw new OlocusError('Failed to create chain');
    }
    return new Chain(id);
  }
}

export class Olocus {
  private static initialized = false;
  
  static async initialize(config: OlocusConfig = {}): Promise<void> {
    if (this.initialized) {
      return;
    }
    
    // Initialize WASM module
    if (config.wasmPath) {
      await init(config.wasmPath);
    } else {
      await init();
    }
    
    // Initialize Olocus library
    const result = wasm.init();
    if (!result.success) {
      throw new OlocusError(`Failed to initialize Olocus: ${result.error_message}`);
    }
    
    this.initialized = true;
    
    if (config.debug) {
      console.log(`Olocus WASM v${wasm.get_version()} initialized`);
    }
  }
  
  static shutdown(): void {
    if (this.initialized) {
      wasm.shutdown();
      this.initialized = false;
    }
  }
  
  static get isInitialized(): boolean {
    return wasm.is_initialized();
  }
  
  static get version(): string {
    return wasm.get_version();
  }
  
  static getMemoryUsage(): wasm.MemoryUsage {
    return wasm.get_memory_usage() as wasm.MemoryUsage;
  }
  
  static cleanupObjects(): number {
    return wasm.cleanup_objects();
  }
  
  // Cryptographic utilities
  static verify(publicKey: Uint8Array, data: Uint8Array, signature: Uint8Array): boolean {
    return wasm.verify(publicKey, data, signature);
  }
  
  static hash(data: Uint8Array | string): Uint8Array {
    const bytes = typeof data === 'string'
      ? new TextEncoder().encode(data)
      : data;
    return wasm.hash_sha256(bytes);
  }
  
  static randomBytes(length: number): Uint8Array {
    return wasm.random_bytes(length);
  }
  
  // Utility functions
  static bytesToHex(bytes: Uint8Array): string {
    return Array.from(bytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }
  
  static hexToBytes(hex: string): Uint8Array {
    if (hex.length % 2 !== 0) {
      throw new OlocusError('Hex string must have even length');
    }
    
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < bytes.length; i++) {
      const byte = parseInt(hex.substr(i * 2, 2), 16);
      if (isNaN(byte)) {
        throw new OlocusError(`Invalid hex string: ${hex}`);
      }
      bytes[i] = byte;
    }
    return bytes;
  }
  
  static encodeString(str: string): Uint8Array {
    return new TextEncoder().encode(str);
  }
  
  static decodeString(bytes: Uint8Array): string {
    return new TextDecoder().decode(bytes);
  }
}

// Re-export main classes
export { KeyPair, Block, Chain, Olocus };

// Default export
export default Olocus;
```

## Performance Optimization

### Size Optimization Techniques

```toml
# Cargo.toml - Aggressive size optimization
[profile.release]
codegen-units = 1
lto = "fat"
opt-level = "z"
strip = "symbols"
panic = "abort"
overflow-checks = false

[profile.release.package.olocus-ffi]
opt-level = 3  # Optimize for speed for core operations

# Remove unnecessary features
[dependencies]
serde = { version = "1.0", default-features = false, features = ["derive"] }
wasm-bindgen = { version = "0.2", default-features = false, features = ["std"] }

# Use smaller alternatives
getrandom = { version = "0.2", features = ["js"] }
sha2 = { version = "0.10", default-features = false }
```

### Runtime Optimization

```rust
// Performance monitoring and optimization
use std::time::Instant;
use web_sys::console;

#[wasm_bindgen]
pub struct PerformanceTimer {
    start: f64,
    label: String,
}

#[wasm_bindgen]
impl PerformanceTimer {
    #[wasm_bindgen(constructor)]
    pub fn new(label: &str) -> PerformanceTimer {
        let start = web_sys::window()
            .and_then(|w| w.performance())
            .map(|p| p.now())
            .unwrap_or(0.0);
            
        PerformanceTimer {
            start,
            label: label.to_string(),
        }
    }
    
    pub fn elapsed(&self) -> f64 {
        let now = web_sys::window()
            .and_then(|w| w.performance())
            .map(|p| p.now())
            .unwrap_or(0.0);
        now - self.start
    }
    
    pub fn finish(&self) {
        let elapsed = self.elapsed();
        console::log_1(&format!("{}: {:.2}ms", self.label, elapsed).into());
    }
}

// Batch operations for better performance
#[wasm_bindgen]
pub fn verify_blocks_batch(block_ids: &[u32]) -> Vec<bool> {
    let _timer = PerformanceTimer::new("verify_blocks_batch");
    
    let state = GLOBAL_STATE.lock().unwrap();
    
    let results: Vec<bool> = block_ids
        .iter()
        .map(|&id| {
            state.blocks.get(&id)
                .map(|block| block.verify().is_ok())
                .unwrap_or(false)
        })
        .collect();
    
    _timer.finish();
    results
}

// Memory-efficient serialization
#[wasm_bindgen]
pub fn serialize_chain_streaming(chain_id: u32, chunk_size: usize) -> js_sys::AsyncIterator {
    // Implementation would return an async iterator for large chains
    todo!("Streaming serialization implementation")
}

// Object pooling for frequent allocations
static mut BLOCK_POOL: Vec<Block> = Vec::new();

#[wasm_bindgen]
pub fn get_pooled_block() -> u32 {
    unsafe {
        if let Some(block) = BLOCK_POOL.pop() {
            let mut state = GLOBAL_STATE.lock().unwrap();
            let id = state.next_id();
            state.blocks.insert(id, block);
            return id;
        }
    }
    0 // No pooled blocks available
}

#[wasm_bindgen]
pub fn return_block_to_pool(block_id: u32) {
    let mut state = GLOBAL_STATE.lock().unwrap();
    if let Some(block) = state.blocks.remove(&block_id) {
        unsafe {
            if BLOCK_POOL.len() < 100 {  // Limit pool size
                BLOCK_POOL.push(block);
            }
        }
    }
}
```

## Browser Integration Examples

### Vanilla JavaScript

```html
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Olocus WASM Demo</title>
    <style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
        .section { margin: 20px 0; padding: 15px; border: 1px solid #ddd; border-radius: 5px; }
        button { margin: 5px; padding: 10px 15px; }
        textarea { width: 100%; height: 100px; }
        .output { background: #f5f5f5; padding: 10px; border-radius: 3px; font-family: monospace; }
    </style>
</head>
<body>
    <h1>Olocus WebAssembly Demo</h1>
    
    <div class="section">
        <h2>Initialization</h2>
        <button id="init-btn">Initialize Olocus</button>
        <button id="shutdown-btn" disabled>Shutdown</button>
        <div id="init-status" class="output">Not initialized</div>
    </div>
    
    <div class="section">
        <h2>Key Management</h2>
        <button id="generate-key-btn" disabled>Generate KeyPair</button>
        <button id="import-key-btn" disabled>Import from Hex</button>
        <input type="text" id="key-hex" placeholder="64-character private key hex" />
        <div id="key-info" class="output">No key generated</div>
    </div>
    
    <div class="section">
        <h2>Block Operations</h2>
        <textarea id="payload-input" placeholder="Enter block payload..."></textarea>
        <button id="create-genesis-btn" disabled>Create Genesis Block</button>
        <button id="add-block-btn" disabled>Add Block to Chain</button>
        <div id="block-info" class="output">No blocks created</div>
    </div>
    
    <div class="section">
        <h2>Chain Operations</h2>
        <button id="create-chain-btn" disabled>Create Chain</button>
        <button id="verify-chain-btn" disabled>Verify Chain</button>
        <button id="export-chain-btn" disabled>Export as JSON</button>
        <div id="chain-info" class="output">No chain created</div>
    </div>
    
    <div class="section">
        <h2>Performance</h2>
        <button id="benchmark-btn" disabled>Run Benchmark</button>
        <div id="performance-info" class="output">Click benchmark to test performance</div>
    </div>

    <script type="module">
        import { Olocus, KeyPair, Block, Chain } from './pkg/olocus-wasm.js';
        
        let keyPair = null;
        let currentBlock = null;
        let chain = null;
        
        // DOM elements
        const initBtn = document.getElementById('init-btn');
        const shutdownBtn = document.getElementById('shutdown-btn');
        const initStatus = document.getElementById('init-status');
        const generateKeyBtn = document.getElementById('generate-key-btn');
        const importKeyBtn = document.getElementById('import-key-btn');
        const keyHexInput = document.getElementById('key-hex');
        const keyInfo = document.getElementById('key-info');
        const payloadInput = document.getElementById('payload-input');
        const createGenesisBtn = document.getElementById('create-genesis-btn');
        const addBlockBtn = document.getElementById('add-block-btn');
        const blockInfo = document.getElementById('block-info');
        const createChainBtn = document.getElementById('create-chain-btn');
        const verifyChainBtn = document.getElementById('verify-chain-btn');
        const exportChainBtn = document.getElementById('export-chain-btn');
        const chainInfo = document.getElementById('chain-info');
        const benchmarkBtn = document.getElementById('benchmark-btn');
        const performanceInfo = document.getElementById('performance-info');
        
        // Initialize Olocus
        initBtn.addEventListener('click', async () => {
            try {
                initBtn.disabled = true;
                initStatus.textContent = 'Initializing...';
                
                await Olocus.initialize({ debug: true });
                
                initStatus.textContent = `Initialized Olocus v${Olocus.version}`;
                shutdownBtn.disabled = false;
                generateKeyBtn.disabled = false;
                importKeyBtn.disabled = false;
                createChainBtn.disabled = false;
                benchmarkBtn.disabled = false;
            } catch (error) {
                initStatus.textContent = `Initialization failed: ${error.message}`;
                initBtn.disabled = false;
            }
        });
        
        // Shutdown
        shutdownBtn.addEventListener('click', () => {
            Olocus.shutdown();
            initStatus.textContent = 'Shutdown complete';
            
            // Reset UI
            initBtn.disabled = false;
            shutdownBtn.disabled = true;
            generateKeyBtn.disabled = true;
            createGenesisBtn.disabled = true;
            addBlockBtn.disabled = true;
            createChainBtn.disabled = true;
            verifyChainBtn.disabled = true;
            exportChainBtn.disabled = true;
            benchmarkBtn.disabled = true;
            
            keyInfo.textContent = 'No key generated';
            blockInfo.textContent = 'No blocks created';
            chainInfo.textContent = 'No chain created';
        });
        
        // Generate KeyPair
        generateKeyBtn.addEventListener('click', () => {
            try {
                keyPair = KeyPair.generate();
                const publicKeyHex = Olocus.bytesToHex(keyPair.publicKey);
                const privateKeyHex = Olocus.bytesToHex(keyPair.privateKey);
                
                keyInfo.innerHTML = `
                    <strong>Public Key:</strong><br>${publicKeyHex}<br>
                    <strong>Private Key:</strong><br>${privateKeyHex}
                `;
                
                createGenesisBtn.disabled = false;
            } catch (error) {
                keyInfo.textContent = `Key generation failed: ${error.message}`;
            }
        });
        
        // Import KeyPair
        importKeyBtn.addEventListener('click', () => {
            try {
                const hexKey = keyHexInput.value.trim();
                if (hexKey.length !== 64) {
                    throw new Error('Private key must be 64 hex characters');
                }
                
                const privateKeyBytes = Olocus.hexToBytes(hexKey);
                keyPair = KeyPair.fromBytes(privateKeyBytes);
                
                const publicKeyHex = Olocus.bytesToHex(keyPair.publicKey);
                keyInfo.innerHTML = `
                    <strong>Imported Key</strong><br>
                    <strong>Public Key:</strong><br>${publicKeyHex}
                `;
                
                createGenesisBtn.disabled = false;
            } catch (error) {
                keyInfo.textContent = `Key import failed: ${error.message}`;
            }
        });
        
        // Create Genesis Block
        createGenesisBtn.addEventListener('click', () => {
            try {
                const payload = payloadInput.value || 'Genesis block';
                currentBlock = Block.createGenesis(payload, 0, keyPair);
                
                const info = currentBlock.getInfo();
                blockInfo.innerHTML = `
                    <strong>Genesis Block Created</strong><br>
                    <strong>Index:</strong> ${info.index}<br>
                    <strong>Timestamp:</strong> ${info.timestamp.toISOString()}<br>
                    <strong>Hash:</strong> ${Olocus.bytesToHex(info.hash)}<br>
                    <strong>Payload:</strong> ${Olocus.decodeString(info.payload)}<br>
                    <strong>Valid:</strong> ${currentBlock.verify()}
                `;
                
                addBlockBtn.disabled = false;
            } catch (error) {
                blockInfo.textContent = `Block creation failed: ${error.message}`;
            }
        });
        
        // Create Chain
        createChainBtn.addEventListener('click', () => {
            try {
                chain = Chain.create();
                chainInfo.textContent = 'Empty chain created';
                
                verifyChainBtn.disabled = false;
                exportChainBtn.disabled = false;
            } catch (error) {
                chainInfo.textContent = `Chain creation failed: ${error.message}`;
            }
        });
        
        // Add Block to Chain
        addBlockBtn.addEventListener('click', () => {
            try {
                if (!chain) {
                    throw new Error('Create a chain first');
                }
                if (!currentBlock) {
                    throw new Error('Create a block first');
                }
                
                chain.addBlock(currentBlock);
                
                const chainInfoData = chain.getInfo();
                chainInfo.innerHTML = `
                    <strong>Chain Info</strong><br>
                    <strong>Length:</strong> ${chainInfoData.length}<br>
                    <strong>Valid:</strong> ${chain.verify()}<br>
                    <strong>Blocks:</strong> ${chainInfoData.blocks.length}
                `;
                
                // Create next block if there's more payload
                if (payloadInput.value.trim()) {
                    const payload = `Block ${chainInfoData.length}: ${payloadInput.value}`;
                    const lastBlock = chain.getBlock(chainInfoData.length - 1);
                    currentBlock = Block.create(
                        chainInfoData.length,
                        lastBlock.hash,
                        payload,
                        0,
                        keyPair
                    );
                    
                    blockInfo.innerHTML += '<br><strong>Next block ready for adding</strong>';
                }
            } catch (error) {
                chainInfo.textContent = `Add block failed: ${error.message}`;
            }
        });
        
        // Verify Chain
        verifyChainBtn.addEventListener('click', () => {
            try {
                if (!chain) {
                    throw new Error('Create a chain first');
                }
                
                const isValid = chain.verify();
                const chainInfoData = chain.getInfo();
                
                chainInfo.innerHTML = `
                    <strong>Chain Verification</strong><br>
                    <strong>Length:</strong> ${chainInfoData.length}<br>
                    <strong>Valid:</strong> ${isValid ? 'YES' : 'NO'}<br>
                    <strong>Memory Usage:</strong> ${JSON.stringify(Olocus.getMemoryUsage(), null, 2)}
                `;
            } catch (error) {
                chainInfo.textContent = `Verification failed: ${error.message}`;
            }
        });
        
        // Export Chain
        exportChainBtn.addEventListener('click', () => {
            try {
                if (!chain) {
                    throw new Error('Create a chain first');
                }
                
                const blocks = chain.getBlocks();
                const exportData = blocks.map(block => {
                    const info = block.getInfo();
                    return {
                        index: info.index,
                        timestamp: info.timestamp.toISOString(),
                        hash: Olocus.bytesToHex(info.hash),
                        payload: Olocus.decodeString(info.payload),
                        json: block.toJSON()
                    };
                });
                
                const blob = new Blob([JSON.stringify(exportData, null, 2)], {
                    type: 'application/json'
                });
                
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'olocus-chain.json';
                a.click();
                URL.revokeObjectURL(url);
                
                chainInfo.textContent += `\nExported ${blocks.length} blocks`;
            } catch (error) {
                chainInfo.textContent = `Export failed: ${error.message}`;
            }
        });
        
        // Benchmark
        benchmarkBtn.addEventListener('click', async () => {
            performanceInfo.textContent = 'Running benchmark...';
            
            try {
                const results = await runBenchmark();
                performanceInfo.innerHTML = `
                    <strong>Benchmark Results</strong><br>
                    ${Object.entries(results)
                        .map(([key, value]) => `<strong>${key}:</strong> ${value}`)
                        .join('<br>')}
                `;
            } catch (error) {
                performanceInfo.textContent = `Benchmark failed: ${error.message}`;
            }
        });
        
        async function runBenchmark() {
            const results = {};
            
            // Key generation benchmark
            const keyStart = performance.now();
            const testKeys = [];
            for (let i = 0; i < 100; i++) {
                testKeys.push(KeyPair.generate());
            }
            results['Key Generation (100)'] = `${(performance.now() - keyStart).toFixed(2)}ms`;
            
            // Block creation benchmark
            const blockStart = performance.now();
            const testBlocks = [];
            for (let i = 0; i < 100; i++) {
                const block = Block.createGenesis(`Test payload ${i}`, 0, testKeys[i % testKeys.length]);
                testBlocks.push(block);
            }
            results['Block Creation (100)'] = `${(performance.now() - blockStart).toFixed(2)}ms`;
            
            // Block verification benchmark
            const verifyStart = performance.now();
            let verifiedCount = 0;
            for (const block of testBlocks) {
                if (block.verify()) verifiedCount++;
            }
            results['Block Verification (100)'] = `${(performance.now() - verifyStart).toFixed(2)}ms`;
            results['Verified Blocks'] = `${verifiedCount}/100`;
            
            // Hashing benchmark
            const hashStart = performance.now();
            const testData = new TextEncoder().encode('Test data for hashing benchmark');
            for (let i = 0; i < 1000; i++) {
                Olocus.hash(testData);
            }
            results['SHA-256 Hashing (1000)'] = `${(performance.now() - hashStart).toFixed(2)}ms`;
            
            // Signing benchmark
            const signStart = performance.now();
            const testKey = testKeys[0];
            for (let i = 0; i < 100; i++) {
                testKey.sign(testData);
            }
            results['Signing (100)'] = `${(performance.now() - signStart).toFixed(2)}ms`;
            
            // Cleanup
            testKeys.forEach(key => key.destroy());
            testBlocks.forEach(block => block.destroy());
            
            results['Memory Cleanup'] = `${Olocus.cleanupObjects()} objects cleaned`;
            
            return results;
        }
    </script>
</body>
</html>
```

### React Integration

```tsx
// App.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { Olocus, KeyPair, Block, Chain, OlocusError } from './olocus-wasm';
import './App.css';

interface AppState {
  initialized: boolean;
  loading: boolean;
  error: string | null;
  keyPair: KeyPair | null;
  chain: Chain | null;
  blocks: Block[];
}

const App: React.FC = () => {
  const [state, setState] = useState<AppState>({
    initialized: false,
    loading: false,
    error: null,
    keyPair: null,
    chain: null,
    blocks: []
  });
  
  const [payload, setPayload] = useState('Hello, Olocus!');
  
  const updateState = useCallback((updates: Partial<AppState>) => {
    setState(prev => ({ ...prev, ...updates }));
  }, []);
  
  const handleError = useCallback((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    updateState({ error: message, loading: false });
  }, [updateState]);
  
  useEffect(() => {
    initializeOlocus();
    
    return () => {
      if (state.initialized) {
        Olocus.shutdown();
      }
    };
  }, []);
  
  const initializeOlocus = async () => {
    try {
      updateState({ loading: true, error: null });
      
      await Olocus.initialize({
        debug: process.env.NODE_ENV === 'development'
      });
      
      updateState({
        initialized: true,
        loading: false
      });
    } catch (error) {
      handleError(error);
    }
  };
  
  const generateKeyPair = useCallback(() => {
    try {
      const keyPair = KeyPair.generate();
      updateState({ keyPair, error: null });
    } catch (error) {
      handleError(error);
    }
  }, [handleError, updateState]);
  
  const createChain = useCallback(() => {
    try {
      const chain = Chain.create();
      updateState({ chain, blocks: [], error: null });
    } catch (error) {
      handleError(error);
    }
  }, [handleError, updateState]);
  
  const createGenesisBlock = useCallback(() => {
    try {
      if (!state.keyPair) {
        throw new OlocusError('Generate a keypair first');
      }
      
      const block = Block.createGenesis(payload, 0, state.keyPair);
      updateState({
        blocks: [block],
        error: null
      });
    } catch (error) {
      handleError(error);
    }
  }, [state.keyPair, payload, handleError, updateState]);
  
  const addBlock = useCallback(() => {
    try {
      if (!state.chain) {
        throw new OlocusError('Create a chain first');
      }
      
      if (state.blocks.length === 0) {
        throw new OlocusError('Create a genesis block first');
      }
      
      const lastBlock = state.blocks[state.blocks.length - 1];
      state.chain.addBlock(lastBlock);
      
      // Create next block if chain has blocks
      if (state.chain.length > 0 && state.keyPair) {
        const nextIndex = state.chain.length;
        const nextBlock = Block.create(
          nextIndex,
          lastBlock.hash,
          `Block ${nextIndex}: ${payload}`,
          0,
          state.keyPair
        );
        
        updateState({
          blocks: [...state.blocks, nextBlock],
          error: null
        });
      }
    } catch (error) {
      handleError(error);
    }
  }, [state.chain, state.blocks, state.keyPair, payload, handleError, updateState]);
  
  const verifyChain = useCallback(() => {
    try {
      if (!state.chain) {
        throw new OlocusError('Create a chain first');
      }
      
      const isValid = state.chain.verify();
      updateState({
        error: isValid ? null : 'Chain verification failed'
      });
      
      alert(isValid ? 'Chain is valid!' : 'Chain verification failed!');
    } catch (error) {
      handleError(error);
    }
  }, [state.chain, handleError, updateState]);
  
  const exportChain = useCallback(() => {
    try {
      if (!state.chain) {
        throw new OlocusError('Create a chain first');
      }
      
      const chainInfo = state.chain.getInfo();
      const exportData = {
        version: Olocus.version,
        timestamp: new Date().toISOString(),
        chain: chainInfo
      };
      
      const blob = new Blob(
        [JSON.stringify(exportData, null, 2)],
        { type: 'application/json' }
      );
      
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `olocus-chain-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      handleError(error);
    }
  }, [state.chain, handleError]);
  
  if (state.loading) {
    return (
      <div className="app loading">
        <h1>Loading Olocus...</h1>
        <p>Initializing WebAssembly module...</p>
      </div>
    );
  }
  
  if (!state.initialized) {
    return (
      <div className="app error">
        <h1>Initialization Failed</h1>
        <p>{state.error || 'Failed to initialize Olocus WASM'}</p>
        <button onClick={initializeOlocus}>Retry</button>
      </div>
    );
  }
  
  return (
    <div className="app">
      <h1>Olocus WebAssembly Demo</h1>
      <p>Version: {Olocus.version}</p>
      
      {state.error && (
        <div className="error-banner">
          Error: {state.error}
          <button onClick={() => updateState({ error: null })}>✕</button>
        </div>
      )}
      
      <div className="section">
        <h2>Key Management</h2>
        <button onClick={generateKeyPair} disabled={!!state.keyPair}>
          Generate KeyPair
        </button>
        
        {state.keyPair && (
          <div className="key-info">
            <p><strong>Public Key:</strong></p>
            <code>{Olocus.bytesToHex(state.keyPair.publicKey)}</code>
          </div>
        )}
      </div>
      
      <div className="section">
        <h2>Chain Operations</h2>
        <button onClick={createChain} disabled={!!state.chain}>
          Create Chain
        </button>
        
        {state.chain && (
          <div className="chain-info">
            <p>Chain Length: {state.chain.length}</p>
            <p>Is Empty: {state.chain.isEmpty ? 'Yes' : 'No'}</p>
            
            <button onClick={verifyChain} disabled={state.chain.isEmpty}>
              Verify Chain
            </button>
            <button onClick={exportChain} disabled={state.chain.isEmpty}>
              Export Chain
            </button>
          </div>
        )}
      </div>
      
      <div className="section">
        <h2>Block Operations</h2>
        <div className="input-group">
          <label htmlFor="payload">Block Payload:</label>
          <textarea
            id="payload"
            value={payload}
            onChange={(e) => setPayload(e.target.value)}
            placeholder="Enter block payload..."
          />
        </div>
        
        <button 
          onClick={createGenesisBlock}
          disabled={!state.keyPair || !state.chain || state.blocks.length > 0}
        >
          Create Genesis Block
        </button>
        
        <button
          onClick={addBlock}
          disabled={!state.chain || state.blocks.length === 0}
        >
          Add Block to Chain
        </button>
        
        {state.blocks.length > 0 && (
          <div className="blocks-list">
            <h3>Created Blocks:</h3>
            {state.blocks.map((block, index) => {
              const info = block.getInfo();
              return (
                <div key={index} className="block-item">
                  <p><strong>Index:</strong> {info.index}</p>
                  <p><strong>Hash:</strong> <code>{Olocus.bytesToHex(info.hash)}</code></p>
                  <p><strong>Payload:</strong> {Olocus.decodeString(info.payload)}</p>
                  <p><strong>Valid:</strong> {block.verify() ? 'Yes' : 'No'}</p>
                </div>
              );
            })}
          </div>
        )}
      </div>
      
      <div className="section">
        <h2>Performance</h2>
        <PerformanceMonitor />
      </div>
    </div>
  );
};

const PerformanceMonitor: React.FC = () => {
  const [memoryUsage, setMemoryUsage] = useState<any>(null);
  const [benchmarkResults, setBenchmarkResults] = useState<any>(null);
  const [running, setRunning] = useState(false);
  
  useEffect(() => {
    const interval = setInterval(() => {
      setMemoryUsage(Olocus.getMemoryUsage());
    }, 1000);
    
    return () => clearInterval(interval);
  }, []);
  
  const runBenchmark = async () => {
    setRunning(true);
    setBenchmarkResults(null);
    
    try {
      const results: Record<string, string> = {};
      
      // Key generation benchmark
      const keyStart = performance.now();
      const testKeys = Array.from({ length: 100 }, () => KeyPair.generate());
      results['Key Generation (100)'] = `${(performance.now() - keyStart).toFixed(2)}ms`;
      
      // Block creation benchmark
      const blockStart = performance.now();
      const testBlocks = testKeys.map((key, i) => 
        Block.createGenesis(`Benchmark block ${i}`, 0, key)
      );
      results['Block Creation (100)'] = `${(performance.now() - blockStart).toFixed(2)}ms`;
      
      // Verification benchmark
      const verifyStart = performance.now();
      const verifiedCount = testBlocks.filter(block => block.verify()).length;
      results['Block Verification (100)'] = `${(performance.now() - verifyStart).toFixed(2)}ms`;
      results['Verification Success Rate'] = `${verifiedCount}/100`;
      
      // Cleanup
      testKeys.forEach(key => key.destroy());
      testBlocks.forEach(block => block.destroy());
      
      const cleanedObjects = Olocus.cleanupObjects();
      results['Objects Cleaned'] = cleanedObjects.toString();
      
      setBenchmarkResults(results);
    } catch (error) {
      console.error('Benchmark failed:', error);
    } finally {
      setRunning(false);
    }
  };
  
  return (
    <div>
      <div className="memory-info">
        <h4>Memory Usage</h4>
        {memoryUsage && (
          <pre>{JSON.stringify(memoryUsage, null, 2)}</pre>
        )}
      </div>
      
      <button onClick={runBenchmark} disabled={running}>
        {running ? 'Running Benchmark...' : 'Run Performance Benchmark'}
      </button>
      
      {benchmarkResults && (
        <div className="benchmark-results">
          <h4>Benchmark Results</h4>
          <ul>
            {Object.entries(benchmarkResults).map(([key, value]) => (
              <li key={key}>
                <strong>{key}:</strong> {value as string}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default App;
```

## Deployment and Distribution

### NPM Package Setup

```json
{
  "name": "@olocus/wasm",
  "version": "1.16.1",
  "description": "Olocus Protocol WebAssembly bindings",
  "main": "olocus_ffi.js",
  "module": "olocus_ffi.js",
  "types": "olocus_ffi.d.ts",
  "files": [
    "olocus_ffi_bg.wasm",
    "olocus_ffi.js",
    "olocus_ffi.d.ts",
    "olocus-wasm.js",
    "olocus-wasm.d.ts",
    "README.md"
  ],
  "scripts": {
    "build": "./build-wasm.sh web release",
    "build:dev": "./build-wasm.sh web dev",
    "build:all": "./build-all-targets.sh",
    "test": "npm run build:dev && npm run test:node",
    "test:node": "node test/node-test.js",
    "test:browser": "npm run build && npm run serve",
    "serve": "python3 -m http.server 8000",
    "size-check": "wasm-opt --print-features pkg/olocus_ffi_bg.wasm"
  },
  "repository": {
    "type": "git",
    "url": "https://codeberg.org/olocus/protocol.git"
  },
  "keywords": [
    "blockchain",
    "cryptography",
    "wasm",
    "webassembly",
    "olocus",
    "timestamping"
  ],
  "license": "MIT",
  "devDependencies": {
    "@types/node": "^18.0.0",
    "typescript": "^4.8.0"
  },
  "engines": {
    "node": ">=16.0.0"
  },
  "sideEffects": false
}
```

### CDN Distribution

```html
<!-- Via JSDelivr CDN -->
<script type="module">
  import init, { Olocus } from 'https://cdn.jsdelivr.net/npm/@olocus/wasm@latest/olocus_ffi.js';
  
  async function main() {
    await init();
    await Olocus.initialize();
    console.log('Olocus loaded from CDN:', Olocus.version);
  }
  
  main();
</script>

<!-- Via UNPKG CDN -->
<script type="module">
  import init, { Olocus } from 'https://unpkg.com/@olocus/wasm@latest/olocus_ffi.js';
  
  async function main() {
    await init();
    await Olocus.initialize();
    console.log('Olocus loaded from CDN:', Olocus.version);
  }
  
  main();
</script>
```

## Testing and Validation

### Node.js Test Suite

```javascript
// test/node-test.js
const { Olocus, KeyPair, Block, Chain } = require('../pkg/olocus_ffi.js');
const assert = require('assert');

async function runTests() {
    console.log('Running Olocus WASM tests...');
    
    // Initialize
    await Olocus.initialize();
    console.log(`✓ Initialized Olocus v${Olocus.version}`);
    
    // Test key generation
    const keyPair = KeyPair.generate();
    assert(keyPair.publicKey.length === 32, 'Public key should be 32 bytes');
    assert(keyPair.privateKey.length === 32, 'Private key should be 32 bytes');
    console.log('✓ Key generation works');
    
    // Test block creation
    const block = Block.createGenesis('Test payload', 0, keyPair);
    assert(block.index === 0, 'Genesis block index should be 0');
    assert(block.verify(), 'Block should verify');
    console.log('✓ Block creation and verification works');
    
    // Test chain operations
    const chain = Chain.create();
    assert(chain.isEmpty, 'New chain should be empty');
    
    chain.addBlock(block);
    assert(chain.length === 1, 'Chain should have 1 block');
    assert(chain.verify(), 'Chain should verify');
    console.log('✓ Chain operations work');
    
    // Test serialization
    const blockJson = block.toJSON();
    assert(typeof blockJson === 'string', 'Block JSON should be string');
    
    const blockBytes = block.toBytes();
    assert(blockBytes instanceof Uint8Array, 'Block bytes should be Uint8Array');
    console.log('✓ Serialization works');
    
    // Test cryptographic operations
    const message = new TextEncoder().encode('Test message');
    const signature = keyPair.sign(message);
    assert(signature.length === 64, 'Signature should be 64 bytes');
    
    const isValid = Olocus.verify(keyPair.publicKey, message, signature);
    assert(isValid, 'Signature should verify');
    console.log('✓ Cryptographic operations work');
    
    // Test memory cleanup
    keyPair.destroy();
    block.destroy();
    chain.destroy();
    
    const cleanedObjects = Olocus.cleanupObjects();
    console.log(`✓ Cleaned up ${cleanedObjects} objects`);
    
    Olocus.shutdown();
    console.log('✓ All tests passed!');
}

runTests().catch(console.error);
```

### Browser Test Suite

```html
<!-- test/browser-test.html -->
<!DOCTYPE html>
<html>
<head>
    <title>Olocus WASM Browser Tests</title>
    <style>
        body { font-family: monospace; padding: 20px; }
        .test { margin: 10px 0; }
        .pass { color: green; }
        .fail { color: red; }
        .pending { color: orange; }
    </style>
</head>
<body>
    <h1>Olocus WASM Browser Tests</h1>
    <div id="test-results"></div>
    
    <script type="module">
        import { Olocus, KeyPair, Block, Chain } from '../pkg/olocus_ffi.js';
        
        const results = document.getElementById('test-results');
        
        function addResult(test, status, message) {
            const div = document.createElement('div');
            div.className = `test ${status}`;
            div.textContent = `${status.toUpperCase()}: ${test} - ${message}`;
            results.appendChild(div);
        }
        
        async function runTest(name, testFn) {
            try {
                addResult(name, 'pending', 'Running...');
                await testFn();
                addResult(name, 'pass', 'Passed');
            } catch (error) {
                addResult(name, 'fail', `Failed: ${error.message}`);
            }
        }
        
        async function runAllTests() {
            await runTest('Initialization', async () => {
                await Olocus.initialize({ debug: true });
                if (!Olocus.isInitialized) {
                    throw new Error('Not initialized');
                }
            });
            
            await runTest('Key Generation', async () => {
                const keyPair = KeyPair.generate();
                if (keyPair.publicKey.length !== 32) {
                    throw new Error('Invalid public key length');
                }
                keyPair.destroy();
            });
            
            await runTest('Block Operations', async () => {
                const keyPair = KeyPair.generate();
                const block = Block.createGenesis('Test', 0, keyPair);
                
                if (!block.verify()) {
                    throw new Error('Block verification failed');
                }
                
                block.destroy();
                keyPair.destroy();
            });
            
            await runTest('Chain Operations', async () => {
                const chain = Chain.create();
                const keyPair = KeyPair.generate();
                const block = Block.createGenesis('Test', 0, keyPair);
                
                chain.addBlock(block);
                
                if (chain.length !== 1) {
                    throw new Error('Invalid chain length');
                }
                
                if (!chain.verify()) {
                    throw new Error('Chain verification failed');
                }
                
                chain.destroy();
                block.destroy();
                keyPair.destroy();
            });
            
            await runTest('Performance', async () => {
                const start = performance.now();
                const keyPairs = [];
                
                // Generate 100 key pairs
                for (let i = 0; i < 100; i++) {
                    keyPairs.push(KeyPair.generate());
                }
                
                const keyGenTime = performance.now() - start;
                
                // Create 100 blocks
                const blockStart = performance.now();
                const blocks = [];
                for (let i = 0; i < 100; i++) {
                    blocks.push(Block.createGenesis(`Block ${i}`, 0, keyPairs[i]));
                }
                const blockTime = performance.now() - blockStart;
                
                // Cleanup
                keyPairs.forEach(kp => kp.destroy());
                blocks.forEach(b => b.destroy());
                
                addResult('Performance Details', 'pass', 
                    `Key gen: ${keyGenTime.toFixed(2)}ms, Block creation: ${blockTime.toFixed(2)}ms`);
                
                if (keyGenTime > 5000 || blockTime > 5000) {
                    throw new Error('Performance too slow');
                }
            });
            
            await runTest('Memory Management', async () => {
                const initialUsage = Olocus.getMemoryUsage();
                
                // Create many objects
                const objects = [];
                for (let i = 0; i < 50; i++) {
                    objects.push(KeyPair.generate());
                    objects.push(Block.createGenesis(`Test ${i}`, 0, objects[objects.length - 1]));
                }
                
                const maxUsage = Olocus.getMemoryUsage();
                
                // Cleanup explicitly
                objects.forEach(obj => obj.destroy());
                const cleanedCount = Olocus.cleanupObjects();
                
                const finalUsage = Olocus.getMemoryUsage();
                
                addResult('Memory Usage', 'pass', 
                    `Initial: ${JSON.stringify(initialUsage)}, Max: ${JSON.stringify(maxUsage)}, Final: ${JSON.stringify(finalUsage)}`);
                
                if (finalUsage.keypairs > initialUsage.keypairs + 5) {
                    throw new Error('Memory leak detected');
                }
            });
            
            addResult('All Tests', 'pass', 'Test suite completed');
        }
        
        runAllTests().catch(error => {
            addResult('Test Suite', 'fail', `Fatal error: ${error.message}`);
        });
    </script>
</body>
</html>
```

## Best Practices

### Performance

1. **Use `wee_alloc`** for smaller binary size
2. **Enable LTO** and size optimizations
3. **Batch operations** when possible
4. **Pool objects** for frequent allocations
5. **Profile with browser DevTools**

### Memory Management

1. **Always destroy WASM objects** when done
2. **Use try/finally** for guaranteed cleanup
3. **Monitor memory usage** in production
4. **Implement object pooling** for performance-critical apps
5. **Use WeakRef** for optional cleanup

### Error Handling

1. **Check initialization** before all operations
2. **Validate inputs** before WASM calls
3. **Provide meaningful error messages**
4. **Use Result types** for better error handling
5. **Log errors** for debugging

### Security

1. **Validate all inputs** from JavaScript
2. **Use secure random** for cryptographic operations
3. **Clear sensitive data** from memory
4. **Verify WASM integrity** in production
5. **Use CSP headers** to protect against attacks

## Troubleshooting

### Common Issues

1. **WASM not loading**: Check MIME types and CORS
2. **Memory access errors**: Ensure proper object lifecycle
3. **Performance issues**: Use Web Workers for heavy computation
4. **Bundle size too large**: Enable optimizations and use wasm-opt
5. **Browser compatibility**: Provide fallbacks for older browsers

### Debug Tips

1. **Use debug builds** for development
2. **Enable console logging** with debug features
3. **Monitor network requests** for WASM loading
4. **Use browser performance tools**
5. **Test across different browsers** and devices
