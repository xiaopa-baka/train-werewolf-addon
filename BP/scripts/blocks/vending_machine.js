// @ts-check
// vendingMachine.js - 自动贩卖机逻辑

import * as mc from "@minecraft/server";


const LOWER_ID = "lw_p1:vending_machine_lower";
const UPPER_ID = "lw_p1:vending_machine_upper";
/** @type {any} */
const STATE_CARDINAL = "lw_p1:cardinal_direction";


// 使方块被放置时正面始终朝向玩家
function yawToCardinal(yaw) {
    if (yaw >= -45 && yaw < 45) return "north";
    if (yaw >= 45 && yaw < 135) return "east";
    if (yaw >= 135 || yaw < -135) return "south";
    return "west";
}


// 多方快结构逻辑，方块朝向修正
mc.world.afterEvents.playerPlaceBlock.subscribe((event) => {
    const { block, player } = event;
    const cardinal = player ? yawToCardinal(player.getRotation().y) : "south";

    if (block.typeId === UPPER_ID) {
        try {
            const upperPerm = block.permutation.withState(STATE_CARDINAL, cardinal);
            block.setPermutation(upperPerm);
        } catch (e) { }
        return;
    }

    if (block.typeId !== LOWER_ID) return;

    try {
        const lowerPerm = block.permutation.withState(STATE_CARDINAL, cardinal);
        block.setPermutation(lowerPerm);
    } catch (e) { }

    const above = block.above();
    if (!above) return;
    if (!above.isAir) {
        block.setType("minecraft:air");
        return;
    }

    try {
        const upperBase = mc.BlockPermutation.resolve(UPPER_ID);
        const upperPerm = upperBase.withState(STATE_CARDINAL, cardinal);
        above.setPermutation(upperPerm);
    } catch (e) { }
});


// 多方快结构掉落物修正
mc.world.beforeEvents.playerBreakBlock.subscribe((event) => {
    const block = event.block;
    const typeId = block.typeId;
    if (typeId !== LOWER_ID && typeId !== UPPER_ID) return;

    let isFullStructure = false;
    let lowerBlock = null;
    let upperBlock = null;

    if (typeId === LOWER_ID) {
        lowerBlock = block;
        const a = block.above();
        if (a && a.typeId === UPPER_ID) {
            upperBlock = a;
            isFullStructure = true;
        }
    } else {
        upperBlock = block;
        const b = block.below();
        if (b && b.typeId === LOWER_ID) {
            lowerBlock = b;
            isFullStructure = true;
        }
    }

    if (!isFullStructure) {
        return;
    }

    event.cancel = true;

    const lowerLoc = { x: lowerBlock.x, y: lowerBlock.y, z: lowerBlock.z };
    const upperLoc = { x: upperBlock.x, y: upperBlock.y, z: upperBlock.z };
    const dim = lowerBlock.dimension;

    mc.system.run(() => {
        try {
            dim.getBlock(lowerLoc)?.setType("minecraft:air");
        } catch (e) { }
        try {
            dim.getBlock(upperLoc)?.setType("minecraft:air");
        } catch (e) { }
        try {
            const drop = new mc.ItemStack(LOWER_ID, 1);
            dim.spawnItem(drop, lowerLoc);
        } catch (e) { }
    });
});