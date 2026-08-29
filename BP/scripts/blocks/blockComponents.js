// @ts-check
// blockComponents.js - 网易版自定义方块组件注册
// 网易版需要显式注册 minecraft:custom_components 才能触发方块交互，
// 通过 registerCustomComponent 将交互逻辑绑定到 onPlayerInteract。
// 交互逻辑本身与国际版 beforeEvents.playerInteractWithBlock 共用（见各模块的去重处理）。

import * as mc from "@minecraft/server";
import { handleKeydoorInteract } from "./keydoor.js";
import { handleVendingMachineInteract } from "../shopSystem.js";
import { handleFoodTrayInteract } from "../propSystem.js";


mc.system.beforeEvents.startup.subscribe((initEvent) => {
    // 钥匙门交互组件
    initEvent.blockComponentRegistry.registerCustomComponent("lw_p1:keydoor_interact", {
        onPlayerInteract: (event) => {
            handleKeydoorInteract(event.player, event.block);
        }
    });
    // 贩卖机交互组件
    initEvent.blockComponentRegistry.registerCustomComponent("lw_p1:vending_machine_interact", {
        onPlayerInteract: (event) => {
            handleVendingMachineInteract(event.player, event.block);
        }
    });
    // 食物托盘交互组件
    initEvent.blockComponentRegistry.registerCustomComponent("lw_p1:food_tray_interact", {
        onPlayerInteract: (event) => {
            handleFoodTrayInteract(event.player, event.block);
        }
    });
});