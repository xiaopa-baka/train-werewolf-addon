// @ts-check
// guideBook.js - 指南书

import * as mc from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";
import { getWorldConfig } from "../config/worldConfig.js";
import { t } from "../core/i18n.js";
import { isInGame } from "../core/state.js";


function getGuidePages() {
    const cfg = getWorldConfig().worldInformation || {};
    const mapName = cfg.mapName || "";
    const mapAuthor = cfg.mapAuthor || "";

    return [
        {
            title: t("lw_p1.guide.ch.overview"),
            body: t("lw_p1.guide.overview.body",
                mapName || t("lw_p1.common.notSet"),
                mapAuthor || t("lw_p1.common.notSet"))
        },
        {
            title: t("lw_p1.guide.ch.roles"),
            body: t("lw_p1.guide.roles.body")
        },
        {
            title: t("lw_p1.guide.ch.tasks"),
            body: t("lw_p1.guide.tasks.body")
        },
        {
            title: t("lw_p1.guide.ch.items"),
            body: t("lw_p1.guide.items.body")
        },
        {
            title: t("lw_p1.guide.ch.note"),
            body: t("lw_p1.guide.note.body")
        },
        {
            title: t("lw_p1.guide.ch.config"),
            body: t("lw_p1.guide.config.body")
        }
    ];
}

function showGuideIndex(player) {
    const pages = getGuidePages();
    const form = new ActionFormData();
    form.title(t("lw_p1.guide.title"));
    form.body(t("lw_p1.guide.indexHint"));

    for (const page of pages) {
        form.button(page.title);
    }

    form.show(player).then(res => {
        if (res.canceled) return;
        showGuidePage(player, res.selection);
    }).catch(() => { });
}

function showGuidePage(player, pageIndex) {
    const pages = getGuidePages();
    if (pageIndex < 0 || pageIndex >= pages.length) return;

    const page = pages[pageIndex];
    const form = new ActionFormData();
    form.title(page.title);
    form.body(page.body);

    if (pageIndex > 0) {
        form.button(t("lw_p1.guide.prev"));
    }
    if (pageIndex < pages.length - 1) {
        form.button(t("lw_p1.guide.next"));
    }

    form.show(player).then(res => {
        if (res.canceled) return;

        if (pageIndex > 0 && res.selection === 0) {
            showGuidePage(player, pageIndex - 1);
            return;
        }
        if (pageIndex < pages.length - 1) {
            const nextIdx = pageIndex > 0 ? 1 : 0;
            if (res.selection === nextIdx) {
                showGuidePage(player, pageIndex + 1);
            }
        }
    }).catch(() => { });
}

// 确保玩家背包中有一份指定物品：已有则跳过，缺失才补发（reload 幂等，不会重复发放）
// 发放时加 lock_in_inventory，禁止玩家丢弃
function ensureItem(player, typeId) {
    try {
        const container = player.getComponent("inventory")?.container;
        if (container) {
            for (let i = 0; i < container.size; i++) {
                if (container.getItem(i)?.typeId === typeId) return;
            }
        }
        player.runCommand(`give @s ${typeId} 1 0 {"minecraft:item_lock":{"mode":"lock_in_inventory"}}`);
    } catch (e) { }
}

// 移除玩家背包中的指定物品（用于局内收回 tp_game）
function removeItem(player, typeId) {
    try {
        const container = player.getComponent("inventory")?.container;
        if (!container) return;
        for (let i = 0; i < container.size; i++) {
            if (container.getItem(i)?.typeId === typeId) container.setItem(i, undefined);
        }
    } catch (e) { }
}

// 指南书全程持有（局内 gameFlow 会重新发放）；传送至车头仅非对局阶段持有
function giveGuideBook(player) {
    if (!player.isValid) return;
    ensureItem(player, "lw_p1:guide_book");
    if (isInGame(player)) {
        removeItem(player, "lw_p1:tp_game");
    } else {
        ensureItem(player, "lw_p1:tp_game");
    }
}

mc.system.runInterval(() => {
    for (const player of mc.world.getPlayers()) {
        giveGuideBook(player);
    }
}, 20);

mc.world.afterEvents.worldLoad.subscribe(() => {
    mc.world.afterEvents.playerJoin.subscribe((event) => {
        const player = Array.from(mc.world.getPlayers()).find(p => p.id === event.playerId);
        if (!player) return;
        mc.system.runTimeout(() => {
            giveGuideBook(player);
        }, 20);
    });

    mc.world.afterEvents.itemUse.subscribe(event => {
        const player = event.source;
        if (!player?.isValid) return;
        if (event.itemStack?.typeId !== "lw_p1:guide_book") return;
        showGuideIndex(player);
    });
});