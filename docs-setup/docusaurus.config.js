// @ts-check
const {themes} = require('prism-react-renderer');
const lightCodeTheme = themes.github;
const darkCodeTheme = themes.dracula;

/** @type {import('@docusaurus/types').Config} */
const config = {
  title: 'Olocus Protocol',
  tagline: 'Distributed trust infrastructure where humans, AI agents and machines collaborate securely',
  favicon: '/images/fav.ico',
  
  url: 'https://olocus.com',
  baseUrl: '/docs/',
  
  organizationName: 'olocus',
  projectName: 'protocol',
  
  onBrokenLinks: 'warn',
  onBrokenMarkdownLinks: 'warn',
  
  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  markdown: {
    mermaid: true,
  },
  
  themes: ['@docusaurus/theme-mermaid'],

  presets: [
    [
      'classic',
      /** @type {import('@docusaurus/preset-classic').Options} */
      ({
        docs: {
          routeBasePath: '/',
          sidebarPath: require.resolve('./sidebars.js'),
          editUrl: 'https://codeberg.org/olocus/protocol/edit/main/',
          showLastUpdateTime: true,
          showLastUpdateAuthor: false,
        },
        theme: {
          customCss: require.resolve('./src/css/custom.css'),
        },
        sitemap: {
          changefreq: 'weekly',
          priority: 0.5,
          ignorePatterns: ['/tags/**'],
          filename: 'sitemap.xml',
        },
      }),
    ],
  ],

  themeConfig:
    /** @type {import('@docusaurus/preset-classic').ThemeConfig} */
    ({
      image: '/images/olocus-og-image.png',
      navbar: {
        title: 'Olocus Protocol',
        logo: {
          alt: 'Olocus Logo',
          src: '/images/fav.ico',
          height: 32,
          width: 32,
        },
        items: [
          {
            type: 'doc',
            docId: 'intro',
            position: 'left',
            label: 'Documentation',
          },
          {
            href: 'https://olocus.com',
            label: 'Home',
            position: 'right',
          },
          {
            href: 'https://codeberg.org/olocus/protocol',
            label: 'Codeberg',
            position: 'right',
          },
        ],
      },
      footer: {
        style: 'dark',
        links: [
          {
            title: 'Docs',
            items: [
              {
                label: 'Introduction',
                to: '/',
              },
              {
                label: 'Getting Started',
                to: '/getting-started/quickstart',
              },
            ],
          },
          {
            title: 'Extensions',
            items: [
              {
                label: 'Extensions Overview',
                to: '/extensions/overview',
              },
            ],
          },
          {
            title: 'Community',
            items: [
              {
                label: 'Forum',
                href: 'https://codeberg.org/olocus/forum/issues',
              },
              {
                label: 'Codeberg',
                href: 'https://codeberg.org/olocus/protocol',
              },
            ],
          },
          {
            title: 'More',
            items: [
              {
                label: 'Terms',
                href: 'https://olocus.com/terms',
              },
              {
                label: 'Privacy',
                href: 'https://olocus.com/privacy.html',
              },
            ],
          },
        ],
        copyright: `Copyright © ${new Date().getFullYear()} Olocus.`,
      },
      prism: {
        theme: lightCodeTheme,
        darkTheme: darkCodeTheme,
        additionalLanguages: ['rust', 'toml', 'bash'],
      },
      algolia: {
        // Will be set up after initial deployment
        appId: 'YOUR_APP_ID',
        apiKey: 'YOUR_API_KEY',
        indexName: 'olocus',
        contextualSearch: true,
      },
      colorMode: {
        defaultMode: 'light',
        disableSwitch: false,
        respectPrefersColorScheme: true,
      },
    }),
};

module.exports = config;