// @ts-check
// shopSystem.js - 商店系统

import * as mc from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";
import { getWorldConfig } from "./config/worldConfig.js";


// 物品ID转贴图路径，物品贴图必须放在 textures/items/ 目录下才能正常显示
function itemIdToIconPath(itemId) {
    const itemName = itemId.includes(":") ? itemId.split(":")[1] : itemId;
    return `textures/items/${itemName}`;
}


// 使用物品 lw_p1:killer_shop 打开杀手商店界面
mc.world.afterEvents.worldLoad.subscribe(() => {
    mc.world.afterEvents.itemUse.subscribe(event => {
        const player = event.source;
        if (player && player.isValid && event.itemStack?.typeId === "lw_p1:killer_shop") {
            openKillerShop(player);
        }
    });
});


// 点击方块 lw_p1:vending_machine 打开贩卖机界面
const vendingUiLock = new Set();
mc.world.beforeEvents.playerInteractWithBlock.subscribe(event => {
    const player = event.player;
    if (!player || !player.isValid) return;
    const blockId = event.block.typeId;
    if (blockId === "lw_p1:vending_machine_lower" || blockId === "lw_p1:vending_machine_upper") {
        event.cancel = true;
        if (vendingUiLock.has(player.id)) return;
        vendingUiLock.add(player.id);
        mc.system.run(() => {
            openVendingMachine(player);
        });
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
        try { player.sendMessage("§c内部错误：金币计分板未找到"); } catch { }
        return false;
    }
    try {
        const before = objective.getScore(player) ?? 0;
        if (before < amount) return false;
        objective.addScore(player, -amount);
        const after = objective.getScore(player) ?? 0;
        try { player.sendMessage(`§e扣除金币：${amount}，余额 ${before} -> ${after}`); } catch { }
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
function openKillerShop(player) {
    const config = getWorldConfig();
    const currentGold = getGoldScore(player);
    const form = new ActionFormData();
    const items = Array.isArray(config.killerShopItems) ? config.killerShopItems : [];

    form.title("杀手商店");
    form.header(`当前金币：${currentGold}`);

    items.forEach(item => {
        const icon = itemIdToIconPath(item.id);
        form.button(`${item.displayName}：${item.price}金币`, icon);
    });
    form.button("§c关闭");

    form.show(player).then(res => {
        if (res.canceled) return;
        if (purchaseLock.has(player.name)) { player.sendMessage("§c操作中，请勿重复点击"); return; }
        purchaseLock.add(player.name);
        if (res.selection === undefined || res.selection < 0 || res.selection >= items.length) { purchaseLock.delete(player.name); return; }
        const target = items[res.selection];
        if (!target) { purchaseLock.delete(player.name); return; }

        if (getGoldScore(player) < target.price) {
            player.sendMessage("§c金币不足，购买失败！");
            purchaseLock.delete(player.name);
            return;
        }

        if (!deductGold(player, target.price)) {
            player.sendMessage("§c购买失败，请重试");
            purchaseLock.delete(player.name);
            return;
        }
        if (giveItem(player, target.id)) {
            player.sendMessage(`§a成功购买 ${target.displayName}，扣除 ${target.price} 金币`);
            purchaseLock.delete(player.name);
        } else {
            try {
                mc.world.scoreboard.getObjective("lw_p1:金币")?.addScore(player, target.price);
                player.sendMessage("§c物品栏已满，金币已退还");
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
    const items = Array.isArray(config.vendingMachineItems) ? config.vendingMachineItems : [];

    form.title("贩卖机");
    form.header(`当前金币：${currentGold}`);

    items.forEach(item => {
        const icon = itemIdToIconPath(item.id);
        form.button(`${item.displayName}：${item.price}金币`, icon);
    });
    form.button("§c关闭");

    form.show(player).then(res => {
        vendingUiLock.delete(player.id);
        if (res.canceled) return;
        if (purchaseLock.has(player.name)) { player.sendMessage("§c操作中，请勿重复点击"); return; }
        purchaseLock.add(player.name);
        if (res.selection === undefined || res.selection < 0 || res.selection >= items.length) { purchaseLock.delete(player.name); return; }
        const target = items[res.selection];
        if (!target) { purchaseLock.delete(player.name); return; }

        if (getGoldScore(player) < target.price) {
            player.sendMessage("§c金币不足，购买失败！");
            purchaseLock.delete(player.name);
            return;
        }

        if (!deductGold(player, target.price)) {
            player.sendMessage("§c购买失败，请重试");
            purchaseLock.delete(player.name);
            return;
        }
        if (giveItem(player, target.id)) {
            player.sendMessage(`§a成功购买 ${target.displayName} ，扣除 ${target.price} 金币`);
            purchaseLock.delete(player.name);
        } else {
            try {
                mc.world.scoreboard.getObjective("lw_p1:金币")?.addScore(player, target.price);
                player.sendMessage("§c物品栏已满，金币已退还");
            } catch (e) { }
            purchaseLock.delete(player.name);
        }
    });
}