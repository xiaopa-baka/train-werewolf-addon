// @ts-check
// vendingMachine.js - 自动贩卖机逻辑

import * as mc from "@minecraft/server";


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