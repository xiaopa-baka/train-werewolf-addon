// @ts-check
// itemIcons.js - 物品图标映射与贴图路径解析


// 物品ID转贴图路径；支持两类输入：
// 1. 完整贴图路径（含任意层级子目录，如 "textures/items/饮品/champagne"）-> 直接原样返回
// 2. 物品ID（如 "minecraft:cooked_beef" / "lw_p1:pistol"）-> 查询特判映射，查不到则用 textures/items/ 下同名
// 若添加新的特殊物品，直接在 ITEM_ICON_MAP 追加一行即可
const ITEM_ICON_MAP = {
    cooked_beef: "beef_cooked",
    cooked_salmon: "fish_salmon_cooked",
    cooked_porkchop: "porkchop_cooked",
    cooked_chicken: "chicken_cooked",
    cooked_mutton: "mutton_cooked",
    cooked_rabbit: "rabbit_cooked",
    cooked_cod: "cod_cooked",
    baked_potato: "potato_baked",
    poisonous_potato: "potato_poisonous",
    golden_apple: "apple_golden",
    enchanted_golden_apple: "apple_golden",
    golden_carrot: "carrot_golden",
    melon_slice: "melon",
    // 刷怪蛋没有自己的物品贴图（外观由客户端实体定义的 spawn_egg 配色生成），复用其对应实体的图标
    firecracker_spawn_egg: "firecracker",
};

export function itemIdToIconPath(itemId) {
    const rawName = itemId.includes(":") ? itemId.split(":")[1] : itemId;

    // 输入本身是完整路径（含路径分隔符，非纯物品名）则直接返回，支持任意子目录
    if (rawName.includes("/")) return itemId;

    // 命中特判映射则用之，否则用 textures/items/ 下同名贴图
    return `textures/items/${ITEM_ICON_MAP[rawName] ?? rawName}`;
}