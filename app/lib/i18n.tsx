import { createContext, useContext, useState, type ReactNode } from "react";

// 支持的语言类型
export type Lang = "zh" | "en";

// 翻译键值对
interface Translations {
  [key: string]: string;
}

// 翻译资源
const resources: Record<Lang, Translations> = {
  zh: {
    // 通用
    "app.subtitle": "ZHU LE",
    
    // 导航
    "nav.home": "首页",
    "nav.download": "下载",
    "nav.game": "游戏",
    "nav.ip": "IP 查询",
    "nav.imageHost": "图床",
    "nav.rules": "公告",
    "nav.more": "更多",
    "nav.settings": "设置",
    "nav.menu": "菜单",
    "nav.switchToLight": "切换到白天模式",
    "nav.switchToDark": "切换到夜间模式",
    
    // 设置页面
    "settings.title": "设置",
    "settings.language": "语言",
    
    // 下载页面
    "download.title": "下载",
    "download.downloadBtn": "下载",
    "download.empty": "暂无文件",
    
    // 图床页面
    "imageHost.title": "图床",
    "imageHost.copyLink": "链接",
    "imageHost.copied": "完成",
    "imageHost.empty": "暂无图片",
    
    // 占位页
    "placeholder.developing": "功能开发中，敬请期待",
    
    // 游戏页面
    "game.title": "游戏",
    "game.score": "分数",
    "game.restart": "重新开始",
    "game.over": "游戏结束！",
    "game.won": "你赢了！",
    "game.controls": "方向键 / WASD / 滑动",
    
    // IP 查询页面
    "ip.title": "IP 查询",
    "ip.myIp": "我的 IP",
    "ip.loading": "正在获取…",
    "ip.loadFailed": "获取失败",
    "ip.none": "无",
    
    // 更多页面
    "more.title": "更多",
    
    // 公告页面
    "rules.title": "公告",
    "rules.empty": "暂无公告",
    
    // 管理后台
    "admin.login": "登录",
    "admin.logout": "登出",
    "admin.username": "账号",
    "admin.password": "密码",
    "admin.loginError": "账号或密码错误",
    "admin.networkError": "网络错误",
    "admin.fetchError": "获取公告失败",
    "admin.createError": "创建公告失败",
    "admin.editError": "编辑公告失败",
    "admin.deleteError": "删除公告失败",
    "admin.deleteConfirm": "确定要删除这条公告吗？",
    "admin.subtitle": "管理公告与内容",
    "admin.create": "创建公告",
    "admin.edit": "编辑",
    "admin.delete": "删除",
    "admin.important": "重要",
    "admin.empty": "暂无公告",
    "admin.form.title": "标题",
    "admin.form.content": "内容",
    "admin.form.important": "标记为重要",
    "admin.form.cancel": "取消",
    "admin.form.save": "保存",
    "admin.form.create": "创建",
    
    // 联系方式
    "contact.qqGroup": "QQ 群",
    "contact.email": "邮箱",
  },
  en: {
    // General
    "app.subtitle": "ZHU LE",
    
    // Navigation
    "nav.home": "Home",
    "nav.download": "Download",
    "nav.game": "Game",
    "nav.ip": "IP Lookup",
    "nav.imageHost": "Image Host",
    "nav.rules": "Rules",
    "nav.more": "More",
    "nav.settings": "Settings",
    "nav.menu": "Menu",
    "nav.switchToLight": "Switch to light mode",
    "nav.switchToDark": "Switch to dark mode",
    
    // Navigation
    "nav.home": "Home",
    "nav.download": "Download",
    "nav.game": "Game",
    "nav.ip": "IP Lookup",
    "nav.imageHost": "Image Host",
    "nav.rules": "Rules",
    "nav.more": "More",
    "nav.settings": "Settings",
    "nav.menu": "Menu",
    "nav.switchToLight": "Switch to light mode",
    "nav.switchToDark": "Switch to dark mode",
    
    // Settings page
    "settings.title": "Settings",
    "settings.language": "Language",
    
    // Download page
    "download.title": "Download",
    "download.downloadBtn": "Download",
    "download.empty": "No files yet",
    
    // Placeholder page
    "placeholder.developing": "Coming soon",
    
    // Game page
    "game.title": "Game",
    "game.score": "Score",
    "game.restart": "Restart",
    "game.over": "Game Over!",
    "game.won": "You Win!",
    "game.controls": "Arrow keys / WASD / Swipe",
    
    // IP lookup page
    "ip.title": "IP Lookup",
    "ip.myIp": "My IP",
    "ip.loading": "Loading…",
    "ip.loadFailed": "Load failed",
    "ip.none": "None",
    
    // Image host page
    "imageHost.title": "Image Host",
    "imageHost.copyLink": "Link",
    "imageHost.copied": "Done",
    "imageHost.empty": "No images yet",
    
    // More page
    "more.title": "More",
    
    // Rules page
    "rules.title": "Rules",
    "rules.empty": "No rules yet",
    
    // Admin
    "admin.login": "Login",
    "admin.logout": "Logout",
    "admin.username": "Username",
    "admin.password": "Password",
    "admin.loginError": "Invalid username or password",
    "admin.networkError": "Network error",
    "admin.fetchError": "Failed to fetch announcements",
    "admin.createError": "Failed to create announcement",
    "admin.editError": "Failed to edit announcement",
    "admin.deleteError": "Failed to delete announcement",
    "admin.deleteConfirm": "Are you sure you want to delete this announcement?",
    "admin.subtitle": "Manage rules and content",
    "admin.create": "Create Rule",
    "admin.edit": "Edit",
    "admin.delete": "Delete",
    "admin.important": "Important",
    "admin.empty": "No rules yet",
    "admin.form.title": "Title",
    "admin.form.content": "Content",
    "admin.form.important": "Mark as important",
    "admin.form.cancel": "Cancel",
    "admin.form.save": "Save",
    "admin.form.create": "Create",
    
    // Contact
    "contact.qqGroup": "QQ Group",
    "contact.email": "Email",
  },
};

// i18n 上下文
interface I18nContextType {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: string) => string;
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

// i18n Provider
export function I18nProvider({ children }: { children: ReactNode }) {
  // 同步读取 localStorage，避免刷新时中文闪烁
  const [lang, setLangState] = useState<Lang>(() => {
    try {
      const stored = localStorage.getItem("lang");
      if (stored === "en") return "en";
    } catch {}
    return "zh";
  });

  // 设置语言
  const setLang = (newLang: Lang) => {
    setLangState(newLang);
    try {
      localStorage.setItem("lang", newLang);
    } catch {
      // 浏览器禁用存储时忽略
    }
    document.documentElement.lang = newLang === "zh" ? "zh-CN" : "en";
  };

  // 翻译函数
  const t = (key: string): string => {
    return resources[lang][key] || key;
  };

  return (
    <I18nContext.Provider value={{ lang, setLang, t }}>
      {children}
    </I18nContext.Provider>
  );
}

// 使用 i18n 的钩子
export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useI18n must be used within an I18nProvider");
  }
  return context;
}