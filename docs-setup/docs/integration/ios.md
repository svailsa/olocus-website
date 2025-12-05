---
id: ios
title: iOS Integration
sidebar_position: 1
---

# iOS Integration

Integrate Olocus Protocol into iOS applications using Swift or Objective-C through the C FFI interface. This guide covers native iOS features including Secure Enclave, App Attestation, and Core Location integration.

## Prerequisites

- Xcode 14.0 or later
- iOS 13.0+ deployment target
- Swift 5.5+ or Objective-C
- Rust toolchain for building the library

## Installation

### Option 1: Pre-built Framework

1. Download the pre-built `OlocusFFI.xcframework` from releases
2. Drag into your Xcode project
3. Add to your target's "Frameworks, Libraries, and Embedded Content"

### Option 2: Build from Source

```bash
# Install Rust targets
rustup target add aarch64-apple-ios
rustup target add x86_64-apple-ios
rustup target add aarch64-apple-ios-sim

# Build universal library
cd olocus-protocol
cargo build -p olocus-ffi --release --target aarch64-apple-ios
cargo build -p olocus-ffi --release --target x86_64-apple-ios
cargo build -p olocus-ffi --release --target aarch64-apple-ios-sim

# Create XCFramework
xcodebuild -create-xcframework \
  -library target/aarch64-apple-ios/release/libolocus_ffi.a \
  -headers extensions/olocus-ffi/include/ \
  -library target/x86_64-apple-ios/release/libolocus_ffi.a \
  -headers extensions/olocus-ffi/include/ \
  -library target/aarch64-apple-ios-sim/release/libolocus_ffi.a \
  -headers extensions/olocus-ffi/include/ \
  -output OlocusFFI.xcframework
```

## Swift Integration

### Basic Setup

```swift
import Foundation
import OlocusFFI

class OlocusManager {
    private var isInitialized = false
    
    init() {
        setupOlocus()
    }
    
    deinit {
        if isInitialized {
            olocus_shutdown()
        }
    }
    
    private func setupOlocus() {
        let config = olocus_config_create()
        defer { olocus_config_destroy(config) }
        
        // Configure for iOS
        olocus_config_set_platform_ios(config, true)
        olocus_config_set_keychain_enabled(config, true)
        
        let result = olocus_init_with_config(config)
        guard result == 0 else {
            fatalError("Failed to initialize Olocus: \(getLastError())")
        }
        
        isInitialized = true
    }
    
    private func getLastError() -> String {
        guard let cMessage = olocus_get_last_error_message() else {
            return "Unknown error"
        }
        defer { olocus_free_string(UnsafeMutablePointer(mutating: cMessage)) }
        return String(cString: cMessage)
    }
}
```

### Key Management with Secure Enclave

```swift
import CryptoKit
import LocalAuthentication

class SecureKeyManager {
    private let keychainService = "com.yourapp.olocus"
    private let keyTag = "olocus-signing-key"
    
    // Generate key in Secure Enclave
    func generateSecureKey() throws -> Data {
        let access = SecAccessControlCreateWithFlags(
            kCFAllocatorDefault,
            kSecAttrAccessibleWhenUnlockedThisDeviceOnly,
            [.privateKeyUsage, .biometryAny],
            nil
        )!
        
        let attributes: [String: Any] = [
            kSecAttrKeyType as String: kSecAttrKeyTypeECSECPrimeRandom,
            kSecAttrKeySizeInBits as String: 256,
            kSecAttrTokenID as String: kSecAttrTokenIDSecureEnclave,
            kSecPrivateKeyAttrs as String: [
                kSecAttrIsPermanent as String: true,
                kSecAttrApplicationTag as String: keyTag.data(using: .utf8)!,
                kSecAttrAccessControl as String: access
            ]
        ]
        
        var error: Unmanaged<CFError>?
        guard let privateKey = SecKeyCreateRandomKey(attributes as CFDictionary, &error) else {
            throw error!.takeRetainedValue() as Error
        }
        
        // Convert to Ed25519 format for Olocus
        return try convertToEd25519(secureEnclaveKey: privateKey)
    }
    
    // Load existing key from Keychain
    func loadExistingKey() throws -> Data? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassKey,
            kSecAttrApplicationTag as String: keyTag.data(using: .utf8)!,
            kSecReturnRef as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne
        ]
        
        var result: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &result)
        
        guard status == errSecSuccess else {
            if status == errSecItemNotFound {
                return nil
            }
            throw KeychainError.loadFailed(status)
        }
        
        let privateKey = result as! SecKey
        return try convertToEd25519(secureEnclaveKey: privateKey)
    }
    
    // Sign with biometric authentication
    func signWithBiometrics(data: Data) async throws -> Data {
        let context = LAContext()
        let reason = "Sign Olocus block with biometric authentication"
        
        try await context.evaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, localizedReason: reason)
        
        // Load key and sign
        guard let keyData = try loadExistingKey() else {
            throw KeychainError.keyNotFound
        }
        
        return try signData(data, with: keyData)
    }
    
    private func convertToEd25519(secureEnclaveKey: SecKey) throws -> Data {
        // Convert Secure Enclave P-256 key to Ed25519 format
        // Implementation depends on your key derivation strategy
        // This is a simplified example
        guard let keyData = SecKeyCopyExternalRepresentation(secureEnclaveKey, nil) as Data? else {
            throw KeychainError.conversionFailed
        }
        
        // Derive Ed25519 key using HKDF
        var derivedKey = Data(count: 32)
        derivedKey.withUnsafeMutableBytes { buffer in
            keyData.withUnsafeBytes { keyBytes in
                let salt = "olocus-ed25519".data(using: .utf8)!
                let info = "key-derivation".data(using: .utf8)!
                
                salt.withUnsafeBytes { saltBytes in
                    info.withUnsafeBytes { infoBytes in
                        olocus_hkdf_derive(
                            keyBytes.baseAddress?.assumingMemoryBound(to: UInt8.self),
                            keyData.count,
                            saltBytes.baseAddress?.assumingMemoryBound(to: UInt8.self),
                            salt.count,
                            infoBytes.baseAddress?.assumingMemoryBound(to: UInt8.self),
                            info.count,
                            buffer.baseAddress?.assumingMemoryBound(to: UInt8.self),
                            32
                        )
                    }
                }
            }
        }
        
        return derivedKey
    }
    
    private func signData(_ data: Data, with key: Data) throws -> Data {
        var signature = Data(count: 64)
        
        let keypair = key.withUnsafeBytes { keyBytes in
            olocus_keypair_from_bytes(keyBytes.baseAddress?.assumingMemoryBound(to: UInt8.self))
        }
        defer { olocus_keypair_destroy(keypair) }
        
        signature.withUnsafeMutableBytes { sigBytes in
            data.withUnsafeBytes { dataBytes in
                olocus_sign(
                    keypair,
                    dataBytes.baseAddress?.assumingMemoryBound(to: UInt8.self),
                    data.count,
                    sigBytes.baseAddress?.assumingMemoryBound(to: UInt8.self)
                )
            }
        }
        
        return signature
    }
}

enum KeychainError: Error {
    case loadFailed(OSStatus)
    case keyNotFound
    case conversionFailed
    case signatureFailed
}
```

### App Attestation Integration

```swift
import DeviceCheck

class AppAttestationManager {
    private let appAttest = DCAppAttestService.shared
    
    func generateAttestationBlock() async throws -> OlocusBlock {
        // Check if App Attest is supported
        guard appAttest.isSupported else {
            throw AttestationError.notSupported
        }
        
        // Generate key
        let keyId = try await appAttest.generateKey()
        
        // Create challenge
        let challenge = generateChallenge()
        
        // Get attestation
        let attestation = try await appAttest.attestKey(keyId, clientDataHash: challenge)
        
        // Create Olocus block with attestation payload
        let payload = AttestationPayload(
            keyId: keyId,
            attestation: attestation,
            challenge: challenge,
            bundleId: Bundle.main.bundleIdentifier!,
            timestamp: Date().timeIntervalSince1970
        )
        
        return try createBlockWithPayload(payload)
    }
    
    func assertWithCounter(keyId: String, counter: UInt32) async throws -> Data {
        let clientData = AssertionClientData(
            challenge: generateChallenge(),
            counter: counter,
            bundleId: Bundle.main.bundleIdentifier!
        )
        
        let clientDataHash = SHA256.hash(data: try JSONEncoder().encode(clientData))
        let assertion = try await appAttest.generateAssertion(keyId, clientDataHash: Data(clientDataHash))
        
        return assertion
    }
    
    private func generateChallenge() -> Data {
        var challenge = Data(count: 32)
        challenge.withUnsafeMutableBytes { buffer in
            olocus_random_bytes(
                buffer.baseAddress?.assumingMemoryBound(to: UInt8.self),
                32
            )
        }
        return challenge
    }
    
    private func createBlockWithPayload(_ payload: AttestationPayload) throws -> OlocusBlock {
        let payloadData = try JSONEncoder().encode(payload)
        
        // Use secure key for signing
        let keyManager = SecureKeyManager()
        let signingKey = try keyManager.loadExistingKey() ?? keyManager.generateSecureKey()
        
        let block = payloadData.withUnsafeBytes { payloadBytes in
            signingKey.withUnsafeBytes { keyBytes in
                olocus_block_create_genesis(
                    Int64(Date().timeIntervalSince1970),
                    payloadBytes.baseAddress?.assumingMemoryBound(to: UInt8.self),
                    payloadData.count,
                    0x0104, // App Attestation payload type
                    keyBytes.baseAddress?.assumingMemoryBound(to: UInt8.self)
                )
            }
        }
        
        guard block != nil else {
            throw AttestationError.blockCreationFailed
        }
        
        return OlocusBlock(cBlock: block!)
    }
}

struct AttestationPayload: Codable {
    let keyId: String
    let attestation: Data
    let challenge: Data
    let bundleId: String
    let timestamp: TimeInterval
}

struct AssertionClientData: Codable {
    let challenge: Data
    let counter: UInt32
    let bundleId: String
}

enum AttestationError: Error {
    case notSupported
    case blockCreationFailed
}
```

### Location Integration

```swift
import CoreLocation
import MapKit

class LocationChainManager: NSObject, CLLocationManagerDelegate {
    private let locationManager = CLLocationManager()
    private let olocusManager = OlocusManager()
    private var chain: OpaquePointer?
    
    override init() {
        super.init()
        setupLocationManager()
        setupChain()
    }
    
    deinit {
        if let chain = chain {
            olocus_chain_destroy(chain)
        }
    }
    
    private func setupLocationManager() {
        locationManager.delegate = self
        locationManager.desiredAccuracy = kCLLocationAccuracyBest
        locationManager.requestWhenInUseAuthorization()
    }
    
    private func setupChain() {
        chain = olocus_chain_create()
    }
    
    func startLocationTracking() {
        guard CLLocationManager.locationServicesEnabled() else {
            print("Location services not enabled")
            return
        }
        
        locationManager.startUpdatingLocation()
        locationManager.startMonitoringSignificantLocationChanges()
    }
    
    // MARK: - CLLocationManagerDelegate
    
    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        for location in locations {
            addLocationBlock(location)
        }
    }
    
    func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        print("Location error: \(error.localizedDescription)")
    }
    
    private func addLocationBlock(_ location: CLLocation) {
        let payload = LocationPayload(
            latitude: location.coordinate.latitude,
            longitude: location.coordinate.longitude,
            altitude: location.altitude,
            horizontalAccuracy: location.horizontalAccuracy,
            verticalAccuracy: location.verticalAccuracy,
            course: location.course,
            speed: location.speed,
            timestamp: location.timestamp.timeIntervalSince1970
        )
        
        do {
            let block = try createLocationBlock(payload)
            addBlockToChain(block)
        } catch {
            print("Failed to create location block: \(error)")
        }
    }
    
    private func createLocationBlock(_ payload: LocationPayload) throws -> OpaquePointer {
        let payloadData = try JSONEncoder().encode(payload)
        let keyManager = SecureKeyManager()
        let signingKey = try keyManager.loadExistingKey() ?? keyManager.generateSecureKey()
        
        // Get previous block hash if chain exists
        var prevHash = Data(count: 32)
        let chainLength = olocus_chain_get_length(chain)
        
        if chainLength > 0 {
            let lastBlock = olocus_chain_get_last_block(chain)
            prevHash.withUnsafeMutableBytes { hashBytes in
                olocus_block_get_hash(
                    lastBlock,
                    hashBytes.baseAddress?.assumingMemoryBound(to: UInt8.self)
                )
            }
        }
        
        let block = payloadData.withUnsafeBytes { payloadBytes in
            signingKey.withUnsafeBytes { keyBytes in
                prevHash.withUnsafeBytes { hashBytes in
                    if chainLength == 0 {
                        // Genesis block
                        return olocus_block_create_genesis(
                            Int64(payload.timestamp),
                            payloadBytes.baseAddress?.assumingMemoryBound(to: UInt8.self),
                            payloadData.count,
                            0x0200, // Location payload type
                            keyBytes.baseAddress?.assumingMemoryBound(to: UInt8.self)
                        )
                    } else {
                        // Regular block
                        return olocus_block_create(
                            chainLength,
                            Int64(payload.timestamp),
                            hashBytes.baseAddress?.assumingMemoryBound(to: UInt8.self),
                            payloadBytes.baseAddress?.assumingMemoryBound(to: UInt8.self),
                            payloadData.count,
                            0x0200, // Location payload type
                            keyBytes.baseAddress?.assumingMemoryBound(to: UInt8.self)
                        )
                    }
                }
            }
        }
        
        guard block != nil else {
            throw LocationError.blockCreationFailed
        }
        
        return block!
    }
    
    private func addBlockToChain(_ block: OpaquePointer) {
        let result = olocus_chain_add_block(chain, block)
        if result != 0 {
            let error = String(cString: olocus_get_last_error_message()!)
            print("Failed to add block to chain: \(error)")
            olocus_free_string(UnsafeMutablePointer(mutating: olocus_get_last_error_message()!))
        }
        
        // Clean up block (chain takes ownership)
        // olocus_block_destroy(block) // Don't call this if chain owns the block
    }
    
    func exportChain() -> Data? {
        guard let chain = chain else { return nil }
        
        let wireFormat = olocus_wire_format_json()
        let buffer = olocus_chain_to_wire_format(chain, wireFormat)
        defer { olocus_byte_buffer_free(UnsafeMutablePointer(mutating: &buffer)) }
        
        return Data(bytes: buffer.data, count: buffer.len)
    }
}

struct LocationPayload: Codable {
    let latitude: CLLocationDegrees
    let longitude: CLLocationDegrees
    let altitude: CLLocationDistance
    let horizontalAccuracy: CLLocationAccuracy
    let verticalAccuracy: CLLocationAccuracy
    let course: CLLocationDirection
    let speed: CLLocationSpeed
    let timestamp: TimeInterval
}

enum LocationError: Error {
    case blockCreationFailed
}
```

### Wire Format Integration

```swift
class WireFormatManager {
    // Create different wire formats
    func createJSONFormat() -> FFIWireFormat {
        return olocus_wire_format_json()
    }
    
    func createCompressedFormat() -> FFIWireFormat {
        return olocus_wire_format_new(
            FFIEncodingFormat_Json,
            FFICompressionMethod_Zstd
        )
    }
    
    func createMessagePackFormat() -> FFIWireFormat {
        return olocus_wire_format_msgpack()
    }
    
    // Serialize block to different formats
    func serializeBlock(_ block: OpaquePointer, format: FFIWireFormat) -> Data? {
        let buffer = olocus_block_to_wire_format(block, format)
        defer { olocus_byte_buffer_free(UnsafeMutablePointer(mutating: &buffer)) }
        
        guard buffer.data != nil else { return nil }
        return Data(bytes: buffer.data, count: buffer.len)
    }
    
    // Deserialize block from data
    func deserializeBlock(_ data: Data, format: FFIWireFormat) -> OpaquePointer? {
        return data.withUnsafeBytes { bytes in
            olocus_block_from_wire_format(
                bytes.baseAddress?.assumingMemoryBound(to: UInt8.self),
                data.count,
                format
            )
        }
    }
    
    // Get content type for HTTP headers
    func getContentType(_ format: FFIWireFormat) -> String {
        guard let cString = olocus_wire_format_content_type(format) else {
            return "application/octet-stream"
        }
        defer { olocus_free_string(UnsafeMutablePointer(mutating: cString)) }
        return String(cString: cString)
    }
    
    // Parse content type to create format
    func formatFromContentType(_ contentType: String) -> FFIWireFormat? {
        var format = FFIWireFormat()
        let result = contentType.withCString { cString in
            olocus_wire_format_from_content_type(cString, &format)
        }
        
        return result == 0 ? format : nil
    }
}
```

## Objective-C Integration

### Wrapper Class

```objc
// OlocusManager.h
#import <Foundation/Foundation.h>
#import "olocus_ffi.h"

NS_ASSUME_NONNULL_BEGIN

@interface OlocusManager : NSObject

@property (nonatomic, readonly, getter=isInitialized) BOOL initialized;

- (instancetype)init;
- (BOOL)initializeWithError:(NSError **)error;
- (void)shutdown;

- (NSData * _Nullable)generateKeyPair;
- (NSData * _Nullable)createGenesisBlockWithPayload:(NSData *)payload
                                         payloadType:(uint32_t)payloadType
                                          signingKey:(NSData *)signingKey
                                               error:(NSError **)error;

- (BOOL)verifyBlock:(FFIBlock *)block error:(NSError **)error;
- (NSString *)lastErrorMessage;

@end

NS_ASSUME_NONNULL_END

// OlocusManager.m
#import "OlocusManager.h"

static NSString * const OlocusErrorDomain = @"OlocusErrorDomain";

@implementation OlocusManager

- (instancetype)init {
    self = [super init];
    if (self) {
        _initialized = NO;
    }
    return self;
}

- (void)dealloc {
    if (_initialized) {
        olocus_shutdown();
    }
}

- (BOOL)initializeWithError:(NSError **)error {
    if (_initialized) {
        return YES;
    }
    
    FFIConfig *config = olocus_config_create();
    olocus_config_set_platform_ios(config, true);
    olocus_config_set_keychain_enabled(config, true);
    
    int result = olocus_init_with_config(config);
    olocus_config_destroy(config);
    
    if (result != 0) {
        if (error) {
            NSString *message = [self lastErrorMessage];
            *error = [NSError errorWithDomain:OlocusErrorDomain
                                         code:result
                                     userInfo:@{NSLocalizedDescriptionKey: message}];
        }
        return NO;
    }
    
    _initialized = YES;
    return YES;
}

- (void)shutdown {
    if (_initialized) {
        olocus_shutdown();
        _initialized = NO;
    }
}

- (NSData *)generateKeyPair {
    FFIKeyPair *keypair = olocus_keypair_generate();
    if (!keypair) {
        return nil;
    }
    
    uint8_t privateKey[32];
    olocus_keypair_get_private_key(keypair, privateKey);
    
    NSData *keyData = [NSData dataWithBytes:privateKey length:32];
    
    // Securely clear the key
    memset_s(privateKey, 32, 0, 32);
    olocus_keypair_destroy(keypair);
    
    return keyData;
}

- (NSData *)createGenesisBlockWithPayload:(NSData *)payload
                              payloadType:(uint32_t)payloadType
                               signingKey:(NSData *)signingKey
                                    error:(NSError **)error {
    
    if (signingKey.length != 32) {
        if (error) {
            *error = [NSError errorWithDomain:OlocusErrorDomain
                                         code:104  // InvalidArgument
                                     userInfo:@{NSLocalizedDescriptionKey: @"Signing key must be 32 bytes"}];
        }
        return nil;
    }
    
    int64_t timestamp = (int64_t)[[NSDate date] timeIntervalSince1970];
    
    FFIBlock *block = olocus_block_create_genesis(
        timestamp,
        payload.bytes,
        payload.length,
        payloadType,
        signingKey.bytes
    );
    
    if (!block) {
        if (error) {
            NSString *message = [self lastErrorMessage];
            *error = [NSError errorWithDomain:OlocusErrorDomain
                                         code:108  // OperationFailed
                                     userInfo:@{NSLocalizedDescriptionKey: message}];
        }
        return nil;
    }
    
    // Serialize to data
    FFIWireFormat format = olocus_wire_format_binary();
    FFIByteBuffer buffer = olocus_block_to_wire_format(block, format);
    
    NSData *blockData = [NSData dataWithBytes:buffer.data length:buffer.len];
    
    olocus_byte_buffer_free(&buffer);
    olocus_block_destroy(block);
    
    return blockData;
}

- (BOOL)verifyBlock:(FFIBlock *)block error:(NSError **)error {
    int result = olocus_block_verify(block);
    
    if (result != 0) {
        if (error) {
            NSString *message = [self lastErrorMessage];
            *error = [NSError errorWithDomain:OlocusErrorDomain
                                         code:result
                                     userInfo:@{NSLocalizedDescriptionKey: message}];
        }
        return NO;
    }
    
    return YES;
}

- (NSString *)lastErrorMessage {
    const char *cMessage = olocus_get_last_error_message();
    if (!cMessage) {
        return @"Unknown error";
    }
    
    NSString *message = [NSString stringWithUTF8String:cMessage];
    olocus_free_string((char *)cMessage);
    return message;
}

@end
```

## Performance Considerations

### Threading

```swift
class ThreadSafeOlocusManager {
    private let queue = DispatchQueue(label: "com.yourapp.olocus", qos: .utility)
    private var chain: OpaquePointer?
    private let chainLock = NSLock()
    
    func addBlockAsync(_ block: OpaquePointer, completion: @escaping (Result<Void, Error>) -> Void) {
        queue.async { [weak self] in
            guard let self = self else { return }
            
            self.chainLock.lock()
            defer { self.chainLock.unlock() }
            
            let result = olocus_chain_add_block(self.chain, block)
            
            DispatchQueue.main.async {
                if result == 0 {
                    completion(.success(()))
                } else {
                    let error = String(cString: olocus_get_last_error_message()!)
                    completion(.failure(OlocusError.operationFailed(error)))
                }
            }
        }
    }
    
    func getChainLengthAsync(completion: @escaping (Int) -> Void) {
        queue.async { [weak self] in
            guard let self = self else { return }
            
            self.chainLock.lock()
            let length = Int(olocus_chain_get_length(self.chain))
            self.chainLock.unlock()
            
            DispatchQueue.main.async {
                completion(length)
            }
        }
    }
}
```

### Memory Management

```swift
class MemoryOptimizedManager {
    // Use autoreleasepool for batch operations
    func processManyBlocks(_ payloads: [Data]) {
        autoreleasepool {
            for payload in payloads {
                autoreleasepool {
                    processBlock(payload)
                }
            }
        }
    }
    
    // Reuse buffers
    private var reuseBuffer = Data(count: 1024)
    
    func processBlock(_ payload: Data) {
        // Reuse buffer if possible
        if reuseBuffer.count < payload.count {
            reuseBuffer = Data(count: payload.count * 2)
        }
        
        // Process...
    }
}
```

## Testing

### Unit Tests

```swift
import XCTest
@testable import YourApp

class OlocusTests: XCTestCase {
    var manager: OlocusManager!
    
    override func setUp() {
        super.setUp()
        manager = OlocusManager()
    }
    
    override func tearDown() {
        manager = nil
        super.tearDown()
    }
    
    func testInitialization() {
        XCTAssertTrue(manager.isInitialized)
    }
    
    func testKeyGeneration() {
        let keyData = manager.generateKeyPair()
        XCTAssertNotNil(keyData)
        XCTAssertEqual(keyData?.count, 32)
    }
    
    func testBlockCreation() {
        let payload = "Test payload".data(using: .utf8)!
        let keyData = manager.generateKeyPair()!
        
        let blockData = manager.createGenesisBlock(
            payload: payload,
            payloadType: 0,
            signingKey: keyData
        )
        
        XCTAssertNotNil(blockData)
    }
}
```

### Integration Tests

```swift
class LocationIntegrationTests: XCTestCase {
    func testLocationBlockCreation() {
        let locationManager = LocationChainManager()
        
        let expectation = self.expectation(description: "Location block created")
        
        // Simulate location update
        let location = CLLocation(
            coordinate: CLLocationCoordinate2D(latitude: 37.7749, longitude: -122.4194),
            altitude: 100.0,
            horizontalAccuracy: 5.0,
            verticalAccuracy: 10.0,
            timestamp: Date()
        )
        
        locationManager.addLocationBlock(location) { result in
            switch result {
            case .success:
                expectation.fulfill()
            case .failure(let error):
                XCTFail("Failed to create location block: \(error)")
            }
        }
        
        waitForExpectations(timeout: 10.0)
    }
}
```

## Best Practices

### Security

1. **Always use Secure Enclave** for key storage when available
2. **Implement biometric authentication** for critical operations
3. **Validate all inputs** before passing to FFI functions
4. **Use App Attestation** for integrity verification
5. **Clear sensitive memory** after use

### Performance

1. **Use background queues** for heavy operations
2. **Implement proper locking** for thread safety
3. **Reuse buffers** where possible
4. **Use autoreleasepool** for batch operations
5. **Profile memory usage** regularly

### Error Handling

1. **Always check return codes** from FFI functions
2. **Provide meaningful error messages** to users
3. **Log errors** for debugging
4. **Implement retry logic** for transient failures
5. **Handle network errors** gracefully

## Troubleshooting

### Common Issues

1. **Library not found**: Ensure XCFramework is properly embedded
2. **Keychain access denied**: Check entitlements and permissions
3. **App Attest unavailable**: Verify device support and configuration
4. **Location access denied**: Request appropriate permissions
5. **Memory leaks**: Use Instruments to profile and fix

### Debug Tips

1. **Enable debug logging** in development builds
2. **Use breakpoints** in Swift/Objective-C code
3. **Check error messages** from FFI functions
4. **Validate inputs** before FFI calls
5. **Test on different devices** and iOS versions
