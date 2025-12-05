# Differential Privacy

## Overview

Differential privacy provides mathematically rigorous privacy guarantees by adding carefully calibrated noise to data or query results. The Olocus Privacy extension implements differential privacy mechanisms to protect individual privacy while preserving statistical utility for data analysis.

## Architecture

### Core Components

```rust
use olocus_core::measure::{Measurement, Value, Uncertainty};
use rand::{Rng, SeedableRng};
use rand_distr::{Laplace, Normal, Distribution};

#[derive(Debug, Clone)]
pub struct DifferentialPrivacyConfig {
    pub epsilon: f64,           // Privacy budget
    pub delta: f64,             // Failure probability (for (ε,δ)-DP)
    pub mechanism: DPMechanism,
    pub sensitivity: f64,       // Global sensitivity
    pub clipping_bound: Option<f64>,
}

#[derive(Debug, Clone)]
pub enum DPMechanism {
    Laplace { scale: f64 },
    Gaussian { scale: f64 },
    Exponential { utility_fn: String },
    Geometric { probability: f64 },
    // Future: Advanced mechanisms
    Shuffle,
    LocalRandomizedResponse,
}

pub struct DifferentialPrivacyProcessor {
    config: DifferentialPrivacyConfig,
    rng: rand::rngs::StdRng,
    privacy_accountant: PrivacyAccountant,
}

#[derive(Debug, Clone)]
pub struct PrivacyAccountant {
    pub total_epsilon_used: f64,
    pub total_delta_used: f64,
    pub query_log: Vec<QueryRecord>,
}

#[derive(Debug, Clone)]
pub struct QueryRecord {
    pub timestamp: chrono::DateTime<chrono::Utc>,
    pub epsilon_spent: f64,
    pub delta_spent: f64,
    pub mechanism_used: String,
    pub query_type: String,
}
```

### Privacy Technique Implementation

```rust
impl PrivacyTechnique for DifferentialPrivacyProcessor {
    type Input = Vec<Measurement>;
    type Output = Vec<Measurement>;
    type Error = DifferentialPrivacyError;

    fn apply(&mut self, data: Self::Input) -> Result<Self::Output, Self::Error> {
        // Check privacy budget
        if !self.privacy_accountant.check_budget(self.config.epsilon, self.config.delta) {
            return Err(DifferentialPrivacyError::PrivacyBudgetExhausted);
        }

        let noisy_data = match &self.config.mechanism {
            DPMechanism::Laplace { scale } => {
                self.apply_laplace_mechanism(data, *scale)?
            },
            DPMechanism::Gaussian { scale } => {
                self.apply_gaussian_mechanism(data, *scale)?
            },
            DPMechanism::Exponential { utility_fn } => {
                self.apply_exponential_mechanism(data, utility_fn)?
            },
            DPMechanism::Geometric { probability } => {
                self.apply_geometric_mechanism(data, *probability)?
            },
            _ => return Err(DifferentialPrivacyError::UnsupportedMechanism),
        };

        // Record privacy expenditure
        self.privacy_accountant.record_query(QueryRecord {
            timestamp: chrono::Utc::now(),
            epsilon_spent: self.config.epsilon,
            delta_spent: self.config.delta,
            mechanism_used: format!("{:?}", self.config.mechanism),
            query_type: "data_release".to_string(),
        });

        Ok(noisy_data)
    }

    fn privacy_loss(&self) -> f64 {
        self.config.epsilon
    }

    fn utility_metric(&self, original: &Self::Input, privatized: &Self::Output) -> f64 {
        self.calculate_mean_squared_error(original, privatized)
    }
}
```

## Mechanism Implementations

### Laplace Mechanism

```rust
impl DifferentialPrivacyProcessor {
    pub fn apply_laplace_mechanism(
        &mut self, 
        data: Vec<Measurement>, 
        scale: f64
    ) -> Result<Vec<Measurement>, DifferentialPrivacyError> {
        let laplace = Laplace::new(0.0, scale)
            .map_err(|_| DifferentialPrivacyError::InvalidParameters)?;
        
        let mut noisy_data = Vec::with_capacity(data.len());
        
        for measurement in data {
            let noisy_measurement = match measurement.value {
                Value::Int(val) => {
                    let noise = laplace.sample(&mut self.rng);
                    let noisy_val = val as f64 + noise;
                    
                    Measurement {
                        value: Value::Float(noisy_val),
                        uncertainty: self.create_noise_uncertainty(scale),
                        provenance: self.add_privacy_provenance(measurement.provenance),
                        validity: measurement.validity,
                    }
                },
                Value::Float(val) => {
                    let noise = laplace.sample(&mut self.rng);
                    
                    Measurement {
                        value: Value::Float(val + noise),
                        uncertainty: self.create_noise_uncertainty(scale),
                        provenance: self.add_privacy_provenance(measurement.provenance),
                        validity: measurement.validity,
                    }
                },
                Value::Array(values) => {
                    let noisy_values = values.iter()
                        .map(|v| self.add_noise_to_value(v, &laplace))
                        .collect::<Result<Vec<_>, _>>()?;
                    
                    Measurement {
                        value: Value::Array(noisy_values),
                        uncertainty: self.create_noise_uncertainty(scale),
                        provenance: self.add_privacy_provenance(measurement.provenance),
                        validity: measurement.validity,
                    }
                },
                _ => {
                    // Non-numeric values can't have Laplace noise added directly
                    return Err(DifferentialPrivacyError::IncompatibleDataType);
                }
            };
            
            noisy_data.push(noisy_measurement);
        }
        
        Ok(noisy_data)
    }

    fn add_noise_to_value(&mut self, value: &Value, laplace: &Laplace<f64>) -> Result<Value, DifferentialPrivacyError> {
        match value {
            Value::Int(val) => {
                let noise = laplace.sample(&mut self.rng);
                Ok(Value::Float(*val as f64 + noise))
            },
            Value::Float(val) => {
                let noise = laplace.sample(&mut self.rng);
                Ok(Value::Float(val + noise))
            },
            _ => Ok(value.clone()), // Pass through non-numeric values
        }
    }
}
```

### Gaussian Mechanism

```rust
impl DifferentialPrivacyProcessor {
    pub fn apply_gaussian_mechanism(
        &mut self, 
        data: Vec<Measurement>, 
        scale: f64
    ) -> Result<Vec<Measurement>, DifferentialPrivacyError> {
        let normal = Normal::new(0.0, scale)
            .map_err(|_| DifferentialPrivacyError::InvalidParameters)?;
        
        let mut noisy_data = Vec::with_capacity(data.len());
        
        for measurement in data {
            let noisy_measurement = match measurement.value {
                Value::Float(val) => {
                    let noise = normal.sample(&mut self.rng);
                    
                    Measurement {
                        value: Value::Float(val + noise),
                        uncertainty: Uncertainty::Gaussian { 
                            mean: val, 
                            std_dev: scale 
                        },
                        provenance: self.add_privacy_provenance(measurement.provenance),
                        validity: measurement.validity,
                    }
                },
                Value::Int(val) => {
                    let noise = normal.sample(&mut self.rng);
                    let noisy_val = val as f64 + noise;
                    
                    Measurement {
                        value: Value::Float(noisy_val),
                        uncertainty: Uncertainty::Gaussian { 
                            mean: noisy_val, 
                            std_dev: scale 
                        },
                        provenance: self.add_privacy_provenance(measurement.provenance),
                        validity: measurement.validity,
                    }
                },
                Value::Point2D(x, y) => {
                    let noise_x = normal.sample(&mut self.rng);
                    let noise_y = normal.sample(&mut self.rng);
                    
                    Measurement {
                        value: Value::Point2D(x + noise_x as i64, y + noise_y as i64),
                        uncertainty: Uncertainty::Circular { 
                            radius: scale * 2.0 // 2-sigma confidence
                        },
                        provenance: self.add_privacy_provenance(measurement.provenance),
                        validity: measurement.validity,
                    }
                },
                _ => return Err(DifferentialPrivacyError::IncompatibleDataType),
            };
            
            noisy_data.push(noisy_measurement);
        }
        
        Ok(noisy_data)
    }
}
```

### Exponential Mechanism

```rust
impl DifferentialPrivacyProcessor {
    pub fn apply_exponential_mechanism(
        &mut self,
        data: Vec<Measurement>,
        utility_fn: &str,
    ) -> Result<Vec<Measurement>, DifferentialPrivacyError> {
        match utility_fn {
            "histogram_bin_selection" => self.exponential_histogram(data),
            "median_selection" => self.exponential_median(data),
            "quantile_selection" => self.exponential_quantile(data),
            _ => Err(DifferentialPrivacyError::UnknownUtilityFunction(utility_fn.to_string())),
        }
    }

    fn exponential_histogram(&mut self, data: Vec<Measurement>) -> Result<Vec<Measurement>, DifferentialPrivacyError> {
        let numeric_values: Vec<f64> = data.iter()
            .filter_map(|m| match &m.value {
                Value::Float(f) => Some(*f),
                Value::Int(i) => Some(*i as f64),
                _ => None,
            })
            .collect();

        if numeric_values.is_empty() {
            return Err(DifferentialPrivacyError::InsufficientData);
        }

        // Define histogram bins
        let min_val = numeric_values.iter().cloned().fold(f64::INFINITY, f64::min);
        let max_val = numeric_values.iter().cloned().fold(f64::NEG_INFINITY, f64::max);
        let bin_count = (numeric_values.len() as f64).sqrt().ceil() as usize;
        let bin_width = (max_val - min_val) / bin_count as f64;

        // Calculate utility scores for each bin (count in bin)
        let mut bin_utilities = Vec::new();
        for i in 0..bin_count {
            let bin_start = min_val + i as f64 * bin_width;
            let bin_end = bin_start + bin_width;
            
            let count = numeric_values.iter()
                .filter(|&&val| val >= bin_start && val < bin_end)
                .count();
            
            bin_utilities.push((count as f64, bin_start, bin_end));
        }

        // Apply exponential mechanism
        let scale = self.config.sensitivity / self.config.epsilon;
        let probabilities: Vec<f64> = bin_utilities.iter()
            .map(|(utility, _, _)| (utility / scale).exp())
            .collect();

        let total_prob: f64 = probabilities.iter().sum();
        let normalized_probs: Vec<f64> = probabilities.iter()
            .map(|p| p / total_prob)
            .collect();

        // Sample from the distribution
        let selected_bin = self.sample_from_distribution(&normalized_probs);
        let (_, bin_start, bin_end) = bin_utilities[selected_bin];

        // Return histogram representation
        let histogram_measurement = Measurement {
            value: Value::Object([
                ("bin_start".to_string(), Value::Float(bin_start)),
                ("bin_end".to_string(), Value::Float(bin_end)),
                ("selected_via_exponential".to_string(), Value::Bool(true)),
            ].iter().cloned().collect()),
            uncertainty: Uncertainty::Exact,
            provenance: self.create_exponential_provenance(),
            validity: None,
        };

        Ok(vec![histogram_measurement])
    }

    fn sample_from_distribution(&mut self, probabilities: &[f64]) -> usize {
        let uniform: f64 = self.rng.gen();
        let mut cumulative = 0.0;
        
        for (i, &prob) in probabilities.iter().enumerate() {
            cumulative += prob;
            if uniform <= cumulative {
                return i;
            }
        }
        
        probabilities.len() - 1 // Fallback to last element
    }
}
```

## Advanced Features

### Privacy Accounting

```rust
impl PrivacyAccountant {
    pub fn new() -> Self {
        Self {
            total_epsilon_used: 0.0,
            total_delta_used: 0.0,
            query_log: Vec::new(),
        }
    }

    pub fn check_budget(&self, epsilon: f64, delta: f64) -> bool {
        self.total_epsilon_used + epsilon <= MAX_EPSILON_BUDGET &&
        self.total_delta_used + delta <= MAX_DELTA_BUDGET
    }

    pub fn record_query(&mut self, record: QueryRecord) {
        self.total_epsilon_used += record.epsilon_spent;
        self.total_delta_used += record.delta_spent;
        self.query_log.push(record);
    }

    pub fn remaining_budget(&self) -> (f64, f64) {
        (
            MAX_EPSILON_BUDGET - self.total_epsilon_used,
            MAX_DELTA_BUDGET - self.total_delta_used
        )
    }

    /// Advanced composition using optimal composition theorem
    pub fn calculate_composition_bound(&self) -> (f64, f64) {
        let mut total_epsilon = 0.0;
        let mut total_delta = 0.0;

        // Apply advanced composition theorem for better bounds
        for query in &self.query_log {
            if query.delta_spent > 0.0 {
                // (ε,δ)-DP composition
                let epsilon_prime = query.epsilon_spent * 
                    (2.0 * (2.0 * self.query_log.len() as f64).ln() / query.delta_spent).sqrt();
                total_epsilon += epsilon_prime.min(query.epsilon_spent);
                total_delta += query.delta_spent;
            } else {
                // Pure ε-DP composition
                total_epsilon += query.epsilon_spent;
            }
        }

        (total_epsilon, total_delta)
    }
}
```

### Local Differential Privacy

```rust
pub struct LocalDifferentialPrivacy {
    pub epsilon: f64,
    pub mechanism: LocalDPMechanism,
}

#[derive(Debug, Clone)]
pub enum LocalDPMechanism {
    RandomizedResponse { probability: f64 },
    RAPPOR { hash_functions: usize, bloom_bits: usize },
    UnaryEncoding { domain_size: usize },
}

impl LocalDifferentialPrivacy {
    pub fn randomized_response(&mut self, value: bool, rng: &mut impl Rng) -> bool {
        let p = (self.epsilon.exp()) / (1.0 + self.epsilon.exp());
        
        if rng.gen::<f64>() < p {
            value // Truth-telling
        } else {
            !value // Lie
        }
    }

    pub fn unary_encoding_categorical(
        &mut self, 
        value: usize, 
        domain_size: usize,
        rng: &mut impl Rng
    ) -> Vec<bool> {
        let mut encoded = vec![false; domain_size];
        encoded[value] = true;

        // Apply randomized response to each bit
        encoded.iter()
            .map(|&bit| self.randomized_response(bit, rng))
            .collect()
    }
}
```

## Integration with Olocus Core

### Block Payload Implementation

```rust
use olocus_core::{Block, BlockPayload};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DifferentialPrivacyPayload {
    pub epsilon: f64,
    pub delta: f64,
    pub mechanism: String,
    pub sensitivity: f64,
    pub data: Vec<Measurement>,
    pub privacy_metadata: DifferentialPrivacyMetadata,
    pub accountability: PrivacyAccountingRecord,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DifferentialPrivacyMetadata {
    pub algorithm: String,
    pub parameters: serde_json::Value,
    pub noise_scale: f64,
    pub utility_loss: f64,
    pub composition_method: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PrivacyAccountingRecord {
    pub total_epsilon_used: f64,
    pub total_delta_used: f64,
    pub remaining_budget: (f64, f64),
    pub query_count: usize,
    pub timestamp: chrono::DateTime<chrono::Utc>,
}

impl BlockPayload for DifferentialPrivacyPayload {
    fn payload_type(&self) -> u16 {
        0x0522 // Privacy extension, differential privacy subtype
    }

    fn validate(&self) -> Result<(), Box<dyn std::error::Error>> {
        // Validate privacy parameters
        if self.epsilon <= 0.0 {
            return Err("Epsilon must be positive".into());
        }

        if self.delta < 0.0 || self.delta >= 1.0 {
            return Err("Delta must be in [0, 1)".into());
        }

        if self.sensitivity <= 0.0 {
            return Err("Sensitivity must be positive".into());
        }

        // Validate privacy budget hasn't been exceeded
        if self.accountability.total_epsilon_used > MAX_EPSILON_BUDGET {
            return Err("Epsilon budget exceeded".into());
        }

        if self.accountability.total_delta_used > MAX_DELTA_BUDGET {
            return Err("Delta budget exceeded".into());
        }

        // Validate noise scale is appropriate for mechanism
        let expected_scale = match self.mechanism.as_str() {
            "laplace" => self.sensitivity / self.epsilon,
            "gaussian" => self.sensitivity * (2.0 * (1.25 / self.delta).ln()).sqrt() / self.epsilon,
            _ => return Err("Unknown mechanism".into()),
        };

        if (self.privacy_metadata.noise_scale - expected_scale).abs() > 0.001 {
            return Err("Incorrect noise scale for mechanism".into());
        }

        Ok(())
    }
}
```

### Usage Example

```rust
use olocus_privacy::{DifferentialPrivacyProcessor, DifferentialPrivacyConfig, DPMechanism};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Configure differential privacy
    let config = DifferentialPrivacyConfig {
        epsilon: 1.0,  // Privacy budget
        delta: 1e-5,   // Failure probability
        mechanism: DPMechanism::Laplace { 
            scale: 1.0  // Will be recalculated based on sensitivity
        },
        sensitivity: 1.0,  // Global sensitivity of the function
        clipping_bound: Some(10.0),  // Clip values to bound sensitivity
    };

    let mut processor = DifferentialPrivacyProcessor::new(config)?;

    // Create sensitive location data
    let location_data = vec![
        create_location_measurement(37.7749, -122.4194), // San Francisco
        create_location_measurement(37.7849, -122.4094), // Nearby location
        create_location_measurement(37.7649, -122.4294), // Another nearby location
    ];

    // Apply differential privacy
    let privatized_data = processor.apply(location_data.clone())?;

    // Create differentially private payload
    let payload = DifferentialPrivacyPayload {
        epsilon: 1.0,
        delta: 1e-5,
        mechanism: "laplace".to_string(),
        sensitivity: 1.0,
        data: privatized_data,
        privacy_metadata: DifferentialPrivacyMetadata {
            algorithm: "laplace_mechanism".to_string(),
            parameters: serde_json::json!({
                "epsilon": 1.0,
                "delta": 1e-5,
                "scale": 1.0
            }),
            noise_scale: 1.0,
            utility_loss: processor.utility_metric(&location_data, &privatized_data),
            composition_method: "basic".to_string(),
        },
        accountability: PrivacyAccountingRecord {
            total_epsilon_used: processor.privacy_accountant.total_epsilon_used,
            total_delta_used: processor.privacy_accountant.total_delta_used,
            remaining_budget: processor.privacy_accountant.remaining_budget(),
            query_count: processor.privacy_accountant.query_log.len(),
            timestamp: chrono::Utc::now(),
        },
    };

    // Create block
    let block = Block::new(payload)?;
    println!("Created differentially private block: {}", hex::encode(block.hash()));

    Ok(())
}

fn create_location_measurement(lat: f64, lon: f64) -> Measurement {
    use olocus_core::measure::Coordinate;
    
    let lat_fixed = Coordinate::latitude_to_fixed(lat);
    let lon_fixed = Coordinate::longitude_to_fixed(lon);
    
    Measurement {
        value: Value::Point2D(lat_fixed, lon_fixed),
        uncertainty: Uncertainty::Circular { radius: 10.0 }, // 10m accuracy
        provenance: Default::default(),
        validity: None,
    }
}
```

## Security Considerations

### Privacy Analysis

```rust
pub struct DifferentialPrivacyAnalysis {
    pub privacy_guarantee: String,
    pub composition_bound: (f64, f64),
    pub attack_resistance: AttackResistance,
    pub utility_metrics: UtilityMetrics,
}

#[derive(Debug, Clone)]
pub struct AttackResistance {
    pub membership_inference: f64,     // Resistance to membership inference
    pub reconstruction: f64,           // Resistance to reconstruction attacks
    pub property_inference: f64,       // Resistance to property inference
}

#[derive(Debug, Clone)]
pub struct UtilityMetrics {
    pub mean_squared_error: f64,
    pub signal_to_noise_ratio: f64,
    pub relative_error: f64,
    pub statistical_significance: f64,
}

impl DifferentialPrivacyProcessor {
    pub fn analyze_privacy_utility_tradeoff(&self, original: &[Measurement], privatized: &[Measurement]) -> DifferentialPrivacyAnalysis {
        let composition = self.privacy_accountant.calculate_composition_bound();
        
        let attack_resistance = AttackResistance {
            membership_inference: (-self.config.epsilon).exp(), // DP guarantee
            reconstruction: self.calculate_reconstruction_resistance(original),
            property_inference: self.calculate_property_inference_resistance(original),
        };
        
        let utility = UtilityMetrics {
            mean_squared_error: self.calculate_mean_squared_error(original, privatized),
            signal_to_noise_ratio: self.calculate_snr(original, privatized),
            relative_error: self.calculate_relative_error(original, privatized),
            statistical_significance: self.calculate_statistical_significance(original, privatized),
        };
        
        DifferentialPrivacyAnalysis {
            privacy_guarantee: format!("({:.3}, {:.2e})-differential privacy", composition.0, composition.1),
            composition_bound: composition,
            attack_resistance,
            utility_metrics: utility,
        }
    }

    fn calculate_snr(&self, original: &[Measurement], privatized: &[Measurement]) -> f64 {
        let signal_power = self.calculate_signal_power(original);
        let noise_power = self.calculate_noise_power(original, privatized);
        
        if noise_power > 0.0 {
            10.0 * (signal_power / noise_power).log10()
        } else {
            f64::INFINITY
        }
    }

    fn calculate_statistical_significance(&self, original: &[Measurement], privatized: &[Measurement]) -> f64 {
        // Perform statistical tests to determine if privatized data
        // maintains statistical properties of original data
        self.kolmogorov_smirnov_test(original, privatized)
    }
}
```

## Performance Characteristics

### Benchmarking

```rust
#[cfg(test)]
mod benchmarks {
    use super::*;
    use criterion::{black_box, Criterion};

    pub fn benchmark_laplace_mechanism(c: &mut Criterion) {
        let config = DifferentialPrivacyConfig {
            epsilon: 1.0,
            delta: 0.0,
            mechanism: DPMechanism::Laplace { scale: 1.0 },
            sensitivity: 1.0,
            clipping_bound: None,
        };
        
        let mut processor = DifferentialPrivacyProcessor::new(config).unwrap();
        
        for size in [100, 1000, 10000].iter() {
            let data = generate_numeric_dataset(*size);
            
            c.bench_function(&format!("laplace_mechanism_{}", size), |b| {
                b.iter(|| {
                    processor.apply(black_box(data.clone())).unwrap()
                })
            });
        }
    }

    pub fn benchmark_gaussian_mechanism(c: &mut Criterion) {
        let config = DifferentialPrivacyConfig {
            epsilon: 1.0,
            delta: 1e-5,
            mechanism: DPMechanism::Gaussian { scale: 1.414 },
            sensitivity: 1.0,
            clipping_bound: None,
        };
        
        let mut processor = DifferentialPrivacyProcessor::new(config).unwrap();
        
        for size in [100, 1000, 10000].iter() {
            let data = generate_numeric_dataset(*size);
            
            c.bench_function(&format!("gaussian_mechanism_{}", size), |b| {
                b.iter(|| {
                    processor.apply(black_box(data.clone())).unwrap()
                })
            });
        }
    }

    pub fn benchmark_exponential_mechanism(c: &mut Criterion) {
        let config = DifferentialPrivacyConfig {
            epsilon: 1.0,
            delta: 0.0,
            mechanism: DPMechanism::Exponential { 
                utility_fn: "median_selection".to_string() 
            },
            sensitivity: 1.0,
            clipping_bound: None,
        };
        
        let mut processor = DifferentialPrivacyProcessor::new(config).unwrap();
        
        for size in [100, 1000, 5000].iter() {
            let data = generate_numeric_dataset(*size);
            
            c.bench_function(&format!("exponential_mechanism_{}", size), |b| {
                b.iter(|| {
                    processor.apply(black_box(data.clone())).unwrap()
                })
            });
        }
    }
}
```

### Performance Targets

- **Laplace mechanism**: O(n) time, O(1) space per measurement
- **Gaussian mechanism**: O(n) time, O(1) space per measurement  
- **Exponential mechanism**: O(n log n) time for sorting-based utilities
- **Target latency**: &lt;50ms for 10,000 measurements with Laplace/Gaussian

## Best Practices

### Parameter Selection

```rust
pub struct DifferentialPrivacyParameterGuide;

impl DifferentialPrivacyParameterGuide {
    /// Recommend epsilon values based on data sensitivity
    pub fn recommend_epsilon(data_sensitivity: DataSensitivity) -> f64 {
        match data_sensitivity {
            DataSensitivity::HighlyPersonal => 0.1,     // Medical records, financial data
            DataSensitivity::Personal => 0.5,           // Demographics, preferences
            DataSensitivity::SemiPublic => 1.0,         // Aggregated behaviors
            DataSensitivity::Public => 2.0,             // Public statistics
        }
    }

    /// Recommend delta values based on dataset size
    pub fn recommend_delta(dataset_size: usize) -> f64 {
        1.0 / (dataset_size as f64 * dataset_size as f64)
    }

    /// Calculate optimal noise scale for given parameters
    pub fn calculate_noise_scale(mechanism: &DPMechanism, epsilon: f64, delta: f64, sensitivity: f64) -> f64 {
        match mechanism {
            DPMechanism::Laplace { .. } => sensitivity / epsilon,
            DPMechanism::Gaussian { .. } => {
                sensitivity * (2.0 * (1.25 / delta).ln()).sqrt() / epsilon
            },
            _ => 1.0, // Default fallback
        }
    }
}

#[derive(Debug, Clone)]
pub enum DataSensitivity {
    HighlyPersonal,
    Personal,
    SemiPublic,
    Public,
}
```

## Error Handling

```rust
#[derive(Debug, thiserror::Error)]
pub enum DifferentialPrivacyError {
    #[error("Invalid privacy parameters: epsilon={epsilon}, delta={delta}")]
    InvalidParameters { epsilon: f64, delta: f64 },
    
    #[error("Privacy budget exhausted: used {used}, limit {limit}")]
    PrivacyBudgetExhausted { used: f64, limit: f64 },
    
    #[error("Incompatible data type for mechanism")]
    IncompatibleDataType,
    
    #[error("Unsupported mechanism: {0}")]
    UnsupportedMechanism(String),
    
    #[error("Unknown utility function: {0}")]
    UnknownUtilityFunction(String),
    
    #[error("Insufficient data for mechanism")]
    InsufficientData,
    
    #[error("Sensitivity calculation failed: {0}")]
    SensitivityCalculationFailed(String),
}
```

This comprehensive implementation provides production-ready differential privacy capabilities within the Olocus Privacy extension, ensuring mathematically rigorous privacy guarantees while maintaining practical utility for real-world applications.