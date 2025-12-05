#!/usr/bin/env node

/**
 * Sync Protocol Documentation from Codeberg
 * 
 * This script fetches the latest documentation from the Olocus Protocol
 * repository and transforms it for the website documentation.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const TEMP_DIR = '/tmp/olocus-protocol-sync';
const DOCS_DIR = path.join(__dirname, '../docs-setup/docs');
const PROTOCOL_REPO = 'https://codeberg.org/olocus/protocol.git';

// Mapping of source files to documentation structure
const FILE_MAPPINGS = {
  // Introduction
  'README.md': {
    target: 'intro.md',
    transform: transformReadme
  },
  
  // Core documentation
  'docs/PROTOCOL-SPECIFICATION.md': {
    target: 'core/overview.md',
    transform: transformProtocolSpec
  },
  'docs/API.md': {
    target: 'api/core.md',
    transform: transformAPI
  },
  'docs/IMPLEMENTATION-GUIDE.md': {
    target: 'implementation/rust-guide.md',
    transform: transformImplementation
  },
  'docs/DESIGN-RATIONALE.md': {
    target: 'concepts/philosophy.md',
    transform: transformDesignRationale
  },
  
  // Extension documentation
  'extensions/olocus-location/README.md': {
    target: 'extensions/location.md',
    transform: transformExtensionDoc
  },
  'extensions/olocus-trust/README.md': {
    target: 'extensions/trust.md',
    transform: transformExtensionDoc
  },
  'extensions/olocus-ml/README.md': {
    target: 'extensions/ml.md',
    transform: transformExtensionDoc
  },
  // Add more extensions...
};

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function transformReadme(content) {
  // Add Docusaurus front matter
  const frontMatter = `---
id: intro
title: Introduction
sidebar_position: 1
---

`;
  
  // Remove the main title (we'll use Docusaurus title)
  content = content.replace(/^# .*\n/, '');
  
  // Add description box
  const description = `:::info Protocol Overview
**Distributed trust infrastructure where humans, AI agents and machines collaborate securely.**

Zero External Dependencies • Pure Rust • Minimal Core (~500 lines) • Extensible
:::

`;
  
  return frontMatter + description + content;
}

function transformProtocolSpec(content) {
  const frontMatter = `---
id: overview
title: Protocol Specification
sidebar_label: Overview
---

`;
  
  // Convert sections to separate pages if needed
  content = content.replace(/^# .*\n/, '');
  
  return frontMatter + content;
}

function transformAPI(content) {
  const frontMatter = `---
id: core
title: Core API Reference
sidebar_label: Core API
---

`;
  
  // Add interactive API elements
  content = content.replace(
    /```rust\n(pub .*?)\n```/gs,
    (match, code) => {
      return `\`\`\`rust title="API Definition"
${code}
\`\`\``;
    }
  );
  
  return frontMatter + content;
}

function transformImplementation(content) {
  const frontMatter = `---
id: rust-guide
title: Rust Implementation Guide
---

`;
  
  return frontMatter + content;
}

function transformDesignRationale(content) {
  const frontMatter = `---
id: philosophy
title: Design Philosophy
sidebar_position: 1
---

`;
  
  return frontMatter + content;
}

function transformExtensionDoc(content, extensionName) {
  const frontMatter = `---
id: ${extensionName}
title: ${extensionName.charAt(0).toUpperCase() + extensionName.slice(1)} Extension
---

`;
  
  // Add extension badge
  const badge = `:::tip Extension Type
**Stable** ✅ - Production Ready
:::

`;
  
  return frontMatter + badge + content;
}

async function syncDocs() {
  console.log('🔄 Starting documentation sync...');
  
  try {
    // Clean temp directory
    if (fs.existsSync(TEMP_DIR)) {
      fs.rmSync(TEMP_DIR, { recursive: true });
    }
    
    // Clone the protocol repository
    console.log('📥 Cloning protocol repository...');
    execSync(`git clone --depth=1 ${PROTOCOL_REPO} ${TEMP_DIR}`, { stdio: 'inherit' });
    
    // Ensure docs directory exists
    ensureDir(DOCS_DIR);
    
    // Process each file mapping
    for (const [source, config] of Object.entries(FILE_MAPPINGS)) {
      const sourcePath = path.join(TEMP_DIR, source);
      const targetPath = path.join(DOCS_DIR, config.target);
      
      if (fs.existsSync(sourcePath)) {
        console.log(`📄 Processing ${source} -> ${config.target}`);
        
        // Read source content
        let content = fs.readFileSync(sourcePath, 'utf-8');
        
        // Transform content
        if (config.transform) {
          const extensionName = source.match(/extensions\/olocus-(.+?)\//)?.[1];
          content = config.transform(content, extensionName);
        }
        
        // Ensure target directory exists
        ensureDir(path.dirname(targetPath));
        
        // Write transformed content
        fs.writeFileSync(targetPath, content);
      } else {
        console.warn(`⚠️  Source file not found: ${source}`);
      }
    }
    
    // Create additional documentation pages
    createGettingStartedPages();
    createConceptPages();
    createArchitecturePages();
    
    console.log('✅ Documentation sync completed!');
    
  } catch (error) {
    console.error('❌ Error syncing documentation:', error);
    process.exit(1);
  } finally {
    // Clean up temp directory
    if (fs.existsSync(TEMP_DIR)) {
      fs.rmSync(TEMP_DIR, { recursive: true });
    }
  }
}

function createGettingStartedPages() {
  const quickstart = `---
id: quickstart
title: Quick Start
sidebar_position: 1
---

# Quick Start Guide

Get up and running with the Olocus Protocol in 5 minutes.

## Prerequisites

- Rust 1.75 or later
- Git

## Installation

\`\`\`bash
# Clone the repository
git clone https://codeberg.org/olocus/protocol.git
cd protocol

# Build the project (pure Rust, no external dependencies!)
cargo build --release

# Run tests
cargo test

# Try the demo
cargo run --example protocol_demo
\`\`\`

## Your First Block

\`\`\`rust
use olocus_core::*;

fn main() {
    // Generate a key pair
    let key = generate_key();
    
    // Create a genesis block
    let genesis = Block::genesis(
        EmptyPayload,
        &key,
        current_timestamp()
    );
    
    println!("Created block: {:?}", genesis);
}
\`\`\`

## Next Steps

- [Create your first chain](./first-chain)
- [Use location extension](./using-extensions)
- [Explore the API](../api/core)
`;

  fs.writeFileSync(
    path.join(DOCS_DIR, 'getting-started/quickstart.md'),
    quickstart
  );
}

function createConceptPages() {
  const blocks = `---
id: blocks
title: Blocks
---

# Understanding Blocks

Blocks are the fundamental unit of data in the Olocus Protocol.

## Block Structure

Every block contains:
- **Header**: Metadata including version, timestamp, and references
- **Payload**: Your application data (any type implementing \`BlockPayload\`)
- **Signature**: Ed25519 signature ensuring authenticity

## Block Types

### Genesis Block
The first block in a chain, with a zero previous hash.

### Regular Block
Links to a previous block, forming the chain.

## Code Example

\`\`\`rust
pub struct Block<P: BlockPayload> {
    pub header: BlockHeader,
    pub payload: P,
    pub signature: [u8; 64],
}
\`\`\`
`;

  fs.writeFileSync(
    path.join(DOCS_DIR, 'concepts/blocks.md'),
    blocks
  );
}

function createArchitecturePages() {
  const overview = `---
id: overview
title: Architecture Overview
---

# System Architecture

The Olocus Protocol follows a modular, extensible architecture inspired by successful protocols like HTTP and SMTP.

## Core Principles

1. **Minimal Core**: ~500 lines of essential functionality
2. **Extension-Based**: All advanced features via extensions
3. **Type-Agnostic**: Generic over any payload type
4. **Future-Proof**: Enum/trait hybrid for extensibility

## Components

### Core Protocol
- Block creation and verification
- Cryptographic operations
- Hash chain validation
- Wire format encoding

### Extensions (23 modules)
- **Location**: GPS, clustering, spoofing detection
- **Trust**: Reputation, attestations, peer connections
- **ML**: On-device inference, federated learning
- **Privacy**: GDPR compliance, differential privacy
- And 19 more...

## Design Philosophy

Following the Unix philosophy:
- Do one thing well
- Compose simple parts
- Text (or binary) streams as universal interface
`;

  ensureDir(path.join(DOCS_DIR, 'architecture'));
  fs.writeFileSync(
    path.join(DOCS_DIR, 'architecture/overview.md'),
    overview
  );
}

// Run the sync
syncDocs();