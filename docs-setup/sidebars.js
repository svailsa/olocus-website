/** @type {import('@docusaurus/plugin-content-docs').SidebarsConfig} */
const sidebars = {
  docsSidebar: [
    {
      type: 'doc',
      id: 'intro',
      label: '🏠 Introduction',
    },
    {
      type: 'category',
      label: '🚀 Getting Started',
      collapsed: false,
      items: [
        'getting-started/quickstart',
        'getting-started/installation',
        'getting-started/first-chain',
        'getting-started/understanding-measurements',
        'getting-started/choosing-extensions',
      ],
    },
    {
      type: 'category',
      label: '📐 Core Concepts',
      collapsed: false,
      items: [
        'concepts/blocks-and-chains',
        'concepts/measurements',
        'concepts/cryptographic-primitives',
        'concepts/wire-format',
        'concepts/algorithm-negotiation',
        'concepts/downgrade-protection',
      ],
    },
    {
      type: 'category',
      label: '🏗️ Architecture',
      items: [
        'architecture/protocol-specification',
        'architecture/design-rationale',
        'architecture/security-model',
        'architecture/formal-verification',
        'architecture/scalability-roadmap',
      ],
    },
    {
      type: 'category',
      label: '📖 API Reference',
      items: [
        'api/core',
        'api/block-operations',
        'api/cryptographic-operations',
        'api/measurement-api',
        'api/wire-format-api',
        'api/error-handling',
      ],
    },
    {
      type: 'category',
      label: '🧩 Extensions Hub',
      items: [
        'extensions/overview',
        'extensions/selection-guide',
        'extensions/creating-extensions',
        {
          type: 'category',
          label: '📍 Location & Spatial',
          items: [
            'extensions/location/tracking',
            'extensions/location/visit-detection',
            'extensions/location/clustering',
            'extensions/location/privacy-obfuscation',
          ],
        },
        {
          type: 'category',
          label: '🔐 Security & Trust',
          items: [
            'extensions/security/trust-networks',
            'extensions/security/device-integrity',
            'extensions/security/hsm-integration',
            'extensions/security/keystore',
            'extensions/security/post-quantum',
          ],
        },
        {
          type: 'category',
          label: '🎯 Data & Privacy',
          items: [
            'extensions/privacy/techniques',
            'extensions/privacy/credentials',
            'extensions/privacy/threshold-signatures',
            'extensions/privacy/zero-knowledge',
          ],
        },
        {
          type: 'category',
          label: '⚡ Infrastructure',
          items: [
            'extensions/infrastructure/storage',
            'extensions/infrastructure/network',
            'extensions/infrastructure/http-api',
            'extensions/infrastructure/metrics',
            'extensions/infrastructure/query-engine',
          ],
        },
        {
          type: 'category',
          label: '🏢 Enterprise',
          items: [
            'extensions/enterprise/orchestration',
            'extensions/enterprise/schema-registry',
            'extensions/enterprise/audit-logging',
            'extensions/enterprise/policy-enforcement',
            'extensions/enterprise/tsa-integration',
          ],
        },
        {
          type: 'category',
          label: '🤖 AI & ML',
          items: [
            'extensions/ai/agent-interaction',
            'extensions/ai/ml-inference',
            'extensions/ai/federated-learning',
          ],
        },
      ],
    },
    {
      type: 'category',
      label: '🔌 Integration Guides',
      items: [
        'integration/platform-overview',
        'integration/ios',
        'integration/android',
        'integration/web',
        'integration/ffi',
        'integration/wasm',
        'integration/language-sdks',
      ],
    },
    {
      type: 'category',
      label: '🛠️ Developer Tools',
      items: [
        'tools/claude-code-agents',
        'tools/testing-framework',
        'tools/benchmarking',
        'tools/debugging',
      ],
    },
    {
      type: 'category',
      label: '📚 Tutorials',
      items: [
        'tutorials/location-tracker',
        'tutorials/trust-networks',
        'tutorials/enterprise-audit',
        'tutorials/privacy-analytics',
        'tutorials/multi-extension-pipelines',
      ],
    },
    {
      type: 'category',
      label: '📊 Case Studies',
      items: [
        'case-studies/supply-chain',
        'case-studies/healthcare',
        'case-studies/iot-devices',
        'case-studies/ai-collaboration',
      ],
    },
    {
      type: 'category',
      label: '📋 Reference',
      items: [
        'reference/error-codes',
        'reference/payload-types',
        'reference/algorithm-ids',
        'reference/glossary',
        'reference/faq',
      ],
    },
  ],
};

module.exports = sidebars;