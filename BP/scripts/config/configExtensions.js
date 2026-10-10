// @ts-check
// configExtensions.js - 配置界面的「可选模块扩展点」
//
// 背景：本项目有一些**可选功能**模块（例如 integration/voiceCraft.js），它们只有在
// 玩家额外装配了对应的第三方附加包时才有意义。这些模块希望把自己的配置页挂进
// 主配置菜单，但配置界面不应该反过来 import 它们——否则删掉那个模块就会连带
// 弄坏配置界面（静态 import 无法 try/catch）。
//
// 所以这里放一个**零依赖**的注册表，方向是反的：
//   · 可选模块在自己的文件顶层调用 registerConfigEntry(...) 注册入口；
//   · configUI.js 只从这个文件读列表，完全不认识任何具体模块。
// 结果：没装配（或删掉）该模块时，按钮自动消失，配置界面与其它功能零影响。
//
// 本文件不得 import 任何项目模块，也不得读写世界数据（保持零副作用）。

/**
 * @typedef {object} ConfigExtension
 * @property {string} id 唯一标识（重复注册以先到者为准）
 * @property {import("@minecraft/server").RawMessage | string} label 菜单按钮上的文字
 * @property {(player: import("@minecraft/server").Player, back?: (player: import("@minecraft/server").Player) => void) => void} open
 *           点击后打开的表单。第二个参数 `back` 由配置界面传入，用于把玩家送回主界面
 *           （与内置页「游戏相关配置」保存/取消后返回上级的行为一致）；忽略它也没问题。
 * @property {() => boolean} [isVisible] 返回假时本次**不显示**该按钮（缺省 = 显示）
 */

/** @type {ConfigExtension[]} */
const entries = [];

/**
 * 注册一个配置界面入口（在模块顶层调用即可）。
 * @param {ConfigExtension} entry
 * @returns {boolean} 是否注册成功（参数不合法或 id 重复时返回 false）
 */
export function registerConfigEntry(entry) {
    if (!entry || !entry.id || !entry.label || typeof entry.open !== "function") return false;
    if (entries.some((e) => e.id === entry.id)) return false;
    entries.push(entry);
    return true;
}

/**
 * 取当前应当显示的入口列表（会逐个调用 isVisible；回调抛错视为不显示）。
 * @param {import("@minecraft/server").Player} [player]
 * @returns {ConfigExtension[]}
 */
export function getConfigEntries(player) {
    return entries.filter((entry) => {
        if (typeof entry.isVisible !== "function") return true;
        try {
            return entry.isVisible() === true;
        } catch {
            return false;
        }
    });
}
