// @ts-check
// i18n.js - 多语言文案工具
// 所有面向玩家的文案统一通过 RawMessage.translate 输出，
// 由客户端按玩家各自的语言设置在对应 .lang 文件中解析。

/**
 * 构造可翻译文案。
 * @param {string} key 语言文件中的键名
 * @param {...(string|number|import("@minecraft/server").RawMessage)} args 占位符参数；对象参数按嵌套翻译处理
 * @returns {import("@minecraft/server").RawMessage}
 */
export function t(key, ...args) {
    if (args.length === 0) return { translate: key };
    return {
        translate: key,
        with: {
            rawtext: args.map(a => (typeof a === "object" && a !== null)
                ? /** @type {import("@minecraft/server").RawMessage} */ (a)
                : { text: String(a) })
        }
    };
}

/**
 * 物品自身译名。
 * 自定义物品的键为 item.<完整标识符>，原版物品的键为 item.<名称>.name；
 * 刷怪蛋的物品 ID 为 <命名空间>:<实体名>_spawn_egg，译名键遵循原版约定
 * item.spawn_egg.entity.<实体标识符>.name（原版实体不带命名空间）。
 * @param {string} id
 * @returns {import("@minecraft/server").RawMessage}
 */
export function tItem(id) {
    if (id.endsWith("_spawn_egg")) {
        const entityId = id.slice(0, -10);
        const short = entityId.startsWith("minecraft:") ? entityId.slice(10) : entityId;
        return { translate: `item.spawn_egg.entity.${short}.name` };
    }
    if (id.startsWith("minecraft:")) return { translate: `item.${id.slice(10)}.name` };
    return { translate: `item.${id}` };
}

/**
 * 方块自身译名
 * @param {string} id
 * @returns {import("@minecraft/server").RawMessage}
 */
export function tBlock(id) {
    return { translate: `tile.${id}.name` };
}

/**
 * 实体自身译名
 * @param {string} id
 * @returns {import("@minecraft/server").RawMessage}
 */
export function tEntity(id) {
    return { translate: `entity.${id}.name` };
}

/**
 * 商店配置项的显示名：填写了自定义名则用原文，否则回退到物品自身译名
 * @param {{ id: string, displayName?: string }} item
 * @returns {import("@minecraft/server").RawMessage}
 */
export function tConfigName(item) {
    return item.displayName ? { text: String(item.displayName) } : tItem(item.id);
}