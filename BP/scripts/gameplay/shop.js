// @ts-check
// shop.js - 商店系统（含贩卖机多方块逻辑）

import * as mc from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";
import { getWorldConfig, getConfig } from "../config/worldConfig.js";
import { itemIdToIconPath } from "../core/itemIcons.js";
import { getGold, addGold, isInGame, isKiller } from "../core/state.js";
import { t, tConfigName } from "../core/i18n.js";


// 使用物品 lw_p1:killer_store 打开杀手商店界面
mc.world.afterEvents.worldLoad.subscribe(() => {
    mc.world.afterEvents.itemUse.subscribe(event => {
        const player = event.source;
        if (player && player.isValid && event.itemStack?.typeId === "lw_p1:killer_store") {
            openkillerStore(player);
        }
    });
});


// 点击方块 lw_p1:vending_machine 打开贩卖机界面
const vendingUiLock = new Set();

// 贩卖机交互核心逻辑
function handleVendingMachineInteract(player, block) {
    if (!player?.isValid || !block) return;
    if (block.typeId !== "lw_p1:vending_machine") return;
    if (vendingUiLock.has(player.id)) return;
    vendingUiLock.add(player.id);
    mc.system.run(() => {
        openVendingMachine(player);
    });
}

mc.world.beforeEvents.playerInteractWithBlock.subscribe(event => {
    const player = event.player;
    if (!player || !player.isValid) return;
    if (event.block?.typeId === "lw_p1:vending_machine") {
        event.cancel = true;
        handleVendingMachineInteract(player, event.block);
    }
});


// 获取玩家金币（经统一访问器）
function getGoldScore(player) {
    return getGold(player);
}


// 扣除玩家金币（经统一访问器）
function deductGold(player, amount) {
    if (getGold(player) < amount) return false;
    try {
        addGold(player, -amount);
        return true;
    } catch (e) {
        return false;
    }
}


// 给玩家添加物品
function giveItem(player, itemId) {
    try {
        const item = new mc.ItemStack(itemId, 1);
        const container = player.getComponent("inventory").container;
        const res = container.addItem(item);
        if (res === undefined || res === null) {
            return true;
        }
        if (Array.isArray(res)) {
            return res.length === 0;
        }
        return false;
    } catch (e) {
        return false;
    }
}


// 防止玩家重复提交购买请求
const purchaseLock = new Set();


// 游戏开始后每 10 秒按角色发放自然金币
const goldAccumulator = new Map();
mc.system.runInterval(() => {
    const killerRate = getConfig("killerGoldRate");
    const civilRate = getConfig("civilGoldRate");

    const players = mc.world.getPlayers();
    for (const player of players) {
        if (!player.isValid) continue;
        if (!isInGame(player)) {
            goldAccumulator.delete(player.id);
            continue;
        }

        const acc = (goldAccumulator.get(player.id) ?? 0) + 1;
        goldAccumulator.set(player.id, acc);
        if (acc < 200) continue; // 累计 200 tick = 10 秒发放一次

        goldAccumulator.set(player.id, 0);
        const rate = isKiller(player) ? killerRate : civilRate;
        if (rate > 0) {
            addGold(player, rate);
        }
    }
}, 1);


// 杀手商店界面
function openkillerStore(player) {
    const config = getWorldConfig();
    const currentGold = getGoldScore(player);
    const form = new ActionFormData();
    const items = Array.isArray(config.killerStoreItems) ? config.killerStoreItems : [];

    form.title(t("lw_p1.shop.title.killer"));
    form.header(t("lw_p1.shop.gold", currentGold));

    items.forEach(item => {
        const icon = itemIdToIconPath(item.id);
        form.button(t("lw_p1.shop.button", tConfigName(item), item.price), icon);
    });
    form.button(t("lw_p1.shop.close"));

    form.show(player).then(res => {
        if (res.canceled) return;
        if (purchaseLock.has(player.name)) { player.sendMessage(t("lw_p1.shop.busy")); return; }
        purchaseLock.add(player.name);
        if (res.selection === undefined || res.selection < 0 || res.selection >= items.length) { purchaseLock.delete(player.name); return; }
        const target = items[res.selection];
        if (!target) { purchaseLock.delete(player.name); return; }

        if (getGoldScore(player) < target.price) {
            player.sendMessage(t("lw_p1.shop.notEnough"));
            purchaseLock.delete(player.name);
            return;
        }

        if (!deductGold(player, target.price)) {
            player.sendMessage(t("lw_p1.shop.fail"));
            purchaseLock.delete(player.name);
            return;
        }
        if (giveItem(player, target.id)) {
            player.sendMessage(t("lw_p1.shop.success", tConfigName(target)));
            purchaseLock.delete(player.name);
        } else {
            try {
                addGold(player, target.price);
                player.sendMessage(t("lw_p1.shop.invFull"));
            } catch (e) { }
            purchaseLock.delete(player.name);
        }
    });
}


// 贩卖机界面
function openVendingMachine(player) {
    const config = getWorldConfig();
    const currentGold = getGoldScore(player);
    const form = new ActionFormData();
    let items = Array.isArray(config.vendingMachineItems) ? config.vendingMachineItems : [];

    // 杀手打开贩卖机时，不显示左轮手枪
    if (isKiller(player)) {
        items = items.filter(item => item.id !== "lw_p1:pistol");
    }

    form.title(t("lw_p1.shop.title.vending"));
    form.header(t("lw_p1.shop.gold", currentGold));

    items.forEach(item => {
        const icon = itemIdToIconPath(item.id);
        form.button(t("lw_p1.shop.button", tConfigName(item), item.price), icon);
    });
    form.button(t("lw_p1.shop.close"));

    form.show(player).then(res => {
        vendingUiLock.delete(player.id);
        if (res.canceled) return;
        if (purchaseLock.has(player.name)) { player.sendMessage(t("lw_p1.shop.busy")); return; }
        purchaseLock.add(player.name);
        if (res.selection === undefined || res.selection < 0 || res.selection >= items.length) { purchaseLock.delete(player.name); return; }
        const target = items[res.selection];
        if (!target) { purchaseLock.delete(player.name); return; }

        if (getGoldScore(player) < target.price) {
            player.sendMessage(t("lw_p1.shop.notEnough"));
            purchaseLock.delete(player.name);
            return;
        }

        if (!deductGold(player, target.price)) {
            player.sendMessage(t("lw_p1.shop.fail"));
            purchaseLock.delete(player.name);
            return;
        }
        if (giveItem(player, target.id)) {
            player.sendMessage(t("lw_p1.shop.success", tConfigName(target)));
            purchaseLock.delete(player.name);
        } else {
            try {
                addGold(player, target.price);
                player.sendMessage(t("lw_p1.shop.invFull"));
            } catch (e) { }
            purchaseLock.delete(player.name);
        }
    });
}


// ===== 自动贩卖机（多方块放置 / 破坏 / 联动） =====

const VENDING_ID = "lw_p1:vending_machine";
/** @type {any} */
const S_CARDINAL = "minecraft:cardinal_direction";
/** @type {any} */
const S_PART = "lw_p1:part";


function isVending(block) {
    return !!block && block.typeId === VENDING_ID;
}

// 贩卖机的另一半
function halfMachine(block) {
    const up = block.above();
    const down = block.below();
    if (up && isVending(up) && up.permutation.getState(S_PART) === "upper") return up;
    if (down && isVending(down) && down.permutation.getState(S_PART) === "lower") return down;
    return null;
}


// 放置时，设置 part=lower，并在上方生成 part=upper
mc.world.afterEvents.playerPlaceBlock.subscribe((event) => {
    const { block, player } = event;
    if (!block || !isVending(block)) return;
    if (!player?.isValid) return;

    const aboveBlock = block.above();
    if (!aboveBlock || (!aboveBlock.isAir && !aboveBlock.isLiquid)) {
        try { block.setType("minecraft:air"); } catch (e) { }
        return;
    }

    const placedCardinal = block.permutation.getState(S_CARDINAL);
    mc.system.run(() => {
        try {
            const dim = block.dimension;
            const loc = { x: block.x, y: block.y, z: block.z };
            const upLoc = { x: block.x, y: block.y + 1, z: block.z };
            const cardinal = String(placedCardinal) || "north";
            const lower = mc.BlockPermutation.resolve(block.typeId)
                .withState(S_CARDINAL, cardinal)
                .withState(S_PART, "lower");
            const upper = mc.BlockPermutation.resolve(block.typeId)
                .withState(S_CARDINAL, cardinal)
                .withState(S_PART, "upper");
            dim.getBlock(loc)?.setPermutation(lower);
            dim.getBlock(upLoc)?.setPermutation(upper);
        } catch (e) { }
    });
});


// 记录整台贩卖机被破坏的掉落信息
const pendingBreaks = new Map();

mc.world.beforeEvents.playerBreakBlock.subscribe((event) => {
    const block = event.block;
    if (!block || !isVending(block)) return;

    const part = block.permutation.getState(S_PART);
    let lowerBlock = null;
    let upperBlock = null;

    if (part === "lower") {
        lowerBlock = block;
        const a = block.above();
        if (a && isVending(a) && a.permutation.getState(S_PART) === "upper") upperBlock = a;
    } else if (part === "upper") {
        upperBlock = block;
        const b = block.below();
        if (b && isVending(b) && b.permutation.getState(S_PART) === "lower") lowerBlock = b;
    }

    // 非完整结构（孤立的一半）按普通方块破坏处理，不拦截
    if (!lowerBlock || !upperBlock) return;

    const brokenKey = `${block.x},${block.y},${block.z}`;
    pendingBreaks.set(brokenKey, {
        lowerLoc: { x: lowerBlock.x, y: lowerBlock.y, z: lowerBlock.z },
        upperLoc: { x: upperBlock.x, y: upperBlock.y, z: upperBlock.z },
    });
});

mc.world.afterEvents.playerBreakBlock.subscribe((event) => {
    const block = event.block;
    const player = event.player;
    if (!block) return;

    const brokenKey = `${block.x},${block.y},${block.z}`;
    const info = pendingBreaks.get(brokenKey);
    if (!info) return;
    pendingBreaks.delete(brokenKey);

    const dim = event.dimension;
    mc.system.run(() => {
        // 移除另一半（被破坏格已由引擎移除）
        for (const loc of [info.lowerLoc, info.upperLoc]) {
            try {
                const b = dim.getBlock(loc);
                if (b && isVending(b)) b.setType("minecraft:air");
            } catch (e) { }
        }
        // 创造模式破坏不掉落物品
        const isCreative = player?.isValid && player.getGameMode() === mc.GameMode.Creative;
        if (!isCreative) {
            try {
                dim.spawnItem(new mc.ItemStack(VENDING_ID, 1), info.lowerLoc);
            } catch (e) { }
        }
    });
});