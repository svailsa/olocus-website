---
id: discovery
title: Peer Discovery Mechanisms
sidebar_position: 3
---

# Peer Discovery Mechanisms

The Peer Discovery module provides multiple mechanisms for discovering and connecting to other Olocus Protocol nodes in distributed networks. Each discovery method is optimized for different network topologies, deployment scenarios, and privacy requirements.

## Overview

Discovery mechanisms enable nodes to find peers and build network topology:

- **DHT (Kademlia)**: Distributed hash table for large-scale networks
- **mDNS**: Local network discovery for LAN environments
- **Gossip**: Epidemic-style peer propagation
- **Bootstrap**: Seed node discovery for network entry
- **DNS**: DNS-based peer discovery with SRV records

```rust
use olocus_network::discovery::*;

// Configure discovery mechanisms
let discovery_config = DiscoveryConfig {
    mechanisms: vec![
        DiscoveryMechanism::DHT {
            bootstrap_nodes: vec![
                "/ip4/104.131.131.82/tcp/4001/p2p/QmaCpDMGvV2BGHeYERUEnRQAwe3N8SzbUtfsmvsqQLuvuJ".parse()?,
                "/ip4/104.236.179.241/tcp/4001/p2p/QmSoLPppuBtQSGwKDZT2M73ULpjvfd3aZ6ha4oFGL1KrGM".parse()?,
            ],
            k_bucket_size: 20,
            replication_factor: 3,
            query_timeout: Duration::from_secs(10),
        },
        DiscoveryMechanism::MDNS {
            service_name: "_olocus._tcp.local".to_string(),
            interface: None,
            ttl: Duration::from_secs(120),
        },
        DiscoveryMechanism::Gossip {
            fanout: 3,
            gossip_interval: Duration::from_secs(30),
            max_peers: 50,
        },
    ],
    peer_limits: PeerLimits {
        max_peers: 100,
        max_inbound: 50,
        max_outbound: 50,
    },
};

let discovery = PeerDiscovery::new(discovery_config).await?;
```

## Discovery Trait Interface

### Core Discovery Trait

```rust
use olocus_network::discovery::traits::*;
use olocus_core::*;

#[async_trait::async_trait]
pub trait DiscoveryMechanism: Send + Sync {
    async fn start(&mut self, local_peer_id: PeerId) -> Result<()>;
    async fn stop(&mut self) -> Result<()>;
    async fn discover_peers(&mut self) -> Result<Vec<PeerInfo>>;
    async fn announce_self(&mut self, peer_info: PeerInfo) -> Result<()>;
    
    fn mechanism_type(&self) -> DiscoveryType;
    fn supports_content_routing(&self) -> bool;
    fn supports_peer_routing(&self) -> bool;
}

#[async_trait::async_trait]
pub trait PeerStore: Send + Sync {
    async fn add_peer(&mut self, peer: PeerInfo) -> Result<()>;
    async fn remove_peer(&mut self, peer_id: &PeerId) -> Result<bool>;
    async fn get_peer(&self, peer_id: &PeerId) -> Result<Option<PeerInfo>>;
    async fn get_peers(&self) -> Result<Vec<PeerInfo>>;
    async fn get_closest_peers(&self, key: &[u8], count: usize) -> Result<Vec<PeerInfo>>;
    async fn update_peer_seen(&mut self, peer_id: &PeerId) -> Result<()>;
}

#[derive(Debug, Clone)]
pub struct PeerInfo {
    pub peer_id: PeerId,
    pub addresses: Vec<Multiaddr>,
    pub protocols: Vec<String>,
    pub last_seen: SystemTime,
    pub connection_status: ConnectionStatus,
    pub reputation_score: f64,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum DiscoveryType {
    DHT,
    MDNS,
    Gossip,
    Bootstrap,
    DNS,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ConnectionStatus {
    Connected,
    Disconnected,
    Connecting,
    Failed,
    Unknown,
}
```

## DHT (Kademlia) Discovery

Distributed Hash Table provides scalable peer discovery for large networks:

### Implementation

```rust
use olocus_network::discovery::dht::*;
use libp2p_kad::*;

#[derive(Debug)]
pub struct DHTDiscovery {
    config: DHTConfig,
    kademlia: Kademlia<MemoryStore>,
    bootstrap_nodes: Vec<PeerId>,
}

#[derive(Debug, Clone)]
pub struct DHTConfig {
    pub bootstrap_nodes: Vec<String>,
    pub k_bucket_size: usize,
    pub replication_factor: usize,
    pub query_timeout: Duration,
    pub republish_interval: Duration,
    pub provider_publication_interval: Duration,
    pub provider_record_ttl: Duration,
}

impl Default for DHTConfig {
    fn default() -> Self {
        Self {
            bootstrap_nodes: vec![],
            k_bucket_size: 20,
            replication_factor: 3,
            query_timeout: Duration::from_secs(10),
            republish_interval: Duration::from_secs(86400), // 24 hours
            provider_publication_interval: Duration::from_secs(43200), // 12 hours
            provider_record_ttl: Duration::from_secs(86400), // 24 hours
        }
    }
}

#[async_trait::async_trait]
impl DiscoveryMechanism for DHTDiscovery {
    async fn start(&mut self, local_peer_id: PeerId) -> Result<()> {
        // Bootstrap from known nodes
        for bootstrap_addr in &self.config.bootstrap_nodes {
            let multiaddr: Multiaddr = bootstrap_addr.parse()?;
            self.kademlia.add_address(&local_peer_id, multiaddr);
        }
        
        // Start bootstrap process
        if let Ok(_query_id) = self.kademlia.bootstrap() {
            // Bootstrap initiated successfully
        }
        
        Ok(())
    }

    async fn discover_peers(&mut self) -> Result<Vec<PeerInfo>> {
        let mut peers = Vec::new();
        
        // Get closest peers to random keys
        let random_key = libp2p_kad::Key::new(&rand::random::<[u8; 32]>());
        if let Ok(_query_id) = self.kademlia.get_closest_peers(random_key) {
            // Query initiated, results will come via events
        }
        
        // Convert Kademlia entries to PeerInfo
        for bucket in self.kademlia.kbuckets() {
            for entry in bucket.iter() {
                let peer_info = PeerInfo {
                    peer_id: *entry.node.key.preimage(),
                    addresses: entry.node.value.clone().into_vec(),
                    protocols: vec!["olocus/1.0.0".to_string()],
                    last_seen: SystemTime::now(),
                    connection_status: ConnectionStatus::Unknown,
                    reputation_score: 1.0,
                };
                peers.push(peer_info);
            }
        }
        
        Ok(peers)
    }

    async fn announce_self(&mut self, peer_info: PeerInfo) -> Result<()> {
        // Start providing our peer ID
        if let Ok(_query_id) = self.kademlia.start_providing(
            libp2p_kad::Key::new(&peer_info.peer_id.to_bytes())
        ) {
            // Announcement initiated
        }
        
        Ok(())
    }

    fn mechanism_type(&self) -> DiscoveryType {
        DiscoveryType::DHT
    }

    fn supports_content_routing(&self) -> bool {
        true
    }

    fn supports_peer_routing(&self) -> bool {
        true
    }
}
```

### Usage Example

```rust
use olocus_network::discovery::dht::*;

let config = DHTConfig {
    bootstrap_nodes: vec![
        "/ip4/104.131.131.82/tcp/4001/p2p/QmaCpDMGvV2BGHeYERUEnRQAwe3N8SzbUtfsmvsqQLuvuJ".to_string(),
        "/ip4/104.236.179.241/tcp/4001/p2p/QmSoLPppuBtQSGwKDZT2M73ULpjvfd3aZ6ha4oFGL1KrGM".to_string(),
    ],
    k_bucket_size: 20,
    replication_factor: 3,
    query_timeout: Duration::from_secs(15),
    ..Default::default()
};

let mut dht = DHTDiscovery::new(config);
dht.start(local_peer_id).await?;

// Announce ourselves
let our_info = PeerInfo {
    peer_id: local_peer_id,
    addresses: vec!["/ip4/192.168.1.100/tcp/8000".parse()?],
    protocols: vec!["olocus/1.0.0".to_string()],
    last_seen: SystemTime::now(),
    connection_status: ConnectionStatus::Connected,
    reputation_score: 1.0,
};

dht.announce_self(our_info).await?;

// Discover other peers
let peers = dht.discover_peers().await?;
println!("Found {} peers via DHT", peers.len());
```

## mDNS Discovery

Multicast DNS enables zero-configuration discovery on local networks:

### Implementation

```rust
use olocus_network::discovery::mdns::*;
use mdns::*;

#[derive(Debug)]
pub struct MDNSDiscovery {
    config: MDNSConfig,
    service: Option<Service>,
    discovered_peers: Arc<RwLock<HashMap<PeerId, PeerInfo>>>,
}

#[derive(Debug, Clone)]
pub struct MDNSConfig {
    pub service_name: String,
    pub service_type: String,
    pub domain: String,
    pub port: u16,
    pub interface: Option<String>,
    pub ttl: Duration,
}

impl Default for MDNSConfig {
    fn default() -> Self {
        Self {
            service_name: "olocus-node".to_string(),
            service_type: "_olocus._tcp".to_string(),
            domain: "local".to_string(),
            port: 8000,
            interface: None,
            ttl: Duration::from_secs(120),
        }
    }
}

#[async_trait::async_trait]
impl DiscoveryMechanism for MDNSDiscovery {
    async fn start(&mut self, local_peer_id: PeerId) -> Result<()> {
        let service_name = format!("{}.{}.{}", 
            local_peer_id.to_base58()[..8], // Truncated peer ID
            self.config.service_type, 
            self.config.domain
        );
        
        // Start mDNS service
        let service = Service::new(&service_name, &self.config.service_type, self.config.port)?
            .with_txt_record("peer_id", &local_peer_id.to_base58())?
            .with_txt_record("protocol", "olocus/1.0.0")?
            .with_ttl(self.config.ttl.as_secs() as u32);
        
        self.service = Some(service);
        
        // Start discovery listener
        let discovered_peers = self.discovered_peers.clone();
        tokio::spawn(async move {
            if let Ok(receiver) = mdns::discover(&self.config.service_type) {
                while let Ok(response) = receiver.recv().await {
                    if let Some(peer_info) = Self::parse_mdns_response(response) {
                        let mut peers = discovered_peers.write().await;
                        peers.insert(peer_info.peer_id, peer_info);
                    }
                }
            }
        });
        
        Ok(())
    }

    async fn stop(&mut self) -> Result<()> {
        if let Some(service) = self.service.take() {
            service.unregister()?;
        }
        Ok(())
    }

    async fn discover_peers(&mut self) -> Result<Vec<PeerInfo>> {
        let peers = self.discovered_peers.read().await;
        Ok(peers.values().cloned().collect())
    }

    async fn announce_self(&mut self, peer_info: PeerInfo) -> Result<()> {
        // mDNS announcement happens automatically when service is registered
        Ok(())
    }

    fn mechanism_type(&self) -> DiscoveryType {
        DiscoveryType::MDNS
    }

    fn supports_content_routing(&self) -> bool {
        false
    }

    fn supports_peer_routing(&self) -> bool {
        true
    }
}

impl MDNSDiscovery {
    fn parse_mdns_response(response: mdns::Response) -> Option<PeerInfo> {
        let peer_id_str = response.txt_records.get("peer_id")?;
        let peer_id = PeerId::from_base58(peer_id_str).ok()?;
        
        let address = format!("/ip4/{}/tcp/{}", 
            response.ip_addr, 
            response.port
        ).parse().ok()?;
        
        Some(PeerInfo {
            peer_id,
            addresses: vec![address],
            protocols: vec!["olocus/1.0.0".to_string()],
            last_seen: SystemTime::now(),
            connection_status: ConnectionStatus::Unknown,
            reputation_score: 1.0,
        })
    }
}
```

### Usage Example

```rust
use olocus_network::discovery::mdns::*;

let config = MDNSConfig {
    service_name: "my-olocus-node".to_string(),
    service_type: "_olocus._tcp".to_string(),
    port: 8000,
    ttl: Duration::from_secs(300),
    ..Default::default()
};

let mut mdns = MDNSDiscovery::new(config);
mdns.start(local_peer_id).await?;

// Wait for discovery
tokio::time::sleep(Duration::from_secs(5)).await;

let peers = mdns.discover_peers().await?;
println!("Found {} peers via mDNS", peers.len());

// Stop discovery
mdns.stop().await?;
```

## Gossip Discovery

Epidemic-style peer propagation for efficient network-wide discovery:

### Implementation

```rust
use olocus_network::discovery::gossip::*;

#[derive(Debug)]
pub struct GossipDiscovery {
    config: GossipConfig,
    known_peers: Arc<RwLock<HashMap<PeerId, PeerInfo>>>,
    gossip_task: Option<JoinHandle<()>>,
}

#[derive(Debug, Clone)]
pub struct GossipConfig {
    pub fanout: usize,
    pub gossip_interval: Duration,
    pub max_peers: usize,
    pub max_gossip_history: usize,
    pub gossip_ttl: u8,
}

impl Default for GossipConfig {
    fn default() -> Self {
        Self {
            fanout: 3,
            gossip_interval: Duration::from_secs(30),
            max_peers: 50,
            max_gossip_history: 1000,
            gossip_ttl: 3,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GossipMessage {
    pub message_id: Uuid,
    pub sender_id: PeerId,
    pub ttl: u8,
    pub timestamp: SystemTime,
    pub payload: GossipPayload,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum GossipPayload {
    PeerAnnouncement(PeerInfo),
    PeerList(Vec<PeerInfo>),
    Ping,
    Pong,
}

#[async_trait::async_trait]
impl DiscoveryMechanism for GossipDiscovery {
    async fn start(&mut self, local_peer_id: PeerId) -> Result<()> {
        let known_peers = self.known_peers.clone();
        let config = self.config.clone();
        
        let task = tokio::spawn(async move {
            let mut interval = tokio::time::interval(config.gossip_interval);
            
            loop {
                interval.tick().await;
                
                // Select random peers to gossip with
                let peers = {
                    let peers_lock = known_peers.read().await;
                    let mut peer_list: Vec<_> = peers_lock.values().cloned().collect();
                    peer_list.shuffle(&mut thread_rng());
                    peer_list.into_iter().take(config.fanout).collect::<Vec<_>>()
                };
                
                // Send gossip messages
                for peer in peers {
                    if peer.connection_status == ConnectionStatus::Connected {
                        let gossip_msg = GossipMessage {
                            message_id: Uuid::new_v4(),
                            sender_id: local_peer_id,
                            ttl: 3,
                            timestamp: SystemTime::now(),
                            payload: GossipPayload::Ping,
                        };
                        
                        // Send via network transport
                        if let Err(e) = Self::send_gossip_message(&peer, &gossip_msg).await {
                            eprintln!("Failed to send gossip to {}: {}", peer.peer_id, e);
                        }
                    }
                }
            }
        });
        
        self.gossip_task = Some(task);
        Ok(())
    }

    async fn stop(&mut self) -> Result<()> {
        if let Some(task) = self.gossip_task.take() {
            task.abort();
        }
        Ok(())
    }

    async fn discover_peers(&mut self) -> Result<Vec<PeerInfo>> {
        let peers = self.known_peers.read().await;
        Ok(peers.values().cloned().collect())
    }

    async fn announce_self(&mut self, peer_info: PeerInfo) -> Result<()> {
        // Add ourselves to known peers
        let mut peers = self.known_peers.write().await;
        peers.insert(peer_info.peer_id, peer_info.clone());
        
        // Gossip our announcement
        let gossip_msg = GossipMessage {
            message_id: Uuid::new_v4(),
            sender_id: peer_info.peer_id,
            ttl: self.config.gossip_ttl,
            timestamp: SystemTime::now(),
            payload: GossipPayload::PeerAnnouncement(peer_info),
        };
        
        self.broadcast_gossip_message(gossip_msg).await?;
        Ok(())
    }

    fn mechanism_type(&self) -> DiscoveryType {
        DiscoveryType::Gossip
    }

    fn supports_content_routing(&self) -> bool {
        false
    }

    fn supports_peer_routing(&self) -> bool {
        true
    }
}

impl GossipDiscovery {
    pub async fn handle_gossip_message(&self, message: GossipMessage) -> Result<()> {
        if message.ttl == 0 {
            return Ok(()); // TTL expired
        }
        
        match message.payload {
            GossipPayload::PeerAnnouncement(peer_info) => {
                let mut peers = self.known_peers.write().await;
                if peers.len() < self.config.max_peers {
                    peers.insert(peer_info.peer_id, peer_info);
                }
                
                // Forward with decreased TTL
                let forwarded_msg = GossipMessage {
                    ttl: message.ttl - 1,
                    ..message
                };
                
                self.forward_gossip_message(forwarded_msg).await?;
            }
            GossipPayload::PeerList(peer_list) => {
                let mut peers = self.known_peers.write().await;
                for peer_info in peer_list {
                    if peers.len() < self.config.max_peers {
                        peers.insert(peer_info.peer_id, peer_info);
                    }
                }
            }
            GossipPayload::Ping => {
                // Respond with pong
                let pong_msg = GossipMessage {
                    message_id: Uuid::new_v4(),
                    sender_id: message.sender_id, // Echo back
                    ttl: 1,
                    timestamp: SystemTime::now(),
                    payload: GossipPayload::Pong,
                };
                
                // Send back to sender (implementation depends on transport)
                // Self::send_to_peer(&message.sender_id, &pong_msg).await?;
            }
            GossipPayload::Pong => {
                // Update peer last seen time
                let mut peers = self.known_peers.write().await;
                if let Some(peer_info) = peers.get_mut(&message.sender_id) {
                    peer_info.last_seen = SystemTime::now();
                }
            }
        }
        
        Ok(())
    }
    
    async fn send_gossip_message(peer: &PeerInfo, message: &GossipMessage) -> Result<()> {
        // Implementation depends on transport layer
        // This would use the network transport to send the message
        Ok(())
    }
    
    async fn broadcast_gossip_message(&self, message: GossipMessage) -> Result<()> {
        let peers = self.known_peers.read().await;
        let selected_peers: Vec<_> = peers.values()
            .filter(|p| p.connection_status == ConnectionStatus::Connected)
            .take(self.config.fanout)
            .collect();
        
        for peer in selected_peers {
            if let Err(e) = Self::send_gossip_message(peer, &message).await {
                eprintln!("Failed to broadcast gossip to {}: {}", peer.peer_id, e);
            }
        }
        
        Ok(())
    }
    
    async fn forward_gossip_message(&self, message: GossipMessage) -> Result<()> {
        if message.ttl > 0 {
            self.broadcast_gossip_message(message).await?;
        }
        Ok(())
    }
}
```

### Usage Example

```rust
use olocus_network::discovery::gossip::*;

let config = GossipConfig {
    fanout: 5,
    gossip_interval: Duration::from_secs(15),
    max_peers: 100,
    gossip_ttl: 4,
    ..Default::default()
};

let mut gossip = GossipDiscovery::new(config);
gossip.start(local_peer_id).await?;

// Add some initial peers (bootstrap)
gossip.add_peer(bootstrap_peer).await?;

// Announce ourselves
gossip.announce_self(our_peer_info).await?;

// Handle incoming gossip messages
tokio::spawn(async move {
    while let Some(msg) = gossip_receiver.recv().await {
        gossip.handle_gossip_message(msg).await?;
    }
});

// Discover peers
let peers = gossip.discover_peers().await?;
println!("Found {} peers via gossip", peers.len());
```

## Bootstrap Discovery

Seed node discovery for initial network entry:

### Implementation

```rust
use olocus_network::discovery::bootstrap::*;

#[derive(Debug)]
pub struct BootstrapDiscovery {
    config: BootstrapConfig,
    bootstrap_status: HashMap<String, BootstrapStatus>,
}

#[derive(Debug, Clone)]
pub struct BootstrapConfig {
    pub bootstrap_nodes: Vec<String>,
    pub max_bootstrap_peers: usize,
    pub bootstrap_timeout: Duration,
    pub retry_interval: Duration,
    pub max_retries: usize,
}

#[derive(Debug, Clone)]
pub struct BootstrapStatus {
    pub last_attempt: SystemTime,
    pub success_count: usize,
    pub failure_count: usize,
    pub last_error: Option<String>,
}

impl Default for BootstrapConfig {
    fn default() -> Self {
        Self {
            bootstrap_nodes: vec![],
            max_bootstrap_peers: 10,
            bootstrap_timeout: Duration::from_secs(30),
            retry_interval: Duration::from_secs(60),
            max_retries: 3,
        }
    }
}

#[async_trait::async_trait]
impl DiscoveryMechanism for BootstrapDiscovery {
    async fn start(&mut self, local_peer_id: PeerId) -> Result<()> {
        // Initialize bootstrap status for each node
        for node in &self.config.bootstrap_nodes {
            self.bootstrap_status.insert(node.clone(), BootstrapStatus {
                last_attempt: SystemTime::UNIX_EPOCH,
                success_count: 0,
                failure_count: 0,
                last_error: None,
            });
        }
        
        Ok(())
    }

    async fn discover_peers(&mut self) -> Result<Vec<PeerInfo>> {
        let mut discovered_peers = Vec::new();
        
        for bootstrap_node in &self.config.bootstrap_nodes.clone() {
            match self.connect_to_bootstrap_node(bootstrap_node).await {
                Ok(peer_info) => {
                    discovered_peers.push(peer_info);
                    
                    // Update success status
                    if let Some(status) = self.bootstrap_status.get_mut(bootstrap_node) {
                        status.success_count += 1;
                        status.last_attempt = SystemTime::now();
                    }
                    
                    // Request peer list from bootstrap node
                    if let Ok(additional_peers) = self.request_peer_list(bootstrap_node).await {
                        discovered_peers.extend(additional_peers);
                    }
                }
                Err(e) => {
                    eprintln!("Failed to connect to bootstrap node {}: {}", bootstrap_node, e);
                    
                    // Update failure status
                    if let Some(status) = self.bootstrap_status.get_mut(bootstrap_node) {
                        status.failure_count += 1;
                        status.last_attempt = SystemTime::now();
                        status.last_error = Some(e.to_string());
                    }
                }
            }
            
            if discovered_peers.len() >= self.config.max_bootstrap_peers {
                break;
            }
        }
        
        Ok(discovered_peers)
    }

    async fn announce_self(&mut self, peer_info: PeerInfo) -> Result<()> {
        // Announce to all responsive bootstrap nodes
        for bootstrap_node in &self.config.bootstrap_nodes.clone() {
            if let Some(status) = self.bootstrap_status.get(bootstrap_node) {
                if status.success_count > 0 {
                    if let Err(e) = self.announce_to_bootstrap_node(bootstrap_node, &peer_info).await {
                        eprintln!("Failed to announce to bootstrap node {}: {}", bootstrap_node, e);
                    }
                }
            }
        }
        
        Ok(())
    }

    fn mechanism_type(&self) -> DiscoveryType {
        DiscoveryType::Bootstrap
    }

    fn supports_content_routing(&self) -> bool {
        false
    }

    fn supports_peer_routing(&self) -> bool {
        true
    }
}

impl BootstrapDiscovery {
    async fn connect_to_bootstrap_node(&self, node: &str) -> Result<PeerInfo> {
        let multiaddr: Multiaddr = node.parse()?;
        
        // Extract peer ID and addresses from multiaddr
        let mut peer_id = None;
        let mut addresses = vec![multiaddr.clone()];
        
        for protocol in multiaddr.iter() {
            if let Protocol::P2p(hash) = protocol {
                peer_id = Some(PeerId::from_multihash(hash)?);
                break;
            }
        }
        
        let peer_id = peer_id.ok_or_else(|| {
            DiscoveryError::InvalidBootstrapNode("No peer ID in multiaddr".to_string())
        })?;
        
        // Attempt connection with timeout
        let connection_result = tokio::time::timeout(
            self.config.bootstrap_timeout,
            self.establish_connection(&multiaddr)
        ).await;
        
        match connection_result {
            Ok(Ok(_connection)) => {
                Ok(PeerInfo {
                    peer_id,
                    addresses,
                    protocols: vec!["olocus/1.0.0".to_string()],
                    last_seen: SystemTime::now(),
                    connection_status: ConnectionStatus::Connected,
                    reputation_score: 1.0,
                })
            }
            Ok(Err(e)) => Err(e.into()),
            Err(_) => Err(DiscoveryError::Timeout.into()),
        }
    }
    
    async fn establish_connection(&self, addr: &Multiaddr) -> Result<()> {
        // Implementation depends on transport layer
        // This would use the network transport to establish connection
        Ok(())
    }
    
    async fn request_peer_list(&self, node: &str) -> Result<Vec<PeerInfo>> {
        // Request peer list from bootstrap node
        // Implementation would send a protocol message requesting known peers
        Ok(vec![])
    }
    
    async fn announce_to_bootstrap_node(&self, node: &str, peer_info: &PeerInfo) -> Result<()> {
        // Announce our presence to bootstrap node
        // Implementation would send a protocol message with our peer info
        Ok(())
    }
    
    pub fn get_bootstrap_status(&self) -> &HashMap<String, BootstrapStatus> {
        &self.bootstrap_status
    }
}
```

### Usage Example

```rust
use olocus_network::discovery::bootstrap::*;

let config = BootstrapConfig {
    bootstrap_nodes: vec![
        "/ip4/104.131.131.82/tcp/4001/p2p/QmaCpDMGvV2BGHeYERUEnRQAwe3N8SzbUtfsmvsqQLuvuJ".to_string(),
        "/ip4/104.236.179.241/tcp/4001/p2p/QmSoLPppuBtQSGwKDZT2M73ULpjvfd3aZ6ha4oFGL1KrGM".to_string(),
        "/dns4/bootstrap.olocus.io/tcp/4001/p2p/QmBootstrapOlocusNodeId".to_string(),
    ],
    max_bootstrap_peers: 5,
    bootstrap_timeout: Duration::from_secs(15),
    max_retries: 3,
    ..Default::default()
};

let mut bootstrap = BootstrapDiscovery::new(config);
bootstrap.start(local_peer_id).await?;

// Initial discovery
let peers = bootstrap.discover_peers().await?;
println!("Bootstrapped with {} peers", peers.len());

// Check bootstrap status
for (node, status) in bootstrap.get_bootstrap_status() {
    println!("Bootstrap node {}: {} successes, {} failures", 
        node, status.success_count, status.failure_count);
}

// Announce ourselves
bootstrap.announce_self(our_peer_info).await?;
```

## DNS Discovery

DNS-based peer discovery using SRV records:

### Implementation

```rust
use olocus_network::discovery::dns::*;
use trust_dns_resolver::*;

#[derive(Debug)]
pub struct DNSDiscovery {
    config: DNSConfig,
    resolver: TokioAsyncResolver,
}

#[derive(Debug, Clone)]
pub struct DNSConfig {
    pub discovery_domains: Vec<String>,
    pub service_name: String,
    pub protocol: String,
    pub dns_timeout: Duration,
    pub cache_ttl: Duration,
}

impl Default for DNSConfig {
    fn default() -> Self {
        Self {
            discovery_domains: vec!["olocus.io".to_string()],
            service_name: "olocus".to_string(),
            protocol: "tcp".to_string(),
            dns_timeout: Duration::from_secs(5),
            cache_ttl: Duration::from_secs(300),
        }
    }
}

#[async_trait::async_trait]
impl DiscoveryMechanism for DNSDiscovery {
    async fn start(&mut self, _local_peer_id: PeerId) -> Result<()> {
        // DNS discovery doesn't require startup
        Ok(())
    }

    async fn discover_peers(&mut self) -> Result<Vec<PeerInfo>> {
        let mut peers = Vec::new();
        
        for domain in &self.config.discovery_domains {
            let srv_name = format!("_{}._{}.{}", 
                self.config.service_name, 
                self.config.protocol, 
                domain
            );
            
            match self.query_srv_records(&srv_name).await {
                Ok(discovered_peers) => peers.extend(discovered_peers),
                Err(e) => eprintln!("DNS discovery failed for {}: {}", srv_name, e),
            }
        }
        
        Ok(peers)
    }

    async fn announce_self(&mut self, _peer_info: PeerInfo) -> Result<()> {
        // DNS announcement requires DNS server configuration
        // This would typically be done through external DNS management
        Ok(())
    }

    fn mechanism_type(&self) -> DiscoveryType {
        DiscoveryType::DNS
    }

    fn supports_content_routing(&self) -> bool {
        false
    }

    fn supports_peer_routing(&self) -> bool {
        true
    }
}

impl DNSDiscovery {
    pub fn new(config: DNSConfig) -> Result<Self> {
        let resolver = TokioAsyncResolver::tokio_from_system_conf()?;
        Ok(Self { config, resolver })
    }
    
    async fn query_srv_records(&self, srv_name: &str) -> Result<Vec<PeerInfo>> {
        let mut peers = Vec::new();
        
        // Query SRV records
        let srv_response = tokio::time::timeout(
            self.config.dns_timeout,
            self.resolver.srv_lookup(srv_name)
        ).await??;
        
        for srv_record in srv_response.iter() {
            // Query TXT records for additional peer information
            let txt_name = format!("_olocus-peer.{}", srv_record.target());
            let peer_info = match self.query_peer_txt_record(&txt_name).await {
                Ok(info) => info,
                Err(_) => {
                    // Fallback: create peer info from SRV record only
                    let addr = format!("/dns4/{}/tcp/{}", 
                        srv_record.target().to_utf8(), 
                        srv_record.port()
                    ).parse()?;
                    
                    PeerInfo {
                        peer_id: PeerId::random(), // Would need proper peer ID
                        addresses: vec![addr],
                        protocols: vec!["olocus/1.0.0".to_string()],
                        last_seen: SystemTime::now(),
                        connection_status: ConnectionStatus::Unknown,
                        reputation_score: 1.0,
                    }
                }
            };
            
            peers.push(peer_info);
        }
        
        Ok(peers)
    }
    
    async fn query_peer_txt_record(&self, txt_name: &str) -> Result<PeerInfo> {
        let txt_response = self.resolver.txt_lookup(txt_name).await?;
        let mut peer_id = None;
        let mut addresses = Vec::new();
        let mut protocols = vec!["olocus/1.0.0".to_string()];
        
        for txt_record in txt_response.iter() {
            for txt_data in txt_record.iter() {
                let txt_str = String::from_utf8_lossy(txt_data);
                
                if txt_str.starts_with("peer_id=") {
                    if let Ok(id) = PeerId::from_base58(&txt_str[8..]) {
                        peer_id = Some(id);
                    }
                } else if txt_str.starts_with("addr=") {
                    if let Ok(addr) = txt_str[5..].parse() {
                        addresses.push(addr);
                    }
                } else if txt_str.starts_with("protocol=") {
                    protocols.push(txt_str[9..].to_string());
                }
            }
        }
        
        let peer_id = peer_id.ok_or_else(|| {
            DiscoveryError::InvalidDNSRecord("No peer_id in TXT record".to_string())
        })?;
        
        Ok(PeerInfo {
            peer_id,
            addresses,
            protocols,
            last_seen: SystemTime::now(),
            connection_status: ConnectionStatus::Unknown,
            reputation_score: 1.0,
        })
    }
}
```

### Usage Example

```rust
use olocus_network::discovery::dns::*;

let config = DNSConfig {
    discovery_domains: vec![
        "olocus.io".to_string(),
        "bootstrap.olocus.network".to_string(),
    ],
    service_name: "olocus".to_string(),
    protocol: "tcp".to_string(),
    dns_timeout: Duration::from_secs(10),
    ..Default::default()
};

let mut dns = DNSDiscovery::new(config)?;
dns.start(local_peer_id).await?;

// Discover peers via DNS
let peers = dns.discover_peers().await?;
println!("Found {} peers via DNS", peers.len());

for peer in &peers {
    println!("DNS discovered peer: {} at {:?}", 
        peer.peer_id, peer.addresses);
}
```

## Multi-Mechanism Discovery

Combining multiple discovery mechanisms for robust peer discovery:

### Implementation

```rust
use olocus_network::discovery::multi::*;

#[derive(Debug)]
pub struct MultiDiscovery {
    mechanisms: Vec<Box<dyn DiscoveryMechanism>>,
    config: MultiDiscoveryConfig,
    peer_store: Box<dyn PeerStore>,
}

#[derive(Debug, Clone)]
pub struct MultiDiscoveryConfig {
    pub max_peers_per_mechanism: usize,
    pub discovery_interval: Duration,
    pub peer_refresh_interval: Duration,
    pub peer_timeout: Duration,
}

impl Default for MultiDiscoveryConfig {
    fn default() -> Self {
        Self {
            max_peers_per_mechanism: 50,
            discovery_interval: Duration::from_secs(60),
            peer_refresh_interval: Duration::from_secs(300),
            peer_timeout: Duration::from_secs(600),
        }
    }
}

impl MultiDiscovery {
    pub fn new(
        mechanisms: Vec<Box<dyn DiscoveryMechanism>>,
        config: MultiDiscoveryConfig,
        peer_store: Box<dyn PeerStore>
    ) -> Self {
        Self {
            mechanisms,
            config,
            peer_store,
        }
    }
    
    pub async fn start_continuous_discovery(&mut self, local_peer_id: PeerId) -> Result<()> {
        // Start all discovery mechanisms
        for mechanism in &mut self.mechanisms {
            mechanism.start(local_peer_id).await?;
        }
        
        // Start continuous discovery loop
        let mechanisms = self.mechanisms.clone(); // Would need Arc<Mutex<>> in practice
        let config = self.config.clone();
        let peer_store = self.peer_store.clone(); // Would need Arc<Mutex<>> in practice
        
        tokio::spawn(async move {
            let mut discovery_interval = tokio::time::interval(config.discovery_interval);
            let mut refresh_interval = tokio::time::interval(config.peer_refresh_interval);
            
            loop {
                tokio::select! {
                    _ = discovery_interval.tick() => {
                        // Run discovery on all mechanisms
                        for mechanism in &mechanisms {
                            match mechanism.discover_peers().await {
                                Ok(peers) => {
                                    for peer in peers.into_iter().take(config.max_peers_per_mechanism) {
                                        if let Err(e) = peer_store.add_peer(peer).await {
                                            eprintln!("Failed to add discovered peer: {}", e);
                                        }
                                    }
                                }
                                Err(e) => {
                                    eprintln!("Discovery mechanism failed: {}", e);
                                }
                            }
                        }
                    }
                    
                    _ = refresh_interval.tick() => {
                        // Clean up old peers
                        let all_peers = peer_store.get_peers().await.unwrap_or_default();
                        let now = SystemTime::now();
                        
                        for peer in all_peers {
                            if let Ok(elapsed) = now.duration_since(peer.last_seen) {
                                if elapsed > config.peer_timeout {
                                    peer_store.remove_peer(&peer.peer_id).await.ok();
                                }
                            }
                        }
                    }
                }
            }
        });
        
        Ok(())
    }
    
    pub async fn get_all_discovered_peers(&self) -> Result<Vec<PeerInfo>> {
        self.peer_store.get_peers().await
    }
}
```

### Usage Example

```rust
use olocus_network::discovery::{multi::*, dht::*, mdns::*, bootstrap::*};

// Create multiple discovery mechanisms
let mechanisms: Vec<Box<dyn DiscoveryMechanism>> = vec![
    Box::new(DHTDiscovery::new(DHTConfig::default())),
    Box::new(MDNSDiscovery::new(MDNSConfig::default())),
    Box::new(BootstrapDiscovery::new(BootstrapConfig {
        bootstrap_nodes: vec![
            "/ip4/104.131.131.82/tcp/4001/p2p/QmaCpDMGvV2BGHeYERUEnRQAwe3N8SzbUtfsmvsqQLuvuJ".to_string(),
        ],
        ..Default::default()
    })),
];

let config = MultiDiscoveryConfig {
    max_peers_per_mechanism: 25,
    discovery_interval: Duration::from_secs(30),
    peer_refresh_interval: Duration::from_secs(180),
    peer_timeout: Duration::from_secs(300),
};

let peer_store = Box::new(MemoryPeerStore::new());
let mut multi_discovery = MultiDiscovery::new(mechanisms, config, peer_store);

// Start continuous discovery
multi_discovery.start_continuous_discovery(local_peer_id).await?;

// Wait and check discovered peers
tokio::time::sleep(Duration::from_secs(60)).await;
let all_peers = multi_discovery.get_all_discovered_peers().await?;
println!("Total discovered peers: {}", all_peers.len());
```

## Performance Characteristics

| Mechanism | Scalability | Latency | Overhead | Use Case |
|-----------|-------------|---------|----------|----------|
| DHT       | Excellent   | Medium  | Medium   | Large networks |
| mDNS      | Limited     | Low     | Low      | Local networks |
| Gossip    | Good        | Low     | Medium   | Medium networks |
| Bootstrap | Good        | Low     | Low      | Initial discovery |
| DNS       | Excellent   | Medium  | Low      | Centralized networks |

## Error Handling

```rust
use olocus_network::discovery::error::*;

#[derive(Debug, thiserror::Error)]
pub enum DiscoveryError {
    #[error("Network timeout")]
    Timeout,
    
    #[error("Invalid bootstrap node: {0}")]
    InvalidBootstrapNode(String),
    
    #[error("Invalid DNS record: {0}")]
    InvalidDNSRecord(String),
    
    #[error("Peer store full")]
    PeerStoreFull,
    
    #[error("DHT error: {0}")]
    DHT(String),
    
    #[error("mDNS error: {0}")]
    MDNS(#[from] mdns::Error),
    
    #[error("DNS error: {0}")]
    DNS(#[from] trust_dns_resolver::error::ResolveError),
    
    #[error("Gossip error: {0}")]
    Gossip(String),
    
    #[error("Network error: {0}")]
    Network(#[from] NetworkError),
    
    #[error("Serialization error: {0}")]
    Serialization(#[from] bincode::Error),
}
```

Discovery mechanisms enable Olocus Protocol nodes to find each other and build robust, decentralized networks. Each mechanism can be used independently or combined for comprehensive peer discovery across different network topologies and environments.