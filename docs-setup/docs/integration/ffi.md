---
id: ffi
title: FFI Reference
sidebar_position: 4
---

# FFI Reference

Complete Foreign Function Interface (FFI) reference for integrating Olocus Protocol with any programming language that supports C bindings. This covers the C interface, memory management, cross-language patterns, and platform-specific considerations.

## Overview

The Olocus FFI provides a C-compatible API that enables integration with:
- **Mobile platforms**: iOS (Swift/Objective-C), Android (Kotlin/Java)
- **Web platforms**: WebAssembly (JavaScript/TypeScript)
- **Desktop applications**: .NET, Python, Go, Node.js
- **System languages**: C, C++, Rust

## Core API Reference

### Initialization and Configuration

```c
// Library lifecycle
int olocus_init(void);
int olocus_init_with_config(const FFIConfig* config);
void olocus_shutdown(void);
bool olocus_is_initialized(void);

// Configuration management
FFIConfig* olocus_config_create(void);
void olocus_config_destroy(FFIConfig* config);

// Platform-specific configuration
void olocus_config_set_platform_ios(FFIConfig* config, bool enabled);
void olocus_config_set_platform_android(FFIConfig* config, bool enabled);
void olocus_config_set_platform_web(FFIConfig* config, bool enabled);
void olocus_config_set_keychain_enabled(FFIConfig* config, bool enabled);
void olocus_config_set_keystore_enabled(FFIConfig* config, bool enabled);
void olocus_config_set_network_enabled(FFIConfig* config, bool enabled);

// Thread configuration
void olocus_config_set_max_threads(FFIConfig* config, uint32_t max_threads);
void olocus_config_set_worker_threads(FFIConfig* config, uint32_t worker_threads);

// Security configuration
void olocus_config_set_secure_memory(FFIConfig* config, bool enabled);
void olocus_config_set_constant_time(FFIConfig* config, bool enabled);
```

### Key Management

```c
// Key pair operations
FFIKeyPair* olocus_keypair_generate(void);
FFIKeyPair* olocus_keypair_from_bytes(const uint8_t* private_key);
FFIKeyPair* olocus_keypair_from_seed(const uint8_t* seed, size_t seed_len);
void olocus_keypair_destroy(FFIKeyPair* keypair);

// Key extraction
void olocus_keypair_get_public_key(const FFIKeyPair* keypair, uint8_t* public_key);
void olocus_keypair_get_private_key(const FFIKeyPair* keypair, uint8_t* private_key);
size_t olocus_keypair_get_public_key_len(void);  // Returns 32
size_t olocus_keypair_get_private_key_len(void); // Returns 32

// Key validation
int olocus_keypair_validate(const FFIKeyPair* keypair);
bool olocus_keypair_is_valid_public_key(const uint8_t* public_key);
bool olocus_keypair_is_valid_private_key(const uint8_t* private_key);

// Key derivation
FFIKeyPair* olocus_keypair_derive_child(
    const FFIKeyPair* parent,
    uint32_t index,
    bool hardened
);
FFIKeyPair* olocus_keypair_derive_path(
    const FFIKeyPair* master,
    const char* derivation_path
);
```

### Block Operations

```c
// Block creation
FFIBlock* olocus_block_create_genesis(
    int64_t timestamp,
    const uint8_t* payload,
    size_t payload_len,
    uint32_t payload_type,
    const uint8_t* signing_key
);

FFIBlock* olocus_block_create(
    uint64_t index,
    int64_t timestamp,
    const uint8_t* previous_hash,
    const uint8_t* payload,
    size_t payload_len,
    uint32_t payload_type,
    const uint8_t* signing_key
);

// Block destruction
void olocus_block_destroy(FFIBlock* block);

// Block properties
uint64_t olocus_block_get_index(const FFIBlock* block);
int64_t olocus_block_get_timestamp(const FFIBlock* block);
uint32_t olocus_block_get_payload_type(const FFIBlock* block);
size_t olocus_block_get_payload_len(const FFIBlock* block);
void olocus_block_get_hash(const FFIBlock* block, uint8_t* hash);
void olocus_block_get_previous_hash(const FFIBlock* block, uint8_t* hash);
void olocus_block_get_payload(const FFIBlock* block, uint8_t* payload);
void olocus_block_get_signature(const FFIBlock* block, uint8_t* signature);
void olocus_block_get_public_key(const FFIBlock* block, uint8_t* public_key);

// Block validation
int olocus_block_verify(const FFIBlock* block);
int olocus_block_verify_signature(const FFIBlock* block);
int olocus_block_verify_hash(const FFIBlock* block);
int olocus_block_verify_timestamp(const FFIBlock* block, int64_t max_future_offset);

// Block comparison
bool olocus_block_equals(const FFIBlock* a, const FFIBlock* b);
int olocus_block_compare_timestamp(const FFIBlock* a, const FFIBlock* b);
```

### Chain Operations

```c
// Chain creation and destruction
FFIChain* olocus_chain_create(void);
FFIChain* olocus_chain_create_with_limit(size_t max_length);
void olocus_chain_destroy(FFIChain* chain);

// Chain manipulation
int olocus_chain_add_block(FFIChain* chain, const FFIBlock* block);
int olocus_chain_insert_block(FFIChain* chain, size_t index, const FFIBlock* block);
int olocus_chain_remove_block(FFIChain* chain, size_t index);
void olocus_chain_clear(FFIChain* chain);

// Chain queries
size_t olocus_chain_get_length(const FFIChain* chain);
bool olocus_chain_is_empty(const FFIChain* chain);
const FFIBlock* olocus_chain_get_block(const FFIChain* chain, size_t index);
const FFIBlock* olocus_chain_get_genesis_block(const FFIChain* chain);
const FFIBlock* olocus_chain_get_last_block(const FFIChain* chain);
const FFIBlock* olocus_chain_find_by_hash(const FFIChain* chain, const uint8_t* hash);

// Chain validation
int olocus_chain_verify(const FFIChain* chain);
int olocus_chain_verify_continuity(const FFIChain* chain);
int olocus_chain_verify_timestamps(const FFIChain* chain);
int olocus_chain_verify_signatures(const FFIChain* chain);

// Chain properties
void olocus_chain_get_tip_hash(const FFIChain* chain, uint8_t* hash);
int64_t olocus_chain_get_earliest_timestamp(const FFIChain* chain);
int64_t olocus_chain_get_latest_timestamp(const FFIChain* chain);

// Chain iteration
typedef bool (*FFIBlockVisitor)(const FFIBlock* block, size_t index, void* user_data);
void olocus_chain_iterate(const FFIChain* chain, FFIBlockVisitor visitor, void* user_data);
void olocus_chain_iterate_range(
    const FFIChain* chain,
    size_t start_index,
    size_t end_index,
    FFIBlockVisitor visitor,
    void* user_data
);

// Batch operations
int olocus_chain_add_blocks(
    FFIChain* chain,
    const FFIBlock* const* blocks,
    size_t block_count
);
int olocus_chain_get_range(
    const FFIChain* chain,
    size_t start_index,
    size_t count,
    FFIBlock** blocks
);
```

### Wire Format Operations

```c
// Wire format types
typedef struct {
    uint8_t encoding;  // FFIEncodingFormat
    uint8_t compression; // FFICompressionMethod
    uint8_t version;
    uint8_t reserved;
} FFIWireFormat;

// Encoding formats
typedef enum {
    FFIEncodingFormat_Binary = 0,
    FFIEncodingFormat_Json = 1,
    FFIEncodingFormat_MessagePack = 2,
    FFIEncodingFormat_Protobuf = 3,
    FFIEncodingFormat_Ssz = 4
} FFIEncodingFormat;

// Compression methods
typedef enum {
    FFICompressionMethod_None = 0,
    FFICompressionMethod_Zstd = 1,
    FFICompressionMethod_Lz4 = 2,
    FFICompressionMethod_Gzip = 3
} FFICompressionMethod;

// Wire format creation
FFIWireFormat olocus_wire_format_binary(void);
FFIWireFormat olocus_wire_format_json(void);
FFIWireFormat olocus_wire_format_msgpack(void);
FFIWireFormat olocus_wire_format_protobuf(void);
FFIWireFormat olocus_wire_format_ssz(void);
FFIWireFormat olocus_wire_format_new(FFIEncodingFormat encoding, FFICompressionMethod compression);

// Content type handling
char* olocus_wire_format_content_type(FFIWireFormat format);
int olocus_wire_format_from_content_type(const char* content_type, FFIWireFormat* format);

// Block serialization
FFIByteBuffer olocus_block_to_wire_format(const FFIBlock* block, FFIWireFormat format);
FFIBlock* olocus_block_from_wire_format(
    const uint8_t* data,
    size_t data_len,
    FFIWireFormat format
);

// Chain serialization
FFIByteBuffer olocus_chain_to_wire_format(const FFIChain* chain, FFIWireFormat format);
FFIChain* olocus_chain_from_wire_format(
    const uint8_t* data,
    size_t data_len,
    FFIWireFormat format
);

// Legacy JSON methods (convenience)
char* olocus_block_to_json(const FFIBlock* block);
FFIBlock* olocus_block_from_json(const char* json);
char* olocus_chain_to_json(const FFIChain* chain);
FFIChain* olocus_chain_from_json(const char* json);

// Binary methods (convenience)
FFIByteBuffer olocus_block_to_bytes(const FFIBlock* block);
FFIBlock* olocus_block_from_bytes(const uint8_t* data, size_t data_len);
FFIByteBuffer olocus_chain_to_bytes(const FFIChain* chain);
FFIChain* olocus_chain_from_bytes(const uint8_t* data, size_t data_len);
```

### Cryptographic Operations

```c
// Digital signatures
void olocus_sign(
    const FFIKeyPair* keypair,
    const uint8_t* message,
    size_t message_len,
    uint8_t* signature
);

int olocus_verify(
    const uint8_t* public_key,
    const uint8_t* message,
    size_t message_len,
    const uint8_t* signature
);

size_t olocus_signature_len(void); // Returns 64

// Batch signature operations
void olocus_sign_batch(
    const FFIKeyPair* keypair,
    const uint8_t* const* messages,
    const size_t* message_lens,
    size_t message_count,
    uint8_t* signatures
);

int olocus_verify_batch(
    const uint8_t* public_key,
    const uint8_t* const* messages,
    const size_t* message_lens,
    const uint8_t* const* signatures,
    size_t count,
    bool* results
);

// Hashing
void olocus_hash_sha256(const uint8_t* data, size_t data_len, uint8_t* hash);
void olocus_hash_sha512(const uint8_t* data, size_t data_len, uint8_t* hash);
void olocus_hash_blake3(const uint8_t* data, size_t data_len, uint8_t* hash);

// Incremental hashing
FFIHasher* olocus_hasher_create(void);
FFIHasher* olocus_hasher_create_sha512(void);
FFIHasher* olocus_hasher_create_blake3(void);
void olocus_hasher_update(FFIHasher* hasher, const uint8_t* data, size_t data_len);
void olocus_hasher_finalize(FFIHasher* hasher, uint8_t* hash);
void olocus_hasher_reset(FFIHasher* hasher);
void olocus_hasher_destroy(FFIHasher* hasher);

// Random number generation
void olocus_random_bytes(uint8_t* buffer, size_t len);
uint32_t olocus_random_u32(void);
uint64_t olocus_random_u64(void);

// Key derivation
void olocus_hkdf_derive(
    const uint8_t* input_key,
    size_t input_key_len,
    const uint8_t* salt,
    size_t salt_len,
    const uint8_t* info,
    size_t info_len,
    uint8_t* output,
    size_t output_len
);

void olocus_pbkdf2_derive(
    const uint8_t* password,
    size_t password_len,
    const uint8_t* salt,
    size_t salt_len,
    uint32_t iterations,
    uint8_t* output,
    size_t output_len
);

// Constant-time operations
int olocus_constant_time_eq(const uint8_t* a, const uint8_t* b, size_t len);
void olocus_constant_time_select(
    const uint8_t* a,
    const uint8_t* b,
    uint8_t choice,
    uint8_t* result,
    size_t len
);
```

### Async Operations

```c
// Async handle
typedef struct FFIAsyncHandle FFIAsyncHandle;

// Async states
typedef enum {
    FFIAsyncState_Pending = 0,
    FFIAsyncState_Running = 1,
    FFIAsyncState_Completed = 2,
    FFIAsyncState_Cancelled = 3,
    FFIAsyncState_Failed = 4
} FFIAsyncState;

// Async callback
typedef void (*FFIAsyncCallback)(
    void* user_data,
    int result,
    const void* data,
    size_t data_len
);

// Async handle management
FFIAsyncHandle* olocus_async_create(FFIAsyncCallback callback, void* user_data);
void olocus_async_destroy(FFIAsyncHandle* handle);

// Async operations
void olocus_async_create_block(
    FFIAsyncHandle* handle,
    uint64_t index,
    int64_t timestamp,
    const uint8_t* previous_hash,
    const uint8_t* payload,
    size_t payload_len,
    uint32_t payload_type,
    const uint8_t* signing_key
);

void olocus_async_verify_block(FFIAsyncHandle* handle, const FFIBlock* block);
void olocus_async_verify_chain(FFIAsyncHandle* handle, const FFIChain* chain);
void olocus_async_sign(FFIAsyncHandle* handle, const FFIKeyPair* keypair, const uint8_t* data, size_t len);

// Async status
FFIAsyncState olocus_async_get_state(const FFIAsyncHandle* handle);
bool olocus_async_is_complete(const FFIAsyncHandle* handle);
bool olocus_async_is_running(const FFIAsyncHandle* handle);
float olocus_async_get_progress(const FFIAsyncHandle* handle);

// Async control
void olocus_async_cancel(FFIAsyncHandle* handle);
int olocus_async_wait(FFIAsyncHandle* handle);
int olocus_async_wait_timeout(FFIAsyncHandle* handle, uint32_t timeout_ms);
```

### Memory Management

```c
// Basic allocation
void* olocus_alloc(size_t size);
void* olocus_alloc_aligned(size_t size, size_t alignment);
void* olocus_realloc(void* ptr, size_t old_size, size_t new_size);
void olocus_free(void* ptr, size_t size);
void olocus_free_aligned(void* ptr, size_t size, size_t alignment);

// Secure memory operations
void* olocus_secure_alloc(size_t size);
void olocus_secure_free(void* ptr, size_t size);
void olocus_secure_zero(void* ptr, size_t size);
int olocus_mlock(void* ptr, size_t size);
int olocus_munlock(void* ptr, size_t size);

// String memory management
void olocus_free_string(char* str);
char* olocus_string_clone(const char* str);

// Byte buffer management
typedef struct {
    uint8_t* data;
    size_t len;
    size_t capacity;
} FFIByteBuffer;

FFIByteBuffer olocus_byte_buffer_create(size_t capacity);
FFIByteBuffer olocus_byte_buffer_from_data(const uint8_t* data, size_t len);
void olocus_byte_buffer_resize(FFIByteBuffer* buffer, size_t new_size);
void olocus_byte_buffer_append(FFIByteBuffer* buffer, const uint8_t* data, size_t len);
void olocus_byte_buffer_free(FFIByteBuffer* buffer);

// Reference counting (for shared objects)
void olocus_block_retain(FFIBlock* block);
void olocus_block_release(FFIBlock* block);
uint32_t olocus_block_get_ref_count(const FFIBlock* block);

void olocus_chain_retain(FFIChain* chain);
void olocus_chain_release(FFIChain* chain);
uint32_t olocus_chain_get_ref_count(const FFIChain* chain);

// Memory statistics
typedef struct {
    size_t total_allocated;
    size_t peak_allocated;
    size_t current_allocated;
    size_t allocation_count;
    size_t free_count;
} FFIMemoryStats;

void olocus_memory_get_stats(FFIMemoryStats* stats);
void olocus_memory_reset_stats(void);
```

### Error Handling

```c
// Error management
int olocus_get_last_error_code(void);
char* olocus_get_last_error_message(void);
char* olocus_get_last_error_details(void);
void olocus_clear_error(void);

// Error description (static strings, no need to free)
const char* olocus_error_description(int error_code);
const char* olocus_error_category(int error_code);

// Error callback
typedef void (*FFIErrorCallback)(int error_code, const char* message, void* user_data);
void olocus_set_error_callback(FFIErrorCallback callback, void* user_data);
void olocus_clear_error_callback(void);

// Logging
typedef enum {
    FFILogLevel_Error = 0,
    FFILogLevel_Warn = 1,
    FFILogLevel_Info = 2,
    FFILogLevel_Debug = 3,
    FFILogLevel_Trace = 4
} FFILogLevel;

typedef void (*FFILogCallback)(FFILogLevel level, const char* target, const char* message, void* user_data);
void olocus_set_log_callback(FFILogCallback callback, void* user_data);
void olocus_set_log_level(FFILogLevel level);
FFILogLevel olocus_get_log_level(void);
void olocus_log(FFILogLevel level, const char* target, const char* message);

// Panic handling
typedef void (*FFIPanicCallback)(const char* message, void* user_data);
void olocus_set_panic_callback(FFIPanicCallback callback, void* user_data);
```

### Version and Feature Information

```c
// Version information
const char* olocus_version(void);
const char* olocus_version_full(void);
const char* olocus_git_hash(void);
const char* olocus_build_timestamp(void);

typedef struct {
    uint16_t major;
    uint16_t minor;
    uint16_t patch;
    const char* pre_release;
    const char* build_metadata;
} FFIVersion;

void olocus_version_info(FFIVersion* version);
int olocus_version_compare(const FFIVersion* a, const FFIVersion* b);

// Feature detection
bool olocus_has_feature(const char* feature_name);
char** olocus_list_features(size_t* count);
void olocus_free_string_array(char** strings, size_t count);

// Platform information
const char* olocus_platform_name(void);
const char* olocus_architecture(void);
const char* olocus_target_triple(void);

// Compilation information
const char* olocus_compiler_version(void);
const char* olocus_rust_version(void);
char** olocus_compile_flags(size_t* count);
```

## Language-Specific Bindings

### Python (ctypes)

```python
# olocus_bindings.py
import ctypes
from ctypes import POINTER, c_void_p, c_char_p, c_uint8, c_uint32, c_uint64, c_int64, c_size_t, c_int, c_bool, c_float
import os
import platform

# Library loading
def load_olocus_library():
    system = platform.system()
    if system == 'Windows':
        lib_name = 'olocus_ffi.dll'
    elif system == 'Darwin':
        lib_name = 'libolocus_ffi.dylib'
    else:
        lib_name = 'libolocus_ffi.so'
    
    # Try different paths
    for path in ['.', 'lib', '/usr/local/lib', '/usr/lib']:
        lib_path = os.path.join(path, lib_name)
        if os.path.exists(lib_path):
            return ctypes.CDLL(lib_path)
    
    raise FileNotFoundError(f"Could not find {lib_name}")

lib = load_olocus_library()

# Type definitions
class FFIByteBuffer(ctypes.Structure):
    _fields_ = [
        ("data", POINTER(c_uint8)),
        ("len", c_size_t),
        ("capacity", c_size_t)
    ]

class FFIWireFormat(ctypes.Structure):
    _fields_ = [
        ("encoding", c_uint8),
        ("compression", c_uint8),
        ("version", c_uint8),
        ("reserved", c_uint8)
    ]

class FFIVersion(ctypes.Structure):
    _fields_ = [
        ("major", c_uint16),
        ("minor", c_uint16),
        ("patch", c_uint16),
        ("pre_release", c_char_p),
        ("build_metadata", c_char_p)
    ]

# Opaque pointer types
FFIConfig = c_void_p
FFIKeyPair = c_void_p
FFIBlock = c_void_p
FFIChain = c_void_p
FFIHasher = c_void_p
FFIAsyncHandle = c_void_p

# Function signatures
# Initialization
lib.olocus_init.argtypes = []
lib.olocus_init.restype = c_int

lib.olocus_init_with_config.argtypes = [FFIConfig]
lib.olocus_init_with_config.restype = c_int

lib.olocus_shutdown.argtypes = []
lib.olocus_shutdown.restype = None

lib.olocus_is_initialized.argtypes = []
lib.olocus_is_initialized.restype = c_bool

# Configuration
lib.olocus_config_create.argtypes = []
lib.olocus_config_create.restype = FFIConfig

lib.olocus_config_destroy.argtypes = [FFIConfig]
lib.olocus_config_destroy.restype = None

lib.olocus_config_set_network_enabled.argtypes = [FFIConfig, c_bool]
lib.olocus_config_set_network_enabled.restype = None

# Key management
lib.olocus_keypair_generate.argtypes = []
lib.olocus_keypair_generate.restype = FFIKeyPair

lib.olocus_keypair_from_bytes.argtypes = [POINTER(c_uint8)]
lib.olocus_keypair_from_bytes.restype = FFIKeyPair

lib.olocus_keypair_destroy.argtypes = [FFIKeyPair]
lib.olocus_keypair_destroy.restype = None

lib.olocus_keypair_get_public_key.argtypes = [FFIKeyPair, POINTER(c_uint8)]
lib.olocus_keypair_get_public_key.restype = None

lib.olocus_keypair_get_private_key.argtypes = [FFIKeyPair, POINTER(c_uint8)]
lib.olocus_keypair_get_private_key.restype = None

# Block operations
lib.olocus_block_create_genesis.argtypes = [
    c_int64, POINTER(c_uint8), c_size_t, c_uint32, POINTER(c_uint8)
]
lib.olocus_block_create_genesis.restype = FFIBlock

lib.olocus_block_create.argtypes = [
    c_uint64, c_int64, POINTER(c_uint8), POINTER(c_uint8), c_size_t, c_uint32, POINTER(c_uint8)
]
lib.olocus_block_create.restype = FFIBlock

lib.olocus_block_destroy.argtypes = [FFIBlock]
lib.olocus_block_destroy.restype = None

lib.olocus_block_verify.argtypes = [FFIBlock]
lib.olocus_block_verify.restype = c_int

lib.olocus_block_get_index.argtypes = [FFIBlock]
lib.olocus_block_get_index.restype = c_uint64

lib.olocus_block_get_timestamp.argtypes = [FFIBlock]
lib.olocus_block_get_timestamp.restype = c_int64

lib.olocus_block_get_payload_type.argtypes = [FFIBlock]
lib.olocus_block_get_payload_type.restype = c_uint32

lib.olocus_block_get_hash.argtypes = [FFIBlock, POINTER(c_uint8)]
lib.olocus_block_get_hash.restype = None

# Chain operations
lib.olocus_chain_create.argtypes = []
lib.olocus_chain_create.restype = FFIChain

lib.olocus_chain_destroy.argtypes = [FFIChain]
lib.olocus_chain_destroy.restype = None

lib.olocus_chain_add_block.argtypes = [FFIChain, FFIBlock]
lib.olocus_chain_add_block.restype = c_int

lib.olocus_chain_get_length.argtypes = [FFIChain]
lib.olocus_chain_get_length.restype = c_size_t

lib.olocus_chain_verify.argtypes = [FFIChain]
lib.olocus_chain_verify.restype = c_int

# Wire format
lib.olocus_wire_format_json.argtypes = []
lib.olocus_wire_format_json.restype = FFIWireFormat

lib.olocus_block_to_wire_format.argtypes = [FFIBlock, FFIWireFormat]
lib.olocus_block_to_wire_format.restype = FFIByteBuffer

lib.olocus_block_from_wire_format.argtypes = [POINTER(c_uint8), c_size_t, FFIWireFormat]
lib.olocus_block_from_wire_format.restype = FFIBlock

# Memory management
lib.olocus_byte_buffer_free.argtypes = [POINTER(FFIByteBuffer)]
lib.olocus_byte_buffer_free.restype = None

lib.olocus_free_string.argtypes = [c_char_p]
lib.olocus_free_string.restype = None

# Cryptographic operations
lib.olocus_sign.argtypes = [FFIKeyPair, POINTER(c_uint8), c_size_t, POINTER(c_uint8)]
lib.olocus_sign.restype = None

lib.olocus_verify.argtypes = [POINTER(c_uint8), POINTER(c_uint8), c_size_t, POINTER(c_uint8)]
lib.olocus_verify.restype = c_int

lib.olocus_hash_sha256.argtypes = [POINTER(c_uint8), c_size_t, POINTER(c_uint8)]
lib.olocus_hash_sha256.restype = None

lib.olocus_random_bytes.argtypes = [POINTER(c_uint8), c_size_t]
lib.olocus_random_bytes.restype = None

# Error handling
lib.olocus_get_last_error_code.argtypes = []
lib.olocus_get_last_error_code.restype = c_int

lib.olocus_get_last_error_message.argtypes = []
lib.olocus_get_last_error_message.restype = c_char_p

lib.olocus_clear_error.argtypes = []
lib.olocus_clear_error.restype = None

# Version information
lib.olocus_version.argtypes = []
lib.olocus_version.restype = c_char_p

# High-level Python wrapper
class OlocusException(Exception):
    def __init__(self, message, error_code=None):
        super().__init__(message)
        self.error_code = error_code

class KeyPair:
    def __init__(self, ptr=None):
        self._ptr = ptr or lib.olocus_keypair_generate()
        if not self._ptr:
            raise OlocusException("Failed to create keypair")
    
    @classmethod
    def from_bytes(cls, private_key):
        if len(private_key) != 32:
            raise ValueError("Private key must be 32 bytes")
        
        key_array = (c_uint8 * 32)(*private_key)
        ptr = lib.olocus_keypair_from_bytes(key_array)
        if not ptr:
            raise OlocusException("Failed to create keypair from bytes")
        
        return cls(ptr)
    
    def get_public_key(self):
        public_key = (c_uint8 * 32)()
        lib.olocus_keypair_get_public_key(self._ptr, public_key)
        return bytes(public_key)
    
    def get_private_key(self):
        private_key = (c_uint8 * 32)()
        lib.olocus_keypair_get_private_key(self._ptr, private_key)
        return bytes(private_key)
    
    def __del__(self):
        if hasattr(self, '_ptr') and self._ptr:
            lib.olocus_keypair_destroy(self._ptr)

class Block:
    def __init__(self, ptr):
        self._ptr = ptr
    
    @classmethod
    def create_genesis(cls, payload, payload_type=0, signing_key=None):
        if signing_key is None:
            keypair = KeyPair()
            signing_key = keypair.get_private_key()
        
        if len(signing_key) != 32:
            raise ValueError("Signing key must be 32 bytes")
        
        payload_data = payload if isinstance(payload, bytes) else payload.encode('utf-8')
        payload_array = (c_uint8 * len(payload_data))(*payload_data)
        key_array = (c_uint8 * 32)(*signing_key)
        
        ptr = lib.olocus_block_create_genesis(
            int(time.time() * 1000),  # timestamp in ms
            payload_array,
            len(payload_data),
            payload_type,
            key_array
        )
        
        if not ptr:
            error_msg = lib.olocus_get_last_error_message()
            if error_msg:
                msg = error_msg.decode('utf-8')
                lib.olocus_free_string(error_msg)
            else:
                msg = "Unknown error"
            raise OlocusException(msg, lib.olocus_get_last_error_code())
        
        return cls(ptr)
    
    def get_index(self):
        return lib.olocus_block_get_index(self._ptr)
    
    def get_timestamp(self):
        return lib.olocus_block_get_timestamp(self._ptr)
    
    def get_payload_type(self):
        return lib.olocus_block_get_payload_type(self._ptr)
    
    def get_hash(self):
        hash_bytes = (c_uint8 * 32)()
        lib.olocus_block_get_hash(self._ptr, hash_bytes)
        return bytes(hash_bytes)
    
    def verify(self):
        result = lib.olocus_block_verify(self._ptr)
        if result != 0:
            error_msg = lib.olocus_get_last_error_message()
            if error_msg:
                msg = error_msg.decode('utf-8')
                lib.olocus_free_string(error_msg)
                raise OlocusException(msg, result)
        return True
    
    def to_json(self):
        wire_format = lib.olocus_wire_format_json()
        buffer = lib.olocus_block_to_wire_format(self._ptr, wire_format)
        try:
            data = ctypes.string_at(buffer.data, buffer.len)
            return data.decode('utf-8')
        finally:
            lib.olocus_byte_buffer_free(ctypes.byref(buffer))
    
    def __del__(self):
        if hasattr(self, '_ptr') and self._ptr:
            lib.olocus_block_destroy(self._ptr)

class Chain:
    def __init__(self):
        self._ptr = lib.olocus_chain_create()
        if not self._ptr:
            raise OlocusException("Failed to create chain")
    
    def add_block(self, block):
        result = lib.olocus_chain_add_block(self._ptr, block._ptr)
        if result != 0:
            error_msg = lib.olocus_get_last_error_message()
            if error_msg:
                msg = error_msg.decode('utf-8')
                lib.olocus_free_string(error_msg)
            else:
                msg = "Unknown error"
            raise OlocusException(msg, result)
    
    def get_length(self):
        return lib.olocus_chain_get_length(self._ptr)
    
    def verify(self):
        result = lib.olocus_chain_verify(self._ptr)
        if result != 0:
            error_msg = lib.olocus_get_last_error_message()
            if error_msg:
                msg = error_msg.decode('utf-8')
                lib.olocus_free_string(error_msg)
                raise OlocusException(msg, result)
        return True
    
    def __del__(self):
        if hasattr(self, '_ptr') and self._ptr:
            lib.olocus_chain_destroy(self._ptr)

# Module initialization
def initialize():
    result = lib.olocus_init()
    if result != 0:
        error_msg = lib.olocus_get_last_error_message()
        if error_msg:
            msg = error_msg.decode('utf-8')
            lib.olocus_free_string(error_msg)
        else:
            msg = "Unknown error"
        raise OlocusException(msg, result)

def shutdown():
    lib.olocus_shutdown()

def get_version():
    version_ptr = lib.olocus_version()
    return version_ptr.decode('utf-8') if version_ptr else "unknown"

# Utility functions
def sign_data(data, keypair):
    if isinstance(data, str):
        data = data.encode('utf-8')
    
    data_array = (c_uint8 * len(data))(*data)
    signature = (c_uint8 * 64)()
    
    lib.olocus_sign(keypair._ptr, data_array, len(data), signature)
    return bytes(signature)

def verify_signature(data, signature, public_key):
    if isinstance(data, str):
        data = data.encode('utf-8')
    
    if len(signature) != 64:
        raise ValueError("Signature must be 64 bytes")
    
    if len(public_key) != 32:
        raise ValueError("Public key must be 32 bytes")
    
    data_array = (c_uint8 * len(data))(*data)
    sig_array = (c_uint8 * 64)(*signature)
    key_array = (c_uint8 * 32)(*public_key)
    
    result = lib.olocus_verify(key_array, data_array, len(data), sig_array)
    return result == 0

def hash_sha256(data):
    if isinstance(data, str):
        data = data.encode('utf-8')
    
    data_array = (c_uint8 * len(data))(*data)
    hash_bytes = (c_uint8 * 32)()
    
    lib.olocus_hash_sha256(data_array, len(data), hash_bytes)
    return bytes(hash_bytes)

def random_bytes(length):
    buffer = (c_uint8 * length)()
    lib.olocus_random_bytes(buffer, length)
    return bytes(buffer)
```

### Go (CGO)

```go
// olocus.go
package olocus

/*
#cgo LDFLAGS: -L. -lolocus_ffi
#include <stdint.h>
#include <stdlib.h>
#include <stdbool.h>

// Forward declarations for opaque types
typedef void* FFIConfig;
typedef void* FFIKeyPair;
typedef void* FFIBlock;
typedef void* FFIChain;
typedef void* FFIHasher;
typedef void* FFIAsyncHandle;

// Structures
typedef struct {
    uint8_t* data;
    size_t len;
    size_t capacity;
} FFIByteBuffer;

typedef struct {
    uint8_t encoding;
    uint8_t compression;
    uint8_t version;
    uint8_t reserved;
} FFIWireFormat;

// Function declarations
int olocus_init(void);
int olocus_init_with_config(FFIConfig config);
void olocus_shutdown(void);
bool olocus_is_initialized(void);

FFIConfig olocus_config_create(void);
void olocus_config_destroy(FFIConfig config);
void olocus_config_set_network_enabled(FFIConfig config, bool enabled);

FFIKeyPair olocus_keypair_generate(void);
FFIKeyPair olocus_keypair_from_bytes(const uint8_t* private_key);
void olocus_keypair_destroy(FFIKeyPair keypair);
void olocus_keypair_get_public_key(FFIKeyPair keypair, uint8_t* public_key);
void olocus_keypair_get_private_key(FFIKeyPair keypair, uint8_t* private_key);

FFIBlock olocus_block_create_genesis(
    int64_t timestamp,
    const uint8_t* payload,
    size_t payload_len,
    uint32_t payload_type,
    const uint8_t* signing_key
);

FFIBlock olocus_block_create(
    uint64_t index,
    int64_t timestamp,
    const uint8_t* previous_hash,
    const uint8_t* payload,
    size_t payload_len,
    uint32_t payload_type,
    const uint8_t* signing_key
);

void olocus_block_destroy(FFIBlock block);
int olocus_block_verify(FFIBlock block);
uint64_t olocus_block_get_index(FFIBlock block);
int64_t olocus_block_get_timestamp(FFIBlock block);
uint32_t olocus_block_get_payload_type(FFIBlock block);
void olocus_block_get_hash(FFIBlock block, uint8_t* hash);

FFIChain olocus_chain_create(void);
void olocus_chain_destroy(FFIChain chain);
int olocus_chain_add_block(FFIChain chain, FFIBlock block);
size_t olocus_chain_get_length(FFIChain chain);
int olocus_chain_verify(FFIChain chain);

FFIWireFormat olocus_wire_format_json(void);
FFIByteBuffer olocus_block_to_wire_format(FFIBlock block, FFIWireFormat format);
FFIBlock olocus_block_from_wire_format(const uint8_t* data, size_t data_len, FFIWireFormat format);
void olocus_byte_buffer_free(FFIByteBuffer* buffer);

void olocus_sign(FFIKeyPair keypair, const uint8_t* message, size_t message_len, uint8_t* signature);
int olocus_verify(const uint8_t* public_key, const uint8_t* message, size_t message_len, const uint8_t* signature);
void olocus_hash_sha256(const uint8_t* data, size_t data_len, uint8_t* hash);
void olocus_random_bytes(uint8_t* buffer, size_t len);

int olocus_get_last_error_code(void);
char* olocus_get_last_error_message(void);
void olocus_clear_error(void);
void olocus_free_string(char* str);

const char* olocus_version(void);
*/
import "C"

import (
    "errors"
    "runtime"
    "time"
    "unsafe"
)

// Error types
type Error struct {
    Code    int
    Message string
}

func (e *Error) Error() string {
    return e.Message
}

// Initialize the library
func Initialize() error {
    result := C.olocus_init()
    if result != 0 {
        return getLastError()
    }
    return nil
}

// Shutdown the library
func Shutdown() {
    C.olocus_shutdown()
}

// Check if library is initialized
func IsInitialized() bool {
    return bool(C.olocus_is_initialized())
}

// Get version information
func Version() string {
    cStr := C.olocus_version()
    return C.GoString(cStr)
}

// KeyPair represents an Ed25519 key pair
type KeyPair struct {
    ptr C.FFIKeyPair
}

// Generate a new key pair
func GenerateKeyPair() (*KeyPair, error) {
    ptr := C.olocus_keypair_generate()
    if ptr == nil {
        return nil, getLastError()
    }
    
    kp := &KeyPair{ptr: ptr}
    runtime.SetFinalizer(kp, (*KeyPair).destroy)
    return kp, nil
}

// Create key pair from private key bytes
func KeyPairFromBytes(privateKey []byte) (*KeyPair, error) {
    if len(privateKey) != 32 {
        return nil, errors.New("private key must be 32 bytes")
    }
    
    ptr := C.olocus_keypair_from_bytes((*C.uint8_t)(unsafe.Pointer(&privateKey[0])))
    if ptr == nil {
        return nil, getLastError()
    }
    
    kp := &KeyPair{ptr: ptr}
    runtime.SetFinalizer(kp, (*KeyPair).destroy)
    return kp, nil
}

// Get public key bytes
func (kp *KeyPair) PublicKey() []byte {
    publicKey := make([]byte, 32)
    C.olocus_keypair_get_public_key(kp.ptr, (*C.uint8_t)(unsafe.Pointer(&publicKey[0])))
    return publicKey
}

// Get private key bytes
func (kp *KeyPair) PrivateKey() []byte {
    privateKey := make([]byte, 32)
    C.olocus_keypair_get_private_key(kp.ptr, (*C.uint8_t)(unsafe.Pointer(&privateKey[0])))
    return privateKey
}

// Destroy the key pair (called by finalizer)
func (kp *KeyPair) destroy() {
    if kp.ptr != nil {
        C.olocus_keypair_destroy(kp.ptr)
        kp.ptr = nil
    }
}

// Manually destroy the key pair
func (kp *KeyPair) Destroy() {
    kp.destroy()
    runtime.SetFinalizer(kp, nil)
}

// Block represents a blockchain block
type Block struct {
    ptr C.FFIBlock
}

// Create a genesis block
func CreateGenesisBlock(payload []byte, payloadType uint32, signingKey []byte) (*Block, error) {
    if len(signingKey) != 32 {
        return nil, errors.New("signing key must be 32 bytes")
    }
    
    timestamp := time.Now().UnixMilli()
    
    var payloadPtr *C.uint8_t
    if len(payload) > 0 {
        payloadPtr = (*C.uint8_t)(unsafe.Pointer(&payload[0]))
    }
    
    ptr := C.olocus_block_create_genesis(
        C.int64_t(timestamp),
        payloadPtr,
        C.size_t(len(payload)),
        C.uint32_t(payloadType),
        (*C.uint8_t)(unsafe.Pointer(&signingKey[0])),
    )
    
    if ptr == nil {
        return nil, getLastError()
    }
    
    block := &Block{ptr: ptr}
    runtime.SetFinalizer(block, (*Block).destroy)
    return block, nil
}

// Create a regular block
func CreateBlock(index uint64, previousHash, payload []byte, payloadType uint32, signingKey []byte) (*Block, error) {
    if len(previousHash) != 32 {
        return nil, errors.New("previous hash must be 32 bytes")
    }
    if len(signingKey) != 32 {
        return nil, errors.New("signing key must be 32 bytes")
    }
    
    timestamp := time.Now().UnixMilli()
    
    var payloadPtr *C.uint8_t
    if len(payload) > 0 {
        payloadPtr = (*C.uint8_t)(unsafe.Pointer(&payload[0]))
    }
    
    ptr := C.olocus_block_create(
        C.uint64_t(index),
        C.int64_t(timestamp),
        (*C.uint8_t)(unsafe.Pointer(&previousHash[0])),
        payloadPtr,
        C.size_t(len(payload)),
        C.uint32_t(payloadType),
        (*C.uint8_t)(unsafe.Pointer(&signingKey[0])),
    )
    
    if ptr == nil {
        return nil, getLastError()
    }
    
    block := &Block{ptr: ptr}
    runtime.SetFinalizer(block, (*Block).destroy)
    return block, nil
}

// Get block index
func (b *Block) Index() uint64 {
    return uint64(C.olocus_block_get_index(b.ptr))
}

// Get block timestamp
func (b *Block) Timestamp() time.Time {
    timestamp := int64(C.olocus_block_get_timestamp(b.ptr))
    return time.UnixMilli(timestamp)
}

// Get payload type
func (b *Block) PayloadType() uint32 {
    return uint32(C.olocus_block_get_payload_type(b.ptr))
}

// Get block hash
func (b *Block) Hash() []byte {
    hash := make([]byte, 32)
    C.olocus_block_get_hash(b.ptr, (*C.uint8_t)(unsafe.Pointer(&hash[0])))
    return hash
}

// Verify block
func (b *Block) Verify() error {
    result := C.olocus_block_verify(b.ptr)
    if result != 0 {
        return getLastError()
    }
    return nil
}

// Convert block to JSON
func (b *Block) ToJSON() ([]byte, error) {
    format := C.olocus_wire_format_json()
    buffer := C.olocus_block_to_wire_format(b.ptr, format)
    defer C.olocus_byte_buffer_free(&buffer)
    
    if buffer.data == nil {
        return nil, getLastError()
    }
    
    data := C.GoBytes(unsafe.Pointer(buffer.data), C.int(buffer.len))
    return data, nil
}

// Destroy the block (called by finalizer)
func (b *Block) destroy() {
    if b.ptr != nil {
        C.olocus_block_destroy(b.ptr)
        b.ptr = nil
    }
}

// Manually destroy the block
func (b *Block) Destroy() {
    b.destroy()
    runtime.SetFinalizer(b, nil)
}

// Chain represents a blockchain
type Chain struct {
    ptr C.FFIChain
}

// Create a new chain
func CreateChain() (*Chain, error) {
    ptr := C.olocus_chain_create()
    if ptr == nil {
        return nil, getLastError()
    }
    
    chain := &Chain{ptr: ptr}
    runtime.SetFinalizer(chain, (*Chain).destroy)
    return chain, nil
}

// Add block to chain
func (c *Chain) AddBlock(block *Block) error {
    result := C.olocus_chain_add_block(c.ptr, block.ptr)
    if result != 0 {
        return getLastError()
    }
    return nil
}

// Get chain length
func (c *Chain) Length() uint64 {
    return uint64(C.olocus_chain_get_length(c.ptr))
}

// Verify chain
func (c *Chain) Verify() error {
    result := C.olocus_chain_verify(c.ptr)
    if result != 0 {
        return getLastError()
    }
    return nil
}

// Destroy the chain (called by finalizer)
func (c *Chain) destroy() {
    if c.ptr != nil {
        C.olocus_chain_destroy(c.ptr)
        c.ptr = nil
    }
}

// Manually destroy the chain
func (c *Chain) Destroy() {
    c.destroy()
    runtime.SetFinalizer(c, nil)
}

// Cryptographic functions

// Sign data with key pair
func Sign(kp *KeyPair, data []byte) []byte {
    signature := make([]byte, 64)
    
    var dataPtr *C.uint8_t
    if len(data) > 0 {
        dataPtr = (*C.uint8_t)(unsafe.Pointer(&data[0]))
    }
    
    C.olocus_sign(
        kp.ptr,
        dataPtr,
        C.size_t(len(data)),
        (*C.uint8_t)(unsafe.Pointer(&signature[0])),
    )
    
    return signature
}

// Verify signature
func Verify(publicKey, data, signature []byte) bool {
    if len(publicKey) != 32 || len(signature) != 64 {
        return false
    }
    
    var dataPtr *C.uint8_t
    if len(data) > 0 {
        dataPtr = (*C.uint8_t)(unsafe.Pointer(&data[0]))
    }
    
    result := C.olocus_verify(
        (*C.uint8_t)(unsafe.Pointer(&publicKey[0])),
        dataPtr,
        C.size_t(len(data)),
        (*C.uint8_t)(unsafe.Pointer(&signature[0])),
    )
    
    return result == 0
}

// Hash data with SHA-256
func HashSHA256(data []byte) []byte {
    hash := make([]byte, 32)
    
    var dataPtr *C.uint8_t
    if len(data) > 0 {
        dataPtr = (*C.uint8_t)(unsafe.Pointer(&data[0]))
    }
    
    C.olocus_hash_sha256(
        dataPtr,
        C.size_t(len(data)),
        (*C.uint8_t)(unsafe.Pointer(&hash[0])),
    )
    
    return hash
}

// Generate random bytes
func RandomBytes(length int) []byte {
    if length <= 0 {
        return nil
    }
    
    buffer := make([]byte, length)
    C.olocus_random_bytes(
        (*C.uint8_t)(unsafe.Pointer(&buffer[0])),
        C.size_t(length),
    )
    
    return buffer
}

// Utility functions

// Get last error from the library
func getLastError() error {
    code := int(C.olocus_get_last_error_code())
    
    msgPtr := C.olocus_get_last_error_message()
    var message string
    if msgPtr != nil {
        message = C.GoString(msgPtr)
        C.olocus_free_string(msgPtr)
    } else {
        message = "Unknown error"
    }
    
    return &Error{Code: code, Message: message}
}
```

## Platform-Specific Considerations

### iOS Specific

```c
// iOS-specific functions
void olocus_config_set_keychain_service(FFIConfig* config, const char* service);
void olocus_config_set_keychain_access_group(FFIConfig* config, const char* access_group);
void olocus_config_set_secure_enclave_enabled(FFIConfig* config, bool enabled);
void olocus_config_set_biometric_auth_enabled(FFIConfig* config, bool enabled);

// iOS Keychain integration
int olocus_keychain_store_key(const char* identifier, const uint8_t* key, size_t key_len);
int olocus_keychain_load_key(const char* identifier, uint8_t* key, size_t* key_len);
int olocus_keychain_delete_key(const char* identifier);
bool olocus_keychain_key_exists(const char* identifier);

// Secure Enclave operations
FFIKeyPair* olocus_secure_enclave_generate_key(const char* key_tag);
int olocus_secure_enclave_sign(
    const char* key_tag,
    const uint8_t* data,
    size_t data_len,
    uint8_t* signature,
    const char* auth_prompt
);

// App Attest integration
int olocus_app_attest_generate_key(char** key_id);
int olocus_app_attest_create_attestation(
    const char* key_id,
    const uint8_t* challenge,
    size_t challenge_len,
    uint8_t** attestation,
    size_t* attestation_len
);
```

### Android Specific

```c
// Android-specific functions
void olocus_config_set_keystore_alias(FFIConfig* config, const char* alias);
void olocus_config_set_hardware_backed(FFIConfig* config, bool enabled);
void olocus_config_set_strongbox_enabled(FFIConfig* config, bool enabled);
void olocus_config_set_biometric_required(FFIConfig* config, bool required);

// Android Keystore integration
int olocus_android_keystore_generate_key(const char* alias);
int olocus_android_keystore_sign(
    const char* alias,
    const uint8_t* data,
    size_t data_len,
    uint8_t* signature
);
int olocus_android_keystore_verify_key_properties(const char* alias);
bool olocus_android_keystore_is_hardware_backed(const char* alias);
bool olocus_android_keystore_is_strongbox_backed(const char* alias);

// Play Integrity API integration
int olocus_play_integrity_request_token(
    const char* nonce,
    char** integrity_token
);
int olocus_play_integrity_verify_token(
    const char* token,
    bool* is_valid
);
```

### WebAssembly Specific

```c
// WebAssembly-specific functions (when compiled with wasm feature)
void olocus_config_set_memory_limit(FFIConfig* config, size_t limit_bytes);
void olocus_config_set_wasm_optimization_level(FFIConfig* config, uint8_t level);

// Web-specific storage
int olocus_web_storage_set_item(const char* key, const uint8_t* data, size_t data_len);
int olocus_web_storage_get_item(const char* key, uint8_t* data, size_t* data_len);
int olocus_web_storage_remove_item(const char* key);
void olocus_web_storage_clear(void);

// Performance monitoring
void olocus_wasm_get_memory_usage(size_t* used, size_t* total);
uint32_t olocus_wasm_get_heap_size(void);
```

## Threading and Safety

### Thread Safety Rules

1. **Initialization**: Only one thread should call `olocus_init()` or `olocus_shutdown()`
2. **Error Context**: Error state is thread-local - each thread has its own error code and message
3. **Immutable Objects**: `FFIBlock` objects are thread-safe for read operations once created
4. **Mutable Objects**: `FFIChain` requires external synchronization for concurrent access
5. **Cryptographic Operations**: All crypto functions are thread-safe
6. **Configuration**: `FFIConfig` objects should not be shared between threads

### Synchronization Example (C)

```c
#include <pthread.h>

typedef struct {
    FFIChain* chain;
    pthread_mutex_t mutex;
    pthread_rwlock_t rwlock;
} ThreadSafeChain;

ThreadSafeChain* thread_safe_chain_create() {
    ThreadSafeChain* tsc = malloc(sizeof(ThreadSafeChain));
    tsc->chain = olocus_chain_create();
    pthread_mutex_init(&tsc->mutex, NULL);
    pthread_rwlock_init(&tsc->rwlock, NULL);
    return tsc;
}

int thread_safe_chain_add_block(ThreadSafeChain* tsc, const FFIBlock* block) {
    pthread_rwlock_wrlock(&tsc->rwlock);
    int result = olocus_chain_add_block(tsc->chain, block);
    pthread_rwlock_unlock(&tsc->rwlock);
    return result;
}

size_t thread_safe_chain_get_length(ThreadSafeChain* tsc) {
    pthread_rwlock_rdlock(&tsc->rwlock);
    size_t length = olocus_chain_get_length(tsc->chain);
    pthread_rwlock_unlock(&tsc->rwlock);
    return length;
}

void thread_safe_chain_destroy(ThreadSafeChain* tsc) {
    pthread_rwlock_destroy(&tsc->rwlock);
    pthread_mutex_destroy(&tsc->mutex);
    olocus_chain_destroy(tsc->chain);
    free(tsc);
}
```

## Memory Management Best Practices

### RAII Pattern (C++)

```cpp
// olocus_raii.hpp
#include "olocus_ffi.h"
#include <memory>
#include <stdexcept>

namespace olocus {

class KeyPair {
public:
    KeyPair() : ptr_(olocus_keypair_generate()) {
        if (!ptr_) {
            throw std::runtime_error("Failed to generate keypair");
        }
    }
    
    explicit KeyPair(const std::array<uint8_t, 32>& private_key)
        : ptr_(olocus_keypair_from_bytes(private_key.data())) {
        if (!ptr_) {
            throw std::runtime_error("Failed to create keypair from bytes");
        }
    }
    
    ~KeyPair() {
        if (ptr_) {
            olocus_keypair_destroy(ptr_);
        }
    }
    
    // Non-copyable, movable
    KeyPair(const KeyPair&) = delete;
    KeyPair& operator=(const KeyPair&) = delete;
    
    KeyPair(KeyPair&& other) noexcept : ptr_(other.ptr_) {
        other.ptr_ = nullptr;
    }
    
    KeyPair& operator=(KeyPair&& other) noexcept {
        if (this != &other) {
            if (ptr_) {
                olocus_keypair_destroy(ptr_);
            }
            ptr_ = other.ptr_;
            other.ptr_ = nullptr;
        }
        return *this;
    }
    
    std::array<uint8_t, 32> public_key() const {
        std::array<uint8_t, 32> key;
        olocus_keypair_get_public_key(ptr_, key.data());
        return key;
    }
    
    std::array<uint8_t, 32> private_key() const {
        std::array<uint8_t, 32> key;
        olocus_keypair_get_private_key(ptr_, key.data());
        return key;
    }
    
    FFIKeyPair* get() const { return ptr_; }
    
private:
    FFIKeyPair* ptr_;
};

class Block {
public:
    static Block create_genesis(const std::vector<uint8_t>& payload,
                              uint32_t payload_type,
                              const std::array<uint8_t, 32>& signing_key) {
        auto ptr = olocus_block_create_genesis(
            std::chrono::duration_cast<std::chrono::milliseconds>(
                std::chrono::system_clock::now().time_since_epoch()
            ).count(),
            payload.data(),
            payload.size(),
            payload_type,
            signing_key.data()
        );
        
        if (!ptr) {
            throw std::runtime_error("Failed to create genesis block");
        }
        
        return Block(ptr);
    }
    
    ~Block() {
        if (ptr_) {
            olocus_block_destroy(ptr_);
        }
    }
    
    Block(const Block&) = delete;
    Block& operator=(const Block&) = delete;
    
    Block(Block&& other) noexcept : ptr_(other.ptr_) {
        other.ptr_ = nullptr;
    }
    
    Block& operator=(Block&& other) noexcept {
        if (this != &other) {
            if (ptr_) {
                olocus_block_destroy(ptr_);
            }
            ptr_ = other.ptr_;
            other.ptr_ = nullptr;
        }
        return *this;
    }
    
    uint64_t index() const {
        return olocus_block_get_index(ptr_);
    }
    
    int64_t timestamp() const {
        return olocus_block_get_timestamp(ptr_);
    }
    
    uint32_t payload_type() const {
        return olocus_block_get_payload_type(ptr_);
    }
    
    std::array<uint8_t, 32> hash() const {
        std::array<uint8_t, 32> h;
        olocus_block_get_hash(ptr_, h.data());
        return h;
    }
    
    void verify() const {
        int result = olocus_block_verify(ptr_);
        if (result != 0) {
            auto msg = olocus_get_last_error_message();
            std::string error_msg = msg ? msg : "Unknown error";
            if (msg) olocus_free_string(msg);
            throw std::runtime_error(error_msg);
        }
    }
    
    FFIBlock* get() const { return ptr_; }
    
private:
    explicit Block(FFIBlock* ptr) : ptr_(ptr) {}
    FFIBlock* ptr_;
};

class Chain {
public:
    Chain() : ptr_(olocus_chain_create()) {
        if (!ptr_) {
            throw std::runtime_error("Failed to create chain");
        }
    }
    
    ~Chain() {
        if (ptr_) {
            olocus_chain_destroy(ptr_);
        }
    }
    
    Chain(const Chain&) = delete;
    Chain& operator=(const Chain&) = delete;
    
    Chain(Chain&& other) noexcept : ptr_(other.ptr_) {
        other.ptr_ = nullptr;
    }
    
    Chain& operator=(Chain&& other) noexcept {
        if (this != &other) {
            if (ptr_) {
                olocus_chain_destroy(ptr_);
            }
            ptr_ = other.ptr_;
            other.ptr_ = nullptr;
        }
        return *this;
    }
    
    void add_block(const Block& block) {
        int result = olocus_chain_add_block(ptr_, block.get());
        if (result != 0) {
            auto msg = olocus_get_last_error_message();
            std::string error_msg = msg ? msg : "Unknown error";
            if (msg) olocus_free_string(msg);
            throw std::runtime_error(error_msg);
        }
    }
    
    size_t length() const {
        return olocus_chain_get_length(ptr_);
    }
    
    void verify() const {
        int result = olocus_chain_verify(ptr_);
        if (result != 0) {
            auto msg = olocus_get_last_error_message();
            std::string error_msg = msg ? msg : "Unknown error";
            if (msg) olocus_free_string(msg);
            throw std::runtime_error(error_msg);
        }
    }
    
private:
    FFIChain* ptr_;
};

} // namespace olocus
```

## Error Handling Patterns

### Error Codes Reference

```c
// Core errors (0-99)
#define OLOCUS_SUCCESS                    0
#define OLOCUS_VERSION_MISMATCH          1
#define OLOCUS_BROKEN_CHAIN              2
#define OLOCUS_INVALID_INDEX             3
#define OLOCUS_TIMESTAMP_REGRESSION      4
#define OLOCUS_PAYLOAD_MISMATCH          5
#define OLOCUS_INVALID_SIGNATURE         6
#define OLOCUS_MALFORMED_BLOCK           7
#define OLOCUS_UNKNOWN_PAYLOAD_TYPE      8
#define OLOCUS_PAYLOAD_TOO_LARGE         9
#define OLOCUS_TIMESTAMP_TOO_FUTURE     10
#define OLOCUS_TIMESTAMP_TOO_OLD        11
#define OLOCUS_FORK_TOO_DEEP            12

// FFI errors (100-199)
#define OLOCUS_NULL_POINTER            100
#define OLOCUS_INVALID_UTF8            101
#define OLOCUS_SERIALIZATION_ERROR     102
#define OLOCUS_DESERIALIZATION_ERROR   103
#define OLOCUS_INVALID_ARGUMENT        104
#define OLOCUS_OUT_OF_MEMORY          105
#define OLOCUS_NOT_INITIALIZED        106
#define OLOCUS_ALREADY_INITIALIZED    107
#define OLOCUS_OPERATION_FAILED       108
#define OLOCUS_BUFFER_TOO_SMALL       109
#define OLOCUS_INVALID_HANDLE         110
#define OLOCUS_CRYPTO_ERROR           115
#define OLOCUS_INVALID_KEY            116

// Platform errors (200-299)
#define OLOCUS_KEYCHAIN_ERROR         200
#define OLOCUS_KEYSTORE_ERROR         201
#define OLOCUS_PLATFORM_NOT_SUPPORTED 202
```

### Comprehensive Error Handling (C)

```c
// error_handling.h
#include "olocus_ffi.h"
#include <stdio.h>
#include <string.h>

typedef struct {
    int code;
    char message[256];
    char details[512];
} olocus_error_t;

// Get comprehensive error information
static inline olocus_error_t olocus_get_error_info() {
    olocus_error_t error;
    error.code = olocus_get_last_error_code();
    
    char* msg = olocus_get_last_error_message();
    if (msg) {
        strncpy(error.message, msg, sizeof(error.message) - 1);
        error.message[sizeof(error.message) - 1] = '\0';
        olocus_free_string(msg);
    } else {
        strcpy(error.message, "Unknown error");
    }
    
    char* details = olocus_get_last_error_details();
    if (details) {
        strncpy(error.details, details, sizeof(error.details) - 1);
        error.details[sizeof(error.details) - 1] = '\0';
        olocus_free_string(details);
    } else {
        strcpy(error.details, "No additional details");
    }
    
    return error;
}

// Check if operation succeeded
#define OLOCUS_CHECK(expr) do { \
    int _result = (expr); \
    if (_result != 0) { \
        olocus_error_t _error = olocus_get_error_info(); \
        fprintf(stderr, "Olocus error %d in %s:%d: %s\n", \
                _error.code, __FILE__, __LINE__, _error.message); \
        return _result; \
    } \
} while(0)

// Check with custom error handling
#define OLOCUS_CHECK_GOTO(expr, label) do { \
    int _result = (expr); \
    if (_result != 0) { \
        error = olocus_get_error_info(); \
        goto label; \
    } \
} while(0)

// Example usage
int example_with_error_handling() {
    FFIConfig* config = NULL;
    FFIKeyPair* keypair = NULL;
    FFIBlock* block = NULL;
    olocus_error_t error = {0};
    int result = 0;
    
    // Create configuration
    config = olocus_config_create();
    if (!config) {
        error = olocus_get_error_info();
        fprintf(stderr, "Failed to create config: %s\n", error.message);
        result = -1;
        goto cleanup;
    }
    
    // Initialize library
    OLOCUS_CHECK_GOTO(olocus_init_with_config(config), cleanup);
    
    // Generate keypair
    keypair = olocus_keypair_generate();
    if (!keypair) {
        error = olocus_get_error_info();
        fprintf(stderr, "Failed to generate keypair: %s\n", error.message);
        result = -1;
        goto cleanup;
    }
    
    // Create block
    uint8_t payload[] = "Hello, world!";
    uint8_t private_key[32];
    olocus_keypair_get_private_key(keypair, private_key);
    
    block = olocus_block_create_genesis(
        1234567890000LL,
        payload,
        sizeof(payload) - 1,
        0,
        private_key
    );
    
    if (!block) {
        error = olocus_get_error_info();
        fprintf(stderr, "Failed to create block: %s\n", error.message);
        fprintf(stderr, "Details: %s\n", error.details);
        result = -1;
        goto cleanup;
    }
    
    // Verify block
    OLOCUS_CHECK_GOTO(olocus_block_verify(block), cleanup);
    
    printf("Success: Block created and verified\n");
    
cleanup:
    // Clean up resources
    if (block) olocus_block_destroy(block);
    if (keypair) olocus_keypair_destroy(keypair);
    if (config) olocus_config_destroy(config);
    
    // Clear sensitive data
    memset(&private_key, 0, sizeof(private_key));
    
    if (result == 0) {
        olocus_shutdown();
    }
    
    return result;
}
```

## Performance Optimization

### Batch Operations

```c
// Batch block verification
int verify_blocks_batch(const FFIBlock* const* blocks, size_t block_count) {
    for (size_t i = 0; i < block_count; i++) {
        int result = olocus_block_verify(blocks[i]);
        if (result != 0) {
            return result;  // Return error code of first failure
        }
    }
    return 0;
}

// Parallel verification using async operations
typedef struct {
    const FFIBlock* block;
    FFIAsyncHandle* handle;
    int result;
} async_verify_context_t;

void verify_callback(void* user_data, int result, const void* data, size_t len) {
    async_verify_context_t* ctx = (async_verify_context_t*)user_data;
    ctx->result = result;
}

int verify_blocks_parallel(const FFIBlock* const* blocks, size_t block_count) {
    async_verify_context_t* contexts = malloc(sizeof(async_verify_context_t) * block_count);
    
    // Start all verifications
    for (size_t i = 0; i < block_count; i++) {
        contexts[i].block = blocks[i];
        contexts[i].handle = olocus_async_create(verify_callback, &contexts[i]);
        contexts[i].result = -1;
        
        olocus_async_verify_block(contexts[i].handle, blocks[i]);
    }
    
    // Wait for all to complete
    int overall_result = 0;
    for (size_t i = 0; i < block_count; i++) {
        olocus_async_wait(contexts[i].handle);
        
        if (contexts[i].result != 0 && overall_result == 0) {
            overall_result = contexts[i].result;
        }
        
        olocus_async_destroy(contexts[i].handle);
    }
    
    free(contexts);
    return overall_result;
}
```

### Memory Pool Allocation

```c
// Simple memory pool for frequent allocations
typedef struct {
    uint8_t* pool;
    size_t pool_size;
    size_t offset;
    size_t alignment;
} memory_pool_t;

memory_pool_t* memory_pool_create(size_t size, size_t alignment) {
    memory_pool_t* pool = malloc(sizeof(memory_pool_t));
    pool->pool = aligned_alloc(alignment, size);
    pool->pool_size = size;
    pool->offset = 0;
    pool->alignment = alignment;
    return pool;
}

void* memory_pool_alloc(memory_pool_t* pool, size_t size) {
    // Align size
    size = (size + pool->alignment - 1) & ~(pool->alignment - 1);
    
    if (pool->offset + size > pool->pool_size) {
        return NULL;  // Pool exhausted
    }
    
    void* ptr = pool->pool + pool->offset;
    pool->offset += size;
    return ptr;
}

void memory_pool_reset(memory_pool_t* pool) {
    pool->offset = 0;
}

void memory_pool_destroy(memory_pool_t* pool) {
    free(pool->pool);
    free(pool);
}
```

## Testing and Debugging

### Unit Test Framework Integration

```c
// test_olocus.c - Example with Unity test framework
#include "unity.h"
#include "olocus_ffi.h"

void setUp(void) {
    int result = olocus_init();
    TEST_ASSERT_EQUAL(0, result);
}

void tearDown(void) {
    olocus_shutdown();
}

void test_keypair_generation(void) {
    FFIKeyPair* keypair = olocus_keypair_generate();
    TEST_ASSERT_NOT_NULL(keypair);
    
    uint8_t public_key[32];
    uint8_t private_key[32];
    
    olocus_keypair_get_public_key(keypair, public_key);
    olocus_keypair_get_private_key(keypair, private_key);
    
    // Test that keys are not all zeros
    bool public_zero = true, private_zero = true;
    for (int i = 0; i < 32; i++) {
        if (public_key[i] != 0) public_zero = false;
        if (private_key[i] != 0) private_zero = false;
    }
    
    TEST_ASSERT_FALSE(public_zero);
    TEST_ASSERT_FALSE(private_zero);
    
    olocus_keypair_destroy(keypair);
}

void test_block_creation_and_verification(void) {
    FFIKeyPair* keypair = olocus_keypair_generate();
    TEST_ASSERT_NOT_NULL(keypair);
    
    uint8_t private_key[32];
    olocus_keypair_get_private_key(keypair, private_key);
    
    const char* payload = "Test payload";
    FFIBlock* block = olocus_block_create_genesis(
        1234567890000LL,
        (const uint8_t*)payload,
        strlen(payload),
        0,
        private_key
    );
    
    TEST_ASSERT_NOT_NULL(block);
    
    // Test block properties
    TEST_ASSERT_EQUAL(0, olocus_block_get_index(block));
    TEST_ASSERT_EQUAL(1234567890000LL, olocus_block_get_timestamp(block));
    TEST_ASSERT_EQUAL(0, olocus_block_get_payload_type(block));
    
    // Verify block
    int result = olocus_block_verify(block);
    TEST_ASSERT_EQUAL(0, result);
    
    olocus_block_destroy(block);
    olocus_keypair_destroy(keypair);
}

void test_chain_operations(void) {
    FFIChain* chain = olocus_chain_create();
    TEST_ASSERT_NOT_NULL(chain);
    
    TEST_ASSERT_TRUE(olocus_chain_is_empty(chain));
    TEST_ASSERT_EQUAL(0, olocus_chain_get_length(chain));
    
    // Create and add genesis block
    FFIKeyPair* keypair = olocus_keypair_generate();
    uint8_t private_key[32];
    olocus_keypair_get_private_key(keypair, private_key);
    
    FFIBlock* genesis = olocus_block_create_genesis(
        1000000000000LL,
        (const uint8_t*)"Genesis",
        7,
        0,
        private_key
    );
    
    int result = olocus_chain_add_block(chain, genesis);
    TEST_ASSERT_EQUAL(0, result);
    
    TEST_ASSERT_FALSE(olocus_chain_is_empty(chain));
    TEST_ASSERT_EQUAL(1, olocus_chain_get_length(chain));
    
    // Verify chain
    result = olocus_chain_verify(chain);
    TEST_ASSERT_EQUAL(0, result);
    
    olocus_block_destroy(genesis);
    olocus_keypair_destroy(keypair);
    olocus_chain_destroy(chain);
}

int main(void) {
    UNITY_BEGIN();
    
    RUN_TEST(test_keypair_generation);
    RUN_TEST(test_block_creation_and_verification);
    RUN_TEST(test_chain_operations);
    
    return UNITY_END();
}
```

## Best Practices Summary

### Security
1. **Always validate inputs** before passing to FFI functions
2. **Use secure memory functions** for sensitive data
3. **Clear sensitive data** after use (private keys, etc.)
4. **Check return codes** from all operations
5. **Use platform-specific secure storage** when available

### Performance
1. **Batch operations** when possible
2. **Use async operations** for heavy workloads
3. **Pool allocations** for frequent memory operations
4. **Cache frequently accessed data**
5. **Profile and optimize** hot paths

### Memory Management
1. **Use RAII patterns** in C++
2. **Implement proper finalizers** in garbage-collected languages
3. **Track object lifecycles** carefully
4. **Use reference counting** for shared objects
5. **Test for memory leaks** regularly

### Error Handling
1. **Check all return codes**
2. **Provide meaningful error messages**
3. **Use appropriate error handling patterns** for each language
4. **Log errors** for debugging
5. **Clean up resources** on error paths

### Cross-Platform
1. **Test on all target platforms**
2. **Use conditional compilation** for platform-specific features
3. **Provide fallbacks** for unsupported features
4. **Document platform requirements**
5. **Use consistent calling conventions**
