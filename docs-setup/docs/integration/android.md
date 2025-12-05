---
id: android
title: Android Integration
sidebar_position: 2
---

# Android Integration

Integrate Olocus Protocol into Android applications using Kotlin or Java through JNI (Java Native Interface). This guide covers Android Keystore, Play Integrity API, and Location Services integration.

## Prerequisites

- Android Studio Arctic Fox or later
- Android SDK API level 21+ (Android 5.0)
- NDK r23c or later
- Rust toolchain for building the native library
- Kotlin 1.7+ or Java 8+

## Installation

### Option 1: Pre-built AAR

1. Download the pre-built `olocus-android.aar` from releases
2. Add to your `app/libs/` directory
3. Add to your `app/build.gradle`:

```gradle
android {
    compileSdk 33
    
    defaultConfig {
        minSdk 21
        targetSdk 33
    }
    
    compileOptions {
        sourceCompatibility JavaVersion.VERSION_1_8
        targetCompatibility JavaVersion.VERSION_1_8
    }
}

dependencies {
    implementation files('libs/olocus-android.aar')
    implementation 'com.google.android.play:integrity:1.2.0'
    implementation 'androidx.security:security-crypto:1.1.0-alpha06'
}
```

### Option 2: Build from Source

1. Install Android targets for Rust:

```bash
# Install targets
rustup target add aarch64-linux-android
rustup target add armv7-linux-androideabi
rustup target add x86_64-linux-android
rustup target add i686-linux-android

# Set up NDK environment
export ANDROID_NDK_HOME="$ANDROID_HOME/ndk/25.1.8937393"
export PATH="$ANDROID_NDK_HOME/toolchains/llvm/prebuilt/linux-x86_64/bin:$PATH"

# Set up cargo config
mkdir -p ~/.cargo
cat > ~/.cargo/config.toml << EOF
[target.aarch64-linux-android]
ar = "$ANDROID_NDK_HOME/toolchains/llvm/prebuilt/linux-x86_64/bin/llvm-ar"
linker = "$ANDROID_NDK_HOME/toolchains/llvm/prebuilt/linux-x86_64/bin/aarch64-linux-android21-clang"

[target.armv7-linux-androideabi]
ar = "$ANDROID_NDK_HOME/toolchains/llvm/prebuilt/linux-x86_64/bin/llvm-ar"
linker = "$ANDROID_NDK_HOME/toolchains/llvm/prebuilt/linux-x86_64/bin/armv7a-linux-androideabi21-clang"

[target.x86_64-linux-android]
ar = "$ANDROID_NDK_HOME/toolchains/llvm/prebuilt/linux-x86_64/bin/llvm-ar"
linker = "$ANDROID_NDK_HOME/toolchains/llvm/prebuilt/linux-x86_64/bin/x86_64-linux-android21-clang"

[target.i686-linux-android]
ar = "$ANDROID_NDK_HOME/toolchains/llvm/prebuilt/linux-x86_64/bin/llvm-ar"
linker = "$ANDROID_NDK_HOME/toolchains/llvm/prebuilt/linux-x86_64/bin/i686-linux-android21-clang"
EOF
```

2. Build for all Android architectures:

```bash
cd olocus-protocol

# Build for each architecture
cargo build -p olocus-ffi --release --target aarch64-linux-android
cargo build -p olocus-ffi --release --target armv7-linux-androideabi
cargo build -p olocus-ffi --release --target x86_64-linux-android
cargo build -p olocus-ffi --release --target i686-linux-android

# Copy libraries to Android project
mkdir -p android/app/src/main/jniLibs/{arm64-v8a,armeabi-v7a,x86_64,x86}
cp target/aarch64-linux-android/release/libolocus_ffi.so android/app/src/main/jniLibs/arm64-v8a/
cp target/armv7-linux-androideabi/release/libolocus_ffi.so android/app/src/main/jniLibs/armeabi-v7a/
cp target/x86_64-linux-android/release/libolocus_ffi.so android/app/src/main/jniLibs/x86_64/
cp target/i686-linux-android/release/libolocus_ffi.so android/app/src/main/jniLibs/x86/
```

## Kotlin Integration

### JNI Wrapper Class

```kotlin
// OlocusFFI.kt
package com.yourapp.olocus

import java.nio.ByteBuffer

class OlocusFFI {
    companion object {
        init {
            System.loadLibrary("olocus_ffi")
        }
        
        // Library lifecycle
        @JvmStatic external fun init(): Int
        @JvmStatic external fun initWithConfig(config: Long): Int
        @JvmStatic external fun shutdown(): Int
        @JvmStatic external fun isInitialized(): Boolean
        
        // Configuration
        @JvmStatic external fun configCreate(): Long
        @JvmStatic external fun configDestroy(config: Long)
        @JvmStatic external fun configSetAndroidKeystore(config: Long, enabled: Boolean)
        @JvmStatic external fun configSetNetworkEnabled(config: Long, enabled: Boolean)
        
        // Key management
        @JvmStatic external fun keypairGenerate(): Long
        @JvmStatic external fun keypairFromBytes(privateKey: ByteArray): Long
        @JvmStatic external fun keypairDestroy(keypair: Long)
        @JvmStatic external fun keypairGetPublicKey(keypair: Long, publicKey: ByteArray)
        @JvmStatic external fun keypairGetPrivateKey(keypair: Long, privateKey: ByteArray)
        
        // Block operations
        @JvmStatic external fun blockCreateGenesis(
            timestamp: Long,
            payload: ByteArray,
            payloadType: Int,
            signingKey: ByteArray
        ): Long
        
        @JvmStatic external fun blockCreate(
            index: Long,
            timestamp: Long,
            previousHash: ByteArray,
            payload: ByteArray,
            payloadType: Int,
            signingKey: ByteArray
        ): Long
        
        @JvmStatic external fun blockDestroy(block: Long)
        @JvmStatic external fun blockVerify(block: Long): Int
        @JvmStatic external fun blockGetIndex(block: Long): Long
        @JvmStatic external fun blockGetTimestamp(block: Long): Long
        @JvmStatic external fun blockGetPayloadType(block: Long): Int
        @JvmStatic external fun blockGetHash(block: Long, hash: ByteArray)
        
        // Chain operations
        @JvmStatic external fun chainCreate(): Long
        @JvmStatic external fun chainCreateWithLimit(limit: Long): Long
        @JvmStatic external fun chainDestroy(chain: Long)
        @JvmStatic external fun chainAddBlock(chain: Long, block: Long): Int
        @JvmStatic external fun chainGetLength(chain: Long): Long
        @JvmStatic external fun chainIsEmpty(chain: Long): Boolean
        @JvmStatic external fun chainGetBlock(chain: Long, index: Long): Long
        @JvmStatic external fun chainGetLastBlock(chain: Long): Long
        @JvmStatic external fun chainVerify(chain: Long): Int
        
        // Wire format
        @JvmStatic external fun wireFormatBinary(): ByteArray
        @JvmStatic external fun wireFormatJson(): ByteArray
        @JvmStatic external fun wireFormatMsgpack(): ByteArray
        @JvmStatic external fun wireFormatNew(encoding: Int, compression: Int): ByteArray
        @JvmStatic external fun blockToWireFormat(block: Long, format: ByteArray): ByteArray
        @JvmStatic external fun blockFromWireFormat(data: ByteArray, format: ByteArray): Long
        @JvmStatic external fun wireFormatContentType(format: ByteArray): String
        @JvmStatic external fun wireFormatFromContentType(contentType: String): ByteArray?
        
        // Cryptographic operations
        @JvmStatic external fun sign(keypair: Long, message: ByteArray, signature: ByteArray)
        @JvmStatic external fun verify(
            publicKey: ByteArray,
            message: ByteArray,
            signature: ByteArray
        ): Int
        @JvmStatic external fun hashSha256(data: ByteArray, hash: ByteArray)
        @JvmStatic external fun randomBytes(buffer: ByteArray)
        @JvmStatic external fun hkdfDerive(
            inputKey: ByteArray,
            salt: ByteArray,
            info: ByteArray,
            output: ByteArray
        )
        
        // Error handling
        @JvmStatic external fun getLastErrorCode(): Int
        @JvmStatic external fun getLastErrorMessage(): String?
        @JvmStatic external fun clearError()
        
        // Memory management
        @JvmStatic external fun freeString(ptr: String)
    }
}

// Wire format constants
object WireFormat {
    const val ENCODING_BINARY = 0
    const val ENCODING_JSON = 1
    const val ENCODING_MESSAGEPACK = 2
    const val ENCODING_PROTOBUF = 3
    const val ENCODING_SSZ = 4
    
    const val COMPRESSION_NONE = 0
    const val COMPRESSION_ZSTD = 1
    const val COMPRESSION_LZ4 = 2
    const val COMPRESSION_GZIP = 3
}
```

### High-Level Kotlin Wrapper

```kotlin
// OlocusManager.kt
package com.yourapp.olocus

import android.content.Context
import android.util.Log
import kotlinx.coroutines.*
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.locks.ReentrantReadWriteLock
import kotlin.concurrent.read
import kotlin.concurrent.write

class OlocusManager private constructor(private val context: Context) {
    companion object {
        private const val TAG = "OlocusManager"
        
        @Volatile
        private var INSTANCE: OlocusManager? = null
        
        fun getInstance(context: Context): OlocusManager {
            return INSTANCE ?: synchronized(this) {
                INSTANCE ?: OlocusManager(context.applicationContext).also { INSTANCE = it }
            }
        }
    }
    
    private var isInitialized = false
    private val chainLock = ReentrantReadWriteLock()
    private var chain: Long? = null
    private val keyManager = AndroidKeyManager(context)
    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())
    
    init {
        initialize()
    }
    
    private fun initialize() {
        if (isInitialized) return
        
        val config = OlocusFFI.configCreate()
        try {
            OlocusFFI.configSetAndroidKeystore(config, true)
            OlocusFFI.configSetNetworkEnabled(config, true)
            
            val result = OlocusFFI.initWithConfig(config)
            if (result != 0) {
                val error = OlocusFFI.getLastErrorMessage() ?: "Unknown error"
                throw OlocusException("Failed to initialize Olocus: $error", result)
            }
            
            chain = OlocusFFI.chainCreate()
            isInitialized = true
            
            Log.i(TAG, "Olocus initialized successfully")
        } finally {
            OlocusFFI.configDestroy(config)
        }
    }
    
    fun createGenesisBlock(
        payload: ByteArray,
        payloadType: Int
    ): Result<Block> = runCatching {
        val signingKey = keyManager.getOrCreateSigningKey()
        val timestamp = System.currentTimeMillis()
        
        val blockPtr = OlocusFFI.blockCreateGenesis(
            timestamp,
            payload,
            payloadType,
            signingKey
        )
        
        if (blockPtr == 0L) {
            val error = OlocusFFI.getLastErrorMessage() ?: "Block creation failed"
            throw OlocusException(error, OlocusFFI.getLastErrorCode())
        }
        
        Block(blockPtr)
    }
    
    fun createBlock(
        payload: ByteArray,
        payloadType: Int
    ): Result<Block> = runCatching {
        chainLock.read {
            val chainPtr = chain ?: throw OlocusException("Chain not initialized", -1)
            
            val length = OlocusFFI.chainGetLength(chainPtr)
            val lastBlock = OlocusFFI.chainGetLastBlock(chainPtr)
            
            val previousHash = ByteArray(32)
            OlocusFFI.blockGetHash(lastBlock, previousHash)
            
            val signingKey = keyManager.getOrCreateSigningKey()
            val timestamp = System.currentTimeMillis()
            
            val blockPtr = OlocusFFI.blockCreate(
                length,
                timestamp,
                previousHash,
                payload,
                payloadType,
                signingKey
            )
            
            if (blockPtr == 0L) {
                val error = OlocusFFI.getLastErrorMessage() ?: "Block creation failed"
                throw OlocusException(error, OlocusFFI.getLastErrorCode())
            }
            
            Block(blockPtr)
        }
    }
    
    fun addBlock(block: Block): Result<Unit> = runCatching {
        chainLock.write {
            val chainPtr = chain ?: throw OlocusException("Chain not initialized", -1)
            
            val result = OlocusFFI.chainAddBlock(chainPtr, block.ptr)
            if (result != 0) {
                val error = OlocusFFI.getLastErrorMessage() ?: "Failed to add block"
                throw OlocusException(error, result)
            }
        }
    }
    
    suspend fun addBlockAsync(block: Block): Result<Unit> = withContext(Dispatchers.IO) {
        addBlock(block)
    }
    
    fun verifyChain(): Result<Boolean> = runCatching {
        chainLock.read {
            val chainPtr = chain ?: throw OlocusException("Chain not initialized", -1)
            
            val result = OlocusFFI.chainVerify(chainPtr)
            result == 0
        }
    }
    
    fun getChainLength(): Long {
        return chainLock.read {
            val chainPtr = chain ?: 0L
            OlocusFFI.chainGetLength(chainPtr)
        }
    }
    
    fun exportChain(format: WireFormatType = WireFormatType.JSON): Result<ByteArray> = runCatching {
        chainLock.read {
            val chainPtr = chain ?: throw OlocusException("Chain not initialized", -1)
            
            val wireFormat = when (format) {
                WireFormatType.BINARY -> OlocusFFI.wireFormatBinary()
                WireFormatType.JSON -> OlocusFFI.wireFormatJson()
                WireFormatType.MESSAGEPACK -> OlocusFFI.wireFormatMsgpack()
                WireFormatType.JSON_COMPRESSED -> OlocusFFI.wireFormatNew(
                    WireFormat.ENCODING_JSON,
                    WireFormat.COMPRESSION_ZSTD
                )
            }
            
            // For chain export, we need to serialize each block
            val length = OlocusFFI.chainGetLength(chainPtr)
            val blocks = mutableListOf<ByteArray>()
            
            for (i in 0 until length) {
                val blockPtr = OlocusFFI.chainGetBlock(chainPtr, i)
                val blockData = OlocusFFI.blockToWireFormat(blockPtr, wireFormat)
                blocks.add(blockData)
            }
            
            // Combine blocks into chain format
            serializeChain(blocks)
        }
    }
    
    private fun serializeChain(blocks: List<ByteArray>): ByteArray {
        // Simple concatenation with length prefixes
        val totalSize = blocks.sumOf { it.size + 4 } + 4 // 4 bytes for count + 4 bytes per length
        val buffer = ByteArray(totalSize)
        var offset = 0
        
        // Write block count
        writeInt(buffer, offset, blocks.size)
        offset += 4
        
        // Write each block with length prefix
        for (block in blocks) {
            writeInt(buffer, offset, block.size)
            offset += 4
            block.copyInto(buffer, offset)
            offset += block.size
        }
        
        return buffer
    }
    
    private fun writeInt(buffer: ByteArray, offset: Int, value: Int) {
        buffer[offset] = (value shr 24).toByte()
        buffer[offset + 1] = (value shr 16).toByte()
        buffer[offset + 2] = (value shr 8).toByte()
        buffer[offset + 3] = value.toByte()
    }
    
    fun cleanup() {
        scope.cancel()
        chainLock.write {
            chain?.let {
                OlocusFFI.chainDestroy(it)
                chain = null
            }
        }
        if (isInitialized) {
            OlocusFFI.shutdown()
            isInitialized = false
        }
    }
}

// Data classes
data class Block(val ptr: Long) {
    fun getIndex(): Long = OlocusFFI.blockGetIndex(ptr)
    fun getTimestamp(): Long = OlocusFFI.blockGetTimestamp(ptr)
    fun getPayloadType(): Int = OlocusFFI.blockGetPayloadType(ptr)
    
    fun getHash(): ByteArray {
        val hash = ByteArray(32)
        OlocusFFI.blockGetHash(ptr, hash)
        return hash
    }
    
    fun verify(): Boolean = OlocusFFI.blockVerify(ptr) == 0
    
    fun toWireFormat(format: WireFormatType = WireFormatType.JSON): ByteArray {
        val wireFormat = when (format) {
            WireFormatType.BINARY -> OlocusFFI.wireFormatBinary()
            WireFormatType.JSON -> OlocusFFI.wireFormatJson()
            WireFormatType.MESSAGEPACK -> OlocusFFI.wireFormatMsgpack()
            WireFormatType.JSON_COMPRESSED -> OlocusFFI.wireFormatNew(
                WireFormat.ENCODING_JSON,
                WireFormat.COMPRESSION_ZSTD
            )
        }
        return OlocusFFI.blockToWireFormat(ptr, wireFormat)
    }
    
    protected fun finalize() {
        OlocusFFI.blockDestroy(ptr)
    }
}

enum class WireFormatType {
    BINARY, JSON, MESSAGEPACK, JSON_COMPRESSED
}

class OlocusException(message: String, val errorCode: Int) : Exception(message)
```

### Android Keystore Integration

```kotlin
// AndroidKeyManager.kt
package com.yourapp.olocus

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKeys
import java.security.KeyStore
import java.security.SecureRandom
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec
import javax.crypto.spec.SecretKeySpec

class AndroidKeyManager(private val context: Context) {
    companion object {
        private const val ANDROID_KEYSTORE = "AndroidKeyStore"
        private const val OLOCUS_KEY_ALIAS = "olocus_signing_key"
        private const val ENCRYPTED_PREFS_NAME = "olocus_secure_prefs"
        private const val SIGNING_KEY_PREF = "encrypted_signing_key"
        private const val TRANSFORMATION = "AES/GCM/NoPadding"
        private const val IV_LENGTH = 12
        private const val TAG_LENGTH = 16
    }
    
    private val keyStore = KeyStore.getInstance(ANDROID_KEYSTORE).apply { load(null) }
    private val masterKeyAlias = MasterKeys.getOrCreate(MasterKeys.AES256_GCM_SPEC)
    
    private val encryptedPrefs = EncryptedSharedPreferences.create(
        ENCRYPTED_PREFS_NAME,
        masterKeyAlias,
        context,
        EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
        EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
    )
    
    fun getOrCreateSigningKey(): ByteArray {
        // First try to load existing key
        loadSigningKey()?.let { return it }
        
        // Generate new key if none exists
        return generateAndStoreSigningKey()
    }
    
    private fun loadSigningKey(): ByteArray? {
        val encryptedKey = encryptedPrefs.getString(SIGNING_KEY_PREF, null) ?: return null
        
        return try {
            val encryptedData = android.util.Base64.decode(encryptedKey, android.util.Base64.DEFAULT)
            decryptSigningKey(encryptedData)
        } catch (e: Exception) {
            Log.w("AndroidKeyManager", "Failed to load existing key, generating new one", e)
            null
        }
    }
    
    private fun generateAndStoreSigningKey(): ByteArray {
        // Generate Ed25519-compatible key (32 random bytes)
        val signingKey = ByteArray(32)
        SecureRandom().nextBytes(signingKey)
        
        try {
            // Encrypt and store the key
            val encryptedKey = encryptSigningKey(signingKey)
            val encodedKey = android.util.Base64.encodeToString(encryptedKey, android.util.Base64.DEFAULT)
            
            encryptedPrefs.edit()
                .putString(SIGNING_KEY_PREF, encodedKey)
                .apply()
            
            return signingKey
        } catch (e: Exception) {
            throw KeyManagerException("Failed to store signing key", e)
        }
    }
    
    private fun encryptSigningKey(key: ByteArray): ByteArray {
        // Generate or get the encryption key from Android Keystore
        val secretKey = getOrCreateEncryptionKey()
        
        val cipher = Cipher.getInstance(TRANSFORMATION)
        cipher.init(Cipher.ENCRYPT_MODE, secretKey)
        
        val iv = cipher.iv
        val encryptedKey = cipher.doFinal(key)
        
        // Combine IV and encrypted data
        return iv + encryptedKey
    }
    
    private fun decryptSigningKey(encryptedData: ByteArray): ByteArray {
        if (encryptedData.size < IV_LENGTH + TAG_LENGTH) {
            throw KeyManagerException("Encrypted data too short")
        }
        
        val secretKey = getOrCreateEncryptionKey()
        val iv = encryptedData.sliceArray(0 until IV_LENGTH)
        val cipherText = encryptedData.sliceArray(IV_LENGTH until encryptedData.size)
        
        val cipher = Cipher.getInstance(TRANSFORMATION)
        val spec = GCMParameterSpec(TAG_LENGTH * 8, iv)
        cipher.init(Cipher.DECRYPT_MODE, secretKey, spec)
        
        return cipher.doFinal(cipherText)
    }
    
    private fun getOrCreateEncryptionKey(): SecretKey {
        return if (keyStore.containsAlias(OLOCUS_KEY_ALIAS)) {
            keyStore.getKey(OLOCUS_KEY_ALIAS, null) as SecretKey
        } else {
            createEncryptionKey()
        }
    }
    
    private fun createEncryptionKey(): SecretKey {
        val keyGenerator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, ANDROID_KEYSTORE)
        
        val keyGenParameterSpec = KeyGenParameterSpec.Builder(
            OLOCUS_KEY_ALIAS,
            KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT
        )
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
            .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
            .setUserAuthenticationRequired(false) // Set to true if you want biometric auth
            .setRandomizedEncryptionRequired(true)
            .build()
        
        keyGenerator.init(keyGenParameterSpec)
        return keyGenerator.generateKey()
    }
    
    fun signWithBiometrics(
        data: ByteArray,
        onSuccess: (ByteArray) -> Unit,
        onError: (Exception) -> Unit
    ) {
        // For biometric signing, you would:
        // 1. Set setUserAuthenticationRequired(true) when creating the key
        // 2. Use BiometricPrompt to authenticate
        // 3. Perform the signing operation within the authentication callback
        
        try {
            val signingKey = getOrCreateSigningKey()
            val signature = signData(data, signingKey)
            onSuccess(signature)
        } catch (e: Exception) {
            onError(e)
        }
    }
    
    private fun signData(data: ByteArray, signingKey: ByteArray): ByteArray {
        val keypair = OlocusFFI.keypairFromBytes(signingKey)
        try {
            val signature = ByteArray(64)
            OlocusFFI.sign(keypair, data, signature)
            return signature
        } finally {
            OlocusFFI.keypairDestroy(keypair)
        }
    }
    
    fun deleteSigningKey() {
        try {
            if (keyStore.containsAlias(OLOCUS_KEY_ALIAS)) {
                keyStore.deleteEntry(OLOCUS_KEY_ALIAS)
            }
            encryptedPrefs.edit().remove(SIGNING_KEY_PREF).apply()
        } catch (e: Exception) {
            throw KeyManagerException("Failed to delete signing key", e)
        }
    }
}

class KeyManagerException(message: String, cause: Throwable? = null) : Exception(message, cause)
```

### Play Integrity API Integration

```kotlin
// PlayIntegrityManager.kt
package com.yourapp.olocus

import android.content.Context
import com.google.android.play.core.integrity.IntegrityManager
import com.google.android.play.core.integrity.IntegrityManagerFactory
import com.google.android.play.core.integrity.model.IntegrityErrorCode
import kotlinx.coroutines.suspendCancellableCoroutine
import java.security.MessageDigest
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

class PlayIntegrityManager(private val context: Context) {
    private val integrityManager: IntegrityManager = IntegrityManagerFactory.create(context)
    
    suspend fun generateIntegrityBlock(nonce: String? = null): Result<Block> = runCatching {
        // Generate nonce if not provided
        val requestNonce = nonce ?: generateNonce()
        
        // Request integrity token
        val integrityToken = requestIntegrityToken(requestNonce)
        
        // Create payload with integrity data
        val payload = IntegrityPayload(
            token = integrityToken,
            nonce = requestNonce,
            packageName = context.packageName,
            timestamp = System.currentTimeMillis()
        )
        
        // Create Olocus block
        createIntegrityBlock(payload)
    }
    
    private suspend fun requestIntegrityToken(nonce: String): String {
        return suspendCancellableCoroutine { continuation ->
            integrityManager
                .requestIntegrityToken(
                    com.google.android.play.core.integrity.IntegrityTokenRequest.builder()
                        .setNonce(nonce)
                        .build()
                )
                .addOnSuccessListener { response ->
                    continuation.resume(response.token())
                }
                .addOnFailureListener { exception ->
                    continuation.resumeWithException(
                        IntegrityException("Integrity request failed", exception)
                    )
                }
        }
    }
    
    private fun generateNonce(): String {
        val randomBytes = ByteArray(32)
        OlocusFFI.randomBytes(randomBytes)
        return android.util.Base64.encodeToString(randomBytes, android.util.Base64.URL_SAFE or android.util.Base64.NO_WRAP)
    }
    
    private fun createIntegrityBlock(payload: IntegrityPayload): Block {
        val olocusManager = OlocusManager.getInstance(context)
        val payloadJson = kotlinx.serialization.json.Json.encodeToString(
            IntegrityPayload.serializer(),
            payload
        )
        
        return olocusManager.createGenesisBlock(
            payloadJson.toByteArray(),
            0x0401 // Play Integrity payload type
        ).getOrThrow()
    }
    
    fun verifyIntegrityToken(token: String): Result<IntegrityVerificationResult> = runCatching {
        // Parse the JWT token (simplified)
        val parts = token.split(".")
        if (parts.size != 3) {
            throw IntegrityException("Invalid token format")
        }
        
        val header = parseJwtPart(parts[0])
        val payload = parseJwtPart(parts[1])
        val signature = parts[2]
        
        // In a real implementation, you would:
        // 1. Verify the JWT signature using Google's public keys
        // 2. Check the token's validity period
        // 3. Verify the nonce matches
        // 4. Check app integrity verdict
        
        IntegrityVerificationResult(
            isValid = true, // Placeholder
            appIntegrity = payload["appIntegrity"] as? Map<String, Any>,
            deviceIntegrity = payload["deviceIntegrity"] as? Map<String, Any>,
            accountDetails = payload["accountDetails"] as? Map<String, Any>
        )
    }
    
    private fun parseJwtPart(part: String): Map<String, Any> {
        val decoded = android.util.Base64.decode(part, android.util.Base64.URL_SAFE)
        val json = String(decoded)
        return kotlinx.serialization.json.Json.parseToJsonElement(json).jsonObject.toMap()
    }
}

@kotlinx.serialization.Serializable
data class IntegrityPayload(
    val token: String,
    val nonce: String,
    val packageName: String,
    val timestamp: Long
)

data class IntegrityVerificationResult(
    val isValid: Boolean,
    val appIntegrity: Map<String, Any>?,
    val deviceIntegrity: Map<String, Any>?,
    val accountDetails: Map<String, Any>?
)

class IntegrityException(message: String, cause: Throwable? = null) : Exception(message, cause)
```

### Location Services Integration

```kotlin
// LocationChainManager.kt
package com.yourapp.olocus

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.location.Location
import android.os.Looper
import androidx.core.content.ContextCompat
import com.google.android.gms.location.*
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.asSharedFlow

class LocationChainManager(private val context: Context) {
    companion object {
        private const val LOCATION_UPDATE_INTERVAL = 30_000L // 30 seconds
        private const val LOCATION_FASTEST_INTERVAL = 10_000L // 10 seconds
        private const val MIN_DISPLACEMENT = 10f // 10 meters
    }
    
    private val fusedLocationClient: FusedLocationProviderClient =
        LocationServices.getFusedLocationProviderClient(context)
    
    private val olocusManager = OlocusManager.getInstance(context)
    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())
    
    private val _locationBlocks = MutableSharedFlow<Block>()
    val locationBlocks: SharedFlow<Block> = _locationBlocks.asSharedFlow()
    
    private val _locationErrors = MutableSharedFlow<LocationException>()
    val locationErrors: SharedFlow<LocationException> = _locationErrors.asSharedFlow()
    
    private var locationCallback: LocationCallback? = null
    private var isTracking = false
    
    fun startLocationTracking(): Result<Unit> = runCatching {
        if (!hasLocationPermissions()) {
            throw LocationException("Location permissions not granted")
        }
        
        if (isTracking) {
            return@runCatching
        }
        
        val locationRequest = LocationRequest.Builder(
            Priority.PRIORITY_HIGH_ACCURACY,
            LOCATION_UPDATE_INTERVAL
        )
            .setMinUpdateIntervalMillis(LOCATION_FASTEST_INTERVAL)
            .setMinUpdateDistanceMeters(MIN_DISPLACEMENT)
            .build()
        
        locationCallback = object : LocationCallback() {
            override fun onLocationResult(locationResult: LocationResult) {
                locationResult.locations.forEach { location ->
                    scope.launch {
                        processLocation(location)
                    }
                }
            }
            
            override fun onLocationAvailability(locationAvailability: LocationAvailability) {
                if (!locationAvailability.isLocationAvailable) {
                    scope.launch {
                        _locationErrors.emit(
                            LocationException("Location not available")
                        )
                    }
                }
            }
        }
        
        fusedLocationClient.requestLocationUpdates(
            locationRequest,
            locationCallback!!,
            Looper.getMainLooper()
        )
        
        isTracking = true
    }
    
    fun stopLocationTracking() {
        if (!isTracking) return
        
        locationCallback?.let {
            fusedLocationClient.removeLocationUpdates(it)
        }
        locationCallback = null
        isTracking = false
    }
    
    private suspend fun processLocation(location: Location) {
        try {
            val locationBlock = createLocationBlock(location)
            olocusManager.addBlockAsync(locationBlock).getOrThrow()
            _locationBlocks.emit(locationBlock)
        } catch (e: Exception) {
            _locationErrors.emit(LocationException("Failed to process location", e))
        }
    }
    
    private fun createLocationBlock(location: Location): Block {
        val payload = LocationPayload(
            latitude = location.latitude,
            longitude = location.longitude,
            altitude = location.altitude,
            accuracy = location.accuracy,
            bearing = location.bearing,
            speed = location.speed,
            timestamp = location.time,
            provider = location.provider ?: "unknown",
            isMock = location.isFromMockProvider
        )
        
        val payloadJson = kotlinx.serialization.json.Json.encodeToString(
            LocationPayload.serializer(),
            payload
        )
        
        return if (olocusManager.getChainLength() == 0L) {
            olocusManager.createGenesisBlock(
                payloadJson.toByteArray(),
                0x0200 // Location payload type
            ).getOrThrow()
        } else {
            olocusManager.createBlock(
                payloadJson.toByteArray(),
                0x0200
            ).getOrThrow()
        }
    }
    
    fun getLocationHistory(): Result<List<LocationPayload>> = runCatching {
        val chainLength = olocusManager.getChainLength()
        val locations = mutableListOf<LocationPayload>()
        
        // This is a simplified version - in practice you'd use the query extension
        // to efficiently filter location blocks
        
        for (i in 0 until chainLength) {
            // Get block and parse if it's a location block
            // Implementation depends on how you store chain access
        }
        
        locations
    }
    
    fun getCurrentLocation(): Result<Location> = runCatching {
        if (!hasLocationPermissions()) {
            throw LocationException("Location permissions not granted")
        }
        
        // This would need to be made suspend and use coroutines
        // Simplified synchronous version for demo
        throw NotImplementedError("Use getCurrentLocationAsync() instead")
    }
    
    suspend fun getCurrentLocationAsync(): Result<Location> = suspendCancellableCoroutine { continuation ->
        if (!hasLocationPermissions()) {
            continuation.resume(Result.failure(LocationException("Location permissions not granted")))
            return@suspendCancellableCoroutine
        }
        
        fusedLocationClient.getCurrentLocation(
            Priority.PRIORITY_HIGH_ACCURACY,
            null
        ).addOnSuccessListener { location ->
            if (location != null) {
                continuation.resume(Result.success(location))
            } else {
                continuation.resume(Result.failure(LocationException("Location is null")))
            }
        }.addOnFailureListener { exception ->
            continuation.resume(Result.failure(LocationException("Failed to get location", exception)))
        }
    }
    
    private fun hasLocationPermissions(): Boolean {
        return ContextCompat.checkSelfPermission(
            context,
            Manifest.permission.ACCESS_FINE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED ||
                ContextCompat.checkSelfPermission(
                    context,
                    Manifest.permission.ACCESS_COARSE_LOCATION
                ) == PackageManager.PERMISSION_GRANTED
    }
    
    fun cleanup() {
        stopLocationTracking()
        scope.cancel()
    }
}

@kotlinx.serialization.Serializable
data class LocationPayload(
    val latitude: Double,
    val longitude: Double,
    val altitude: Double,
    val accuracy: Float,
    val bearing: Float,
    val speed: Float,
    val timestamp: Long,
    val provider: String,
    val isMock: Boolean
)

class LocationException(message: String, cause: Throwable? = null) : Exception(message, cause)
```

## Java Integration

### Basic Java Wrapper

```java
// OlocusManagerJava.java
package com.yourapp.olocus;

import android.content.Context;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class OlocusManagerJava {
    private static OlocusManagerJava instance;
    private final ExecutorService executor;
    private final Context context;
    private boolean isInitialized = false;
    private long chainPtr = 0;
    private AndroidKeyManagerJava keyManager;
    
    private OlocusManagerJava(Context context) {
        this.context = context.getApplicationContext();
        this.executor = Executors.newSingleThreadExecutor();
        this.keyManager = new AndroidKeyManagerJava(context);
        initialize();
    }
    
    public static synchronized OlocusManagerJava getInstance(Context context) {
        if (instance == null) {
            instance = new OlocusManagerJava(context);
        }
        return instance;
    }
    
    private void initialize() {
        long config = OlocusFFI.configCreate();
        try {
            OlocusFFI.configSetAndroidKeystore(config, true);
            int result = OlocusFFI.initWithConfig(config);
            if (result != 0) {
                throw new OlocusException("Failed to initialize Olocus: " + 
                    OlocusFFI.getLastErrorMessage(), result);
            }
            
            chainPtr = OlocusFFI.chainCreate();
            isInitialized = true;
        } finally {
            OlocusFFI.configDestroy(config);
        }
    }
    
    public CompletableFuture<BlockJava> createGenesisBlockAsync(
            byte[] payload, int payloadType) {
        return CompletableFuture.supplyAsync(() -> {
            try {
                byte[] signingKey = keyManager.getOrCreateSigningKey();
                long timestamp = System.currentTimeMillis();
                
                long blockPtr = OlocusFFI.blockCreateGenesis(
                    timestamp, payload, payloadType, signingKey);
                    
                if (blockPtr == 0) {
                    throw new OlocusException(
                        OlocusFFI.getLastErrorMessage(),
                        OlocusFFI.getLastErrorCode());
                }
                
                return new BlockJava(blockPtr);
            } catch (Exception e) {
                throw new RuntimeException(e);
            }
        }, executor);
    }
    
    public CompletableFuture<Void> addBlockAsync(BlockJava block) {
        return CompletableFuture.runAsync(() -> {
            synchronized (this) {
                int result = OlocusFFI.chainAddBlock(chainPtr, block.getPtr());
                if (result != 0) {
                    throw new RuntimeException(new OlocusException(
                        OlocusFFI.getLastErrorMessage(), result));
                }
            }
        }, executor);
    }
    
    public synchronized long getChainLength() {
        return OlocusFFI.chainGetLength(chainPtr);
    }
    
    public byte[] exportChain() {
        byte[] wireFormat = OlocusFFI.wireFormatJson();
        // Implementation for chain export
        return new byte[0]; // Placeholder
    }
    
    public void cleanup() {
        executor.shutdown();
        synchronized (this) {
            if (chainPtr != 0) {
                OlocusFFI.chainDestroy(chainPtr);
                chainPtr = 0;
            }
        }
        if (isInitialized) {
            OlocusFFI.shutdown();
            isInitialized = false;
        }
    }
}

// BlockJava.java
package com.yourapp.olocus;

public class BlockJava {
    private final long ptr;
    
    public BlockJava(long ptr) {
        this.ptr = ptr;
    }
    
    public long getPtr() {
        return ptr;
    }
    
    public long getIndex() {
        return OlocusFFI.blockGetIndex(ptr);
    }
    
    public long getTimestamp() {
        return OlocusFFI.blockGetTimestamp(ptr);
    }
    
    public int getPayloadType() {
        return OlocusFFI.blockGetPayloadType(ptr);
    }
    
    public byte[] getHash() {
        byte[] hash = new byte[32];
        OlocusFFI.blockGetHash(ptr, hash);
        return hash;
    }
    
    public boolean verify() {
        return OlocusFFI.blockVerify(ptr) == 0;
    }
    
    @Override
    protected void finalize() {
        OlocusFFI.blockDestroy(ptr);
    }
}

// OlocusException.java
package com.yourapp.olocus;

public class OlocusException extends Exception {
    private final int errorCode;
    
    public OlocusException(String message, int errorCode) {
        super(message);
        this.errorCode = errorCode;
    }
    
    public int getErrorCode() {
        return errorCode;
    }
}
```

## Performance Optimization

### Background Processing

```kotlin
class PerformanceOptimizedManager(context: Context) {
    private val backgroundDispatcher = Dispatchers.IO.limitedParallelism(2)
    private val computationDispatcher = Dispatchers.Default
    
    // Batch process multiple blocks
    suspend fun addBlocksBatch(blocks: List<Block>): Result<Unit> = withContext(backgroundDispatcher) {
        runCatching {
            for (block in blocks) {
                val result = OlocusFFI.chainAddBlock(chainPtr, block.ptr)
                if (result != 0) {
                    throw OlocusException(OlocusFFI.getLastErrorMessage() ?: "Unknown error", result)
                }
            }
        }
    }
    
    // Parallel verification
    suspend fun verifyBlocksParallel(blocks: List<Block>): List<Boolean> = withContext(computationDispatcher) {
        blocks.map { block ->
            async {
                OlocusFFI.blockVerify(block.ptr) == 0
            }
        }.awaitAll()
    }
    
    // Memory-efficient chain export
    suspend fun exportChainStreaming(): Flow<ByteArray> = flow {
        val length = OlocusFFI.chainGetLength(chainPtr)
        val wireFormat = OlocusFFI.wireFormatNew(WireFormat.ENCODING_JSON, WireFormat.COMPRESSION_ZSTD)
        
        for (i in 0 until length) {
            val blockPtr = OlocusFFI.chainGetBlock(chainPtr, i)
            val blockData = OlocusFFI.blockToWireFormat(blockPtr, wireFormat)
            emit(blockData)
        }
    }.flowOn(backgroundDispatcher)
}
```

## Testing

### Unit Tests

```kotlin
// OlocusManagerTest.kt
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Test
import org.junit.runner.RunWith
import org.junit.Assert.*
import org.junit.Before
import org.junit.After

@RunWith(AndroidJUnit4::class)
class OlocusManagerTest {
    private lateinit var context: Context
    private lateinit var olocusManager: OlocusManager
    
    @Before
    fun setup() {
        context = InstrumentationRegistry.getInstrumentation().targetContext
        olocusManager = OlocusManager.getInstance(context)
    }
    
    @After
    fun tearDown() {
        olocusManager.cleanup()
    }
    
    @Test
    fun testInitialization() {
        assertTrue("Olocus should be initialized", olocusManager.isInitialized)
    }
    
    @Test
    fun testGenesisBlockCreation() {
        val payload = "Test payload".toByteArray()
        val result = olocusManager.createGenesisBlock(payload, 0)
        
        assertTrue("Genesis block creation should succeed", result.isSuccess)
        val block = result.getOrThrow()
        assertEquals("Genesis block index should be 0", 0L, block.getIndex())
        assertTrue("Genesis block should be valid", block.verify())
    }
    
    @Test
    fun testChainBuilding() {
        // Create genesis block
        val genesisPayload = "Genesis".toByteArray()
        val genesisResult = olocusManager.createGenesisBlock(genesisPayload, 0)
        assertTrue(genesisResult.isSuccess)
        val genesis = genesisResult.getOrThrow()
        
        // Add to chain
        val addResult = olocusManager.addBlock(genesis)
        assertTrue(addResult.isSuccess)
        assertEquals(1L, olocusManager.getChainLength())
        
        // Create second block
        val secondPayload = "Second block".toByteArray()
        val secondResult = olocusManager.createBlock(secondPayload, 0)
        assertTrue(secondResult.isSuccess)
        val second = secondResult.getOrThrow()
        
        // Add second block
        val addSecondResult = olocusManager.addBlock(second)
        assertTrue(addSecondResult.isSuccess)
        assertEquals(2L, olocusManager.getChainLength())
    }
    
    @Test
    fun testWireFormatSerialization() {
        val payload = "Test payload".toByteArray()
        val block = olocusManager.createGenesisBlock(payload, 0).getOrThrow()
        
        // Test different formats
        val jsonData = block.toWireFormat(WireFormatType.JSON)
        val binaryData = block.toWireFormat(WireFormatType.BINARY)
        val msgpackData = block.toWireFormat(WireFormatType.MESSAGEPACK)
        
        assertTrue("JSON data should not be empty", jsonData.isNotEmpty())
        assertTrue("Binary data should not be empty", binaryData.isNotEmpty())
        assertTrue("MessagePack data should not be empty", msgpackData.isNotEmpty())
        
        // JSON should be larger than binary for small payloads
        assertTrue("JSON should be larger than binary", jsonData.size > binaryData.size)
    }
}
```

### Integration Tests

```kotlin
// LocationIntegrationTest.kt
@RunWith(AndroidJUnit4::class)
class LocationIntegrationTest {
    private lateinit var locationManager: LocationChainManager
    private lateinit var context: Context
    
    @Before
    fun setup() {
        context = InstrumentationRegistry.getInstrumentation().targetContext
        locationManager = LocationChainManager(context)
    }
    
    @After
    fun tearDown() {
        locationManager.cleanup()
    }
    
    @Test
    fun testLocationBlockCreation() {
        // This test would require location permissions and mock location provider
        // Simplified for demonstration
        
        val mockLocation = createMockLocation()
        // Test location block creation logic
    }
    
    private fun createMockLocation(): Location {
        return Location("test").apply {
            latitude = 37.7749
            longitude = -122.4194
            altitude = 100.0
            accuracy = 5.0f
            time = System.currentTimeMillis()
        }
    }
}
```

## Best Practices

### Security

1. **Always use Android Keystore** for key management
2. **Validate all JNI inputs** before passing to native code
3. **Use Play Integrity API** for app integrity verification
4. **Implement certificate pinning** for network communications
5. **Clear sensitive data** from memory after use

### Performance

1. **Use background threads** for heavy operations
2. **Implement proper caching** for frequently accessed data
3. **Use efficient serialization** formats (MessagePack vs JSON)
4. **Monitor memory usage** and implement proper cleanup
5. **Batch operations** when possible

### Error Handling

1. **Always check JNI return codes**
2. **Provide user-friendly error messages**
3. **Implement retry mechanisms** for transient failures
4. **Log errors** for debugging but avoid sensitive data
5. **Handle network failures** gracefully

## Troubleshooting

### Common Issues

1. **UnsatisfiedLinkError**: Ensure native library is in correct ABI directory
2. **Keystore access errors**: Check Android version compatibility and permissions
3. **Location permission denied**: Request runtime permissions properly
4. **Play Integrity unavailable**: Verify Google Play Services version
5. **Memory leaks**: Use try-with-resources and proper cleanup

### Debug Tips

1. **Enable native debugging** in Android Studio
2. **Use adb logcat** to view native logs
3. **Test on different devices** and Android versions
4. **Use memory profilers** to identify leaks
5. **Validate inputs** before JNI calls
