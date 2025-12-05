---
id: consensus
title: Consensus Algorithms
sidebar_position: 4
---

# Consensus Algorithms

The Consensus module provides multiple consensus algorithm implementations for distributed Olocus Protocol networks. Each algorithm is optimized for different network conditions, security requirements, and performance characteristics.

## Overview

Consensus algorithms enable distributed agreement on block ordering and chain state:

- **Proof of Work (PoW)**: Energy-based consensus with cryptographic puzzles
- **Proof of Stake (PoS)**: Stake-based consensus with validator selection
- **PBFT**: Practical Byzantine Fault Tolerance for permissioned networks
- **Raft**: Leader-based consensus for crash fault tolerance
- **Tendermint**: BFT consensus with instant finality

```rust
use olocus_network::consensus::*;

// Configure consensus algorithm
let consensus_config = ConsensusConfig {
    algorithm: ConsensusAlgorithm::PBFT {
        validator_set: ValidatorSet::new(validators),
        view_timeout: Duration::from_secs(30),
        prepare_timeout: Duration::from_secs(10),
        commit_timeout: Duration::from_secs(10),
        max_faulty_nodes: 1, // f = 1, total nodes = 3f + 1 = 4
    },
    block_time: Duration::from_secs(5),
    max_block_size: 1024 * 1024, // 1MB
    finality_threshold: 6, // Number of confirmations for finality
};

let consensus_engine = ConsensusEngine::new(consensus_config).await?;
```

## Consensus Trait Interface

### Core Consensus Trait

```rust
use olocus_network::consensus::traits::*;
use olocus_core::*;

#[async_trait::async_trait]
pub trait ConsensusAlgorithm: Send + Sync {
    async fn propose_block(&mut self, block: Block<impl BlockPayload>) -> Result<ProposalId>;
    async fn validate_block(&self, block: &Block<impl BlockPayload>) -> Result<bool>;
    async fn process_vote(&mut self, vote: Vote) -> Result<VoteResult>;
    async fn finalize_block(&mut self, block_hash: BlockHash) -> Result<()>;
    
    async fn get_current_leader(&self) -> Result<Option<NodeId>>;
    async fn get_consensus_state(&self) -> Result<ConsensusState>;
    async fn handle_timeout(&mut self, timeout_type: TimeoutType) -> Result<()>;
    
    fn algorithm_type(&self) -> ConsensusType;
    fn supports_instant_finality(&self) -> bool;
    fn max_fault_tolerance(&self) -> f64; // Fraction of faulty nodes tolerated
}

#[async_trait::async_trait]
pub trait ValidatorSet: Send + Sync {
    async fn get_validators(&self) -> Result<Vec<Validator>>;
    async fn is_validator(&self, node_id: &NodeId) -> Result<bool>;
    async fn get_validator_weight(&self, node_id: &NodeId) -> Result<u64>;
    async fn get_total_stake(&self) -> Result<u64>;
    async fn select_leader(&self, round: u64) -> Result<NodeId>;
}

#[derive(Debug, Clone)]
pub struct Vote {
    pub voter_id: NodeId,
    pub block_hash: BlockHash,
    pub vote_type: VoteType,
    pub round: u64,
    pub view: u64,
    pub signature: Signature,
    pub timestamp: SystemTime,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum VoteType {
    Prepare,
    Commit,
    Precommit,
    Prevote,
}

#[derive(Debug, Clone)]
pub enum VoteResult {
    Accepted,
    Rejected(String),
    Threshold(ThresholdReached),
}

#[derive(Debug, Clone)]
pub struct ThresholdReached {
    pub vote_type: VoteType,
    pub block_hash: BlockHash,
    pub vote_count: usize,
    pub total_weight: u64,
}
```

## Proof of Work (PoW)

Bitcoin-style proof of work with adjustable difficulty:

### Implementation

```rust
use olocus_network::consensus::pow::*;
use sha2::{Sha256, Digest};

#[derive(Debug)]
pub struct ProofOfWork {
    config: PoWConfig,
    current_difficulty: u64,
    mining_stats: MiningStats,
}

#[derive(Debug, Clone)]
pub struct PoWConfig {
    pub initial_difficulty: u64,
    pub target_block_time: Duration,
    pub difficulty_adjustment_interval: u64, // Number of blocks
    pub max_difficulty_change: f64, // Maximum change per adjustment (e.g., 4.0 = 400%)
    pub min_difficulty: u64,
    pub max_difficulty: u64,
}

impl Default for PoWConfig {
    fn default() -> Self {
        Self {
            initial_difficulty: 0x1d00ffff, // Bitcoin-style difficulty
            target_block_time: Duration::from_secs(600), // 10 minutes
            difficulty_adjustment_interval: 144, // ~1 day at 10 min blocks
            max_difficulty_change: 4.0,
            min_difficulty: 1,
            max_difficulty: u64::MAX,
        }
    }
}

#[derive(Debug, Clone)]
pub struct MiningStats {
    pub blocks_mined: u64,
    pub total_hash_rate: f64,
    pub average_block_time: Duration,
    pub last_difficulty_adjustment: SystemTime,
}

#[async_trait::async_trait]
impl ConsensusAlgorithm for ProofOfWork {
    async fn propose_block(&mut self, mut block: Block<impl BlockPayload>) -> Result<ProposalId> {
        // Mine the block by finding valid nonce
        let start_time = SystemTime::now();
        let (nonce, hash) = self.mine_block(&block).await?;
        
        // Update block with mining results
        block.nonce = nonce;
        block.hash = Some(hash);
        
        // Update mining statistics
        let mining_duration = start_time.elapsed().unwrap_or_default();
        self.update_mining_stats(mining_duration);
        
        // Adjust difficulty if needed
        if self.should_adjust_difficulty() {
            self.adjust_difficulty().await?;
        }
        
        Ok(ProposalId::from_hash(hash))
    }

    async fn validate_block(&self, block: &Block<impl BlockPayload>) -> Result<bool> {
        // Verify proof of work
        let block_hash = self.calculate_block_hash(block)?;
        let meets_difficulty = self.meets_difficulty_target(&block_hash, self.current_difficulty);
        
        if !meets_difficulty {
            return Ok(false);
        }
        
        // Verify block structure
        if block.nonce == 0 && block.previous_hash.is_some() {
            return Ok(false); // Genesis block exception
        }
        
        // Verify hash chain
        if let Some(prev_hash) = &block.previous_hash {
            // Would verify against stored previous block
        }
        
        Ok(true)
    }

    async fn process_vote(&mut self, _vote: Vote) -> Result<VoteResult> {
        // PoW doesn't use explicit voting - acceptance is implicit through mining
        Ok(VoteResult::Accepted)
    }

    async fn finalize_block(&mut self, block_hash: BlockHash) -> Result<()> {
        // In PoW, finality is probabilistic based on chain depth
        // This would update the canonical chain
        self.mining_stats.blocks_mined += 1;
        Ok(())
    }

    async fn get_current_leader(&self) -> Result<Option<NodeId>> {
        // PoW has no fixed leader - anyone can mine
        Ok(None)
    }

    async fn get_consensus_state(&self) -> Result<ConsensusState> {
        Ok(ConsensusState {
            algorithm_type: ConsensusType::ProofOfWork,
            current_round: self.mining_stats.blocks_mined,
            current_leader: None,
            difficulty: Some(self.current_difficulty),
            finalized_block_height: self.mining_stats.blocks_mined.saturating_sub(6), // 6-block finality
        })
    }

    async fn handle_timeout(&mut self, _timeout_type: TimeoutType) -> Result<()> {
        // PoW mining continues regardless of timeouts
        Ok(())
    }

    fn algorithm_type(&self) -> ConsensusType {
        ConsensusType::ProofOfWork
    }

    fn supports_instant_finality(&self) -> bool {
        false // Probabilistic finality only
    }

    fn max_fault_tolerance(&self) -> f64 {
        0.5 // 51% attack threshold
    }
}

impl ProofOfWork {
    async fn mine_block(&self, block: &Block<impl BlockPayload>) -> Result<(u64, BlockHash)> {
        let mut nonce = 0u64;
        let target = self.difficulty_to_target(self.current_difficulty);
        
        loop {
            let hash = self.calculate_hash_with_nonce(block, nonce)?;
            
            if self.hash_meets_target(&hash, &target) {
                return Ok((nonce, hash));
            }
            
            nonce += 1;
            
            // Yield occasionally to prevent blocking
            if nonce % 100000 == 0 {
                tokio::task::yield_now().await;
            }
            
            // Check for cancellation
            if nonce % 1000000 == 0 {
                // Could check for stop signal here
            }
        }
    }
    
    fn calculate_hash_with_nonce(&self, block: &Block<impl BlockPayload>, nonce: u64) -> Result<BlockHash> {
        let mut hasher = Sha256::new();
        
        // Hash block content + nonce
        hasher.update(&block.to_bytes()?);
        hasher.update(&nonce.to_le_bytes());
        
        let hash_bytes = hasher.finalize();
        Ok(BlockHash::from_bytes(hash_bytes.as_slice())?)
    }
    
    fn difficulty_to_target(&self, difficulty: u64) -> [u8; 32] {
        // Convert difficulty to target (simplified)
        let mut target = [0xffu8; 32];
        let leading_zeros = (difficulty.leading_zeros() / 8) as usize;
        
        for i in 0..leading_zeros.min(32) {
            target[i] = 0;
        }
        
        target
    }
    
    fn hash_meets_target(&self, hash: &BlockHash, target: &[u8; 32]) -> bool {
        hash.as_bytes() <= target
    }
    
    fn meets_difficulty_target(&self, hash: &BlockHash, difficulty: u64) -> bool {
        let target = self.difficulty_to_target(difficulty);
        self.hash_meets_target(hash, &target)
    }
    
    fn calculate_block_hash(&self, block: &Block<impl BlockPayload>) -> Result<BlockHash> {
        self.calculate_hash_with_nonce(block, block.nonce)
    }
    
    fn should_adjust_difficulty(&self) -> bool {
        self.mining_stats.blocks_mined % self.config.difficulty_adjustment_interval == 0
    }
    
    async fn adjust_difficulty(&mut self) -> Result<()> {
        let actual_time = self.mining_stats.average_block_time;
        let target_time = self.config.target_block_time;
        
        let adjustment_ratio = target_time.as_secs_f64() / actual_time.as_secs_f64();
        let clamped_ratio = adjustment_ratio.clamp(
            1.0 / self.config.max_difficulty_change, 
            self.config.max_difficulty_change
        );
        
        let new_difficulty = ((self.current_difficulty as f64) * clamped_ratio) as u64;
        self.current_difficulty = new_difficulty.clamp(
            self.config.min_difficulty, 
            self.config.max_difficulty
        );
        
        Ok(())
    }
    
    fn update_mining_stats(&mut self, mining_duration: Duration) {
        // Update rolling average block time
        let alpha = 0.1; // Exponential moving average factor
        let new_block_time_secs = mining_duration.as_secs_f64();
        let current_avg_secs = self.mining_stats.average_block_time.as_secs_f64();
        
        let updated_avg_secs = alpha * new_block_time_secs + (1.0 - alpha) * current_avg_secs;
        self.mining_stats.average_block_time = Duration::from_secs_f64(updated_avg_secs);
    }
}
```

### Usage Example

```rust
use olocus_network::consensus::pow::*;

let config = PoWConfig {
    initial_difficulty: 0x1e00ffff, // Lower difficulty for faster testing
    target_block_time: Duration::from_secs(60), // 1 minute blocks
    difficulty_adjustment_interval: 10, // Adjust every 10 blocks
    max_difficulty_change: 2.0, // Max 200% change
    ..Default::default()
};

let mut pow = ProofOfWork::new(config);

// Mine a block
let proposal_id = pow.propose_block(my_block).await?;
println!("Mined block with proposal ID: {:?}", proposal_id);

// Validate a received block
let is_valid = pow.validate_block(&received_block).await?;
if is_valid {
    pow.finalize_block(received_block.hash()?).await?;
}

// Check consensus state
let state = pow.get_consensus_state().await?;
println!("Current difficulty: {:?}", state.difficulty);
```

## Proof of Stake (PoS)

Ethereum-style proof of stake with validator selection:

### Implementation

```rust
use olocus_network::consensus::pos::*;

#[derive(Debug)]
pub struct ProofOfStake {
    config: PoSConfig,
    validator_set: Box<dyn ValidatorSet>,
    current_epoch: u64,
    slot_time: Duration,
}

#[derive(Debug, Clone)]
pub struct PoSConfig {
    pub slots_per_epoch: u64,
    pub slot_duration: Duration,
    pub min_stake: u64,
    pub slashing_multiplier: f64,
    pub reward_per_block: u64,
}

impl Default for PoSConfig {
    fn default() -> Self {
        Self {
            slots_per_epoch: 32,
            slot_duration: Duration::from_secs(12),
            min_stake: 32_000_000_000, // 32 ETH equivalent in wei
            slashing_multiplier: 1.0,
            reward_per_block: 1_000_000_000, // 1 unit
        }
    }
}

#[derive(Debug, Clone)]
pub struct Validator {
    pub node_id: NodeId,
    pub public_key: PublicKey,
    pub stake: u64,
    pub status: ValidatorStatus,
    pub last_attestation_slot: Option<u64>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ValidatorStatus {
    Active,
    PendingActivation,
    PendingExit,
    Exited,
    Slashed,
}

#[async_trait::async_trait]
impl ConsensusAlgorithm for ProofOfStake {
    async fn propose_block(&mut self, block: Block<impl BlockPayload>) -> Result<ProposalId> {
        let current_slot = self.get_current_slot();
        let proposer = self.validator_set.select_leader(current_slot).await?;
        
        // Verify we are the selected proposer
        let our_node_id = self.get_our_node_id();
        if proposer != our_node_id {
            return Err(ConsensusError::NotSelectedProposer.into());
        }
        
        // Sign the block
        let signed_block = self.sign_block(block).await?;
        
        Ok(ProposalId::from_hash(signed_block.hash()?))
    }

    async fn validate_block(&self, block: &Block<impl BlockPayload>) -> Result<bool> {
        // Verify proposer selection
        let slot = self.block_slot(block);
        let expected_proposer = self.validator_set.select_leader(slot).await?;
        
        if block.proposer != Some(expected_proposer) {
            return Ok(false);
        }
        
        // Verify proposer signature
        if !self.verify_block_signature(block).await? {
            return Ok(false);
        }
        
        // Verify stake requirements
        let proposer_stake = self.validator_set.get_validator_weight(&expected_proposer).await?;
        if proposer_stake < self.config.min_stake {
            return Ok(false);
        }
        
        Ok(true)
    }

    async fn process_vote(&mut self, vote: Vote) -> Result<VoteResult> {
        // Verify vote signature
        if !self.verify_vote_signature(&vote).await? {
            return Ok(VoteResult::Rejected("Invalid signature".to_string()));
        }
        
        // Verify voter is active validator
        if !self.validator_set.is_validator(&vote.voter_id).await? {
            return Ok(VoteResult::Rejected("Not an active validator".to_string()));
        }
        
        // Calculate vote weight based on stake
        let vote_weight = self.validator_set.get_validator_weight(&vote.voter_id).await?;
        
        // Check if we've reached threshold (2/3 of total stake)
        let total_stake = self.validator_set.get_total_stake().await?;
        let threshold = (total_stake * 2) / 3;
        
        // This would update vote tracking and check threshold
        if self.get_total_vote_weight_for_block(&vote.block_hash, vote.vote_type).await? >= threshold {
            return Ok(VoteResult::Threshold(ThresholdReached {
                vote_type: vote.vote_type,
                block_hash: vote.block_hash,
                vote_count: 1, // Would track actual count
                total_weight: vote_weight,
            }));
        }
        
        Ok(VoteResult::Accepted)
    }

    async fn finalize_block(&mut self, block_hash: BlockHash) -> Result<()> {
        // Update validator rewards
        self.distribute_rewards(block_hash).await?;
        
        // Update epoch if needed
        self.check_epoch_transition().await?;
        
        Ok(())
    }

    async fn get_current_leader(&self) -> Result<Option<NodeId>> {
        let current_slot = self.get_current_slot();
        let leader = self.validator_set.select_leader(current_slot).await?;
        Ok(Some(leader))
    }

    async fn get_consensus_state(&self) -> Result<ConsensusState> {
        Ok(ConsensusState {
            algorithm_type: ConsensusType::ProofOfStake,
            current_round: self.get_current_slot(),
            current_leader: self.get_current_leader().await?,
            difficulty: None,
            finalized_block_height: self.get_finalized_height().await?,
        })
    }

    async fn handle_timeout(&mut self, timeout_type: TimeoutType) -> Result<()> {
        match timeout_type {
            TimeoutType::SlotTimeout => {
                // Move to next slot
                self.advance_slot().await?;
            }
            TimeoutType::EpochTimeout => {
                // Move to next epoch
                self.advance_epoch().await?;
            }
            _ => {}
        }
        Ok(())
    }

    fn algorithm_type(&self) -> ConsensusType {
        ConsensusType::ProofOfStake
    }

    fn supports_instant_finality(&self) -> bool {
        true // With sufficient attestations
    }

    fn max_fault_tolerance(&self) -> f64 {
        0.33 // 1/3 Byzantine fault tolerance
    }
}

impl ProofOfStake {
    fn get_current_slot(&self) -> u64 {
        let genesis_time = SystemTime::UNIX_EPOCH; // Would be actual genesis
        let elapsed = SystemTime::now().duration_since(genesis_time).unwrap_or_default();
        elapsed.as_secs() / self.config.slot_duration.as_secs()
    }
    
    fn block_slot(&self, block: &Block<impl BlockPayload>) -> u64 {
        // Extract slot from block timestamp
        let genesis_time = SystemTime::UNIX_EPOCH;
        let block_elapsed = block.timestamp.duration_since(genesis_time).unwrap_or_default();
        block_elapsed.as_secs() / self.config.slot_duration.as_secs()
    }
    
    async fn sign_block(&self, mut block: Block<impl BlockPayload>) -> Result<Block<impl BlockPayload>> {
        let our_node_id = self.get_our_node_id();
        block.proposer = Some(our_node_id);
        
        // Sign with our validator key
        let signature = self.create_block_signature(&block).await?;
        block.signature = Some(signature);
        
        Ok(block)
    }
    
    async fn verify_block_signature(&self, block: &Block<impl BlockPayload>) -> Result<bool> {
        if let (Some(proposer), Some(signature)) = (&block.proposer, &block.signature) {
            // Get proposer's public key
            let validators = self.validator_set.get_validators().await?;
            if let Some(validator) = validators.iter().find(|v| &v.node_id == proposer) {
                return Ok(self.verify_signature(&validator.public_key, block, signature).await?);
            }
        }
        Ok(false)
    }
    
    async fn verify_vote_signature(&self, vote: &Vote) -> Result<bool> {
        let validators = self.validator_set.get_validators().await?;
        if let Some(validator) = validators.iter().find(|v| v.node_id == vote.voter_id) {
            return Ok(self.verify_vote_sig(&validator.public_key, vote).await?);
        }
        Ok(false)
    }
    
    async fn get_total_vote_weight_for_block(&self, _block_hash: &BlockHash, _vote_type: VoteType) -> Result<u64> {
        // This would track votes and return total weight
        Ok(0)
    }
    
    async fn distribute_rewards(&mut self, _block_hash: BlockHash) -> Result<()> {
        // Distribute block rewards to proposer and attesters
        Ok(())
    }
    
    async fn check_epoch_transition(&mut self) -> Result<()> {
        let current_slot = self.get_current_slot();
        let new_epoch = current_slot / self.config.slots_per_epoch;
        
        if new_epoch > self.current_epoch {
            self.current_epoch = new_epoch;
            // Update validator set, process exits/activations, etc.
        }
        
        Ok(())
    }
    
    async fn advance_slot(&mut self) -> Result<()> {
        // Implementation for slot progression
        Ok(())
    }
    
    async fn advance_epoch(&mut self) -> Result<()> {
        // Implementation for epoch progression
        Ok(())
    }
    
    async fn get_finalized_height(&self) -> Result<u64> {
        // Return height of last finalized block
        Ok(0)
    }
    
    fn get_our_node_id(&self) -> NodeId {
        // Return this node's ID
        NodeId::default()
    }
    
    async fn create_block_signature(&self, _block: &Block<impl BlockPayload>) -> Result<Signature> {
        // Create signature using validator private key
        Ok(Signature::default())
    }
    
    async fn verify_signature(&self, _public_key: &PublicKey, _block: &Block<impl BlockPayload>, _signature: &Signature) -> Result<bool> {
        // Verify block signature
        Ok(true)
    }
    
    async fn verify_vote_sig(&self, _public_key: &PublicKey, _vote: &Vote) -> Result<bool> {
        // Verify vote signature
        Ok(true)
    }
}
```

### Usage Example

```rust
use olocus_network::consensus::pos::*;

let validators = vec![
    Validator {
        node_id: validator1_id,
        public_key: validator1_pubkey,
        stake: 32_000_000_000,
        status: ValidatorStatus::Active,
        last_attestation_slot: None,
    },
    // ... more validators
];

let validator_set = Box::new(SimpleValidatorSet::new(validators));
let config = PoSConfig {
    slots_per_epoch: 32,
    slot_duration: Duration::from_secs(12),
    min_stake: 32_000_000_000,
    ..Default::default()
};

let mut pos = ProofOfStake::new(config, validator_set);

// Propose a block if we're the selected proposer
if let Ok(Some(leader)) = pos.get_current_leader().await {
    if leader == our_node_id {
        let proposal_id = pos.propose_block(my_block).await?;
        println!("Proposed block: {:?}", proposal_id);
    }
}

// Process attestation votes
let vote = Vote {
    voter_id: validator_id,
    block_hash: block_hash,
    vote_type: VoteType::Prevote,
    round: current_slot,
    view: 0,
    signature: vote_signature,
    timestamp: SystemTime::now(),
};

match pos.process_vote(vote).await? {
    VoteResult::Threshold(threshold) => {
        println!("Reached threshold for block: {:?}", threshold.block_hash);
        pos.finalize_block(threshold.block_hash).await?;
    }
    VoteResult::Accepted => {
        println!("Vote accepted");
    }
    VoteResult::Rejected(reason) => {
        println!("Vote rejected: {}", reason);
    }
}
```

## PBFT (Practical Byzantine Fault Tolerance)

Three-phase Byzantine fault tolerant consensus:

### Implementation

```rust
use olocus_network::consensus::pbft::*;

#[derive(Debug)]
pub struct PBFT {
    config: PBFTConfig,
    current_view: u64,
    current_sequence: u64,
    validator_set: Box<dyn ValidatorSet>,
    message_log: HashMap<(u64, u64), PBFTMessage>, // (view, sequence) -> message
    vote_tracker: HashMap<(u64, u64, VoteType), Vec<Vote>>, // Track votes
}

#[derive(Debug, Clone)]
pub struct PBFTConfig {
    pub view_timeout: Duration,
    pub prepare_timeout: Duration,
    pub commit_timeout: Duration,
    pub max_faulty_nodes: usize,
    pub checkpoint_interval: u64,
}

impl Default for PBFTConfig {
    fn default() -> Self {
        Self {
            view_timeout: Duration::from_secs(30),
            prepare_timeout: Duration::from_secs(10),
            commit_timeout: Duration::from_secs(10),
            max_faulty_nodes: 1, // f=1, n=3f+1=4 nodes minimum
            checkpoint_interval: 100,
        }
    }
}

#[derive(Debug, Clone)]
pub struct PBFTMessage {
    pub view: u64,
    pub sequence: u64,
    pub message_type: PBFTMessageType,
    pub sender_id: NodeId,
    pub timestamp: SystemTime,
    pub signature: Signature,
}

#[derive(Debug, Clone)]
pub enum PBFTMessageType {
    Request(Block<serde_json::Value>),
    PrePrepare(BlockHash),
    Prepare(BlockHash),
    Commit(BlockHash),
    ViewChange(u64), // new view
    NewView(u64, Vec<PBFTMessage>), // new view + prepare messages
    Checkpoint(u64, BlockHash), // sequence + state hash
}

#[async_trait::async_trait]
impl ConsensusAlgorithm for PBFT {
    async fn propose_block(&mut self, block: Block<impl BlockPayload>) -> Result<ProposalId> {
        // Check if we are the primary for current view
        if !self.is_primary(self.current_view).await? {
            return Err(ConsensusError::NotPrimary.into());
        }
        
        self.current_sequence += 1;
        let block_hash = block.hash()?;
        
        // Send PRE-PREPARE message
        let pre_prepare = PBFTMessage {
            view: self.current_view,
            sequence: self.current_sequence,
            message_type: PBFTMessageType::PrePrepare(block_hash),
            sender_id: self.get_our_node_id(),
            timestamp: SystemTime::now(),
            signature: self.sign_message(&PBFTMessageType::PrePrepare(block_hash)).await?,
        };
        
        self.message_log.insert((self.current_view, self.current_sequence), pre_prepare.clone());
        self.broadcast_message(pre_prepare).await?;
        
        Ok(ProposalId::from_hash(block_hash))
    }

    async fn validate_block(&self, block: &Block<impl BlockPayload>) -> Result<bool> {
        // Basic block validation
        if !self.validate_block_structure(block).await? {
            return Ok(false);
        }
        
        // Check if block is part of current consensus round
        let block_hash = block.hash()?;
        if let Some(message) = self.message_log.get(&(self.current_view, self.current_sequence)) {
            if let PBFTMessageType::PrePrepare(expected_hash) = &message.message_type {
                return Ok(*expected_hash == block_hash);
            }
        }
        
        Ok(true)
    }

    async fn process_vote(&mut self, vote: Vote) -> Result<VoteResult> {
        // Verify vote signature
        if !self.verify_vote_signature(&vote).await? {
            return Ok(VoteResult::Rejected("Invalid signature".to_string()));
        }
        
        // Check if voter is valid
        if !self.validator_set.is_validator(&vote.voter_id).await? {
            return Ok(VoteResult::Rejected("Invalid validator".to_string()));
        }
        
        // Add vote to tracker
        let key = (vote.view, vote.round, vote.vote_type);
        self.vote_tracker.entry(key).or_default().push(vote.clone());
        
        // Check thresholds
        let votes = &self.vote_tracker[&key];
        let required_votes = self.get_required_vote_count().await?;
        
        if votes.len() >= required_votes {
            return Ok(VoteResult::Threshold(ThresholdReached {
                vote_type: vote.vote_type,
                block_hash: vote.block_hash,
                vote_count: votes.len(),
                total_weight: votes.len() as u64,
            }));
        }
        
        Ok(VoteResult::Accepted)
    }

    async fn finalize_block(&mut self, block_hash: BlockHash) -> Result<()> {
        // Block is finalized when we have 2f+1 COMMIT messages
        let commit_key = (self.current_view, self.current_sequence, VoteType::Commit);
        
        if let Some(commits) = self.vote_tracker.get(&commit_key) {
            let required = self.get_required_vote_count().await?;
            if commits.len() >= required {
                // Block is committed
                self.execute_block(block_hash).await?;
                
                // Send checkpoint if needed
                if self.current_sequence % self.config.checkpoint_interval == 0 {
                    self.send_checkpoint().await?;
                }
                
                return Ok(());
            }
        }
        
        Err(ConsensusError::InsufficientVotes.into())
    }

    async fn get_current_leader(&self) -> Result<Option<NodeId>> {
        let primary = self.get_primary_for_view(self.current_view).await?;
        Ok(Some(primary))
    }

    async fn get_consensus_state(&self) -> Result<ConsensusState> {
        Ok(ConsensusState {
            algorithm_type: ConsensusType::PBFT,
            current_round: self.current_sequence,
            current_leader: self.get_current_leader().await?,
            difficulty: None,
            finalized_block_height: self.get_last_finalized_sequence(),
        })
    }

    async fn handle_timeout(&mut self, timeout_type: TimeoutType) -> Result<()> {
        match timeout_type {
            TimeoutType::ViewTimeout => {
                // Initiate view change
                self.start_view_change().await?;
            }
            TimeoutType::PrepareTimeout => {
                // Resend prepare or move to view change
                self.handle_prepare_timeout().await?;
            }
            TimeoutType::CommitTimeout => {
                // Resend commit or move to view change
                self.handle_commit_timeout().await?;
            }
            _ => {}
        }
        Ok(())
    }

    fn algorithm_type(&self) -> ConsensusType {
        ConsensusType::PBFT
    }

    fn supports_instant_finality(&self) -> bool {
        true
    }

    fn max_fault_tolerance(&self) -> f64 {
        0.33 // f < n/3
    }
}

impl PBFT {
    pub async fn handle_pbft_message(&mut self, message: PBFTMessage) -> Result<()> {
        // Verify message signature
        if !self.verify_message_signature(&message).await? {
            return Err(ConsensusError::InvalidSignature.into());
        }
        
        match &message.message_type {
            PBFTMessageType::PrePrepare(block_hash) => {
                self.handle_pre_prepare(message, *block_hash).await?;
            }
            PBFTMessageType::Prepare(block_hash) => {
                self.handle_prepare(message, *block_hash).await?;
            }
            PBFTMessageType::Commit(block_hash) => {
                self.handle_commit(message, *block_hash).await?;
            }
            PBFTMessageType::ViewChange(new_view) => {
                self.handle_view_change(message, *new_view).await?;
            }
            PBFTMessageType::NewView(new_view, prepare_messages) => {
                self.handle_new_view(message, *new_view, prepare_messages).await?;
            }
            PBFTMessageType::Checkpoint(sequence, state_hash) => {
                self.handle_checkpoint(message, *sequence, *state_hash).await?;
            }
            _ => {}
        }
        
        Ok(())
    }
    
    async fn handle_pre_prepare(&mut self, message: PBFTMessage, block_hash: BlockHash) -> Result<()> {
        // Verify sender is primary for view
        let primary = self.get_primary_for_view(message.view).await?;
        if message.sender_id != primary {
            return Err(ConsensusError::InvalidPrimary.into());
        }
        
        // Store PRE-PREPARE message
        self.message_log.insert((message.view, message.sequence), message);
        
        // Send PREPARE message
        let prepare = PBFTMessage {
            view: self.current_view,
            sequence: message.sequence,
            message_type: PBFTMessageType::Prepare(block_hash),
            sender_id: self.get_our_node_id(),
            timestamp: SystemTime::now(),
            signature: self.sign_message(&PBFTMessageType::Prepare(block_hash)).await?,
        };
        
        self.broadcast_message(prepare).await?;
        Ok(())
    }
    
    async fn handle_prepare(&mut self, message: PBFTMessage, block_hash: BlockHash) -> Result<()> {
        // Add to vote tracker
        let vote = Vote {
            voter_id: message.sender_id,
            block_hash,
            vote_type: VoteType::Prepare,
            round: message.sequence,
            view: message.view,
            signature: message.signature,
            timestamp: message.timestamp,
        };
        
        match self.process_vote(vote).await? {
            VoteResult::Threshold(_) => {
                // Send COMMIT message
                let commit = PBFTMessage {
                    view: self.current_view,
                    sequence: message.sequence,
                    message_type: PBFTMessageType::Commit(block_hash),
                    sender_id: self.get_our_node_id(),
                    timestamp: SystemTime::now(),
                    signature: self.sign_message(&PBFTMessageType::Commit(block_hash)).await?,
                };
                
                self.broadcast_message(commit).await?;
            }
            _ => {}
        }
        
        Ok(())
    }
    
    async fn handle_commit(&mut self, message: PBFTMessage, block_hash: BlockHash) -> Result<()> {
        // Add to vote tracker
        let vote = Vote {
            voter_id: message.sender_id,
            block_hash,
            vote_type: VoteType::Commit,
            round: message.sequence,
            view: message.view,
            signature: message.signature,
            timestamp: message.timestamp,
        };
        
        match self.process_vote(vote).await? {
            VoteResult::Threshold(_) => {
                // Execute block
                self.finalize_block(block_hash).await?;
            }
            _ => {}
        }
        
        Ok(())
    }
    
    async fn is_primary(&self, view: u64) -> Result<bool> {
        let primary = self.get_primary_for_view(view).await?;
        Ok(primary == self.get_our_node_id())
    }
    
    async fn get_primary_for_view(&self, view: u64) -> Result<NodeId> {
        let validators = self.validator_set.get_validators().await?;
        let primary_index = (view as usize) % validators.len();
        Ok(validators[primary_index].node_id)
    }
    
    async fn get_required_vote_count(&self) -> Result<usize> {
        let total_validators = self.validator_set.get_validators().await?.len();
        Ok(2 * self.config.max_faulty_nodes + 1)
    }
    
    async fn start_view_change(&mut self) -> Result<()> {
        self.current_view += 1;
        
        let view_change = PBFTMessage {
            view: self.current_view,
            sequence: self.current_sequence,
            message_type: PBFTMessageType::ViewChange(self.current_view),
            sender_id: self.get_our_node_id(),
            timestamp: SystemTime::now(),
            signature: self.sign_message(&PBFTMessageType::ViewChange(self.current_view)).await?,
        };
        
        self.broadcast_message(view_change).await?;
        Ok(())
    }
    
    // Additional helper methods...
    async fn handle_view_change(&mut self, _message: PBFTMessage, _new_view: u64) -> Result<()> {
        // Implementation for view change handling
        Ok(())
    }
    
    async fn handle_new_view(&mut self, _message: PBFTMessage, _new_view: u64, _prepare_messages: &[PBFTMessage]) -> Result<()> {
        // Implementation for new view handling
        Ok(())
    }
    
    async fn handle_checkpoint(&mut self, _message: PBFTMessage, _sequence: u64, _state_hash: BlockHash) -> Result<()> {
        // Implementation for checkpoint handling
        Ok(())
    }
    
    async fn send_checkpoint(&mut self) -> Result<()> {
        // Implementation for sending checkpoint
        Ok(())
    }
    
    async fn handle_prepare_timeout(&mut self) -> Result<()> {
        // Implementation for prepare timeout
        Ok(())
    }
    
    async fn handle_commit_timeout(&mut self) -> Result<()> {
        // Implementation for commit timeout
        Ok(())
    }
    
    async fn execute_block(&mut self, _block_hash: BlockHash) -> Result<()> {
        // Implementation for block execution
        Ok(())
    }
    
    async fn validate_block_structure(&self, _block: &Block<impl BlockPayload>) -> Result<bool> {
        // Implementation for block structure validation
        Ok(true)
    }
    
    async fn verify_vote_signature(&self, _vote: &Vote) -> Result<bool> {
        // Implementation for vote signature verification
        Ok(true)
    }
    
    async fn verify_message_signature(&self, _message: &PBFTMessage) -> Result<bool> {
        // Implementation for message signature verification
        Ok(true)
    }
    
    async fn sign_message(&self, _message_type: &PBFTMessageType) -> Result<Signature> {
        // Implementation for message signing
        Ok(Signature::default())
    }
    
    async fn broadcast_message(&self, _message: PBFTMessage) -> Result<()> {
        // Implementation for message broadcasting
        Ok(())
    }
    
    fn get_our_node_id(&self) -> NodeId {
        NodeId::default()
    }
    
    fn get_last_finalized_sequence(&self) -> u64 {
        0
    }
}
```

## Common Types and Traits

```rust
use olocus_network::consensus::types::*;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ConsensusType {
    ProofOfWork,
    ProofOfStake,
    PBFT,
    Raft,
    Tendermint,
}

#[derive(Debug, Clone)]
pub struct ConsensusState {
    pub algorithm_type: ConsensusType,
    pub current_round: u64,
    pub current_leader: Option<NodeId>,
    pub difficulty: Option<u64>,
    pub finalized_block_height: u64,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TimeoutType {
    ViewTimeout,
    SlotTimeout,
    EpochTimeout,
    PrepareTimeout,
    CommitTimeout,
    ElectionTimeout,
    HeartbeatTimeout,
}

#[derive(Debug, Clone)]
pub struct ProposalId {
    pub hash: BlockHash,
    pub round: u64,
    pub proposer: NodeId,
}

impl ProposalId {
    pub fn from_hash(hash: BlockHash) -> Self {
        Self {
            hash,
            round: 0,
            proposer: NodeId::default(),
        }
    }
}

#[derive(Debug, thiserror::Error)]
pub enum ConsensusError {
    #[error("Not selected as proposer for this round")]
    NotSelectedProposer,
    
    #[error("Not the primary node")]
    NotPrimary,
    
    #[error("Invalid primary node")]
    InvalidPrimary,
    
    #[error("Invalid signature")]
    InvalidSignature,
    
    #[error("Insufficient votes for consensus")]
    InsufficientVotes,
    
    #[error("Network error: {0}")]
    Network(#[from] NetworkError),
    
    #[error("Validation error: {0}")]
    Validation(String),
}
```

## Performance Comparison

| Algorithm  | Throughput | Latency | Energy | Finality | Fault Tolerance |
|------------|------------|---------|---------|-----------|-----------------|
| PoW        | Low        | High    | Very High | Probabilistic | 51% hash power |
| PoS        | Medium     | Medium  | Low     | Fast      | 33% stake |
| PBFT       | High       | Low     | Low     | Instant   | 33% nodes |
| Raft       | High       | Low     | Low     | Instant   | 50% nodes (crash only) |
| Tendermint | High       | Low     | Low     | Instant   | 33% nodes |

## Usage Guidelines

### When to Use Each Algorithm

1. **Proof of Work**: Public networks, maximum decentralization, energy not a concern
2. **Proof of Stake**: Public networks, energy efficiency important, economic security
3. **PBFT**: Permissioned networks, Byzantine faults expected, instant finality required
4. **Raft**: Private networks, crash faults only, simplicity preferred
5. **Tendermint**: High-performance applications, Byzantine faults, instant finality

### Configuration Recommendations

```rust
// Production PoW configuration
let pow_config = PoWConfig {
    target_block_time: Duration::from_secs(300), // 5 minutes
    difficulty_adjustment_interval: 288, // ~1 day
    max_difficulty_change: 2.0,
    ..Default::default()
};

// Production PoS configuration  
let pos_config = PoSConfig {
    slot_duration: Duration::from_secs(12),
    slots_per_epoch: 32,
    min_stake: 32_000_000_000,
    ..Default::default()
};

// Production PBFT configuration
let pbft_config = PBFTConfig {
    view_timeout: Duration::from_secs(60),
    prepare_timeout: Duration::from_secs(15),
    commit_timeout: Duration::from_secs(15),
    max_faulty_nodes: 2, // For 7-node cluster
};
```

Each consensus algorithm can be configured independently and integrated with the same high-level Olocus Protocol APIs, providing flexibility to choose the right algorithm for your specific use case and network requirements.