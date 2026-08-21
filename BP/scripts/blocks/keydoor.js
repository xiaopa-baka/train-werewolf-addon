// @ts-check
// keydoor.js - 钥匙门逻辑

import * as mc from "@minecraft/server";


const DOOR_IDS = new Set(
    Array.from({ length: 10 }, (_, i) => `lw_p1:keydoor_${i + 1}`)
);

// 每个门对应的钥匙 ID
const DOOR_KEY_MAP = {
    "lw_p1:keydoor_1": "lw_p1:key_1",
    "lw_p1:keydoor_2": "lw_p1:key_2",
    "lw_p1:keydoor_3": "lw_p1:key_3",
    "lw_p1:keydoor_4": "lw_p1:key_4",
    "lw_p1:keydoor_5": "lw_p1:key_5",
    "lw_p1:keydoor_6": "lw_p1:key_6",
    "lw_p1:keydoor_7": "lw_p1:key_7",
    "lw_p1:keydoor_8": "lw_p1:key_8",
};


// 判断玩家当前手持物品是否允许打开该门
function canOpenDoor(doorId, hand) {
    // 九号门，只能用开锁器
    if (doorId === "lw_p1:keydoor_9") {
        return hand === "lw_p1:lockpick";
    }
    // 十号门，无需任何物品即可打开
    if (doorId === "lw_p1:keydoor_10") {
        return true;
    }
    // 其余门，对应钥匙或开锁器
    return hand === DOOR_KEY_MAP[doorId] || hand === "lw_p1:lockpick";
}

/** @type {any} */
const S_CARDINAL = "minecraft:cardinal_direction";
/** @type {any} */
const S_OPEN = "lw_p1:is_open";
/** @type {any} */
const S_PART = "lw_p1:part";


function isDoor(block) {
    return !!block && DOOR_IDS.has(block.typeId);
}

// 门的另一半
function halfDoor(block) {
    const up = block.above();
    const down = block.below();
    if (up && isDoor(up) && up.permutation.getState(S_PART) === "upper") return up;
    if (down && isDoor(down) && down.permutation.getState(S_PART) === "lower") return down;
    return null;
}

// 获取当前手持物品 typeId
function getHandTypeId(player) {
    try {
        const c = player.getComponent("inventory").container;
        const it = c.getItem(player.selectedSlotIndex);
        return it ? it.typeId : null;
    } catch (e) {
        return null;
    }
}

// 同步上下两块门的 is_open
function toggleOpen(block, nextOpen) {
    try {
        block.setPermutation(block.permutation.withState(S_OPEN, nextOpen));
    } catch (e) { }
    try {
        const half = halfDoor(block);
        if (half) half.setPermutation(half.permutation.withState(S_OPEN, nextOpen));
    } catch (e) { }
}

// 门的下半方块（lower）
function doorLower(block) {
    if (block.permutation.getState(S_PART) === "upper") {
        const d = block.below();
        return d && isDoor(d) ? d : block;
    }
    return block;
}

function doorKey(block) {
    const low = doorLower(block);
    return `${low.typeId}@${low.x},${low.y},${low.z}`;
}

// 记录"最近一次开门"的 tick，用于自动关门时判断门是否仍处于该状态
const openTimers = new Map();

// 记录"最近一次交互"的 tick，防抖
const lastInteractTick = new Map();

// 记录被撬棍锁定的门，交互时拒绝开关
const CROWBARED_DOORS = new Map();


// 放置时，设置 part=lower，并在上方生成 part=upper
mc.world.afterEvents.playerPlaceBlock.subscribe((event) => {
    const { block, player } = event;
    if (!block || !isDoor(block)) return;
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
                .withState(S_OPEN, false)
                .withState(S_PART, "lower");
            const upper = mc.BlockPermutation.resolve(block.typeId)
                .withState(S_CARDINAL, cardinal)
                .withState(S_OPEN, false)
                .withState(S_PART, "upper");
            dim.getBlock(loc)?.setPermutation(lower);
            dim.getBlock(upLoc)?.setPermutation(upper);
        } catch (e) { }
    });
});


// 只有手持对应钥匙才能切换开/关
mc.world.beforeEvents.playerInteractWithBlock.subscribe((event) => {
    const player = event.player;
    const block = event.block;
    if (!player?.isValid || !block || !isDoor(block)) return;

    // 拦截门本身的交互
    event.cancel = true;

    const hand = getHandTypeId(player);

    // 撬棍交互
    if (hand === "lw_p1:crowbar") {
        const isDoor10 = block.typeId === "lw_p1:keydoor_10";
        // 10号门 需要潜行
        if (isDoor10 && !player.isSneaking) return;
        if (!isDoor10 && player.isSneaking) return;

        const isOpen = block.permutation.getState(S_OPEN) === true;
        const slot = player.selectedSlotIndex;
        const barId = doorKey(block);
        mc.system.run(() => {
            if (!isDoor10 && !isOpen) {
                toggleOpen(block, true); 
            } else if (isDoor10 && isOpen) {
                toggleOpen(block, false);
            }
            // 锁定，1-9号门永久，10号门 40 秒
            if (isDoor10) {
                CROWBARED_DOORS.set(barId, mc.system.currentTick + 800); // 40 秒 = 800 tick
            } else {
                CROWBARED_DOORS.set(barId, "permanent");
            }
            // 消耗撬棍
            if (player.getGameMode() !== mc.GameMode.Creative) {
                try {
                    if (!player.isValid) return;
                    const c = player.getComponent("inventory").container;
                    const item = c.getItem(slot);
                    if (item && item.typeId === "lw_p1:crowbar") {
                        if (item.amount > 1) { item.amount -= 1; c.setItem(slot, item); }
                        else { c.setItem(slot, undefined); }
                    }
                } catch (e) { }
            }

        });
        return;
    }

    if (!canOpenDoor(block.typeId, hand)) {
        return;
    }

    // 防抖
    const now = mc.system.currentTick;
    const last = lastInteractTick.get(doorKey(block));
    if (last !== undefined && now - last < 10) {
        return;
    }
    lastInteractTick.set(doorKey(block), now);

    // 被撬棍锁定的门拒绝钥匙开关
    const doorKeyStr = doorKey(block);
    const barExpiry = CROWBARED_DOORS.get(doorKeyStr);
    if (barExpiry !== undefined) {
        if (barExpiry === "permanent") {
            try { player.sendMessage("§c这扇门被撬开了，无法关闭"); } catch (e) { }
            return;
        }
        if (barExpiry > mc.system.currentTick) {
            try { player.sendMessage("§c这扇门被撬棍卡住了，稍后才能打开"); } catch (e) { }
            return;
        }
        CROWBARED_DOORS.delete(doorKeyStr); // 临时锁定过期，解锁
    }

    // 手持对应钥匙切换开/关
    const isOpen = block.permutation.getState(S_OPEN) === true;
    const nextOpen = !isOpen;
    const key = doorKeyStr;
    const lowerBlock = doorLower(block);
    const dim = lowerBlock.dimension;
    const lowerLoc = { x: lowerBlock.x, y: lowerBlock.y, z: lowerBlock.z };
    const openedAt = mc.system.currentTick;

    if (nextOpen) {
        openTimers.set(key, openedAt);
    } else {
        openTimers.delete(key);
    }

    mc.system.run(() => {
        toggleOpen(block, nextOpen);
        try {
            dim.playSound(nextOpen ? "open.wooden_door" : "close.wooden_door", lowerLoc, { pitch: 1.0, volume: 1.5 });
        } catch (e) { }
    });

    // 开门 3 秒后自动关门
    if (nextOpen) {
        mc.system.runTimeout(() => {
            try {
                const low = dim.getBlock({ x: lowerLoc.x, y: lowerLoc.y, z: lowerLoc.z });
                if (!low || !isDoor(low)) { openTimers.delete(key); return; }
                // 期间门被再次打开/关闭过则跳过本次
                if (openTimers.get(key) !== openedAt) return;
                // 被撬棍永久锁定的门不自动关门
                if (CROWBARED_DOORS.get(key) === "permanent") { openTimers.delete(key); return; }
                if (low.permutation.getState(S_OPEN) === true) {
                    toggleOpen(low, false);
                    try { dim.playSound("close.wooden_door", low.location, { pitch: 1.0, volume: 2.0 }); } catch (e2) { }
                }
                openTimers.delete(key);
            } catch (e) { }
        }, 60);
    }
});


// ============ 按钮检测自动开门：门上半后方/前方一格左右两边有激活按钮则开门 ============
// 门朝向 -> 后方（cardinal 方向）偏移
const CARDINAL_BACK = {
    "north": [0, 0, -1],
    "south": [0, 0, 1],
    "east": [1, 0, 0],
    "west": [-1, 0, 0],
};
// 后方格的左右两边（垂直于门朝向的水平两侧）
const CARDINAL_SIDES = {
    "north": [[1, 0, 0], [-1, 0, 0]],
    "south": [[1, 0, 0], [-1, 0, 0]],
    "east": [[0, 0, 1], [0, 0, -1]],
    "west": [[0, 0, 1], [0, 0, -1]],
};

// 是否为被激活的按钮（任意按钮方块，button_pressed_bit = true）
function isPressedButton(block) {
    if (!block) return false;
    const t = block.typeId;
    if (!t.endsWith("_button") && !t.endsWith("button")) return false;
    try {
        return block.permutation.getState("button_pressed_bit") === true;
    } catch (e) {
        return false;
    }
}

// 检查门（任意一格）上半 前方/后方 一格左右两边是否有激活按钮（两个方向都检测）
function doorHasPressedButton(block) {
    try {
        const dim = block.dimension;
        const cardinal = String(block.permutation.getState(S_CARDINAL));
        const back = CARDINAL_BACK[cardinal];
        if (!back) return false;
        // 前方 = cardinal 反方向
        const front = [-back[0], -back[1], -back[2]];
        // 上半格（part==upper 用自身，lower 用 above）
        const isUpper = block.permutation.getState(S_PART) === "upper";
        const yBase = isUpper ? block.y : block.y + 1;
        // 后方一格 + 前方一格 都检测左右两边
        for (const off of [back, front]) {
            const baseX = block.x + off[0], baseZ = block.z + off[2];
            for (const s of CARDINAL_SIDES[cardinal]) {
                const btn = dim.getBlock({ x: baseX + s[0], y: yBase, z: baseZ + s[2] });
                if (isPressedButton(btn)) return true;
            }
        }
    } catch (e) { }
    return false;
}

// 轮询玩家附近区域的门，检测按钮激活
mc.system.runInterval(() => {
    for (const p of mc.world.getPlayers()) {
        if (!p.isValid) continue;
        const dim = p.dimension;
        const c = p.location;
        const from = { x: Math.floor(c.x) - 24, y: Math.floor(c.y) - 24, z: Math.floor(c.z) - 24 };
        const to = { x: Math.floor(c.x) + 24, y: Math.floor(c.y) + 24, z: Math.floor(c.z) + 24 };
        try {
            const vol = new mc.BlockVolume(from, to);
            const hits = dim.getBlocks(vol, { includeTypes: [...DOOR_IDS] }, false);
            for (const loc of hits.getBlockLocationIterator()) {
                try {
                    const block = dim.getBlock({ x: loc.x, y: loc.y, z: loc.z });
                    if (!block || !isDoor(block)) continue;
                    // 只处理下半格，避免同扇门重复触发
                    if (block.permutation.getState(S_PART) !== "lower") continue;
                    if (block.permutation.getState(S_OPEN) === true) continue; // 已开不重复
                    if (doorHasPressedButton(block)) {
                        openDoorWithAutoClose(block);
                    }
                } catch (e) { }
            }
        } catch (e) { }
    }
}, 5);

function openDoorWithAutoClose(block) {
    const key = doorKey(block);
    const lowerBlock = doorLower(block);
    const dim = lowerBlock.dimension;
    const lowerLoc = { x: lowerBlock.x, y: lowerBlock.y, z: lowerBlock.z };
    const openedAt = mc.system.currentTick;
    openTimers.set(key, openedAt);
    mc.system.run(() => {
        toggleOpen(block, true);
        try { dim.playSound("open.wooden_door", lowerLoc, { pitch: 1.0, volume: 1.5 }); } catch (e) { }
    });
    mc.system.runTimeout(() => {
        try {
            const low = dim.getBlock({ x: lowerLoc.x, y: lowerLoc.y, z: lowerLoc.z });
            if (!low || !isDoor(low)) { openTimers.delete(key); return; }
            if (openTimers.get(key) !== openedAt) return;
            if (low.permutation.getState(S_OPEN) === true) {
                toggleOpen(low, false);
                try { dim.playSound("close.wooden_door", low.location, { pitch: 1.0, volume: 2.0 }); } catch (e2) { }
            }
            openTimers.delete(key);
        } catch (e) { }
    }, 60);
}


// 供 main.js 在游戏结束时调用，清除所有撬棍锁定并关闭被撬开的门
export function clearCrowbaredDoors() {
    const dim = mc.world.getDimension("overworld");
    for (const [key, expiry] of CROWBARED_DOORS) {
        if (expiry === "permanent") {
            try {
                const parts = key.split("@");
                const coords = parts[1].split(",");
                const x = parseInt(coords[0]), y = parseInt(coords[1]), z = parseInt(coords[2]);
                const block = dim.getBlock({ x, y, z });
                if (block && isDoor(block) && block.permutation.getState(S_OPEN) === true) {
                    toggleOpen(block, false);
                }
            } catch (e) { }
        }
    }
    CROWBARED_DOORS.clear();
}