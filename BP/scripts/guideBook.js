// @ts-check
// duideBook.js - 指南书

import * as mc from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";
import { getWorldConfig } from "./config/worldConfig";


function getGuidePages() {
    const cfg = getWorldConfig().worldInformation || {};
    const mapName = cfg.mapName || "未设置";
    const mapAuthor = cfg.mapAuthor || "未设置";

    return [
        {
            title: "§l游戏概述",
            body: "§f一列飞驰的火车，一场暗藏杀机的旅途。\n" +
                "你能否活着到站？\n" +
                "§f列车狼人杀是一款多人推理对抗游戏。\n" +
                "§e5-15 人§f，一局约 §e10 分钟§f。\n\n" +
                "§l规则§r\n" +
                "§f1. 所有人登车后，列车出发\n" +
                "2. 随机分配身份： §c杀手§f、§b警员§f、§a平民§f\n" +
                "3. 杀手暗中消灭乘客，乘客努力找出杀手\n\n" +
                "§l获胜条件§r\n" +
                "§a乘客§f：杀手死亡 / 列车到站\n" +
                "§c杀手§f：所有乘客死亡\n\n" +
                "§7地图名称： " + mapName + "\n" +
                "§7地图作者： " + mapAuthor + "\n" +
                "§7Addon作者： 狮狼传奇_小怕（LW.狮狼传奇工作室）"
        },
        {
            title: "§l身份",
            body: "· §c§l杀手§r\n" +
                "§f隐藏在乘客之中，目标是消灭所有乘客，拥有§e杀手商店§f。\n\n" +
                "· §b§l警员§r\n" +
                "§f唯一的执法人员，拥有§e左轮手枪§f。\n\n" +
                "· §a§l平民§r\n" +
                "§f没有武器，没有特权，是人数最多的群体。\n\n\n"
        },
        {
            title: "§l任务系统",
            body: "§f游戏开始后随机发布任务，倒计时在经验条上显示。\n" +
                "§c超时未完成死亡§f\n\n" +
                "§b§l任务列表§r\n" +
                "§e通风任务§f：去车头或车尾透气\n" +
                "§e睡觉任务§f：躺到床上\n" +
                "§e进食任务§f：吃下任意食物\n" +
                "§e补水任务§f：喝任意饮品 - §7香烟直接完成§f\n" +
                "§e蹲坑任务§f：去厕所蹲下 - §7矿泉水瓶直接完成§f\n" +
                "§e社交任务§f：靠近其他玩家站一会"
        },
        {
            title: "§l道具与商店",
            body: "§c§l杀手商店道具：§r\n" +
                "§f匕首 · 德林杰手枪 · 撬棍 · 开锁器 · 毒药 · 球棒 · 手雷 · 断电装置\n\n" +
                "§b§l通用道具§r\n§f便条 · 左轮手枪(警员) · 矿泉水 · 矿泉水瓶 · 神奇的海螺 · 父亲的怀表 · 野生蜂王浆\n\n" +
                "§e杀手商店§f：杀手自带商店，可购买专属道具\n" +
                "§e自动贩卖机§f：列车上的自动贩卖机可以购买特殊道具"
        },
        {
            title: "§l便条",
            body: "§l便条系统§r\n" +
                "§f每人开局获得一张便条，绑定背包。\n" +
                "· 对空白处使用 → 编辑内容\n" +
                " 对玩家使用 → 发送便条\n" +
                "· 死亡后内容留在尸体上\n\n\n\n\n" +
                "§7便条是游戏里唯一的通讯方式！\n"
        },
        {
            title: "§l修改配置",
            body: "使用物品 §e木棍 §f打开配置界面，修改游戏配置\n\n\n\n\n\n\n\n\n\n\n\n\n"
        }
    ];
}

function showGuideIndex(player) {
    const pages = getGuidePages();
    const form = new ActionFormData();
    form.title("§l§6列车乘客手册");
    form.body("§7选择章节阅读§r");

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
        form.button("← 上一页");
    }
    if (pageIndex < pages.length - 1) {
        form.button("下一页 →");
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

function giveGuideBook(player) {
    if (!player.isValid) return;
    if (player.hasTag("lw_p1:已领取物品")) return;

    try {
        player.runCommand(`give @s lw_p1:guide_book`);
        player.runCommand(`give @s lw_p1:tp_game`)
        player.addTag("lw_p1:已领取物品");
    } catch (e) { }
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