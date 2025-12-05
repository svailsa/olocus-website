---
id: keystore
title: Keystore Management
sidebar_position: 4
---

# Keystore Management

The Keystore extension provides secure key derivation, storage, and lifecycle management across multiple platforms with BIP-32/44 support and hardware-backed security.

## Overview

The Keystore extension offers comprehensive key management capabilities:

- **Key Derivation**: BIP-32, BIP-44 hierarchical deterministic wallets
- **Secure Storage**: iOS Keychain, Android Keystore, Windows DPAPI
- **Key Rotation**: Automatic rotation with configurable policies
- **Backup & Recovery**: Mnemonic phrases, encrypted backups
- **Access Control**: Biometric authentication, PIN protection
- **Cross-Platform**: Unified API across mobile and desktop platforms

```rust
use olocus_keystore::*;

// Configure keystore
let keystore_config = KeystoreConfig {
    backend: KeystoreBackend::Platform, // Use platform-specific secure storage
    derivation_method: KeyDerivationMethod::BIP44 {
        coin_type: 0,        // Bitcoin coin type
        account: 0,          // First account
    },
    encryption: EncryptionConfig {
        algorithm: EncryptionAlgorithm::AES256GCM,
        key_derivation: KeyDerivationFunction::PBKDF2 {
            iterations: 100000,
            salt_length: 32,
        },
    },
    rotation_policy: RotationPolicy {
        enabled: true,
        interval: Duration::from_days(90),
        advance_warning: Duration::from_days(7),
    },
};

let keystore = Keystore::new(keystore_config).await?;
```

## BIP-32 Hierarchical Deterministic Keys

BIP-32 enables deterministic key derivation from a single master seed:

### BIP-32 Implementation

```rust
use olocus_keystore::bip32::*;
use olocus_keystore::bip39::*;

pub struct BIP32KeyDerivation {
    master_seed: [u8; 64],           // 512-bit master seed
    master_key: ExtendedKey,         // Master extended key
    derivation_cache: LruCache<String, DerivedKey>,
}

#[derive(Debug, Clone)]
pub struct ExtendedKey {
    pub key: PrivateKey,             // 32-byte private key
    pub chain_code: [u8; 32],        // 32-byte chain code
    pub depth: u8,                   // Derivation depth
    pub parent_fingerprint: [u8; 4], // Parent key fingerprint
    pub child_index: u32,            // Child key index
}

impl KeyDerivationMethod for BIP32KeyDerivation {
    fn derive_key(&mut self, path: &DerivationPath) -> Result<DerivedKey> {
        let path_string = path.to_string();
        
        // Check cache first
        if let Some(cached_key) = self.derivation_cache.get(&path_string) {
            return Ok(cached_key.clone());
        }
        
        // Derive key step by step
        let mut current_key = self.master_key.clone();
        
        for &index in &path.indices {
            current_key = self.derive_child_key(&current_key, index)?;
        }
        
        let derived_key = DerivedKey {
            private_key: current_key.key,
            public_key: current_key.key.public_key(),
            chain_code: current_key.chain_code,
            path: path.clone(),
            fingerprint: self.calculate_fingerprint(&current_key.key.public_key()),
        };
        
        // Cache the result
        self.derivation_cache.insert(path_string, derived_key.clone());
        
        Ok(derived_key)
    }
    
    fn derive_child_key(&self, parent: &ExtendedKey, index: u32) -> Result<ExtendedKey> {
        let is_hardened = index >= 0x80000000;
        
        // Prepare data for HMAC
        let mut hmac_data = Vec::new();
        
        if is_hardened {
            // Hardened derivation: use private key
            hmac_data.push(0x00); // Padding byte
            hmac_data.extend_from_slice(&parent.key.as_bytes());
        } else {
            // Non-hardened derivation: use public key
            hmac_data.extend_from_slice(&parent.key.public_key().as_bytes());
        }
        
        hmac_data.extend_from_slice(&index.to_be_bytes());
        
        // HMAC-SHA512 with chain code as key
        let hmac_result = hmac_sha512(&parent.chain_code, &hmac_data);
        
        // Split result: left 32 bytes = key material, right 32 bytes = chain code
        let key_material = &hmac_result[..32];
        let chain_code: [u8; 32] = hmac_result[32..].try_into().unwrap();
        
        // Derive child private key
        let child_key = self.add_private_keys(&parent.key, key_material)?;
        
        // Calculate parent fingerprint
        let parent_public = parent.key.public_key();
        let parent_fingerprint = self.calculate_fingerprint(&parent_public)[..4].try_into().unwrap();
        
        Ok(ExtendedKey {
            key: child_key,
            chain_code,
            depth: parent.depth + 1,
            parent_fingerprint,
            child_index: index,
        })
    }
    
    fn from_mnemonic(mnemonic: &str, passphrase: Option<&str>) -> Result<Self> {
        // Validate mnemonic
        if !Mnemonic::validate(mnemonic) {
            return Err(KeystoreError::InvalidMnemonic);
        }
        
        // Generate seed from mnemonic
        let seed = Mnemonic::to_seed(mnemonic, passphrase.unwrap_or(""));
        
        // Generate master key
        let hmac_result = hmac_sha512(b"Bitcoin seed", &seed);
        let master_key_bytes = &hmac_result[..32];
        let master_chain_code: [u8; 32] = hmac_result[32..].try_into().unwrap();
        
        let master_private_key = PrivateKey::from_bytes(master_key_bytes)?;
        
        let master_key = ExtendedKey {
            key: master_private_key,
            chain_code: master_chain_code,
            depth: 0,
            parent_fingerprint: [0; 4],
            child_index: 0,
        };
        
        Ok(Self {
            master_seed: seed,
            master_key,
            derivation_cache: LruCache::new(100),
        })
    }
}
```

### BIP-44 Multi-Account Structure

```rust
use olocus_keystore::bip44::*;

pub struct BIP44KeyManager {
    derivation: BIP32KeyDerivation,
    coin_type: u32,
    accounts: HashMap<u32, AccountInfo>,
}

#[derive(Debug, Clone)]
pub struct AccountInfo {
    pub account_index: u32,
    pub external_chain_index: u32,  // Receiving addresses
    pub internal_chain_index: u32,  // Change addresses
    pub keys: HashMap<(u32, u32), DerivedKey>, // (chain, index) -> key
}

impl BIP44KeyManager {
    pub fn new(mnemonic: &str, coin_type: u32) -> Result<Self> {
        let derivation = BIP32KeyDerivation::from_mnemonic(mnemonic, None)?;
        
        Ok(Self {
            derivation,
            coin_type,
            accounts: HashMap::new(),
        })
    }
    
    pub fn derive_account_key(&mut self, account: u32) -> Result<DerivedKey> {
        // BIP-44 path: m/44'/coin_type'/account'
        let path = DerivationPath::new(vec![
            44 | 0x80000000,           // Purpose (hardened)
            self.coin_type | 0x80000000, // Coin type (hardened)
            account | 0x80000000,       // Account (hardened)
        ])?;
        
        self.derivation.derive_key(&path)
    }
    
    pub fn derive_address_key(
        &mut self,
        account: u32,
        is_change: bool,
        index: u32
    ) -> Result<DerivedKey> {
        // BIP-44 path: m/44'/coin_type'/account'/change/address_index
        let change = if is_change { 1 } else { 0 };
        
        let path = DerivationPath::new(vec![
            44 | 0x80000000,           // Purpose (hardened)
            self.coin_type | 0x80000000, // Coin type (hardened)
            account | 0x80000000,       // Account (hardened)
            change,                     // Change (non-hardened)
            index,                      // Address index (non-hardened)
        ])?;
        
        let derived_key = self.derivation.derive_key(&path)?;
        
        // Track key in account info
        let account_info = self.accounts.entry(account).or_insert_with(|| AccountInfo {
            account_index: account,
            external_chain_index: 0,
            internal_chain_index: 0,
            keys: HashMap::new(),
        });
        
        account_info.keys.insert((change, index), derived_key.clone());
        
        // Update chain index
        if is_change {
            account_info.internal_chain_index = account_info.internal_chain_index.max(index + 1);
        } else {
            account_info.external_chain_index = account_info.external_chain_index.max(index + 1);
        }
        
        Ok(derived_key)
    }
    
    pub fn get_next_receiving_key(&mut self, account: u32) -> Result<DerivedKey> {
        let account_info = self.accounts.entry(account).or_insert_with(|| AccountInfo {
            account_index: account,
            external_chain_index: 0,
            internal_chain_index: 0,
            keys: HashMap::new(),
        });
        
        let index = account_info.external_chain_index;
        self.derive_address_key(account, false, index)
    }
    
    pub fn get_next_change_key(&mut self, account: u32) -> Result<DerivedKey> {
        let account_info = self.accounts.entry(account).or_insert_with(|| AccountInfo {
            account_index: account,
            external_chain_index: 0,
            internal_chain_index: 0,
            keys: HashMap::new(),
        });
        
        let index = account_info.internal_chain_index;
        self.derive_address_key(account, true, index)
    }
}
```

## Platform-Specific Secure Storage

### iOS Keychain Integration

```rust
use olocus_keystore::ios::*;
use security_framework::keychain::*;

pub struct IOSKeychainBackend {
    service_name: String,
    access_group: Option<String>,
    accessibility: KeychainAccessibility,
    require_biometry: bool,
}

#[derive(Debug, Clone)]
pub enum KeychainAccessibility {
    WhenUnlocked,                    // Available when device unlocked
    WhenUnlockedThisDeviceOnly,     // Device-specific, when unlocked
    AfterFirstUnlock,               // Available after first unlock
    WhenPasscodeSetThisDeviceOnly,  // Requires passcode, device-specific
    BiometryAny,                    // Biometry required (Touch ID/Face ID)
    BiometryCurrentSet,             // Current biometry enrollment required
}

impl KeystoreBackend for IOSKeychainBackend {
    async fn store_key(&self, key_id: &str, key_data: &KeyData) -> Result<()> {
        let key_label = format!("{}-{}", self.service_name, key_id);
        
        // Serialize key data
        let serialized_key = self.serialize_key_data(key_data)?;
        
        // Set up keychain attributes
        let mut attributes = vec![
            (kSecClass, kSecClassGenericPassword),
            (kSecAttrService, self.service_name.as_ref()),
            (kSecAttrAccount, key_id.as_ref()),
            (kSecAttrLabel, key_label.as_ref()),
            (kSecValueData, serialized_key.as_slice()),
            (kSecAttrAccessible, self.map_accessibility(&self.accessibility)),
        ];
        
        // Add access group if specified
        if let Some(ref access_group) = self.access_group {
            attributes.push((kSecAttrAccessGroup, access_group.as_ref()));
        }
        
        // Add biometric requirements
        if self.require_biometry {
            let access_control = SecAccessControl::create_with_flags(
                None,
                kSecAttrAccessibleWhenUnlockedThisDeviceOnly,
                kSecAccessControlBiometryAny
            ).map_err(|e| KeystoreError::BiometrySetupFailed(e.to_string()))?;
            
            attributes.push((kSecAttrAccessControl, access_control));
        }
        
        // Store in keychain
        let status = SecItemAdd(&attributes, None);
        
        match status {
            errSecSuccess => Ok(()),
            errSecDuplicateItem => {
                // Update existing item
                self.update_key(key_id, key_data).await
            },
            _ => Err(KeystoreError::StorageFailed(format!("Keychain error: {}", status))),
        }
    }
    
    async fn retrieve_key(&self, key_id: &str) -> Result<Option<KeyData>> {
        let query = vec![
            (kSecClass, kSecClassGenericPassword),
            (kSecAttrService, self.service_name.as_ref()),
            (kSecAttrAccount, key_id.as_ref()),
            (kSecReturnData, kCFBooleanTrue),
            (kSecMatchLimit, kSecMatchLimitOne),
        ];
        
        // Add biometric prompt if required
        if self.require_biometry {
            let context = LAContext::new();
            context.set_localized_fallback_title("Enter Passcode");
            
            let auth_result = context.evaluate_policy(
                LAPolicy::BiometryDeviceOwnerAuthentication,
                "Access cryptographic key"
            ).await;
            
            if let Err(e) = auth_result {
                return Err(KeystoreError::AuthenticationFailed(e.to_string()));
            }
        }
        
        let mut result: CFTypeRef = std::ptr::null();
        let status = SecItemCopyMatching(&query, &mut result);
        
        match status {
            errSecSuccess => {
                let data = unsafe { CFData::wrap_under_get_rule(result as CFDataRef) };
                let key_bytes = data.bytes();
                let key_data = self.deserialize_key_data(key_bytes)?;
                Ok(Some(key_data))
            },
            errSecItemNotFound => Ok(None),
            _ => Err(KeystoreError::RetrievalFailed(format!("Keychain error: {}", status))),
        }
    }
    
    async fn delete_key(&self, key_id: &str) -> Result<()> {
        let query = vec![
            (kSecClass, kSecClassGenericPassword),
            (kSecAttrService, self.service_name.as_ref()),
            (kSecAttrAccount, key_id.as_ref()),
        ];
        
        let status = SecItemDelete(&query);
        
        match status {
            errSecSuccess | errSecItemNotFound => Ok(()),
            _ => Err(KeystoreError::DeletionFailed(format!("Keychain error: {}", status))),
        }
    }
    
    fn map_accessibility(&self, accessibility: &KeychainAccessibility) -> CFStringRef {
        match accessibility {
            KeychainAccessibility::WhenUnlocked => kSecAttrAccessibleWhenUnlocked,
            KeychainAccessibility::WhenUnlockedThisDeviceOnly => kSecAttrAccessibleWhenUnlockedThisDeviceOnly,
            KeychainAccessibility::AfterFirstUnlock => kSecAttrAccessibleAfterFirstUnlock,
            KeychainAccessibility::WhenPasscodeSetThisDeviceOnly => kSecAttrAccessibleWhenPasscodeSetThisDeviceOnly,
            KeychainAccessibility::BiometryAny => kSecAttrAccessibleWhenUnlockedThisDeviceOnly,
            KeychainAccessibility::BiometryCurrentSet => kSecAttrAccessibleWhenUnlockedThisDeviceOnly,
        }
    }
}
```

### Android Keystore Integration

```rust
use olocus_keystore::android::*;
use jni::{JNIEnv, JavaVM, objects::*};

pub struct AndroidKeystoreBackend {
    keystore_alias_prefix: String,
    require_authentication: bool,
    authentication_validity_duration: Duration,
    encryption_required: bool,
}

impl KeystoreBackend for AndroidKeystoreBackend {
    async fn store_key(&self, key_id: &str, key_data: &KeyData) -> Result<()> {
        let alias = format!("{}{}", self.keystore_alias_prefix, key_id);
        
        // Get JNI environment
        let env = self.get_jni_env()?;
        
        if self.encryption_required {
            // Generate encryption key in Android Keystore
            self.generate_keystore_key(&env, &alias)?;
            
            // Encrypt key data with Keystore key
            let encrypted_data = self.encrypt_with_keystore_key(&env, &alias, key_data)?;
            
            // Store encrypted data in shared preferences or file
            self.store_encrypted_data(&env, key_id, &encrypted_data).await?;
        } else {
            // Store directly in Android Keystore (for supported key types)
            self.store_key_in_keystore(&env, &alias, key_data)?;
        }
        
        Ok(())
    }
    
    async fn retrieve_key(&self, key_id: &str) -> Result<Option<KeyData>> {
        let alias = format!("{}{}", self.keystore_alias_prefix, key_id);
        let env = self.get_jni_env()?;
        
        // Check if key exists
        if !self.keystore_contains_alias(&env, &alias)? {
            return Ok(None);
        }
        
        if self.encryption_required {
            // Retrieve encrypted data
            let encrypted_data = match self.get_encrypted_data(&env, key_id).await? {
                Some(data) => data,
                None => return Ok(None),
            };
            
            // Decrypt with Keystore key
            let key_data = self.decrypt_with_keystore_key(&env, &alias, &encrypted_data)?;
            Ok(Some(key_data))
        } else {
            // Retrieve directly from Android Keystore
            let key_data = self.retrieve_key_from_keystore(&env, &alias)?;
            Ok(Some(key_data))
        }
    }
    
    fn generate_keystore_key(&self, env: &JNIEnv, alias: &str) -> Result<()> {
        // KeyGenerator for AES keys
        let key_generator_class = env.find_class("javax/crypto/KeyGenerator")?;
        let key_generator = env.call_static_method(
            key_generator_class,
            "getInstance",
            "(Ljava/lang/String;Ljava/lang/String;)Ljavax/crypto/KeyGenerator;",
            &[
                JValue::Object(env.new_string("AES")?.into()),
                JValue::Object(env.new_string("AndroidKeyStore")?.into()),
            ],
        )?.l()?;
        
        // KeyGenParameterSpec.Builder
        let builder_class = env.find_class("android/security/keystore/KeyGenParameterSpec$Builder")?;
        let builder = env.new_object(
            builder_class,
            "(Ljava/lang/String;I)V",
            &[
                JValue::Object(env.new_string(alias)?.into()),
                JValue::Int(3), // PURPOSE_ENCRYPT | PURPOSE_DECRYPT
            ],
        )?;
        
        // Set key size
        env.call_method(
            builder,
            "setKeySize",
            "(I)Landroid/security/keystore/KeyGenParameterSpec$Builder;",
            &[JValue::Int(256)],
        )?;
        
        // Set encryption padding and mode
        env.call_method(
            builder,
            "setEncryptionPaddings",
            "([Ljava/lang/String;)Landroid/security/keystore/KeyGenParameterSpec$Builder;",
            &[JValue::Object(self.create_string_array(&env, &["PKCS7Padding"])?.into())],
        )?;
        
        env.call_method(
            builder,
            "setBlockModes",
            "([Ljava/lang/String;)Landroid/security/keystore/KeyGenParameterSpec$Builder;",
            &[JValue::Object(self.create_string_array(&env, &["GCM"])?.into())],
        )?;
        
        // Set authentication requirements
        if self.require_authentication {
            env.call_method(
                builder,
                "setUserAuthenticationRequired",
                "(Z)Landroid/security/keystore/KeyGenParameterSpec$Builder;",
                &[JValue::Bool(1)],
            )?;
            
            env.call_method(
                builder,
                "setUserAuthenticationValidityDurationSeconds",
                "(I)Landroid/security/keystore/KeyGenParameterSpec$Builder;",
                &[JValue::Int(self.authentication_validity_duration.as_secs() as i32)],
            )?;
        }
        
        // Build the spec
        let spec = env.call_method(builder, "build", "()Landroid/security/keystore/KeyGenParameterSpec;", &[])?;
        
        // Initialize KeyGenerator with spec
        env.call_method(
            key_generator,
            "init",
            "(Ljava/security/spec/AlgorithmParameterSpec;)V",
            &[JValue::Object(spec.l()?)],
        )?;
        
        // Generate the key
        env.call_method(key_generator, "generateKey", "()Ljavax/crypto/SecretKey;", &[])?;
        
        Ok(())
    }
    
    fn encrypt_with_keystore_key(&self, env: &JNIEnv, alias: &str, key_data: &KeyData) -> Result<Vec<u8>> {
        // Get the key from Keystore
        let keystore = self.get_keystore(env)?;
        let secret_key = env.call_method(
            keystore,
            "getKey",
            "(Ljava/lang/String;[C)Ljava/security/Key;",
            &[
                JValue::Object(env.new_string(alias)?.into()),
                JValue::Object(JObject::null()),
            ],
        )?.l()?;
        
        // Create cipher
        let cipher_class = env.find_class("javax/crypto/Cipher")?;
        let cipher = env.call_static_method(
            cipher_class,
            "getInstance",
            "(Ljava/lang/String;)Ljavax/crypto/Cipher;",
            &[JValue::Object(env.new_string("AES/GCM/PKCS7Padding")?.into())],
        )?.l()?;
        
        // Initialize cipher for encryption
        env.call_method(
            cipher,
            "init",
            "(ILjava/security/Key;)V",
            &[JValue::Int(1), JValue::Object(secret_key)], // ENCRYPT_MODE = 1
        )?;
        
        // Serialize and encrypt key data
        let serialized_data = self.serialize_key_data(key_data)?;
        let data_array = env.byte_array_from_slice(&serialized_data)?;
        
        let encrypted_result = env.call_method(
            cipher,
            "doFinal",
            "([B)[B",
            &[JValue::Object(data_array.into())],
        )?.l()?;
        
        let encrypted_bytes = env.convert_byte_array(encrypted_result.into_inner())?;
        Ok(encrypted_bytes)
    }
}
```

## Key Rotation Management

### Automatic Key Rotation

```rust
use olocus_keystore::rotation::*;

pub struct KeyRotationManager {
    keystore: Arc<Keystore>,
    rotation_scheduler: TaskScheduler,
    rotation_policies: HashMap<String, RotationPolicy>,
    notification_manager: NotificationManager,
}

#[derive(Debug, Clone)]
pub struct RotationPolicy {
    pub enabled: bool,
    pub interval: Duration,
    pub advance_warning: Duration,
    pub grace_period: Duration,          // Old key remains valid
    pub backup_before_rotation: bool,
    pub require_manual_confirmation: bool,
    pub rotation_triggers: Vec<RotationTrigger>,
}

#[derive(Debug, Clone)]
pub enum RotationTrigger {
    TimeInterval,                        // Regular time-based rotation
    UsageCount(u64),                     // After N operations
    SecurityEvent,                       // After security incident
    ComplianceRequirement,               // Regulatory requirement
    ManualRequest,                       // User-initiated
}

impl KeyRotationManager {
    pub async fn schedule_rotation(&mut self, key_id: &str, policy: RotationPolicy) -> Result<()> {
        // Get current key info
        let key_info = self.keystore.get_key_info(key_id).await?
            .ok_or_else(|| KeystoreError::KeyNotFound(key_id.to_string()))?;
            
        let next_rotation = key_info.created_at + policy.interval;
        let warning_time = next_rotation - policy.advance_warning;
        
        // Schedule advance warning
        self.rotation_scheduler.schedule_task(
            warning_time,
            RotationTask::AdvanceWarning {
                key_id: key_id.to_string(),
                rotation_time: next_rotation,
            },
        ).await?;
        
        // Schedule actual rotation
        if !policy.require_manual_confirmation {
            self.rotation_scheduler.schedule_task(
                next_rotation,
                RotationTask::AutomaticRotation {
                    key_id: key_id.to_string(),
                },
            ).await?;
        }
        
        // Store policy
        self.rotation_policies.insert(key_id.to_string(), policy);
        
        Ok(())
    }
    
    pub async fn rotate_key(&mut self, key_id: &str, reason: RotationReason) -> Result<RotationResult> {
        let policy = self.rotation_policies.get(key_id)
            .ok_or_else(|| KeystoreError::RotationPolicyNotFound(key_id.to_string()))?
            .clone();
            
        // Get current key
        let current_key = self.keystore.get_key_info(key_id).await?
            .ok_or_else(|| KeystoreError::KeyNotFound(key_id.to_string()))?;
            
        // Create backup if required
        if policy.backup_before_rotation {
            self.create_rotation_backup(key_id, &current_key).await?;
        }
        
        // Generate new key with same derivation path but incremented version
        let new_key_spec = KeySpec {
            key_id: format!("{}-v{}", current_key.base_key_id(), current_key.version + 1),
            derivation_path: current_key.derivation_path.clone(),
            algorithm: current_key.algorithm.clone(),
            usage_policy: current_key.usage_policy.clone(),
        };
        
        let new_key_data = self.keystore.generate_key(&new_key_spec).await?;
        
        // Store new key
        self.keystore.store_key(&new_key_spec.key_id, &new_key_data).await?;
        
        // Update key registry
        let rotation_info = KeyRotationInfo {
            old_key_id: key_id.to_string(),
            new_key_id: new_key_spec.key_id.clone(),
            rotation_time: SystemTime::now(),
            reason,
            grace_period_ends: SystemTime::now() + policy.grace_period,
        };
        
        self.keystore.register_key_rotation(&rotation_info).await?;
        
        // Mark old key as superseded (but keep it for grace period)
        self.keystore.update_key_status(key_id, KeyStatus::Superseded).await?;
        
        // Schedule grace period expiration
        self.rotation_scheduler.schedule_task(
            rotation_info.grace_period_ends,
            RotationTask::ExpireOldKey {
                key_id: key_id.to_string(),
            },
        ).await?;
        
        // Send notifications
        self.send_rotation_notifications(&rotation_info).await?;
        
        // Schedule next rotation for new key
        self.schedule_rotation(&new_key_spec.key_id, policy).await?;
        
        Ok(RotationResult {
            rotation_info,
            new_key_data,
        })
    }
    
    async fn handle_advance_warning(&self, key_id: &str, rotation_time: SystemTime) -> Result<()> {
        let policy = self.rotation_policies.get(key_id)
            .ok_or_else(|| KeystoreError::RotationPolicyNotFound(key_id.to_string()))?;
            
        if policy.require_manual_confirmation {
            // Send notification requesting manual confirmation
            self.notification_manager.send_rotation_warning(RotationWarning {
                key_id: key_id.to_string(),
                scheduled_rotation: rotation_time,
                requires_action: true,
                message: format!(
                    "Key {} is scheduled for rotation at {:?}. Manual confirmation required.",
                    key_id, rotation_time
                ),
            }).await?;
        } else {
            // Send informational notification
            self.notification_manager.send_rotation_warning(RotationWarning {
                key_id: key_id.to_string(),
                scheduled_rotation: rotation_time,
                requires_action: false,
                message: format!(
                    "Key {} will be automatically rotated at {:?}.",
                    key_id, rotation_time
                ),
            }).await?;
        }
        
        Ok(())
    }
    
    pub async fn emergency_rotation(&mut self, key_id: &str, security_incident: &SecurityIncident) -> Result<RotationResult> {
        // Log security incident
        self.log_security_incident(key_id, security_incident).await?;
        
        // Perform immediate rotation with no grace period
        let emergency_policy = RotationPolicy {
            enabled: true,
            interval: Duration::ZERO,
            advance_warning: Duration::ZERO,
            grace_period: Duration::ZERO,  // No grace period for emergency
            backup_before_rotation: true,   // Always backup for emergencies
            require_manual_confirmation: false,
            rotation_triggers: vec![RotationTrigger::SecurityEvent],
        };
        
        // Temporarily override policy
        let old_policy = self.rotation_policies.insert(key_id.to_string(), emergency_policy);
        
        let result = self.rotate_key(key_id, RotationReason::SecurityIncident {
            incident_id: security_incident.incident_id.clone(),
            description: security_incident.description.clone(),
        }).await?;
        
        // Restore old policy for new key
        if let Some(old_policy) = old_policy {
            self.rotation_policies.insert(result.rotation_info.new_key_id.clone(), old_policy);
        }
        
        // Immediately revoke old key
        self.keystore.update_key_status(key_id, KeyStatus::Revoked).await?;
        
        // Send emergency notification
        self.notification_manager.send_emergency_rotation_alert(EmergencyRotationAlert {
            key_id: key_id.to_string(),
            new_key_id: result.rotation_info.new_key_id.clone(),
            incident: security_incident.clone(),
            rotation_time: result.rotation_info.rotation_time,
        }).await?;
        
        Ok(result)
    }
}
```

### Backup and Recovery

```rust
use olocus_keystore::backup::*;

pub struct KeyBackupManager {
    backup_storage: Arc<dyn BackupStorage>,
    encryption_key: EncryptionKey,
    compression_enabled: bool,
}

#[derive(Debug, Clone)]
pub struct BackupMetadata {
    pub backup_id: String,
    pub key_count: u32,
    pub created_at: SystemTime,
    pub backup_type: BackupType,
    pub encryption_algorithm: String,
    pub compression_used: bool,
    pub checksum: String,
}

#[derive(Debug, Clone)]
pub enum BackupType {
    Full,                               // All keys
    Incremental,                        // Only changed keys
    Selective(Vec<String>),             // Specific keys
}

impl KeyBackupManager {
    pub async fn create_full_backup(&self, keystore: &Keystore) -> Result<BackupResult> {
        let backup_id = format!("backup-{}", Uuid::new_v4());
        
        // Get all keys
        let key_infos = keystore.list_all_keys().await?;
        let mut backup_data = BackupData {
            version: BACKUP_FORMAT_VERSION,
            created_at: SystemTime::now(),
            keys: Vec::new(),
            metadata: HashMap::new(),
        };
        
        // Export each key
        for key_info in key_infos {
            let key_data = keystore.export_key(&key_info.key_id).await?;
            
            backup_data.keys.push(BackupKeyEntry {
                key_id: key_info.key_id.clone(),
                key_data,
                derivation_path: key_info.derivation_path,
                created_at: key_info.created_at,
                algorithm: key_info.algorithm,
                usage_policy: key_info.usage_policy,
            });
        }
        
        // Serialize backup data
        let serialized = bincode::serialize(&backup_data)?;
        
        // Compress if enabled
        let data_to_encrypt = if self.compression_enabled {
            self.compress_data(&serialized)?
        } else {
            serialized
        };
        
        // Encrypt backup
        let encrypted_data = self.encrypt_backup(&data_to_encrypt)?;
        
        // Calculate checksum
        let checksum = sha256::digest(&encrypted_data);
        
        // Store backup
        let metadata = BackupMetadata {
            backup_id: backup_id.clone(),
            key_count: backup_data.keys.len() as u32,
            created_at: backup_data.created_at,
            backup_type: BackupType::Full,
            encryption_algorithm: "AES-256-GCM".to_string(),
            compression_used: self.compression_enabled,
            checksum,
        };
        
        self.backup_storage.store_backup(&backup_id, &encrypted_data, &metadata).await?;
        
        Ok(BackupResult {
            backup_id,
            metadata,
            backup_size: encrypted_data.len(),
        })
    }
    
    pub async fn restore_from_backup(
        &self,
        backup_id: &str,
        keystore: &mut Keystore,
        restore_options: &RestoreOptions
    ) -> Result<RestoreResult> {
        
        // Get backup metadata
        let metadata = self.backup_storage.get_backup_metadata(backup_id).await?
            .ok_or_else(|| KeystoreError::BackupNotFound(backup_id.to_string()))?;
            
        // Retrieve backup data
        let encrypted_data = self.backup_storage.get_backup_data(backup_id).await?;
        
        // Verify checksum
        let calculated_checksum = sha256::digest(&encrypted_data);
        if calculated_checksum != metadata.checksum {
            return Err(KeystoreError::BackupCorrupted {
                backup_id: backup_id.to_string(),
                expected_checksum: metadata.checksum,
                actual_checksum: calculated_checksum,
            });
        }
        
        // Decrypt backup
        let decrypted_data = self.decrypt_backup(&encrypted_data)?;
        
        // Decompress if needed
        let serialized_data = if metadata.compression_used {
            self.decompress_data(&decrypted_data)?
        } else {
            decrypted_data
        };
        
        // Deserialize backup data
        let backup_data: BackupData = bincode::deserialize(&serialized_data)?;
        
        // Restore keys
        let mut restored_keys = Vec::new();
        let mut failed_keys = Vec::new();
        
        for key_entry in backup_data.keys {
            // Check if key should be restored
            if !self.should_restore_key(&key_entry, restore_options) {
                continue;
            }
            
            // Check for conflicts
            if !restore_options.overwrite_existing {
                if keystore.key_exists(&key_entry.key_id).await? {
                    failed_keys.push(RestoreError {
                        key_id: key_entry.key_id,
                        error: "Key already exists and overwrite not allowed".to_string(),
                    });
                    continue;
                }
            }
            
            // Restore key
            match keystore.import_key(&key_entry.key_id, &key_entry.key_data).await {
                Ok(_) => {
                    restored_keys.push(key_entry.key_id);
                },
                Err(e) => {
                    failed_keys.push(RestoreError {
                        key_id: key_entry.key_id,
                        error: e.to_string(),
                    });
                }
            }
        }
        
        Ok(RestoreResult {
            backup_id: backup_id.to_string(),
            restored_keys,
            failed_keys,
            restore_time: SystemTime::now(),
        })
    }
    
    pub async fn create_mnemonic_backup(
        &self,
        master_key: &ExtendedKey
    ) -> Result<MnemonicBackup> {
        
        // Generate mnemonic from master key entropy
        let entropy = &master_key.key.as_bytes()[..16]; // Use first 128 bits
        let mnemonic = Mnemonic::from_entropy(entropy)?;
        
        // Create backup QR code for easy recovery
        let qr_code = self.generate_backup_qr_code(&mnemonic.phrase())?;
        
        Ok(MnemonicBackup {
            mnemonic_phrase: mnemonic.phrase().to_string(),
            qr_code,
            created_at: SystemTime::now(),
            warning: "Store this mnemonic phrase securely. Anyone with access can recover your keys.".to_string(),
        })
    }
}
```

## Testing & Integration

```rust
#[cfg(test)]
mod keystore_tests {
    use super::*;
    
    #[tokio::test]
    async fn test_bip44_key_derivation() {
        let mnemonic = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
        let mut manager = BIP44KeyManager::new(mnemonic, 0).unwrap(); // Bitcoin
        
        // Derive first receiving address
        let key1 = manager.derive_address_key(0, false, 0).unwrap();
        let key2 = manager.derive_address_key(0, false, 1).unwrap();
        
        // Keys should be different
        assert_ne!(key1.private_key.as_bytes(), key2.private_key.as_bytes());
        
        // Derivation should be deterministic
        let key1_again = manager.derive_address_key(0, false, 0).unwrap();
        assert_eq!(key1.private_key.as_bytes(), key1_again.private_key.as_bytes());
    }
    
    #[tokio::test] 
    async fn test_key_rotation() {
        let mut keystore = create_test_keystore().await;
        let mut rotation_manager = KeyRotationManager::new(Arc::new(keystore));
        
        let key_id = "test-key";
        let policy = RotationPolicy {
            enabled: true,
            interval: Duration::from_secs(60), // 1 minute for testing
            advance_warning: Duration::from_secs(30),
            grace_period: Duration::from_secs(30),
            backup_before_rotation: true,
            require_manual_confirmation: false,
            rotation_triggers: vec![RotationTrigger::TimeInterval],
        };
        
        // Generate initial key
        let key_spec = KeySpec {
            key_id: key_id.to_string(),
            derivation_path: DerivationPath::new(vec![44 | 0x80000000, 0, 0]).unwrap(),
            algorithm: KeyAlgorithm::Ed25519,
            usage_policy: KeyUsagePolicy::default(),
        };
        
        rotation_manager.keystore.generate_key(&key_spec).await.unwrap();
        
        // Schedule rotation
        rotation_manager.schedule_rotation(key_id, policy).await.unwrap();
        
        // Perform rotation
        let result = rotation_manager.rotate_key(key_id, RotationReason::Scheduled).await.unwrap();
        
        assert_ne!(result.rotation_info.old_key_id, result.rotation_info.new_key_id);
        assert!(result.rotation_info.new_key_id.contains("-v"));
    }
    
    #[tokio::test]
    async fn test_backup_and_restore() {
        let keystore = create_test_keystore().await;
        let backup_manager = KeyBackupManager::new(create_test_backup_storage()).await;
        
        // Generate some test keys
        for i in 0..5 {
            let key_spec = KeySpec {
                key_id: format!("test-key-{}", i),
                derivation_path: DerivationPath::new(vec![44 | 0x80000000, 0, i]).unwrap(),
                algorithm: KeyAlgorithm::Ed25519,
                usage_policy: KeyUsagePolicy::default(),
            };
            keystore.generate_key(&key_spec).await.unwrap();
        }
        
        // Create backup
        let backup_result = backup_manager.create_full_backup(&keystore).await.unwrap();
        assert_eq!(backup_result.metadata.key_count, 5);
        
        // Create new keystore
        let mut new_keystore = create_empty_keystore().await;
        
        // Restore from backup
        let restore_options = RestoreOptions {
            overwrite_existing: false,
            key_filter: None,
        };
        
        let restore_result = backup_manager.restore_from_backup(
            &backup_result.backup_id,
            &mut new_keystore,
            &restore_options
        ).await.unwrap();
        
        assert_eq!(restore_result.restored_keys.len(), 5);
        assert!(restore_result.failed_keys.is_empty());
    }
}
```

## Related Documentation

- [HSM Integration](./hsm-integration.md) - Hardware-backed key storage
- [Device Integrity](./device-integrity.md) - Secure device attestation
- [Trust Networks](./trust-networks.md) - Key-based trust establishment
- [Post-Quantum Cryptography](./post-quantum.md) - Future-proof key algorithms