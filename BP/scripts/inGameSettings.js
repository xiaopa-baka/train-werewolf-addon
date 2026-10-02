// @ts-check
// inGameSettings.js - 局内开关的运行时适配
// 目前负责"跳跃"开关：读取世界配置，把跳跃输入权限下发到全部在线玩家。
// 跳跃权限会随玩家重新登录/重生重置，所以这里周期性重新下发，保证开关始终生效。

import * as mc from "@minecraft/server";
import { getWorldConfig } from "./config/worldConfig.js";


mc.system.runInterval(() => {
    const jumpEnabled = getWorldConfig().jumpEnabled !== false;

    for (const player of mc.world.getPlayers()) {
        if (!player.isValid) continue;
        try {
            player.inputPermissions.setPermissionCategory(mc.InputPermissionCategory.Jump, jumpEnabled);
        } catch (e) { }
    }
}, 20);