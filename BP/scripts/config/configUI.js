// @ts-check
// configUI.js - 用于管理游戏配置的UI界面脚本

import * as mc from "@minecraft/server";
import {ActionFormData, MessageFormData, ModalFormData } from "@minecraft/server-ui";
import { getWorldConfig, saveWorldConfig, getEmptyConfig, getConfig, setConfig, getConfigMeta, resetConfigDefaults } from "./worldConfig.js";
import { t, tBlock, tConfigName } from "../core/i18n.js";
import { itemIdToIconPath } from "../core/itemIcons.js";


// 将玩家位置转换为方块坐标，并提供一个函数将方块坐标转换为方块中心坐标，方便UI输入输出
function getPlayerBlockIntPos(player) {
    return {
        x: Math.floor(player.location.x),
        y: Math.floor(player.location.y),
        z: Math.floor(player.location.z)
    };
}


function intPosToCenter(intX, intY, intZ) {
    return {
        x: intX + 0.5,
        y: intY + 0.5,
        z: intZ + 0.5
    };
}


// 使用物品 木棍 打开配置UI
mc.world.afterEvents.worldLoad.subscribe(() => {
    mc.world.afterEvents.itemUse.subscribe(event => {
        const player = event.source;
        if (player && player.isValid && event.itemStack?.typeId === "minecraft:stick") {
            showMainForm(player);
        }
    });
});


// ===== 主界面 =====
function showMainForm(player) {
    if (!player.isValid) return;

    const mainForm = new ActionFormData()
        .title(t("lw_p1.ui.main.title"))
        .body(t("lw_p1.ui.main.body"))
        .button(t("lw_p1.ui.main.game"))
        .button(t("lw_p1.ui.main.map"))
        .button(t("lw_p1.ui.main.food"))
        .button(t("lw_p1.ui.main.shop"))
        .button(t("lw_p1.ui.main.other"))
        .button(t("lw_p1.ui.close"));

    mainForm.show(player).then(res => {
        if (!player.isValid || res.canceled) return;
        switch (res.selection) {
            case 0: showGameSettingForm(player); break;
            case 1: showMapSettingForm(player); break;
            case 2: showFoodDrinkForm(player); break;
            case 3: showShopForm(player); break;
            case 4: showOtherMenu(player); break;
        }
    }).catch(() => { });
}


// ===== 主界面/全局游戏配置 =====
function showGameSettingForm(player) {
    if (!player.isValid) return;

    const gameForm = new ActionFormData()
        .title(t("lw_p1.ui.game.title"))
        .body(t("lw_p1.ui.game.body"))
        .button(t("lw_p1.ui.game.settings"))
        .button(t("lw_p1.ui.game.task"))
        .button(t("lw_p1.ui.inGame.button"))
        .button(t("lw_p1.ui.resetDefault"))
        .button(t("lw_p1.ui.back"));

    gameForm.show(player).then(res => {
        if (!player.isValid) return;
        if (res.canceled) { showMainForm(player); return; }
        switch (res.selection) {
            case 0: mc.system.run(() => showGameConfigModal(player)); break;
            case 1: mc.system.run(() => showTaskConfigModal(player)); break;
            case 2: mc.system.run(() => showInGameSettingModal(player)); break;
            case 3: resetAllScoresToDefault(player); break;
            case 4: showMainForm(player); break;
        }
    }).catch(() => { });
}


// ===== 主界面/全局游戏配置/局内相关配置 =====
function showInGameSettingModal(player) {
    if (!player.isValid) return;
    const cfg = getWorldConfig();
    new ModalFormData()
        .title(t("lw_p1.ui.inGame.title"))
        .toggle(t("lw_p1.ui.inGame.staminaToggle"), { defaultValue: cfg.staminaEnabled !== false })
        .slider(t("lw_p1.ui.inGame.drainDesc", cfg.staminaDrainPerSecond ?? 10), 2, 20, { valueStep: 2, defaultValue: cfg.staminaDrainPerSecond ?? 10 })
        .slider(t("lw_p1.ui.inGame.regenDesc", cfg.staminaRegenPerSecond ?? 4), 2, 20, { valueStep: 2, defaultValue: cfg.staminaRegenPerSecond ?? 4 })
        .toggle(t("lw_p1.ui.inGame.killerToggle"), { defaultValue: cfg.killerStamina !== false })
        .toggle(t("lw_p1.ui.inGame.jumpToggle"), { defaultValue: cfg.jumpEnabled !== false })
        .toggle(t("lw_p1.ui.inGame.weatherToggle"), { defaultValue: cfg.weatherEnabled !== false })
        .show(player).then(res => {
            if (!player.isValid) return;
            if (res.canceled) { showGameSettingForm(player); return; }
            try {
                const vals = res.formValues.filter(v => v !== null && v !== undefined);
                const latest = getWorldConfig();
                latest.staminaEnabled = vals[0] === true;
                latest.staminaDrainPerSecond = Number(vals[1]);
                latest.staminaRegenPerSecond = Number(vals[2]);
                latest.killerStamina = vals[3] === true;
                latest.jumpEnabled = vals[4] === true;
                latest.weatherEnabled = vals[5] === true;
                saveWorldConfig(latest);
                player.sendMessage(t("lw_p1.ui.inGame.saved"));
            } catch (e) {
                player.sendMessage(t("lw_p1.ui.saveFail", String(e)));
            }
            showGameSettingForm(player);
        }).catch(() => { });
}


// ===== 主界面/全局游戏配置/游戏相关配置 =====
function showGameConfigModal(player) {
    if (!player.isValid) return;
    const autoStart = getConfig("autoStart");
    const s1 = getConfigMeta("autoStartDelay");
    const s2 = getConfigMeta("minPlayers");
    const s3 = getConfigMeta("baseDuration");
    new ModalFormData()
        .title(t("lw_p1.ui.game.settingsTitle"))
        .header(t("lw_p1.ui.game.autoHeader"))
        .slider(t("lw_p1.ui.game.autoDesc", s1.default), s1.min, s1.max, { valueStep: s1.step, defaultValue: getConfig("autoStartDelay") })
        .toggle(t("lw_p1.ui.game.autoToggle"), { defaultValue: autoStart !== 0 })
        .header(t("lw_p1.ui.game.minHeader"))
        .slider(t("lw_p1.ui.game.minDesc", s2.default), s2.min, s2.max, { valueStep: s2.step, defaultValue: getConfig("minPlayers") })
        .header(t("lw_p1.ui.game.baseHeader"))
        .slider(t("lw_p1.ui.game.baseDesc", s3.default), s3.min, s3.max, { valueStep: s3.step, defaultValue: getConfig("baseDuration") })
        .show(player).then(res => {
            if (res.canceled) { showGameSettingForm(player); return; }
            try {
                const vals = res.formValues.filter(v => v !== null && v !== undefined);
                setConfig("autoStartDelay", Number(vals[0]));
                setConfig("autoStart", vals[1] ? 1 : 0);
                setConfig("minPlayers", Number(vals[2]));
                setConfig("baseDuration", Number(vals[3]));
                player.sendMessage(t("lw_p1.ui.game.saved"));
            } catch (e) {
                player.sendMessage(t("lw_p1.ui.saveFail", String(e)));
            }
            showGameSettingForm(player);
        }).catch(() => { });
}


// ===== 主界面/全局游戏配置/任务相关配置 =====
function showTaskConfigModal(player) {
    if (!player.isValid) return;
    const s1 = getConfigMeta("taskChance");
    const s2 = getConfigMeta("taskFirstDelay");
    const s3 = getConfigMeta("taskLimit");
    const s4 = getConfigMeta("fakeTaskLimit");
    const s5 = getConfigMeta("taskReward");
    new ModalFormData()
        .title(t("lw_p1.ui.task.title"))
        .header(t("lw_p1.ui.task.probHeader"))
        .slider(t("lw_p1.ui.task.probDesc", s1.default), s1.min, s1.max, { valueStep: s1.step, defaultValue: getConfig("taskChance") })
        .header(t("lw_p1.ui.task.startHeader"))
        .slider(t("lw_p1.ui.task.startDesc", s2.default), s2.min, s2.max, { valueStep: s2.step, defaultValue: getConfig("taskFirstDelay") })
        .header(t("lw_p1.ui.task.limitHeader"))
        .slider(t("lw_p1.ui.task.limitDesc", s3.default), s3.min, s3.max, { valueStep: s3.step, defaultValue: getConfig("taskLimit") })
        .header(t("lw_p1.ui.task.fakeHeader"))
        .slider(t("lw_p1.ui.task.fakeDesc", s4.default), s4.min, s4.max, { valueStep: s4.step, defaultValue: getConfig("fakeTaskLimit") })
        .header(t("lw_p1.ui.task.rewardHeader"))
        .slider(t("lw_p1.ui.task.rewardDesc", s5.default), s5.min, s5.max, { valueStep: s5.step, defaultValue: getConfig("taskReward") })
        .show(player).then(res => {
            if (res.canceled) { showGameSettingForm(player); return; }
            try {
                const vals = res.formValues.filter(v => v !== null && v !== undefined);
                setConfig("taskChance", Number(vals[0]));
                setConfig("taskFirstDelay", Number(vals[1]));
                setConfig("taskLimit", Number(vals[2]));
                setConfig("fakeTaskLimit", Number(vals[3]));
                setConfig("taskReward", Number(vals[4]));
                player.sendMessage(t("lw_p1.ui.task.saved"));
            } catch (e) {
                player.sendMessage(t("lw_p1.ui.saveFail", String(e)));
            }
            showGameSettingForm(player);
        }).catch(() => { });
}


// ===== 主界面/全局游戏配置/恢复默认配置 =====
function resetAllScoresToDefault(player) {
    if (!player.isValid) return;

    new MessageFormData()
        .title(t("lw_p1.ui.reset.title"))
        .body(t("lw_p1.ui.reset.body"))
        .button1(t("lw_p1.ui.cancel"))
        .button2(t("lw_p1.ui.confirmReset"))
        .show(player).then(res => {
            if (res.selection === 1) {
                // 全部可调参数恢复预设值
                resetConfigDefaults();

                // 局内开关同样恢复默认（开启）
                const cfg = getWorldConfig();
                cfg.staminaEnabled = true;
                cfg.jumpEnabled = true;
                cfg.staminaDrainPerSecond = 10;
                cfg.staminaRegenPerSecond = 4;
                cfg.killerStamina = true;
                cfg.weatherEnabled = true;
                saveWorldConfig(cfg);

                player.sendMessage(t("lw_p1.ui.reset.done"));
            }

            showGameSettingForm(player);
        });
}


// ===== 主界面/地图区域配置 =====
function showMapSettingForm(player) {
    if (!player.isValid) return;

    const mapForm = new ActionFormData()
        .title(t("lw_p1.ui.map.title"))
        .body(t("lw_p1.ui.map.body"))
        .button(t("lw_p1.ui.map.stationEngine"))
        .button(t("lw_p1.ui.map.trainArea"))
        .button(t("lw_p1.ui.map.engineVent"))
        .button(t("lw_p1.ui.map.tailVent"))
        .button(t("lw_p1.ui.map.toilet"))
        .button(t("lw_p1.ui.map.randomTp"))
        .button(t("lw_p1.ui.map.roomCount"))
        .button(t("lw_p1.ui.map.clearAll"))
        .button(t("lw_p1.ui.back"));

    mapForm.show(player).then(res => {
        if (!player.isValid) return;
        if (res.canceled) { showMainForm(player); return; }
        switch (res.selection) {
            case 0: mc.system.run(() => showStationEngineCoordModal(player)); break;
            case 1: mc.system.run(() => showTrainAreaCoordModal(player)); break;
            case 2: mc.system.run(() => showEngineVentCoordModal(player)); break;
            case 3: mc.system.run(() => showTailVentCoordModal(player)); break;
            case 4: showToiletList(player); break;
            case 5: showRandomList(player); break;
            case 6: mc.system.run(() => showRoomCountModal(player)); break;
            case 7: confirmClearAllCoord(player); break;
            case 8: showMainForm(player); break;
        }
    }).catch(() => { });
}


// ===== 主界面/地图区域配置/站台&车头坐标 =====
function showStationEngineCoordModal(player) {
    if (!player.isValid) return;
    const cfg = getWorldConfig();
    const playerPos = getPlayerBlockIntPos(player);

    // 站台坐标默认值
    let station = { x: playerPos.x, y: playerPos.y, z: playerPos.z };
    if (cfg.trainStationCoordinates && cfg.trainStationCoordinates.x !== undefined) {
        station = {
            x: Math.floor(cfg.trainStationCoordinates.x),
            y: Math.floor(cfg.trainStationCoordinates.y),
            z: Math.floor(cfg.trainStationCoordinates.z)
        };
    }

    // 车头坐标默认值
    let engine = { x: playerPos.x, y: playerPos.y, z: playerPos.z };
    if (cfg.trainEngineCoordinates && cfg.trainEngineCoordinates.x !== undefined) {
        engine = {
            x: Math.floor(cfg.trainEngineCoordinates.x),
            y: Math.floor(cfg.trainEngineCoordinates.y),
            z: Math.floor(cfg.trainEngineCoordinates.z)
        };
    }

    new ModalFormData()
        .title(t("lw_p1.ui.stationEngine.title"))
        .header(t("lw_p1.ui.stationEngine.stationHeader"))
        .textField(t("lw_p1.ui.stationEngine.stationX"), "", { defaultValue: String(station.x) })
        .textField(t("lw_p1.ui.stationEngine.stationY"), "", { defaultValue: String(station.y) })
        .textField(t("lw_p1.ui.stationEngine.stationZ"), "", { defaultValue: String(station.z) })
        .header(t("lw_p1.ui.stationEngine.engineHeader"))
        .textField(t("lw_p1.ui.stationEngine.engineX"), "", { defaultValue: String(engine.x) })
        .textField(t("lw_p1.ui.stationEngine.engineY"), "", { defaultValue: String(engine.y) })
        .textField(t("lw_p1.ui.stationEngine.engineZ"), "", { defaultValue: String(engine.z) })
        .show(player).then(res => {
            if (!player.isValid) return;
            if (res.canceled) { showMapSettingForm(player); return; }
            const vals = res.formValues.filter(v => v !== null && v !== undefined);
            const sx = parseInt(String(vals[0]));
            const sy = parseInt(String(vals[1]));
            const sz = parseInt(String(vals[2]));
            const ex = parseInt(String(vals[3]));
            const ey = parseInt(String(vals[4]));
            const ez = parseInt(String(vals[5]));
            if (!Number.isFinite(sx) || !Number.isFinite(sy) || !Number.isFinite(sz)
                || !Number.isFinite(ex) || !Number.isFinite(ey) || !Number.isFinite(ez)) {
                player.sendMessage(t("lw_p1.ui.coordInvalid"));
                showMapSettingForm(player);
                return;
            }
            cfg.trainStationCoordinates = intPosToCenter(sx, sy, sz);
            cfg.trainEngineCoordinates = intPosToCenter(ex, ey, ez);
            saveWorldConfig(cfg);
            player.sendMessage(t("lw_p1.ui.stationEngine.saved"));
            showMapSettingForm(player);
        }).catch(() => { });
}


// ===== 主界面/地图区域配置/列车区域坐标 =====
function showTrainAreaCoordModal(player) {
    if (!player.isValid) return;
    const cfg = getWorldConfig();
    const playerPos = getPlayerBlockIntPos(player);
    const tc = cfg.trainCoordinates || {};

    const start = tc.start && tc.start.x !== undefined
        ? tc.start
        : { x: playerPos.x, y: playerPos.y, z: playerPos.z };
    const end = tc.end && tc.end.x !== undefined
        ? tc.end
        : { x: playerPos.x, y: playerPos.y, z: playerPos.z };

    new ModalFormData()
        .title(t("lw_p1.ui.trainArea.title"))
        .header(t("lw_p1.ui.trainArea.startHeader"))
        .textField(t("lw_p1.ui.coord.diagStartX"), "", { defaultValue: String(start.x) })
        .textField(t("lw_p1.ui.coord.startY"), "", { defaultValue: String(start.y) })
        .textField(t("lw_p1.ui.coord.startZ"), "", { defaultValue: String(start.z) })
        .header(t("lw_p1.ui.trainArea.endHeader"))
        .textField(t("lw_p1.ui.coord.diagEndX"), "", { defaultValue: String(end.x) })
        .textField(t("lw_p1.ui.coord.endY"), "", { defaultValue: String(end.y) })
        .textField(t("lw_p1.ui.coord.endZ"), "", { defaultValue: String(end.z) })
        .show(player).then(res => {
            if (!player.isValid) return;
            if (res.canceled) { showMapSettingForm(player); return; }
            const vals = res.formValues.filter(v => v !== null && v !== undefined);
            const sx = parseInt(String(vals[0]));
            const sy = parseInt(String(vals[1]));
            const sz = parseInt(String(vals[2]));
            const ex = parseInt(String(vals[3]));
            const ey = parseInt(String(vals[4]));
            const ez = parseInt(String(vals[5]));
            if (!Number.isFinite(sx) || !Number.isFinite(sy) || !Number.isFinite(sz)
                || !Number.isFinite(ex) || !Number.isFinite(ey) || !Number.isFinite(ez)) {
                player.sendMessage(t("lw_p1.ui.coordInvalid"));
                showMapSettingForm(player);
                return;
            }
            if (!cfg.trainCoordinates) cfg.trainCoordinates = {};
            cfg.trainCoordinates.start = { x: sx, y: sy, z: sz };
            cfg.trainCoordinates.end = { x: ex, y: ey, z: ez };
            saveWorldConfig(Object.assign({}, cfg));
            player.sendMessage(t("lw_p1.ui.trainArea.saved"));
            showMapSettingForm(player);
        }).catch(() => { });
}


// ===== 主界面/地图区域配置/车头透气区坐标 =====
function showEngineVentCoordModal(player) {
    if (!player.isValid) return;
    const cfg = getWorldConfig();
    const playerPos = getPlayerBlockIntPos(player);
    if (!cfg.ventilationAreas) cfg.ventilationAreas = {};
    if (!cfg.ventilationAreas.trainEngine) cfg.ventilationAreas.trainEngine = {};
    const ve = cfg.ventilationAreas.trainEngine;

    const start = ve.start && ve.start.x !== undefined
        ? ve.start
        : { x: playerPos.x, y: playerPos.y, z: playerPos.z };
    const end = ve.end && ve.end.x !== undefined
        ? ve.end
        : { x: playerPos.x, y: playerPos.y, z: playerPos.z };

    new ModalFormData()
        .title(t("lw_p1.ui.engineVent.title"))
        .header(t("lw_p1.ui.engineVent.startHeader"))
        .textField(t("lw_p1.ui.coord.diagStartX"), "", { defaultValue: String(start.x) })
        .textField(t("lw_p1.ui.coord.startY"), "", { defaultValue: String(start.y) })
        .textField(t("lw_p1.ui.coord.startZ"), "", { defaultValue: String(start.z) })
        .header(t("lw_p1.ui.engineVent.endHeader"))
        .textField(t("lw_p1.ui.coord.diagEndX"), "", { defaultValue: String(end.x) })
        .textField(t("lw_p1.ui.coord.endY"), "", { defaultValue: String(end.y) })
        .textField(t("lw_p1.ui.coord.endZ"), "", { defaultValue: String(end.z) })
        .show(player).then(res => {
            if (!player.isValid) return;
            if (res.canceled) { showMapSettingForm(player); return; }
            const vals = res.formValues.filter(v => v !== null && v !== undefined);
            const sx = parseInt(String(vals[0]));
            const sy = parseInt(String(vals[1]));
            const sz = parseInt(String(vals[2]));
            const ex = parseInt(String(vals[3]));
            const ey = parseInt(String(vals[4]));
            const ez = parseInt(String(vals[5]));
            if (!Number.isFinite(sx) || !Number.isFinite(sy) || !Number.isFinite(sz)
                || !Number.isFinite(ex) || !Number.isFinite(ey) || !Number.isFinite(ez)) {
                player.sendMessage(t("lw_p1.ui.coordInvalid"));
                showMapSettingForm(player);
                return;
            }
            cfg.ventilationAreas.trainEngine.start = { x: sx, y: sy, z: sz };
            cfg.ventilationAreas.trainEngine.end = { x: ex, y: ey, z: ez };
            saveWorldConfig(Object.assign({}, cfg));
            player.sendMessage(t("lw_p1.ui.engineVent.saved"));
            showMapSettingForm(player);
        }).catch(() => { });
}


// ===== 主界面/地图区域配置/车尾透气区坐标 =====
function showTailVentCoordModal(player) {
    if (!player.isValid) return;
    const cfg = getWorldConfig();
    const playerPos = getPlayerBlockIntPos(player);
    if (!cfg.ventilationAreas) cfg.ventilationAreas = {};
    if (!cfg.ventilationAreas.trainTail) cfg.ventilationAreas.trainTail = {};
    const vt = cfg.ventilationAreas.trainTail;

    const start = vt.start && vt.start.x !== undefined
        ? vt.start
        : { x: playerPos.x, y: playerPos.y, z: playerPos.z };
    const end = vt.end && vt.end.x !== undefined
        ? vt.end
        : { x: playerPos.x, y: playerPos.y, z: playerPos.z };

    new ModalFormData()
        .title(t("lw_p1.ui.tailVent.title"))
        .header(t("lw_p1.ui.tailVent.startHeader"))
        .textField(t("lw_p1.ui.coord.diagStartX"), "", { defaultValue: String(start.x) })
        .textField(t("lw_p1.ui.coord.startY"), "", { defaultValue: String(start.y) })
        .textField(t("lw_p1.ui.coord.startZ"), "", { defaultValue: String(start.z) })
        .header(t("lw_p1.ui.tailVent.endHeader"))
        .textField(t("lw_p1.ui.coord.diagEndX"), "", { defaultValue: String(end.x) })
        .textField(t("lw_p1.ui.coord.endY"), "", { defaultValue: String(end.y) })
        .textField(t("lw_p1.ui.coord.endZ"), "", { defaultValue: String(end.z) })
        .show(player).then(res => {
            if (!player.isValid) return;
            if (res.canceled) { showMapSettingForm(player); return; }
            const vals = res.formValues.filter(v => v !== null && v !== undefined);
            const sx = parseInt(String(vals[0]));
            const sy = parseInt(String(vals[1]));
            const sz = parseInt(String(vals[2]));
            const ex = parseInt(String(vals[3]));
            const ey = parseInt(String(vals[4]));
            const ez = parseInt(String(vals[5]));
            if (!Number.isFinite(sx) || !Number.isFinite(sy) || !Number.isFinite(sz)
                || !Number.isFinite(ex) || !Number.isFinite(ey) || !Number.isFinite(ez)) {
                player.sendMessage(t("lw_p1.ui.coordInvalid"));
                showMapSettingForm(player);
                return;
            }
            cfg.ventilationAreas.trainTail.start = { x: sx, y: sy, z: sz };
            cfg.ventilationAreas.trainTail.end = { x: ex, y: ey, z: ez };
            saveWorldConfig(Object.assign({}, cfg));
            player.sendMessage(t("lw_p1.ui.tailVent.saved"));
            showMapSettingForm(player);
        }).catch(() => { });
}


// ===== 主界面/地图区域配置/蹲坑坐标管理 =====
function showToiletList(player) {
    if (!player.isValid) return;
    const cfg = getWorldConfig();
    const form = new ActionFormData()
        .title(t("lw_p1.ui.toilet.title"))
        .body(t("lw_p1.ui.toilet.body"))
        .button(t("lw_p1.ui.addCurrent"));

    cfg.toiletCoordinates.forEach((pos) => {
        const label = pos && pos.x !== undefined
            ? `${Math.floor(pos.x)} ${Math.floor(pos.y)} ${Math.floor(pos.z)}`
            : t("lw_p1.ui.unset");
        form.button(label);
    });

    form.button(t("lw_p1.ui.back")).show(player).then(res => {
        if (!player.isValid || res.canceled) { showMapSettingForm(player); return; }
        if (res.selection === 0) {
            const intPos = getPlayerBlockIntPos(player);
            cfg.toiletCoordinates.push(intPosToCenter(intPos.x, intPos.y, intPos.z));
            saveWorldConfig(cfg);
            player.sendMessage(t("lw_p1.ui.toilet.added"));
            showToiletList(player);
            return;
        }

        const itemIndex = res.selection - 1;
        if (itemIndex >= 0 && itemIndex < cfg.toiletCoordinates.length) {
            editToiletCoordinate(player, itemIndex);
            return;
        }

        showMapSettingForm(player);
    });
}


// ===== 主界面/地图区域配置/蹲坑坐标管理/编辑 =====
function editToiletCoordinate(player, index) {
    if (!player.isValid) return;
    const cfg = getWorldConfig();
    const item = cfg.toiletCoordinates[index];
    if (!item) { showToiletList(player); return; }

    new ModalFormData()
        .title(t("lw_p1.ui.toilet.edit", index + 1))
        .textField(t("lw_p1.ui.coordX"), t("lw_p1.ui.inputInt"), { defaultValue: String(Math.floor(item.x)) })
        .textField(t("lw_p1.ui.coordY"), t("lw_p1.ui.inputInt"), { defaultValue: String(Math.floor(item.y)) })
        .textField(t("lw_p1.ui.coordZ"), t("lw_p1.ui.inputInt"), { defaultValue: String(Math.floor(item.z)) })
        .toggle(t("lw_p1.ui.deleteItem"), { defaultValue: false })
        .show(player).then(res => {
            if (!player.isValid) { showToiletList(player); return; }
            if (res.canceled) { showToiletList(player); return; }
            const vals = res.formValues.filter(v => v !== null && v !== undefined);
            if (vals[3] === true) {
                cfg.toiletCoordinates.splice(index, 1);
                saveWorldConfig(cfg);
                player.sendMessage(t("lw_p1.ui.toilet.deleted"));
                showToiletList(player);
                return;
            }
            const x = parseInt(String(vals[0]));
            const y = parseInt(String(vals[1]));
            const z = parseInt(String(vals[2]));
            if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
                player.sendMessage(t("lw_p1.ui.coordInvalid"));
                showToiletList(player);
                return;
            }
            cfg.toiletCoordinates[index] = intPosToCenter(x, y, z);
            saveWorldConfig(cfg);
            player.sendMessage(t("lw_p1.ui.toilet.updated"));
            showToiletList(player);
        });
}


// ===== 主界面/地图区域配置/随机传送坐标管理 =====
function showRandomList(player) {
    if (!player.isValid) return;
    const cfg = getWorldConfig();
    const form = new ActionFormData()
        .title(t("lw_p1.ui.random.title"))
        .body(t("lw_p1.ui.random.body"))
        .button(t("lw_p1.ui.addCurrent"));

    cfg.randomCoordinates.forEach((pos) => {
        const label = pos && pos.x !== undefined
            ? `${Math.floor(pos.x)} ${Math.floor(pos.y)} ${Math.floor(pos.z)}`
            : t("lw_p1.ui.unset");
        form.button(label);
    });

    form.button(t("lw_p1.ui.back")).show(player).then(res => {
        if (!player.isValid || res.canceled) { showMapSettingForm(player); return; }
        if (res.selection === 0) {
            const intPos = getPlayerBlockIntPos(player);
            cfg.randomCoordinates.push(intPosToCenter(intPos.x, intPos.y, intPos.z));
            saveWorldConfig(cfg);
            player.sendMessage(t("lw_p1.ui.random.added"));
            showRandomList(player);
            return;
        }

        const itemIndex = res.selection - 1;
        if (itemIndex >= 0 && itemIndex < cfg.randomCoordinates.length) {
            editRandomCoordinate(player, itemIndex);
            return;
        }

        showMapSettingForm(player);
    });
}


// ===== 主界面/地图区域配置/随机传送坐标管理/编辑 =====
function editRandomCoordinate(player, index) {
    if (!player.isValid) return;
    const cfg = getWorldConfig();
    const item = cfg.randomCoordinates[index];
    if (!item) { showRandomList(player); return; }

    new ModalFormData()
        .title(t("lw_p1.ui.random.edit", index + 1))
        .textField(t("lw_p1.ui.coordX"), t("lw_p1.ui.inputInt"), { defaultValue: String(Math.floor(item.x)) })
        .textField(t("lw_p1.ui.coordY"), t("lw_p1.ui.inputInt"), { defaultValue: String(Math.floor(item.y)) })
        .textField(t("lw_p1.ui.coordZ"), t("lw_p1.ui.inputInt"), { defaultValue: String(Math.floor(item.z)) })
        .toggle(t("lw_p1.ui.deleteItem"), { defaultValue: false })
        .show(player).then(res => {
            if (!player.isValid) { showRandomList(player); return; }
            if (res.canceled) { showRandomList(player); return; }
            const vals = res.formValues.filter(v => v !== null && v !== undefined);
            if (vals[3] === true) {
                cfg.randomCoordinates.splice(index, 1);
                saveWorldConfig(cfg);
                player.sendMessage(t("lw_p1.ui.random.deleted"));
                showRandomList(player);
                return;
            }
            const x = parseInt(String(vals[0]));
            const y = parseInt(String(vals[1]));
            const z = parseInt(String(vals[2]));
            if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
                player.sendMessage(t("lw_p1.ui.coordInvalid"));
                showRandomList(player);
                return;
            }
            cfg.randomCoordinates[index] = intPosToCenter(x, y, z);
            saveWorldConfig(cfg);
            player.sendMessage(t("lw_p1.ui.random.updated"));
            showRandomList(player);
        });
}


// ===== 主界面/地图区域配置/房间数配置 =====
function showRoomCountModal(player) {
    if (!player.isValid) return;
    const s = getConfigMeta("roomCount");
    new ModalFormData()
        .title(t("lw_p1.ui.room.title"))
        .header(t("lw_p1.ui.room.header"))
        .slider(t("lw_p1.ui.room.desc", s.default), s.min, s.max, { valueStep: s.step, defaultValue: getConfig("roomCount") })
        .show(player).then(res => {
            if (res.canceled) { showMapSettingForm(player); return; }
            const vals = res.formValues.filter(v => v !== null && v !== undefined);
            const n = Number(vals[0]);
            if (Number.isFinite(n) && n >= s.min && n <= s.max) {
                setConfig("roomCount", n);
                player.sendMessage(t("lw_p1.ui.room.set", n));
            }
            showMapSettingForm(player);
        });
}


// ===== 主界面/地图区域配置/清空所有地图坐标 =====
function confirmClearAllCoord(player) {
    if (!player.isValid) return;
    new MessageFormData()
        .title(t("lw_p1.ui.clear.title"))
        .body(t("lw_p1.ui.clear.body"))
        .button1(t("lw_p1.ui.cancel"))
        .button2(t("lw_p1.ui.confirmClear"))
        .show(player).then(res => {
            if (res.selection === 1) {
                saveWorldConfig(getEmptyConfig());
                player.sendMessage(t("lw_p1.ui.clear.done"));
            }
            showMapSettingForm(player);
        });
}





// ===== 主界面/食物&饮品配置 =====
function showFoodDrinkForm(player) {
    if (!player.isValid) return;
    const form = new ActionFormData();
        form.title(t("lw_p1.ui.food.title"));
        form.body(t("lw_p1.ui.food.body"));
        form.button(t("lw_p1.ui.food.foods"));
        form.button(t("lw_p1.ui.food.drinks"));
        form.button(t("lw_p1.ui.food.trays"));
        form.button(t("lw_p1.ui.resetDefault"));
        form.button(t("lw_p1.ui.back"));

    form.show(player).then(res => {
        if (!player.isValid) return;
        if (res.canceled) { showMainForm(player); return; }
        switch (res.selection) {
            case 0: showFoodListForm(player); break;
            case 1: showDrinkListForm(player); break;
            case 2: showFoodTrayMenu(player); break;
            case 3: confirmResetFoodDrink(player); break;
            case 4: showMainForm(player); break;
        }
    });
}


// 确认恢复合法食物/饮品/食物托盘默认配置
function confirmResetFoodDrink(player) {
    if (!player.isValid) return;
    new MessageFormData()
        .title(t("lw_p1.ui.resetTitle"))
        .body(t("lw_p1.ui.resetFood.body"))
        .button1(t("lw_p1.ui.cancel"))
        .button2(t("lw_p1.ui.confirmReset"))
        .show(player).then(res => {
            if (!player.isValid) return;
            if (res.selection === 1) {
                const config = getWorldConfig();
                const defaults = getEmptyConfig();
                config.allowedFoods = [...defaults.allowedFoods];
                config.allowedDrinks = [...defaults.allowedDrinks];
                config.foodTrayItems = {};
                for (const id of Object.keys(defaults.foodTrayItems)) {
                    config.foodTrayItems[id] = [...defaults.foodTrayItems[id]];
                }
                saveWorldConfig(config);
                player.sendMessage(t("lw_p1.ui.resetFood.done"));
            }
            showFoodDrinkForm(player);
        });
}


// ===== 主界面/食物&饮品配置/管理合法食物 =====
function showFoodListForm(player) {
    const config = getWorldConfig();
    const form = new ActionFormData();
    form.title(t("lw_p1.ui.foodList.title"));
    form.body(t("lw_p1.ui.foodList.body"));

    config.allowedFoods.forEach(itemId => {
        const icon = itemIdToIconPath(itemId);
        form.button(itemId, icon);
    });
    form.button(t("lw_p1.ui.foodList.add"));
    form.button(t("lw_p1.ui.back"));

    form.show(player).then(res => {
        if (res.canceled) return showFoodDrinkForm(player);
        const idx = res.selection;

        if (idx === config.allowedFoods.length) {
            showAddModal(player, "food");
        } else if (idx === config.allowedFoods.length + 1) {
            showFoodDrinkForm(player);
        } else {
            showEditModal(player, "food", idx);
        }
    });
}


// ===== 主界面/食物&饮品配置/管理合法饮品 =====
function showDrinkListForm(player) {
    const config = getWorldConfig();
    const form = new ActionFormData();
    form.title(t("lw_p1.ui.drinkList.title"));
    form.body(t("lw_p1.ui.drinkList.body"));

    config.allowedDrinks.forEach(itemId => {
        const icon = itemIdToIconPath(itemId);
        form.button(itemId, icon);
    });
    form.button(t("lw_p1.ui.drinkList.add"));
    form.button(t("lw_p1.ui.back"));

    form.show(player).then(res => {
        if (res.canceled) return showFoodDrinkForm(player);
        const idx = res.selection;

        if (idx === config.allowedDrinks.length) {
            showAddModal(player, "drink");
        } else if (idx === config.allowedDrinks.length + 1) {
            showFoodDrinkForm(player);
        } else {
            showEditModal(player, "drink", idx);
        }
    });
}


// ===== 主界面/食物&饮品配置/管理合法食物（饮品）/编辑 =====
function showEditModal(player, type, index) {
    if (!player.isValid) return;
    const config = getWorldConfig();
    const list = type === "food" ? config.allowedFoods : config.allowedDrinks;
    const oldValue = list[index];
    const form = new ModalFormData();
        form.title(t("lw_p1.ui.edit", oldValue));
        form.textField(t("lw_p1.ui.itemId.label"), t("lw_p1.ui.itemId.ph"), { defaultValue: String(oldValue) });
        form.toggle(t("lw_p1.ui.deleteItem"), { defaultValue: false });

    form.show(player).then(res => {
        const backList = () => type === "food" ? showFoodListForm(player) : showDrinkListForm(player);
        if (res.canceled) return backList();

        const vals = res.formValues.filter(v => v !== null && v !== undefined);
        if (vals[1] === true) {
            list.splice(index, 1);
            saveWorldConfig(config);
            return backList();
        }
        const newValue = (String(vals[0]) || "").trim();
        if (newValue) {
            list[index] = newValue;
            saveWorldConfig(config);
        }
        backList();
    });
}


// ===== 主界面/食物&饮品配置/管理合法食物（饮品）/单项操作/新增 =====
function showAddModal(player, type) {
    if (!player.isValid) return;
    const config = getWorldConfig();
    const form = new ModalFormData();

    form.title(type === "food" ? t("lw_p1.ui.foodList.add") : t("lw_p1.ui.drinkList.add"));
    form.textField(t("lw_p1.ui.itemId.label"), t("lw_p1.ui.itemId.ph"), { defaultValue: "" });

    form.show(player).then(res => {
        const backList = () => type === "food" ? showFoodListForm(player) : showDrinkListForm(player);
        if (res.canceled) return backList();

        const newValue = String(res.formValues[0]).trim();
        if (newValue) {
            const list = type === "food" ? config.allowedFoods : config.allowedDrinks;
            list.push(newValue);
            saveWorldConfig(config);
        }
        backList();
    });
}


// 食物托盘 ID 列表（显示名取自各自方块的译名）
const FOOD_TRAY_IDS = [
    "lw_p1:food_tray",
    "lw_p1:food_tray_ceramic",
    "lw_p1:food_tray_glass",
    "lw_p1:food_tray_wood"
];

// ===== 主界面/食物&饮品配置/食物托盘配置 =====
function showFoodTrayMenu(player) {
    if (!player.isValid) return;
    const form = new ActionFormData();
    form.title(t("lw_p1.ui.tray.title"));
    form.body(t("lw_p1.ui.tray.body"));

    FOOD_TRAY_IDS.forEach(id => {
        form.button(tBlock(id));
    });
    form.button(t("lw_p1.ui.back"));

    form.show(player).then(res => {
        if (!player.isValid) return;
        if (res.canceled) { showFoodDrinkForm(player); return; }
        if (res.selection < FOOD_TRAY_IDS.length) {
            showFoodTrayItemList(player, FOOD_TRAY_IDS[res.selection]);
        } else {
            showFoodDrinkForm(player);
        }
    });
}


// ===== 主界面/食物&饮品配置/食物托盘配置/物品列表 =====
function showFoodTrayItemList(player, trayId) {
    if (!player.isValid) return;
    const config = getWorldConfig();
    if (!config.foodTrayItems) config.foodTrayItems = {};
    if (!config.foodTrayItems[trayId]) config.foodTrayItems[trayId] = [];
    const items = config.foodTrayItems[trayId];

    const form = new ActionFormData();
    form.title(t("lw_p1.ui.tray.items", tBlock(trayId)));
    form.body(t("lw_p1.ui.tray.itemsBody"));

    items.forEach(itemId => {
        const icon = itemIdToIconPath(itemId);
        form.button(itemId, icon);
    });
    form.button(t("lw_p1.ui.addItem"));
    form.button(t("lw_p1.ui.back"));

    form.show(player).then(res => {
        if (!player.isValid) return;
        if (res.canceled) { showFoodTrayMenu(player); return; }
        if (res.selection === items.length) {
            showFoodTrayAddModal(player, trayId);
        } else if (res.selection === items.length + 1) {
            showFoodTrayMenu(player);
        } else {
            showFoodTrayEditModal(player, trayId, res.selection);
        }
    });
}


// ===== 主界面/食物&饮品配置/食物托盘配置/物品列表/新增 =====
function showFoodTrayAddModal(player, trayId) {
    if (!player.isValid) return;
    new ModalFormData()
        .title(t("lw_p1.ui.tray.addTitle", tBlock(trayId)))
        .textField(t("lw_p1.ui.itemId.label"), t("lw_p1.ui.itemId.phShort"), { defaultValue: "" })
        .show(player).then(res => {
            if (res.canceled) { showFoodTrayItemList(player, trayId); return; }
            const vals = res.formValues.filter(v => v !== null && v !== undefined);
            const newValue = String(vals[0]).trim();
            if (newValue) {
                const config = getWorldConfig();
                config.foodTrayItems[trayId].push(newValue);
                saveWorldConfig(config);
            }
            showFoodTrayItemList(player, trayId);
        });
}


// ===== 主界面/食物&饮品配置/食物托盘配置/物品列表/编辑 =====
function showFoodTrayEditModal(player, trayId, index) {
    if (!player.isValid) return;
    const config = getWorldConfig();
    const oldValue = config.foodTrayItems[trayId][index];
    new ModalFormData()
        .title(t("lw_p1.ui.edit", oldValue))
        .textField(t("lw_p1.ui.itemId.labelShort"), t("lw_p1.ui.itemId.phShort"), { defaultValue: String(oldValue) })
        .toggle(t("lw_p1.ui.deleteItem"), { defaultValue: false })
        .show(player).then(res => {
            if (res.canceled) { showFoodTrayItemList(player, trayId); return; }
            const vals = res.formValues.filter(v => v !== null && v !== undefined);
            if (vals[1] === true) {
                config.foodTrayItems[trayId].splice(index, 1);
                saveWorldConfig(config);
                showFoodTrayItemList(player, trayId);
                return;
            }
            const newValue = String(vals[0]).trim();
            if (newValue) {
                config.foodTrayItems[trayId][index] = newValue;
                saveWorldConfig(config);
            }
            showFoodTrayItemList(player, trayId);
        });
}


// ===== 主界面/商店配置 =====
function showShopForm(player) {
    if (!player.isValid) return;
    const form = new ActionFormData();
    form.title(t("lw_p1.ui.shop.title"));
    form.body(t("lw_p1.ui.shop.body"));
    form.button(t("lw_p1.ui.shop.killer"));
    form.button(t("lw_p1.ui.shop.vending"));
    form.button(t("lw_p1.ui.shop.initialCoins"))
    form.button(t("lw_p1.ui.resetDefault"));
    form.button(t("lw_p1.ui.back"));

    form.show(player).then(res => {
        if (!player.isValid) return;
        if (res.canceled) { showMainForm(player); return; }
        switch (res.selection) {
            case 0: showkillerStoreForm(player); break;
            case 1: showVendingMachineForm(player); break;
            case 2: showInitialCoinsForm(player); break;
            case 3: confirmResetShop(player); break;
            case 4: showMainForm(player); break;
        }
    });
}


// 确认恢复商店默认配置
function confirmResetShop(player) {
    if (!player.isValid) return;
    new MessageFormData()
        .title(t("lw_p1.ui.resetTitle"))
        .body(t("lw_p1.ui.resetShop.body"))
        .button1(t("lw_p1.ui.cancel"))
        .button2(t("lw_p1.ui.confirmReset"))
        .show(player).then(res => {
            if (!player.isValid) return;
            if (res.selection === 1) {
                const config = getWorldConfig();
                const defaults = getEmptyConfig();
                config.killerStoreItems = defaults.killerStoreItems.map(i => ({ ...i }));
                config.vendingMachineItems = defaults.vendingMachineItems.map(i => ({ ...i }));
                saveWorldConfig(config);
                player.sendMessage(t("lw_p1.ui.resetShop.done"));
            }
            showShopForm(player);
        });
}


// ===== 主界面/商店配置/杀手商店配置 =====
function showkillerStoreForm(player) {
    if (!player.isValid) return;
    const config = getWorldConfig();
    const form = new ActionFormData();
    const items = config.killerStoreItems;

    form.title(t("lw_p1.ui.killerForm.title"));
    form.body(t("lw_p1.ui.killerForm.body"));

    config.killerStoreItems.forEach(item => {
        const icon = itemIdToIconPath(item.id);
        form.button(t("lw_p1.shop.button", tConfigName(item), item.price), icon);
    });
    form.button(t("lw_p1.ui.addProduct"));
    form.button(t("lw_p1.ui.back"));

    form.show(player).then(res => {
        if (!player.isValid) return;
        if (res.canceled) { showShopForm(player); return; }

        const idx = res.selection;
        if (idx === items.length) {
            showAddShopItemModal(player, "killer");
        } else if (idx === items.length + 1) {
            showShopForm(player);
        } else {
            showEditShopItemModal(player, "killer", idx);
        }
    });
}


// ===== 主界面/商店配置/贩卖机配置 =====
function showVendingMachineForm(player) {
    if (!player.isValid) return;
    const config = getWorldConfig();
    const form = new ActionFormData();
    const items = config.vendingMachineItems;

    form.title(t("lw_p1.ui.vendingForm.title"));
    form.body(t("lw_p1.ui.vendingForm.body"));

    config.vendingMachineItems.forEach(item => {
        const icon = itemIdToIconPath(item.id);
        form.button(t("lw_p1.shop.button", tConfigName(item), item.price), icon);
    });
    form.button(t("lw_p1.ui.addProduct"));
    form.button(t("lw_p1.ui.back"));

    form.show(player).then(res => {
        if (!player.isValid) return;
        if (res.canceled) { showShopForm(player); return; }

        const idx = res.selection;
        if (idx === items.length) {
            showAddShopItemModal(player, "vending");
        } else if (idx === items.length + 1) {
            showShopForm(player);
        } else {
            showEditShopItemModal(player, "vending", idx);
        }
    });
}


// ===== 主界面/商店配置/杀手商店（贩卖机）/编辑 =====
function showEditShopItemModal(player, shopType, index) {
    const config = getWorldConfig();
    const list = shopType === "killer" ? config.killerStoreItems : config.vendingMachineItems;
    const item = list[index];
    const form = new ModalFormData();
    const backForm = () => shopType === "killer" ? showkillerStoreForm(player) : showVendingMachineForm(player);

    form.title(t("lw_p1.ui.edit", tConfigName(item)));
    form.textField(t("lw_p1.ui.shopItem.name"), t("lw_p1.ui.shopItem.namePh"), { defaultValue: String(item.displayName) });
    form.textField(t("lw_p1.ui.shopItem.id"), t("lw_p1.ui.shopItem.idPh"), { defaultValue: String(item.id) });
    form.textField(t("lw_p1.ui.shopItem.price"), t("lw_p1.ui.shopItem.pricePh"), { defaultValue: String(item.price) });
    form.toggle(t("lw_p1.ui.deleteItem"), { defaultValue: false });

    form.show(player).then(res => {
        if (res.canceled) return backForm();
        const vals = res.formValues.filter(v => v !== null && v !== undefined);
        if (vals[3] === true) {
            list.splice(index, 1);
            saveWorldConfig(config);
            return backForm();
        }
        const [newName, newId, priceStr] = vals;
        const newPrice = parseInt(String(priceStr));

        if (String(newName).trim() && String(newId).trim() && !isNaN(newPrice) && newPrice > 0) {
            list[index].displayName = String(newName).trim();
            list[index].id = String(newId).trim();
            list[index].price = newPrice;
            saveWorldConfig(config);
        }

        backForm();
    });
}


// ===== 主界面/商店配置/杀手商店（贩卖机）/单项操作/新增 =====
function showAddShopItemModal(player, shopType) {
    const config = getWorldConfig();
    const list = shopType === "killer" ? config.killerStoreItems : config.vendingMachineItems;
    const backForm = () => shopType === "killer" ? showkillerStoreForm(player) : showVendingMachineForm(player);
    const form = new ModalFormData();

    form.title(t("lw_p1.ui.addProduct"));
    form.textField(t("lw_p1.ui.shopItem.name"), t("lw_p1.ui.shopItem.namePh"), { defaultValue: "" });
    form.textField(t("lw_p1.ui.shopItem.id"), t("lw_p1.ui.shopItem.idPh"), { defaultValue: "" });
    form.textField(t("lw_p1.ui.shopItem.price"), t("lw_p1.ui.shopItem.pricePh"), { defaultValue: "" });

    form.show(player).then(res => {
        if (res.canceled) return backForm();
        const vals = res.formValues.filter(v => v !== null && v !== undefined);
        const [name, id, priceStr] = vals;
        const price = parseInt(String(priceStr));

        if (String(name).trim() && String(id).trim() && !isNaN(price) && price > 0) {
            list.push({
                id: String(id).trim(),
                displayName: String(name).trim(),
                price: price
            });
            saveWorldConfig(config);
        }
        backForm();
    });
}


// ===== 主界面/商店配置/初始金币 =====
function showInitialCoinsForm(player) {
    if (!player.isValid) return;
    const s1 = getConfigMeta("killerGold");
    const s2 = getConfigMeta("civilGold");
    const s3 = getConfigMeta("killerGoldRate");
    const s4 = getConfigMeta("civilGoldRate");
    new ModalFormData()
        .title(t("lw_p1.ui.initialCoins.title"))
        .header(t("lw_p1.ui.initialCoins.killerHeader"))
        .slider(t("lw_p1.ui.initialCoins.killerDesc", s1.default), s1.min, s1.max, { valueStep: s1.step, defaultValue: getConfig("killerGold") })
        .header(t("lw_p1.ui.initialCoins.civilHeader"))
        .slider(t("lw_p1.ui.initialCoins.civilDesc", s2.default), s2.min, s2.max, { valueStep: s2.step, defaultValue: getConfig("civilGold") })
        .header(t("lw_p1.ui.initialCoins.killerRateHeader"))
        .slider(t("lw_p1.ui.initialCoins.killerRateDesc", s3.default), s3.min, s3.max, { valueStep: s3.step, defaultValue: getConfig("killerGoldRate") })
        .header(t("lw_p1.ui.initialCoins.civilRateHeader"))
        .slider(t("lw_p1.ui.initialCoins.civilRateDesc", s4.default), s4.min, s4.max, { valueStep: s4.step, defaultValue: getConfig("civilGoldRate") })
        .show(player).then(res => {
            if (res.canceled) { showShopForm(player); return; }
            try {
                const vals = res.formValues.filter(v => v !== null && v !== undefined);
                setConfig("killerGold", Number(vals[0]));
                setConfig("civilGold", Number(vals[1]));
                setConfig("killerGoldRate", Number(vals[2]));
                setConfig("civilGoldRate", Number(vals[3]));
            } catch (e) {
                player.sendMessage(t("lw_p1.ui.initialCoins.fail", String(e)));
            }
            showShopForm(player);
        }).catch(() => { });
}



// ===== 主界面/其他 =====
function showOtherMenu(player) {
    if (!player.isValid) return;
    const otherForm = new ActionFormData()
        .title(t("lw_p1.ui.other.title"))
        .body(t("lw_p1.ui.other.body"))
        .button(t("lw_p1.ui.other.mapInfo"))
        .button(t("lw_p1.ui.other.unused"))
        .button(t("lw_p1.ui.other.about"))
        .button(t("lw_p1.ui.other.sponsor"))
        .button(t("lw_p1.ui.back"));
    otherForm.show(player).then(res => {
        if (!player.isValid) return;
        if (res.canceled) { showMainForm(player); return; }
        switch (res.selection) {
            case 0: mc.system.run(() => showMapInfoForm(player)); break;
            case 1: showUnusedConfigUI(player); break;
            case 2: showDeveloperAboutUI(player); break;
            case 3: showSponsorJoinUI(player); break;
            case 4: showMainForm(player); break;
        }
    }).catch(() => { });
}


// ===== 主界面/其他/设置地图信息 =====
function showMapInfoForm(player) {
    if (!player.isValid) return;
    const cfg = getWorldConfig();
    const wi = cfg.worldInformation || {};
    new ModalFormData()
        .title(t("lw_p1.ui.mapInfo.title"))
        .textField(t("lw_p1.ui.mapInfo.name"), t("lw_p1.ui.mapInfo.namePh"), { defaultValue: String(wi.mapName ?? "") })
        .textField(t("lw_p1.ui.mapInfo.author"), t("lw_p1.ui.mapInfo.authorPh"), { defaultValue: String(wi.mapAuthor ?? "") })
        .show(player).then(res => {
            if (!player.isValid) return;
            if (res.canceled) { showOtherMenu(player); return; }
            const vals = res.formValues.filter(v => v !== null && v !== undefined);
            cfg.worldInformation = {
                mapName: String(vals[0] ?? "").trim(),
                mapAuthor: String(vals[1] ?? "").trim(),
            };
            saveWorldConfig(cfg);
            player.sendMessage(t("lw_p1.ui.mapInfo.saved"));
            showOtherMenu(player);
        }).catch(() => { });
}


// ===== 主界面/其他/修改更多当前不可用配置 =====
function showUnusedConfigUI(player) {
    if (!player.isValid) return;
    new ActionFormData().title(t("lw_p1.ui.unused.title")).body(t("lw_p1.ui.unused.body")).button(t("lw_p1.ui.back"))
        .show(player).then(r => r.selection === 0 && showOtherMenu(player));
}


// ===== 主界面/其他/关于Addon开发者 =====
function showDeveloperAboutUI(player) {
    if (!player.isValid) return;
    new ActionFormData().title(t("lw_p1.ui.about.title")).body(t("lw_p1.ui.about.body")).button(t("lw_p1.ui.back"))
        .show(player).then(r => r.selection === 0 && showOtherMenu(player));
}


// ===== 主界面/其他/赞助&加入我们 =====
function showSponsorJoinUI(player) {
    if (!player.isValid) return;
    new ActionFormData().title(t("lw_p1.ui.sponsor.title")).body(t("lw_p1.ui.sponsor.body")).button(t("lw_p1.ui.back"))
        .show(player).then(r => r.selection === 0 && showOtherMenu(player));
}