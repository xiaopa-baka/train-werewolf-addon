// @ts-check
// containerLock.js - 局内禁止与"可存储物品的容器"交互
// 仅限制对局中（isInGame）的玩家；局外可正常使用容器（配置 / 测试不受影响）
// 静默拦截，不给提示文案

import * as mc from "@minecraft/server";
import { isInGame } from "../core/state.js";


// 可存储物品的容器方块（含全部氧化态 / 染色变体 / 点燃状态）
const CONTAINER_BLOCKS = new Set([
    // 箱子族
    "minecraft:chest",
    "minecraft:trapped_chest",
    "minecraft:ender_chest",
    "minecraft:copper_chest",
    "minecraft:exposed_copper_chest",
    "minecraft:weathered_copper_chest",
    "minecraft:oxidized_copper_chest",
    "minecraft:waxed_copper_chest",
    "minecraft:waxed_exposed_copper_chest",
    "minecraft:waxed_weathered_copper_chest",
    "minecraft:waxed_oxidized_copper_chest",
    // 木桶
    "minecraft:barrel",
    // 潜影盒（原色 + 16 种染色）
    "minecraft:undyed_shulker_box",
    "minecraft:white_shulker_box",
    "minecraft:orange_shulker_box",
    "minecraft:magenta_shulker_box",
    "minecraft:light_blue_shulker_box",
    "minecraft:yellow_shulker_box",
    "minecraft:lime_shulker_box",
    "minecraft:pink_shulker_box",
    "minecraft:gray_shulker_box",
    "minecraft:light_gray_shulker_box",
    "minecraft:cyan_shulker_box",
    "minecraft:purple_shulker_box",
    "minecraft:blue_shulker_box",
    "minecraft:brown_shulker_box",
    "minecraft:green_shulker_box",
    "minecraft:red_shulker_box",
    "minecraft:black_shulker_box",
    // 熔炉族（含点燃状态）
    "minecraft:furnace",
    "minecraft:lit_furnace",
    "minecraft:blast_furnace",
    "minecraft:lit_blast_furnace",
    "minecraft:smoker",
    "minecraft:lit_smoker",
    // 运输与加工
    "minecraft:hopper",
    "minecraft:dropper",
    "minecraft:dispenser",
    "minecraft:crafter",
    // 陶罐
    "minecraft:decorated_pot",
    // 展示架（各木质变体）
    "minecraft:oak_shelf",
    "minecraft:spruce_shelf",
    "minecraft:birch_shelf",
    "minecraft:jungle_shelf",
    "minecraft:acacia_shelf",
    "minecraft:dark_oak_shelf",
    "minecraft:mangrove_shelf",
    "minecraft:cherry_shelf",
    "minecraft:pale_oak_shelf",
    "minecraft:bamboo_shelf",
    "minecraft:crimson_shelf",
    "minecraft:warped_shelf",
    "minecraft:poplar_shelf",
    // 物品展示框
    "minecraft:frame",
    "minecraft:glow_frame",
]);


// 物品展示框在当前版本中是方块（见上方 CONTAINER_BLOCKS），此处保留实体分支作为兜底，
// 兼容以实体形式实现物品展示框的版本。
const CONTAINER_ENTITIES = new Set([
    "minecraft:item_frame",
    "minecraft:glow_item_frame",
]);


// 拦截对局中的容器方块交互
mc.world.beforeEvents.playerInteractWithBlock.subscribe(event => {
    const player = event.player;
    if (!player || !player.isValid) return;
    if (!CONTAINER_BLOCKS.has(event.block?.typeId)) return;
    if (!isInGame(player)) return;
    event.cancel = true;
});


// 拦截对局中的容器实体交互
mc.world.beforeEvents.playerInteractWithEntity.subscribe(event => {
    const player = event.player;
    if (!player || !player.isValid) return;
    if (!CONTAINER_ENTITIES.has(event.target?.typeId)) return;
    if (!isInGame(player)) return;
    event.cancel = true;
});
