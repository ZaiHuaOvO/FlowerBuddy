import { defineConfig } from 'vitepress'

const repository = 'https://github.com/ZaiHuaOvO/FlowerBuddy'
const releases = `${repository}/releases/latest`

export default defineConfig({
  base: '/FlowerBuddy/',
  lang: 'zh-CN',
  title: '花伴',
  description: '花伴 — Windows 桌面宠物与个人信息助手',
  head: [
    ['link', { rel: 'icon', type: 'image/png', href: '/FlowerBuddy/app-icon.png' }],
    ['meta', { name: 'theme-color', content: '#8b5a2b' }]
  ],
  lastUpdated: true,
  themeConfig: {
    logo: '/app-icon.png',
    siteTitle: '花伴',
    nav: [
      { text: '首页', link: '/' },
      { text: '使用指南', link: '/guide/' },
      { text: '常见问题', link: '/guide/faq' },
      { text: '更新日志', link: '/guide/changelog' },
      { text: '下载', link: releases },
      { text: 'GitHub', link: repository }
    ],
    sidebar: {
      '/guide/': [
        {
          text: '开始使用',
          items: [
            { text: '简介', link: '/guide/' },
            { text: '安装与升级', link: '/guide/install' },
            { text: '功能', link: '/guide/features' },
            { text: '使用指南', link: '/guide/usage' }
          ]
        },
        {
          text: '帮助与说明',
          items: [
            { text: '常见问题', link: '/guide/faq' },
            { text: '隐私', link: '/guide/privacy' },
            { text: '安全与已知限制', link: '/guide/security' },
            { text: '更新日志', link: '/guide/changelog' }
          ]
        }
      ]
    },
    socialLinks: [{ icon: 'github', link: repository }],
    footer: {
      message: '源代码采用 MIT 许可证；美术素材保留所有权利。',
      copyright: 'Copyright © 2026 花伴 / ZFFFlower'
    },
    outline: { label: '本页目录', level: [2, 3] },
    docFooter: { prev: '上一页', next: '下一页' },
    lastUpdated: { text: '最后更新' },
    darkModeSwitchLabel: '外观',
    lightModeSwitchTitle: '切换到浅色模式',
    darkModeSwitchTitle: '切换到深色模式',
    sidebarMenuLabel: '菜单',
    returnToTopLabel: '回到顶部',
    search: {
      provider: 'local',
      options: {
        translations: {
          button: { buttonText: '搜索', buttonAriaLabel: '搜索' },
          modal: {
            noResultsText: '没有找到结果',
            resetButtonTitle: '清除查询',
            footer: {
              selectText: '选择',
              navigateText: '切换',
              closeText: '关闭'
            }
          }
        }
      }
    }
  }
})
