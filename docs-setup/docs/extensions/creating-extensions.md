---
id: creating-extensions
title: Creating Custom Extensions
sidebar_position: 100
---

# Creating Custom Extensions

Learn how to build your own extensions for the Olocus Protocol using the standard enum/trait hybrid pattern.

## Extension Architecture

Every Olocus extension follows the same pattern:
1. **Trait** for custom implementations
2. **Enum** for built-in implementations
3. **Payload** type implementing `BlockPayload`
4. **Error** types in the standard range

## Basic Extension Template

### 1. Define Your Payload

```rust
use olocus_core::{BlockPayload, Error};
use serde::{Serialize, Deserialize};

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct MyExtensionPayload {
    pub data: String,
    pub timestamp: u64,
    pub metadata: HashMap<String, String>,
}

impl BlockPayload for MyExtensionPayload {
    fn to_bytes(&self) -> Vec<u8> {
        serde_json::to_vec(self).unwrap()
    }
    
    fn from_bytes(bytes: &[u8]) -> Result<Self, Error> {
        serde_json::from_slice(bytes)
            .map_err(|e| Error::Deserialization(e.to_string()))
    }
    
    fn payload_type() -> u32 {
        0x8000  // Choose unique ID in 0x8000-0xFFFF range
    }
}
```

### 2. Create the Trait

```rust
use async_trait::async_trait;

#[async_trait]
pub trait MyExtensionProcessor: Send + Sync {
    /// Process data according to your extension's logic
    async fn process(
        &self,
        input: &[u8]
    ) -> Result<MyExtensionPayload, MyExtensionError>;
    
    /// Validate data according to your rules
    fn validate(&self, payload: &MyExtensionPayload) -> bool;
    
    /// Get processor metadata
    fn metadata(&self) -> ProcessorMetadata;
}
```

### 3. Create the Enum

```rust
pub enum BuiltInProcessor {
    /// Basic processor with default settings
    Basic {
        timeout: Duration,
        retry_count: u32,
    },
    
    /// Advanced processor with caching
    Advanced {
        cache_size: usize,
        ttl: Duration,
        compression: bool,
    },
    
    /// High-performance processor
    Performance {
        thread_pool_size: usize,
        queue_capacity: usize,
    },
    
    // Future: QuantumProcessor
    // Future: AIProcessor
}

#[async_trait]
impl MyExtensionProcessor for BuiltInProcessor {
    async fn process(&self, input: &[u8]) -> Result<MyExtensionPayload, MyExtensionError> {
        match self {
            Self::Basic { timeout, retry_count } => {
                // Implementation
            },
            Self::Advanced { cache_size, ttl, compression } => {
                // Implementation
            },
            Self::Performance { thread_pool_size, queue_capacity } => {
                // Implementation
            },
        }
    }
    
    fn validate(&self, payload: &MyExtensionPayload) -> bool {
        // Validation logic
        true
    }
    
    fn metadata(&self) -> ProcessorMetadata {
        ProcessorMetadata {
            name: "Built-in Processor".to_string(),
            version: "1.0.0".to_string(),
        }
    }
}
```

### 4. Define Error Types

```rust
#[derive(Debug, thiserror::Error)]
pub enum MyExtensionError {
    #[error("Processing failed: {0}")]
    ProcessingFailed(String),
    
    #[error("Validation failed: {0}")]
    ValidationFailed(String),
    
    #[error("Timeout after {0:?}")]
    Timeout(Duration),
    
    #[error("Resource exhausted: {0}")]
    ResourceExhausted(String),
}

// Map to protocol error codes (choose range like 2000-2099)
impl MyExtensionError {
    pub fn error_code(&self) -> u16 {
        match self {
            Self::ProcessingFailed(_) => 2000,
            Self::ValidationFailed(_) => 2001,
            Self::Timeout(_) => 2002,
            Self::ResourceExhausted(_) => 2003,
        }
    }
}
```

## Integration with Core

### Using with Measurements

```rust
use olocus_core::{Measurement, Value, Uncertainty};

impl MyExtensionPayload {
    /// Convert to measurement for standardized handling
    pub fn to_measurement(&self) -> Measurement {
        Measurement {
            value: Value::Object(
                self.metadata.iter()
                    .map(|(k, v)| (k.clone(), Value::String(v.clone())))
                    .collect()
            ),
            uncertainty: Uncertainty::Unknown,
            provenance: Provenance::default(),
            validity: ValidityWindow::perpetual(),
        }
    }
}
```

### Creating Blocks

```rust
use olocus_core::{Block, generate_key, current_timestamp};

fn create_extension_block(
    processor: &impl MyExtensionProcessor,
    input: &[u8],
    previous: Option<&Block<impl BlockPayload>>,
) -> Result<Block<MyExtensionPayload>, Error> {
    // Process data
    let payload = processor.process(input).await?;
    
    // Validate
    if !processor.validate(&payload) {
        return Err(Error::ValidationFailed);
    }
    
    // Create block
    let key = generate_key();
    let block = if let Some(prev) = previous {
        Block::next(prev, payload, &key, current_timestamp())?
    } else {
        Block::genesis(payload, &key, current_timestamp())
    };
    
    Ok(block)
}
```

## Advanced Features

### Custom Implementations

Users can implement the trait for their specific needs:

```rust
struct CustomProcessor {
    api_endpoint: String,
    auth_token: String,
}

#[async_trait]
impl MyExtensionProcessor for CustomProcessor {
    async fn process(&self, input: &[u8]) -> Result<MyExtensionPayload, MyExtensionError> {
        // Call external API
        let response = reqwest::Client::new()
            .post(&self.api_endpoint)
            .bearer_auth(&self.auth_token)
            .body(input.to_vec())
            .send()
            .await?;
        
        // Parse response into payload
        Ok(MyExtensionPayload {
            data: response.text().await?,
            timestamp: current_timestamp(),
            metadata: HashMap::new(),
        })
    }
    
    // Other trait methods...
}
```

### Composability

Extensions can work together:

```rust
use olocus_location::LocationPayload;
use olocus_trust::TrustAttestation;

pub struct EnhancedPayload {
    pub base: MyExtensionPayload,
    pub location: Option<LocationPayload>,
    pub attestation: Option<TrustAttestation>,
}
```

## Testing Your Extension

### Unit Tests

```rust
#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_payload_serialization() {
        let payload = MyExtensionPayload {
            data: "test".to_string(),
            timestamp: 1234567890,
            metadata: HashMap::new(),
        };
        
        let bytes = payload.to_bytes();
        let decoded = MyExtensionPayload::from_bytes(&bytes).unwrap();
        
        assert_eq!(payload.data, decoded.data);
    }
    
    #[tokio::test]
    async fn test_processor() {
        let processor = BuiltInProcessor::Basic {
            timeout: Duration::from_secs(30),
            retry_count: 3,
        };
        
        let input = b"test data";
        let result = processor.process(input).await.unwrap();
        
        assert!(processor.validate(&result));
    }
}
```

### Integration Tests

```rust
#[tokio::test]
async fn test_full_workflow() {
    // Create processor
    let processor = BuiltInProcessor::Advanced {
        cache_size: 100,
        ttl: Duration::from_secs(60),
        compression: true,
    };
    
    // Process data
    let payload = processor.process(b"input").await.unwrap();
    
    // Create block
    let key = generate_key();
    let block = Block::genesis(payload, &key, current_timestamp());
    
    // Verify block
    verify_block(&block, None).unwrap();
    
    // Encode/decode
    let wire = WireFormat::json();
    let encoded = wire.encode(&block).unwrap();
    let decoded: Block<MyExtensionPayload> = wire.decode(&encoded).unwrap();
    
    assert_eq!(block.hash(), decoded.hash());
}
```

## Best Practices

### 1. Follow the Pattern
Always use the enum/trait hybrid pattern for maximum flexibility.

### 2. Document Thoroughly
```rust
/// My extension for processing special data.
/// 
/// # Example
/// ```
/// use my_extension::*;
/// 
/// let processor = BuiltInProcessor::Basic { 
///     timeout: Duration::from_secs(30),
///     retry_count: 3 
/// };
/// ```
pub struct MyExtension;
```

### 3. Version Your Payloads
```rust
#[derive(Serialize, Deserialize)]
#[serde(tag = "version")]
pub enum MyPayload {
    #[serde(rename = "1.0")]
    V1 { data: String },
    
    #[serde(rename = "2.0")]
    V2 { data: String, metadata: HashMap<String, String> },
}
```

### 4. Handle Errors Gracefully
```rust
impl From<reqwest::Error> for MyExtensionError {
    fn from(err: reqwest::Error) -> Self {
        MyExtensionError::ProcessingFailed(err.to_string())
    }
}
```

### 5. Provide Defaults
```rust
impl Default for BuiltInProcessor {
    fn default() -> Self {
        Self::Basic {
            timeout: Duration::from_secs(30),
            retry_count: 3,
        }
    }
}
```

## Publishing Your Extension

### 1. Create a Crate
```toml
[package]
name = "olocus-myextension"
version = "0.1.0"
edition = "2021"

[dependencies]
olocus-core = { git = "https://codeberg.org/olocus/protocol.git" }
serde = { version = "1.0", features = ["derive"] }
async-trait = "0.1"
thiserror = "1.0"
```

### 2. Add to Registry
Submit a PR to add your extension to the official registry.

### 3. Document Usage
Provide clear examples and documentation for users.

## Example: Weather Extension

Here's a complete example of a weather data extension:

```rust
use olocus_core::*;
use serde::{Serialize, Deserialize};

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct WeatherPayload {
    pub temperature: Measurement,
    pub humidity: Measurement,
    pub pressure: Measurement,
    pub location: Value,
    pub timestamp: u64,
}

impl BlockPayload for WeatherPayload {
    fn to_bytes(&self) -> Vec<u8> {
        serde_json::to_vec(self).unwrap()
    }
    
    fn from_bytes(bytes: &[u8]) -> Result<Self, Error> {
        serde_json::from_slice(bytes)
            .map_err(|e| Error::Deserialization(e.to_string()))
    }
    
    fn payload_type() -> u32 {
        0x8001  // Weather extension type
    }
}

impl WeatherPayload {
    pub fn new(
        temp_celsius: f64,
        humidity_percent: f64,
        pressure_hpa: f64,
        lat: f64,
        lon: f64,
    ) -> Self {
        Self {
            temperature: Measurement {
                value: Value::Float(temp_celsius),
                uncertainty: Uncertainty::Gaussian { std_dev: 0.1 },
                provenance: Provenance::default(),
                validity: ValidityWindow::new(
                    current_timestamp() as i64,
                    Some((current_timestamp() + 3600) as i64)
                ),
            },
            humidity: Measurement {
                value: Value::Float(humidity_percent),
                uncertainty: Uncertainty::Gaussian { std_dev: 1.0 },
                provenance: Provenance::default(),
                validity: ValidityWindow::new(
                    current_timestamp() as i64,
                    Some((current_timestamp() + 3600) as i64)
                ),
            },
            pressure: Measurement {
                value: Value::Float(pressure_hpa),
                uncertainty: Uncertainty::Gaussian { std_dev: 0.5 },
                provenance: Provenance::default(),
                validity: ValidityWindow::new(
                    current_timestamp() as i64,
                    Some((current_timestamp() + 3600) as i64)
                ),
            },
            location: Value::Point2D {
                lat: Coordinate::latitude_to_fixed(lat),
                lon: Coordinate::longitude_to_fixed(lon),
            },
            timestamp: current_timestamp(),
        }
    }
}
```

## Next Steps

- [Browse Existing Extensions](./overview) - Learn from existing implementations
- [Join the Community](https://github.com/svailsa/olocus-website/discussions) - Share your extension
- [Protocol Specification](../core/overview) - Deep dive into protocol details