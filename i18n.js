/**
 * i18n.js - 国际化（i18n）支持模块
 *
 * 架构说明：
 *  - t('key') 获取当前语言的翻译文本，支持模板变量 t('key', {var: val})
 *  - tElem(key) / tMob(key) 分别翻译 Element 和 MobName 的显示文本
 *    （代码内部值 Chemical / Brutes 等保持不变，只翻译 UI 显示层）
 *  - setLanguage(lang) 切换语言，刷新所有 data-i18n 元素
 *  - 语言包独立存放在 locales/ 目录下，支持懒加载
 */

// ─── 语言包缓存 ───────────────────────────────────────────────
const localeCache = {};

// ─── 当前语言 ──────────────────────────────────────────────
let currentLang = localStorage.getItem('so_lang') || 'zh';

/**
 * 动态加载语言包
 * @param {string} lang - 语言代码 'zh' | 'en'
 * @returns {Promise<Object>} 语言包对象
 */
async function loadLocale(lang) {
    if (localeCache[lang]) {
        return localeCache[lang];
    }
    
    try {
        const module = await import(`./locales/${lang}.js`);
        localeCache[lang] = module.default || module;
        return localeCache[lang];
    } catch (err) {
        console.error(`Failed to load locale: ${lang}`, err);
        // 回退到中文
        if (lang !== 'zh') {
            return loadLocale('zh');
        }
        throw err;
    }
}

/**
 * 翻译函数：t('key') 或 t('key', {var: val})
 */
async function t(key, vars) {
    const dict = await loadLocale(currentLang);
    let str = dict[key];
    if (str === undefined) {
        // 回退到中文
        const zhDict = await loadLocale('zh');
        str = zhDict[key];
    }
    if (str === undefined) {
        return key; // 找不到则返回 key 本身
    }
    if (vars) {
        str = str.replace(/\{(\w+)\}/g, (_, k) => (vars[k] !== undefined ? vars[k] : `{${k}}`));
    }
    return str;
}

/**
 * 同步翻译函数（用于已缓存的语言包）：tSync('key') 或 tSync('key', {var: val})
 * 注意：首次使用某语言前需确保已调用 await loadLocale(lang)
 */
function tSync(key, vars) {
    const dict = localeCache[currentLang] || localeCache['zh'] || {};
    let str = dict[key];
    if (str === undefined) {
        // 回退到中文
        const zhDict = localeCache['zh'] || {};
        str = zhDict[key];
    }
    if (str === undefined) {
        return key;
    }
    if (vars) {
        str = str.replace(/\{(\w+)\}/g, (_, k) => (vars[k] !== undefined ? vars[k] : `{${k}}`));
    }
    return str;
}

/**
 * 翻译 Element 显示文本（代码值 Chemical → 化学）
 * @param {string} elementValue - Element enum 的值，如 "Chemical"
 */
function tElem(elementValue) {
    if (!elementValue) return tSync('ele.none');
    return tSync(`ele.${elementValue}`) || elementValue;
}

/**
 * 翻译 MobName 显示文本（代码值 Brutes → 蛮兵）
 * @param {string} mobValue - MobName enum 的值，如 "Brutes"
 */
function tMob(mobValue) {
    if (!mobValue) return mobValue;
    return tSync(`mob.${mobValue}`) || mobValue;
}

/**
 * 切换语言并刷新页面所有带 data-i18n 属性的元素
 * @param {string} lang - 'zh' | 'en'
 */
async function setLanguage(lang) {
    // 预加载语言包
    await loadLocale(lang);
    currentLang = lang;
    localStorage.setItem('so_lang', lang);
    applyTranslations();
}

/**
 * 获取当前语言
 */
function getLanguage() {
    return currentLang;
}

/**
 * 将翻译应用到 DOM 中所有带 data-i18n 属性的元素
 * data-i18n="key"           → textContent
 * data-i18n-title="key"     → title 属性
 * data-i18n-placeholder="key" → placeholder 属性
 */
function applyTranslations() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        el.textContent = tSync(key);
    });
    document.querySelectorAll('[data-i18n-title]').forEach(el => {
        const key = el.getAttribute('data-i18n-title');
        el.title = tSync(key);
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const key = el.getAttribute('data-i18n-placeholder');
        el.placeholder = tSync(key);
    });
}

/**
 * 初始化 i18n 模块，预加载当前语言包
 */
async function initI18n() {
    await loadLocale(currentLang);
}

// 导出 API
export { t, tSync, tElem, tMob, setLanguage, getLanguage, applyTranslations, loadLocale, initI18n };

// 为兼容旧代码，暴露到 window._t
if (typeof window !== 'undefined') {
    window._t = tSync;
    window._tElem = tElem;
    window._tMob = tMob;
}
