// @ts-check
// shopSystem.js - 商店系统

import * as mc from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";
import { getWorldConfig } from "./config/worldConfig.js";
import { itemIdToIconPath } from "./config/configUI.js";
import { t, tConfigName } from "./i18n/i18n.js";


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


// 获取玩家金币分数
function getGoldScore(player) {
    const objective = mc.world.scoreboard.getObjective("lw_p1:金币");
    try { return objective?.getScore(player) ?? 0; } catch { return 0; }
}


// 扣除玩家金币分数
function deductGold(player, amount) {
    const objective = mc.world.scoreboard.getObjective("lw_p1:金币");
    if (!objective) {
        try { player.sendMessage(t("lw_p1.shop.noScoreboard")); } catch { }
        return false;
    }
    try {
        const before = objective.getScore(player) ?? 0;
        if (before < amount) return false;
        objective.addScore(player, -amount);
        const after = objective.getScore(player) ?? 0;
        return true;
    } catch (e) { }
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
    const goldObj = mc.world.scoreboard.getObjective("lw_p1:金币");
    if (!goldObj) return;
    const killerRateObj = mc.world.scoreboard.getObjective("lw_p1:杀手金币增速");
    const civilRateObj = mc.world.scoreboard.getObjective("lw_p1:平民金币增速");
    const killerRate = killerRateObj?.getScore("lw_p1:全局") ?? 15;
    const civilRate = civilRateObj?.getScore("lw_p1:全局") ?? 0;

    const players = mc.world.getPlayers();
    for (const player of players) {
        if (!player.isValid) continue;
        if (!player.hasTag("lw_p1:游戏中")) {
            goldAccumulator.delete(player.id);
            continue;
        }

        const acc = (goldAccumulator.get(player.id) ?? 0) + 1;
        goldAccumulator.set(player.id, acc);
        if (acc < 200) continue;

        goldAccumulator.set(player.id, 0);
        const rate = player.hasTag("lw_p1:杀手") ? killerRate : civilRate;
        if (rate > 0) {
            goldObj.addScore(player, rate);
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
                mc.world.scoreboard.getObjective("lw_p1:金币")?.addScore(player, target.price);
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
    if (player.hasTag("lw_p1:杀手")) {
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
                mc.world.scoreboard.getObjective("lw_p1:金币")?.addScore(player, target.price);
                player.sendMessage(t("lw_p1.shop.invFull"));
            } catch (e) { }
            purchaseLock.delete(player.name);
        }
    });
}
