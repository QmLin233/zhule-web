import { createContext, useContext, useState, useEffect, type ReactNode } from "react";

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
    "app.title": "逐乐",
    "app.description": "逐乐 ZHU LE",
    "app.subtitle": "ZHU LE",
    
    // 导航
    "nav.home": "首页",
    "nav.download": "下载",
    "nav.game": "游戏",
    "nav.ip": "IP 查询",
    "nav.imageHost": "图床",
    "nav.more": "更多",
    "nav.settings": "设置",
    "nav.menu": "菜单",
    "nav.switchToLight": "切换到白天模式",
    "nav.switchToDark": "切换到夜间模式",
    
    // 设置页面
    "settings.title": "设置",
    "settings.language": "语言",
    "settings.theme": "主题",
    "settings.theme.light": "浅色",
    "settings.theme.dark": "深色",
    "settings.theme.system": "跟随系统",
    
    // 下载页面
    "download.title": "下载",
    "download.downloadBtn": "下载",
    
    // 占位页
    "placeholder.developing": "功能开发中，敬请期待",
    
    // 游戏页面
    "game.title": "游戏",
    "game.score": "分数",
    "game.best": "最高分",
    "game.restart": "重新开始",
    "game.over": "游戏结束！",
    "game.won": "你赢了！",
    "game.continue": "继续游戏",
    "game.controls": "方向键 / WASD / 滑动",
    
    // IP 查询页面
    "ip.title": "IP 查询",
    "ip.myIp": "我的 IP",
    "ip.loading": "正在获取…",
    "ip.loadFailed": "获取失败",
    "ip.location": "位置",
    "ip.isp": "运营商",
    "ip.asn": "ASN",
    
    // 图床页面
    "imageHost.title": "图床",
    "imageHost.copyLink": "链接",
    "imageHost.copied": "完成",
    
    // 更多页面
    "more.title": "更多",
    
    // 联系方式
    "contact.qqGroup": "QQ 群",
    "contact.email": "邮箱",
  },
  en: {
    // General
    "app.title": "Zhu Le",
    "app.description": "ZHU LE",
    "app.subtitle": "ZHU LE",
    
    // Navigation
    "nav.home": "Home",
    "nav.download": "Download",
    "nav.game": "Game",
    "nav.ip": "IP Lookup",
    "nav.imageHost": "Image Host",
    "nav.more": "More",
    "nav.settings": "Settings",
    "nav.menu": "Menu",
    "nav.switchToLight": "Switch to light mode",
    "nav.switchToDark": "Switch to dark mode",
    
    // Settings page
    "settings.title": "Settings",
    "settings.language": "Language",
    "settings.theme": "Theme",
    "settings.theme.light": "Light",
    "settings.theme.dark": "Dark",
    "settings.theme.system": "System",
    
    // Download page
    "download.title": "Download",
    "download.downloadBtn": "Download",
    
    // Placeholder page
    "placeholder.developing": "Coming soon",
    
    // Game page
    "game.title": "Game",
    "game.score": "Score",
    "game.best": "Best",
    "game.restart": "Restart",
    "game.over": "Game Over!",
    "game.won": "You Win!",
    "game.continue": "Continue",
    "game.controls": "Arrow keys / WASD / Swipe",
    
    // IP lookup page
    "ip.title": "IP Lookup",
    "ip.myIp": "My IP",
    "ip.loading": "Loading…",
    "ip.loadFailed": "Load failed",
    "ip.location": "Location",
    "ip.isp": "ISP",
    "ip.asn": "ASN",
    
    // Image host page
    "imageHost.title": "Image Host",
    "imageHost.copyLink": "Link",
    "imageHost.copied": "Done",
    
    // More page
    "more.title": "More",
    
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
  const [lang, setLangState] = useState<Lang>("zh");

  // 初始化语言
  useEffect(() => {
    let stored: string | null = null;
    try {
      stored = localStorage.getItem("lang");
    } catch {
      // 浏览器禁用存储时忽略
    }
    if (stored === "zh" || stored === "en") {
      setLangState(stored);
    }
  }, []);

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