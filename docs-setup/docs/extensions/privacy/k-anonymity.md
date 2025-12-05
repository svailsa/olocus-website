# K-Anonymity Implementation

## Overview

K-anonymity is a privacy-preserving technique that ensures each record in a dataset is indistinguishable from at least k-1 other records with respect to certain identifying attributes (quasi-identifiers). The Olocus Privacy extension implements k-anonymity as part of its comprehensive privacy protection toolkit.

## Architecture

### Core Components

```rust
use olocus_core::measure::{Measurement, Value, Uncertainty};
use std::collections::HashMap;

pub struct KAnonymityConfig {
    pub k: usize,
    pub quasi_identifiers: Vec<String>,
    pub sensitive_attributes: Vec<String>,
    pub suppression_threshold: f64,
}

pub struct KAnonymityProcessor {
    config: KAnonymityConfig,
    generalization_hierarchies: HashMap<String, GeneralizationHierarchy>,
}

#[derive(Debug, Clone)]
pub struct GeneralizationHierarchy {
    pub levels: Vec<GeneralizationLevel>,
    pub current_level: usize,
}

#[derive(Debug, Clone)]
pub struct GeneralizationLevel {
    pub name: String,
    pub mapping: HashMap<String, String>,
}
```

### Privacy Technique Implementation

```rust
impl PrivacyTechnique for KAnonymityProcessor {
    type Input = Vec<Measurement>;
    type Output = Vec<Measurement>;
    type Error = KAnonymityError;

    fn apply(&self, data: Self::Input) -> Result<Self::Output, Self::Error> {
        let mut anonymized_data = data.clone();
        let mut current_k = self.calculate_k_value(&anonymized_data)?;
        
        while current_k < self.config.k {
            if !self.generalize_step(&mut anonymized_data)? {
                // If generalization fails, apply suppression
                self.suppress_outliers(&mut anonymized_data)?;
                break;
            }
            current_k = self.calculate_k_value(&anonymized_data)?;
        }
        
        Ok(anonymized_data)
    }

    fn privacy_loss(&self) -> f64 {
        // K-anonymity provides syntactic privacy, not semantic
        // Privacy loss is inversely related to k value
        1.0 / self.config.k as f64
    }

    fn utility_metric(&self, original: &Self::Input, anonymized: &Self::Output) -> f64 {
        self.calculate_information_loss(original, anonymized)
    }
}
```

## Implementation Details

### Generalization Hierarchies

```rust
impl KAnonymityProcessor {
    pub fn new(config: KAnonymityConfig) -> Self {
        let mut hierarchies = HashMap::new();
        
        // Example: Age generalization hierarchy
        let age_hierarchy = GeneralizationHierarchy {
            levels: vec![
                GeneralizationLevel {
                    name: "exact".to_string(),
                    mapping: HashMap::new(), // Identity mapping
                },
                GeneralizationLevel {
                    name: "5-year-groups".to_string(),
                    mapping: create_age_groups(5),
                },
                GeneralizationLevel {
                    name: "10-year-groups".to_string(),
                    mapping: create_age_groups(10),
                },
                GeneralizationLevel {
                    name: "generation".to_string(),
                    mapping: create_generation_mapping(),
                },
            ],
            current_level: 0,
        };
        
        hierarchies.insert("age".to_string(), age_hierarchy);
        
        Self {
            config,
            generalization_hierarchies: hierarchies,
        }
    }

    fn generalize_step(&mut self, data: &mut Vec<Measurement>) -> Result<bool, KAnonymityError> {
        // Find the quasi-identifier with the lowest information loss for next generalization
        let best_qi = self.select_best_generalization_candidate(data)?;
        
        if let Some(qi_name) = best_qi {
            if let Some(hierarchy) = self.generalization_hierarchies.get_mut(&qi_name) {
                if hierarchy.current_level + 1 < hierarchy.levels.len() {
                    hierarchy.current_level += 1;
                    self.apply_generalization(data, &qi_name)?;
                    return Ok(true);
                }
            }
        }
        
        Ok(false)
    }

    fn apply_generalization(&self, data: &mut Vec<Measurement>, qi_name: &str) -> Result<(), KAnonymityError> {
        let hierarchy = self.generalization_hierarchies.get(qi_name)
            .ok_or(KAnonymityError::MissingHierarchy(qi_name.to_string()))?;
        
        let level = &hierarchy.levels[hierarchy.current_level];
        
        for measurement in data.iter_mut() {
            if let Value::Object(ref mut obj) = &mut measurement.value {
                if let Some(Value::Int(age_val)) = obj.get(qi_name).cloned() {
                    let generalized = level.mapping.get(&age_val.to_string())
                        .cloned()
                        .unwrap_or_else(|| format!("{}*", age_val));
                    
                    obj.insert(qi_name.to_string(), Value::String(generalized));
                }
            }
        }
        
        Ok(())
    }

    fn calculate_k_value(&self, data: &[Measurement]) -> Result<usize, KAnonymityError> {
        let mut equivalence_classes = HashMap::new();
        
        for measurement in data {
            let qi_signature = self.extract_quasi_identifier_signature(measurement)?;
            *equivalence_classes.entry(qi_signature).or_insert(0) += 1;
        }
        
        equivalence_classes.values().min().copied().unwrap_or(0)
    }

    fn extract_quasi_identifier_signature(&self, measurement: &Measurement) -> Result<String, KAnonymityError> {
        let mut signature_parts = Vec::new();
        
        if let Value::Object(obj) = &measurement.value {
            for qi in &self.config.quasi_identifiers {
                if let Some(value) = obj.get(qi) {
                    signature_parts.push(format!("{}={}", qi, self.value_to_string(value)));
                }
            }
        }
        
        Ok(signature_parts.join("|"))
    }

    fn suppress_outliers(&self, data: &mut Vec<Measurement>) -> Result<(), KAnonymityError> {
        let mut equivalence_classes = HashMap::new();
        
        // Group by quasi-identifier signature
        for (idx, measurement) in data.iter().enumerate() {
            let signature = self.extract_quasi_identifier_signature(measurement)?;
            equivalence_classes.entry(signature).or_insert_with(Vec::new).push(idx);
        }
        
        // Mark small equivalence classes for suppression
        let mut indices_to_suppress = Vec::new();
        for (_, indices) in equivalence_classes {
            if indices.len() < self.config.k {
                indices_to_suppress.extend(indices);
            }
        }
        
        // Remove suppressed records
        indices_to_suppress.sort_unstable();
        for idx in indices_to_suppress.into_iter().rev() {
            data.remove(idx);
        }
        
        Ok(())
    }

    fn calculate_information_loss(&self, original: &[Measurement], anonymized: &[Measurement]) -> f64 {
        if original.len() != anonymized.len() {
            return 1.0; // Maximum loss if records were suppressed
        }
        
        let mut total_loss = 0.0;
        let mut comparisons = 0;
        
        for (orig, anon) in original.iter().zip(anonymized.iter()) {
            if let (Value::Object(orig_obj), Value::Object(anon_obj)) = (&orig.value, &anon.value) {
                for qi in &self.config.quasi_identifiers {
                    if let (Some(orig_val), Some(anon_val)) = (orig_obj.get(qi), anon_obj.get(qi)) {
                        total_loss += self.calculate_field_loss(orig_val, anon_val);
                        comparisons += 1;
                    }
                }
            }
        }
        
        if comparisons > 0 {
            total_loss / comparisons as f64
        } else {
            0.0
        }
    }
}
```

### Generalization Utilities

```rust
fn create_age_groups(group_size: u32) -> HashMap<String, String> {
    let mut mapping = HashMap::new();
    
    for age in 0..=120 {
        let group_start = (age / group_size) * group_size;
        let group_end = group_start + group_size - 1;
        mapping.insert(age.to_string(), format!("{}-{}", group_start, group_end));
    }
    
    mapping
}

fn create_generation_mapping() -> HashMap<String, String> {
    let mut mapping = HashMap::new();
    
    // Generation mappings based on birth year
    for year in 1900..=2020 {
        let generation = match year {
            1928..=1945 => "Silent Generation",
            1946..=1964 => "Baby Boomer",
            1965..=1980 => "Generation X",
            1981..=1996 => "Millennial",
            1997..=2012 => "Generation Z",
            _ => "Other",
        };
        
        mapping.insert(year.to_string(), generation.to_string());
    }
    
    mapping
}
```

## Integration with Olocus Core

### Block Payload Implementation

```rust
use olocus_core::{Block, BlockPayload};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KAnonymizedPayload {
    pub original_count: usize,
    pub anonymized_count: usize,
    pub k_value: usize,
    pub generalization_levels: HashMap<String, usize>,
    pub data: Vec<Measurement>,
    pub privacy_metadata: PrivacyMetadata,
}

impl BlockPayload for KAnonymizedPayload {
    fn payload_type(&self) -> u16 {
        0x0521 // Privacy extension, K-anonymity subtype
    }

    fn validate(&self) -> Result<(), Box<dyn std::error::Error>> {
        if self.k_value < 2 {
            return Err("K-anonymity requires k >= 2".into());
        }
        
        if self.anonymized_count > self.original_count {
            return Err("Anonymized count cannot exceed original count".into());
        }
        
        // Validate that data actually satisfies k-anonymity
        let processor = KAnonymityProcessor::new(KAnonymityConfig {
            k: self.k_value,
            quasi_identifiers: self.privacy_metadata.quasi_identifiers.clone(),
            sensitive_attributes: self.privacy_metadata.sensitive_attributes.clone(),
            suppression_threshold: 0.1,
        });
        
        let calculated_k = processor.calculate_k_value(&self.data)?;
        if calculated_k < self.k_value {
            return Err(format!("Data does not satisfy {}-anonymity", self.k_value).into());
        }
        
        Ok(())
    }
}
```

### Usage Example

```rust
use olocus_privacy::{KAnonymityProcessor, KAnonymityConfig};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Configure k-anonymity processor
    let config = KAnonymityConfig {
        k: 5,
        quasi_identifiers: vec![
            "age".to_string(),
            "zipcode".to_string(),
            "gender".to_string(),
        ],
        sensitive_attributes: vec![
            "medical_condition".to_string(),
            "salary".to_string(),
        ],
        suppression_threshold: 0.05,
    };
    
    let processor = KAnonymityProcessor::new(config);
    
    // Create sample medical data
    let medical_data = vec![
        create_patient_measurement(25, "12345", "M", "Diabetes"),
        create_patient_measurement(27, "12345", "F", "Hypertension"),
        create_patient_measurement(23, "12346", "M", "Diabetes"),
        // ... more records
    ];
    
    // Apply k-anonymity
    let anonymized_data = processor.apply(medical_data.clone())?;
    
    // Create anonymized payload
    let payload = KAnonymizedPayload {
        original_count: medical_data.len(),
        anonymized_count: anonymized_data.len(),
        k_value: 5,
        generalization_levels: HashMap::from([
            ("age".to_string(), 1), // 5-year groups
            ("zipcode".to_string(), 2), // 3-digit prefix
        ]),
        data: anonymized_data,
        privacy_metadata: PrivacyMetadata {
            technique: "k-anonymity".to_string(),
            parameters: serde_json::json!({ "k": 5 }),
            quasi_identifiers: config.quasi_identifiers,
            sensitive_attributes: config.sensitive_attributes,
            privacy_loss: processor.privacy_loss(),
        },
    };
    
    // Create block
    let block = Block::new(payload)?;
    println!("Created k-anonymous block: {}", hex::encode(block.hash()));
    
    Ok(())
}

fn create_patient_measurement(age: u32, zipcode: &str, gender: &str, condition: &str) -> Measurement {
    let mut patient_data = std::collections::HashMap::new();
    patient_data.insert("age".to_string(), Value::Int(age as i64));
    patient_data.insert("zipcode".to_string(), Value::String(zipcode.to_string()));
    patient_data.insert("gender".to_string(), Value::String(gender.to_string()));
    patient_data.insert("medical_condition".to_string(), Value::String(condition.to_string()));
    
    Measurement {
        value: Value::Object(patient_data),
        uncertainty: Uncertainty::Exact,
        provenance: Default::default(),
        validity: None,
    }
}
```

## Security Considerations

### Limitations of K-Anonymity

```rust
/// K-anonymity vulnerabilities and mitigations
pub struct KAnonymitySecurityAnalysis {
    pub homogeneity_attack_risk: f64,
    pub background_knowledge_risk: f64,
    pub skewness_vulnerability: f64,
    pub recommended_mitigations: Vec<String>,
}

impl KAnonymityProcessor {
    pub fn analyze_security(&self, data: &[Measurement]) -> KAnonymitySecurityAnalysis {
        let homogeneity_risk = self.assess_homogeneity_attack(data);
        let background_risk = self.assess_background_knowledge_attack(data);
        let skewness_risk = self.assess_skewness_vulnerability(data);
        
        let mut mitigations = Vec::new();
        
        if homogeneity_risk > 0.5 {
            mitigations.push("Consider l-diversity to address homogeneity attacks".to_string());
        }
        
        if background_risk > 0.3 {
            mitigations.push("Apply t-closeness for background knowledge protection".to_string());
        }
        
        if skewness_risk > 0.4 {
            mitigations.push("Use differential privacy for stronger privacy guarantees".to_string());
        }
        
        KAnonymitySecurityAnalysis {
            homogeneity_attack_risk: homogeneity_risk,
            background_knowledge_risk: background_risk,
            skewness_vulnerability: skewness_risk,
            recommended_mitigations: mitigations,
        }
    }

    fn assess_homogeneity_attack(&self, data: &[Measurement]) -> f64 {
        // Analyze distribution of sensitive attributes within equivalence classes
        let mut total_classes = 0;
        let mut homogeneous_classes = 0;
        
        let equivalence_classes = self.group_by_quasi_identifiers(data);
        
        for class in equivalence_classes {
            total_classes += 1;
            let sensitive_diversity = self.calculate_sensitive_diversity(&class);
            if sensitive_diversity < 0.3 { // Low diversity threshold
                homogeneous_classes += 1;
            }
        }
        
        if total_classes > 0 {
            homogeneous_classes as f64 / total_classes as f64
        } else {
            0.0
        }
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

    pub fn benchmark_k_anonymity(c: &mut Criterion) {
        let config = KAnonymityConfig {
            k: 10,
            quasi_identifiers: vec!["age".to_string(), "zipcode".to_string()],
            sensitive_attributes: vec!["salary".to_string()],
            suppression_threshold: 0.05,
        };
        
        let processor = KAnonymityProcessor::new(config);
        
        // Test with different dataset sizes
        for size in [100, 1000, 10000].iter() {
            let data = generate_test_dataset(*size);
            
            c.bench_function(&format!("k_anonymity_{}", size), |b| {
                b.iter(|| {
                    processor.apply(black_box(data.clone())).unwrap()
                })
            });
        }
    }

    pub fn benchmark_k_calculation(c: &mut Criterion) {
        let processor = KAnonymityProcessor::new(KAnonymityConfig {
            k: 5,
            quasi_identifiers: vec!["age".to_string()],
            sensitive_attributes: vec!["salary".to_string()],
            suppression_threshold: 0.1,
        });
        
        for size in [1000, 5000, 10000].iter() {
            let data = generate_test_dataset(*size);
            
            c.bench_function(&format!("k_calculation_{}", size), |b| {
                b.iter(|| {
                    processor.calculate_k_value(black_box(&data)).unwrap()
                })
            });
        }
    }
}
```

### Performance Targets

- **K-value calculation**: O(n) where n is dataset size
- **Generalization**: O(n × m) where m is number of quasi-identifiers
- **Memory usage**: O(n) for equivalence class tracking
- **Target latency**: &lt;100ms for 10,000 records

## Best Practices

### Configuration Guidelines

1. **K-value Selection**:
   - Minimum k=5 for basic privacy
   - k=10-20 for sensitive healthcare data
   - k≥50 for highly sensitive financial data

2. **Quasi-identifier Selection**:
   - Include all potentially identifying attributes
   - Consider correlation between attributes
   - Account for external knowledge availability

3. **Generalization Hierarchies**:
   - Design meaningful semantic generalizations
   - Balance privacy and utility
   - Consider domain-specific knowledge

### Integration Patterns

```rust
// Combine with other privacy techniques
pub struct LayeredPrivacyProcessor {
    k_anonymity: KAnonymityProcessor,
    differential_privacy: Option<DifferentialPrivacyProcessor>,
}

impl LayeredPrivacyProcessor {
    pub fn apply_layered_privacy(&self, data: Vec<Measurement>) -> Result<Vec<Measurement>, PrivacyError> {
        // First apply k-anonymity
        let k_anonymous_data = self.k_anonymity.apply(data)?;
        
        // Then apply differential privacy if configured
        if let Some(dp) = &self.differential_privacy {
            dp.apply(k_anonymous_data)
        } else {
            Ok(k_anonymous_data)
        }
    }
}
```

## Error Handling

```rust
#[derive(Debug, thiserror::Error)]
pub enum KAnonymityError {
    #[error("Missing generalization hierarchy for quasi-identifier: {0}")]
    MissingHierarchy(String),
    
    #[error("Invalid k-value: {0} (must be >= 2)")]
    InvalidKValue(usize),
    
    #[error("Insufficient data for k-anonymity: need at least {needed}, got {actual}")]
    InsufficientData { needed: usize, actual: usize },
    
    #[error("Generalization failed: no valid generalization path found")]
    GeneralizationFailed,
    
    #[error("Suppression threshold exceeded: {suppressed}/{total} records")]
    SuppressionThresholdExceeded { suppressed: usize, total: usize },
}
```

This implementation provides a comprehensive k-anonymity solution within the Olocus Privacy extension, ensuring data privacy while maintaining compatibility with the protocol's core measurement and block structures.