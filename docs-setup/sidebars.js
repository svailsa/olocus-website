/** @type {import('@docusaurus/plugin-content-docs').SidebarsConfig} */
const sidebars = {
  docsSidebar: [
    {
      type: 'doc',
      id: 'intro',
      label: 'Introduction',
    },
    {
      type: 'category',
      label: 'Getting Started',
      collapsed: false,
      items: [
        'getting-started/quickstart',
        'getting-started/first-chain',
      ],
    },
    {
      type: 'category',
      label: 'Concepts',
      items: [
        'concepts/measurements',
      ],
    },
    {
      type: 'category',
      label: 'API Reference',
      items: [
        'api/core',
      ],
    },
    {
      type: 'category',
      label: 'Extensions',
      collapsed: false,
      items: [
        'extensions/overview',
        'extensions/creating-extensions',
      ],
    },
  ],
};

module.exports = sidebars;