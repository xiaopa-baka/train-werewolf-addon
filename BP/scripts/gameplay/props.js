// @ts-check
// props.js - 道具系统

import * as mc from "@minecraft/server";
import { ModalFormData } from "@minecraft/server-ui";
import { getWorldConfig } from "../config/worldConfig.js";
import { getRemainSeconds, setTaskProgress, getPlayerState, isInGame, isKiller, isOfficer } from "../core/state.js";
import { t } from "../core/i18n.js";
import { registerActionBarProvider } from "../core/hud.js";


// 判断玩家是否为创造模式
function isCreative(player) {
    try {
        return player.getGameMode() === mc.GameMode.Creative;
    } catch (e) {
        return false;
    }
}


// 玩家触发死亡逻辑，生成尸体实体、关联 ownerId、切换到观察者模式
function poisonKill(player) {
    if (!player?.isValid) return;
    if (!isCreative(player)) {
        try {
            const noteContent = player.getDynamicProperty("lw_p1:noteMessage");
            try {
                player.runCommand("summon lw_p1:corpes ~ ~ ~ facing ^ ^ ^1");
                player.runCommand("execute as @e[type=lw_p1:corpes,r=1] at @s run tp @s ~ ~ ~ ~ 20");
            } catch (e) { }
            const pid = player.id;
            const ploc = player.location;
            const pdim = player.dimension;
            mc.system.runTimeout(() => {
                try {
                    const nearby = pdim.getEntities({ type: "lw_p1:corpes", location: ploc, maxDistance: 3 });
                    let best = null, bestDist = Infinity;
                    for (const c of nearby) {
                        if (!c.isValid) continue;
                        if (typeof c.getDynamicProperty("lw_p1:ownerId") === "string") continue;
                        const d = (c.location.x - ploc.x) ** 2 + (c.location.y - ploc.y) ** 2 + (c.location.z - ploc.z) ** 2;
                        if (d < bestDist) { bestDist = d; best = c; }
                    }
                    if (best) {
                        best.setDynamicProperty("lw_p1:ownerId", pid);
                        if (noteContent && typeof noteContent === "string" && noteContent.trim() !== "") {
                            best.setDynamicProperty("lw_p1:noteContent", noteContent);
                        }
                    }
                } catch (e) { }
            }, 1);
            player.setGameMode(mc.GameMode.Spectator);
        } catch (e) { }
    }
}


// ===== 音效传播辅助 =====
// 对范围内每个玩家单独播放：播放点放在该玩家「朝声源方向 1 格」处（有方位感，且距离≈1 必然出声）；
// 音量按距离线性衰减：volume = 1 - 距离 × falloff，小于 0 记 0（0 即不播放）。
// 参数：dimensionId 维度 id；loc 声源坐标；soundId 音效名；falloff 每 1 格衰减的音量
export function playSoundNearby(dimensionId, loc, soundId, falloff) {
    // 统一去掉命名空间前缀：调用方可能传 "overworld"，而 dimension.id 是 "minecraft:overworld"
    const shortId = (id) => String(id).split(":").pop();
    const wantDim = shortId(dimensionId);

    for (const p of mc.world.getPlayers()) {
        if (!p.isValid) continue;
        try { if (shortId(p.dimension.id) !== wantDim) continue; } catch (e) { continue; }

        let dx = loc.x - p.location.x;
        let dy = loc.y - p.location.y;
        let dz = loc.z - p.location.z;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

        const volume = Math.max(0, 1 - dist * falloff);
        if (volume <= 0) continue;

        if (dist < 1e-4) { dx = 0; dy = 0; dz = 1; }   // 与声源重合，退化为正前方
        else { dx /= dist; dy /= dist; dz /= dist; }

        // 播放点 = 玩家位置朝声源方向 1 格
        const sx = p.location.x + dx;
        const sy = p.location.y + dy;
        const sz = p.location.z + dz;

        try {
            p.dimension.runCommand(`playsound ${soundId} "${p.name}" ${sx.toFixed(3)} ${sy.toFixed(3)} ${sz.toFixed(3)} ${volume.toFixed(3)} 1`);
        } catch (e) { }
    }
}


// ===== 匕首 =====
const chargeStartTick = new Map();
// 获取玩家前方一定角度、一定范围内最近的其他玩家（同格也算命中）
function getPlayerInFront(player) {
    const yaw = player.getRotation().y * Math.PI / 180;
    const dirX = -Math.sin(yaw);
    const dirZ = Math.cos(yaw);

    const p = player.location;
    const MAX_RANGE = 1.5;              // 最大检测距离（格，水平）
    const MAX_ANGLE_DEG = 60;           // 视角半角（度）
    const cosMax = Math.cos(MAX_ANGLE_DEG * Math.PI / 180);

    let bestTarget = null;
    let bestDistSq = Infinity;

    for (const other of mc.world.getPlayers()) {
        if (!other.isValid || other.id === player.id) continue;
        // 旁观（已淘汰）玩家不参与刺杀判定
        let otherIsSpec = false;
        try { otherIsSpec = other.getGameMode() === mc.GameMode.Spectator; } catch (e) { continue; }
        if (otherIsSpec) continue;

        const o = other.location;
        const dx = o.x - p.x;
        const dy = o.y - p.y;
        const dz = o.z - p.z;
        const distSq = dx * dx + dz * dz;   // 水平距离平方（Y 单独判定）

        if (distSq > MAX_RANGE * MAX_RANGE) continue;
        if (Math.abs(dy) > 1.5) continue;   // 上下楼层不命中

        // 同格或几乎重合：直接视为在正前方，无需角度判定
        let inAngle = true;
        if (distSq > 0.01) {
            const dist = Math.sqrt(distSq);
            const dot = (dx * dirX + dz * dirZ) / dist;
            inAngle = dot >= cosMax;
        }
        if (!inAngle) continue;

        if (distSq < bestDistSq) {
            bestDistSq = distSq;
            bestTarget = other;
        }
    }
    return bestTarget;
}

// 刺杀逻辑
mc.world.afterEvents.worldLoad.subscribe(() => {

    // 开始蓄力
    mc.world.afterEvents.itemStartUse.subscribe((event) => {
        const player = event.source;
        if (!player?.isValid || event.itemStack?.typeId !== "lw_p1:dagger") return;

        if (!isCreative(player)) {
            try {
                if (player.getItemCooldown("lw_p1_dagger") > 0) {
                    /** @ts-ignore stopUsingItem 运行时仍可用但类型定义中缺失 */
                    player.stopUsingItem();
                    return;
                }
            } catch (e) { }
        }

        chargeStartTick.set(player.id, mc.system.currentTick);
        try {
            player.runCommand(`playsound dagger_1 @a ~ ~ ~ 1`);
        } catch (e) { }
    });

    // 满蓄力则命中前方一格的其他玩家
    const handleRelease = (event) => {
        const player = event.source;
        if (!player?.isValid || event.itemStack?.typeId !== "lw_p1:dagger") return;

        const startTick = chargeStartTick.get(player.id);
        chargeStartTick.delete(player.id);
        if (startTick === undefined) return;

        const chargedTicks = mc.system.currentTick - startTick;
        if (chargedTicks < 10) return;

        const target = getPlayerInFront(player);
        if (target) {
            getPlayerState(target).hurt = true;
            try {
                target.runCommand(`playsound dagger_2 @a ~ ~ ~ 1`);
            } catch (e) { }

            // 只有命中目标才进入冷却
            if (!isCreative(player)) {
                try {
                    player.startItemCooldown("lw_p1_dagger", 600);
                } catch (e) { }
            }
        }
    };

    mc.world.afterEvents.itemReleaseUse.subscribe(handleRelease);
    mc.world.afterEvents.itemCompleteUse.subscribe(handleRelease);

});


// ===== 爆竹 =====
mc.world.afterEvents.entitySpawn.subscribe((event) => {
    const entity = event.entity;
    if (entity.typeId === "lw_p1:firecracker") {
        entity.setDynamicProperty("lw_p1:spawnTick", mc.system.currentTick);
    }
});

mc.system.runInterval(() => {
    for (const dimName of ["overworld", "nether", "the_end"]) {
        let dimension;
        try {
            dimension = mc.world.getDimension(dimName);
        } catch { continue; }
        if (!dimension) continue;

        for (const fc of dimension.getEntities({ type: "lw_p1:firecracker" })) {
            if (!fc.isValid) continue;

            const spawnTick = fc.getDynamicProperty("lw_p1:spawnTick");
            if (typeof spawnTick !== "number") continue;
            const nowTick = mc.system.currentTick;

            // 弹道：每 tick 推进（带重力），碰到方块即停
            const vx = fc.getDynamicProperty("lw_p1:vx");
            const vy = fc.getDynamicProperty("lw_p1:vy");
            const vz = fc.getDynamicProperty("lw_p1:vz");
            if (typeof vx === "number" && typeof vy === "number" && typeof vz === "number") {
                const GRAVITY = 0.05;
                const newVy = vy - GRAVITY;
                const loc = fc.location;

                // 位移拆成子步逐点判定，避免漏检嵌进方块
                const SUB = 0.1;
                const stepLen = Math.sqrt(vx * vx + newVy * newVy + vz * vz) || 1;
                const n = Math.min(16, Math.max(1, Math.ceil(stepLen / SUB)));
                let curX = loc.x, curY = loc.y, curZ = loc.z;
                let hitBlock = false;
                for (let i = 0; i < n; i++) {
                    const nx = curX + vx / n, ny = curY + newVy / n, nz = curZ + vz / n;
                    let blocked = false;
                    try {
                        const blk = dimension.getBlock({ x: nx, y: ny, z: nz });
                        if (blk && !blk.isAir && !blk.isLiquid) blocked = true;
                    } catch (e) { }
                    if (blocked) { hitBlock = true; break; }
                    curX = nx; curY = ny; curZ = nz;
                }

                if (hitBlock) {
                    // 停住并记录落地时刻
                    fc.teleport({ x: curX, y: curY, z: curZ }, { dimension: fc.dimension });
                    fc.setDynamicProperty("lw_p1:vx", undefined);
                    fc.setDynamicProperty("lw_p1:vy", undefined);
                    fc.setDynamicProperty("lw_p1:vz", undefined);
                    fc.setDynamicProperty("lw_p1:landTick", nowTick);
                } else {
                    fc.setDynamicProperty("lw_p1:vy", newVy);
                    fc.teleport({ x: curX, y: curY, z: curZ }, { dimension: fc.dimension });
                }
            }

            // 未落地：不喷粒子、不倒计时，超时兜底
            const landTick = fc.getDynamicProperty("lw_p1:landTick");
            if (typeof landTick !== "number") {
                if (nowTick - spawnTick >= 1200) { try { fc.remove(); } catch (e) { } }
                continue;
            }

            const landedAge = nowTick - landTick;

            // 落地第一帧喷一次火苗
            if (landedAge === 0) {
                try {
                    fc.runCommand(`particle minecraft:basic_flame_particle ^0.1 ^0.1 ^0.06`);
                } catch (e) { }
            }

            // 烟：每 5 tick 一次
            if (landedAge % 5 === 0) {
                try {
                    fc.runCommand(`particle minecraft:basic_smoke_particle ^0.1 ^0.1 ^0.06`);
                } catch (e) { }
            }

            // 落地 15 秒后爆炸
            if (landedAge >= 300) {
                try {
                    playSoundNearby(fc.dimension.id, fc.location, "firecracker", 0.015);
                    fc.runCommand(`particle minecraft:lava_particle ~ ~ ~`);
                    fc.runCommand(`particle minecraft:lava_particle ~ ~ ~`);
                    fc.runCommand(`particle minecraft:lava_particle ~ ~ ~`);
                } catch (e) { }
                fc.remove();
            }
        }
    }
}, 1);

// 爆竹：右键抛出，带重力飞行，碰到方块停下
const firecrackerThrowCooldown = new Map();
const FIRECRACKER_THROW_INTERVAL = 10;

function throwFirecracker(player) {
    const last = firecrackerThrowCooldown.get(player.id) ?? 0;
    if (mc.system.currentTick - last < FIRECRACKER_THROW_INTERVAL) return;
    firecrackerThrowCooldown.set(player.id, mc.system.currentTick);

    const slot = player.selectedSlotIndex;
    mc.system.run(() => {
        try {
            if (!player.isValid) return;

            // 消耗一个爆竹（创造模式不消耗）
            if (!isCreative(player)) {
                const c = player.getComponent('inventory').container;
                const it = c.getItem(slot);
                if (it && it.typeId === 'lw_p1:firecracker') {
                    if (it.amount > 1) { it.amount -= 1; c.setItem(slot, it); }
                    else { c.setItem(slot, undefined); }
                }
            }

            const loc = player.location;
            const spawnLoc = { x: loc.x, y: (loc.y ?? 0) + 1.62, z: loc.z };
            const view = player.getViewDirection();
            const len = Math.sqrt(view.x * view.x + view.y * view.y + view.z * view.z) || 1;
            const speed = 0.5;   // 初速度（格/tick）

            let fc;
            try {
                fc = player.dimension.spawnEntity('lw_p1:firecracker', spawnLoc);
            } catch (e) {
                return;
            }
            fc.setDynamicProperty('lw_p1:spawnTick', mc.system.currentTick);
            fc.setDynamicProperty('lw_p1:vx', (view.x / len) * speed);
            fc.setDynamicProperty('lw_p1:vy', (view.y / len) * speed);
            fc.setDynamicProperty('lw_p1:vz', (view.z / len) * speed);

            // 生成朝向跟随玩家视角
            try {
                const rot = player.getRotation();
                fc.setRotation({ x: rot.x, y: rot.y });
            } catch (e) { }

            try { player.runCommand('playsound random.bow @a ~ ~ ~ 1 1.5'); } catch (e) { }
        } catch (e) { }
    });
}

// 两种右键触发都拦截
mc.world.beforeEvents.itemUse.subscribe((event) => {
    const player = event.source;
    const item = event.itemStack;
    if (!player?.isValid || !item) return;
    if (item.typeId !== 'lw_p1:firecracker') return;

    event.cancel = true;
    throwFirecracker(player);
});

mc.world.beforeEvents.playerInteractWithBlock.subscribe((event) => {
    const player = event.player;
    const item = event.itemStack;
    if (!player?.isValid || !item) return;
    if (item.typeId !== 'lw_p1:firecracker') return;

    event.cancel = true;
    if (!event.isFirstEvent) return;
    throwFirecracker(player);
});


// ===== 手枪 =====
// 根据玩家朝向计算子弹初始速度方向
function getBulletVelocity(player) {
    const view = player.getViewDirection();
    const len = Math.sqrt(view.x * view.x + view.y * view.y + view.z * view.z) || 1;
    return {
        x: (view.x / len) * 5,
        y: (view.y / len) * 5,
        z: (view.z / len) * 5
    };
}

// 生成子弹实体
function spawnBullet(player, weaponType) {
    const loc = player.location;
    const headY = (loc.y ?? 0) + 1.62;
    const spawnLoc = { x: loc.x, y: headY, z: loc.z };
    const velocity = getBulletVelocity(player);

    let bullet;
    try {
        bullet = player.dimension.spawnEntity("lw_p1:bullet", spawnLoc);
    } catch (e) {
        console.error("[spawnBullet] spawn fail:", e);
        return;
    }

    bullet.setDynamicProperty("lw_p1:spawnTick", mc.system.currentTick);
    bullet.setDynamicProperty("lw_p1:shooterId", player.id);
    bullet.setDynamicProperty("lw_p1:weaponType", weaponType);

    // 统一手动推进，保证命中判定与子弹位置在同一 tick 同步
    bullet.setDynamicProperty("lw_p1:vx", velocity.x);
    bullet.setDynamicProperty("lw_p1:vy", velocity.y);
    bullet.setDynamicProperty("lw_p1:vz", velocity.z);
}

// 记录手枪当前在瞄准中、还未开枪结束的玩家
const pistolAiming = new Map();

// 按住右键进入蓄力状态，松手时开枪
mc.world.afterEvents.worldLoad.subscribe(() => {

    // 开始蓄力，若冷却中则打断
    mc.world.afterEvents.itemStartUse.subscribe((event) => {
        const player = event.source;
        const typeId = event.itemStack?.typeId;
        if (!player?.isValid) return;
        if (typeId !== "lw_p1:pistol" && typeId !== "lw_p1:pistol_mini") return;

        const cooldownCategory = typeId === "lw_p1:pistol" ? "lw_p1_pistol" : "lw_p1_pistol_mini";
        if (!isCreative(player)) {
            try {
                if (player.getItemCooldown(cooldownCategory) > 0) {
                    /** @ts-ignore stopUsingItem 运行时仍可用但类型定义中缺失 */
                    player.stopUsingItem();
                    return;
                }
            } catch (e) { }
        }

        pistolAiming.set(player.id, typeId);
    });

    // 松手开枪
    const handleShoot = (event) => {
        const player = event.source;
        const typeId = event.itemStack?.typeId;
        if (!player?.isValid) return;
        if (typeId !== "lw_p1:pistol" && typeId !== "lw_p1:pistol_mini") return;

        if (!pistolAiming.has(player.id)) return;
        pistolAiming.delete(player.id);

        const cooldownCategory = typeId === "lw_p1:pistol" ? "lw_p1_pistol" : "lw_p1_pistol_mini";

        try {
            playSoundNearby(player.dimension.id, player.location, "pistol", 0.03);
        } catch (e) { }

        spawnBullet(player, typeId);

        try {
            player.runCommand(`particle minecraft:campfire_smoke_particle ^-0.5 ^1.5 ^0.2`);
        } catch (e) { }

        try {
            player.runCommand(`camerashake add @s 0.4 0.15 positional`);
        } catch (e) { }

        if (!isCreative(player)) {
            try {
                player.startItemCooldown(cooldownCategory, 200);
            } catch (e) { }
        }
    };

    mc.world.afterEvents.itemReleaseUse.subscribe(handleShoot);
    mc.world.afterEvents.itemCompleteUse.subscribe(handleShoot);

    // 若蓄力被中断则清除瞄准状态
    mc.world.afterEvents.itemStopUse.subscribe((event) => {
        const player = event.source;
        const typeId = event.itemStack?.typeId;
        if (!player?.isValid) return;
        if (typeId !== "lw_p1:pistol" && typeId !== "lw_p1:pistol_mini") return;

        pistolAiming.delete(player.id);
    });
});

// ===== 子弹 =====
mc.system.runInterval(() => {
    for (const dimName of ["overworld", "nether", "the_end"]) {
        let dimension;
        try {
            dimension = mc.world.getDimension(dimName);
        } catch { continue; }
        if (!dimension) continue;

        for (const bullet of dimension.getEntities({ type: "lw_p1:bullet" })) {
            if (!bullet.isValid) continue;

            const spawnTick = bullet.getDynamicProperty("lw_p1:spawnTick");
            if (typeof spawnTick !== "number") { bullet.remove(); continue; }
            const age = mc.system.currentTick - spawnTick;

            try {
                bullet.runCommand(`particle minecraft:white_smoke_particle ~ ~ ~`);
            } catch (e) { }

            // 超时未命中销毁（德林杰未命中消失）
            if (age >= 20) {
                try {
                    const wp = bullet.getDynamicProperty("lw_p1:weaponType");
                    const sid = bullet.getDynamicProperty("lw_p1:shooterId");
                    if (wp === "lw_p1:pistol_mini" && typeof sid === "string") {
                        const shooter = Array.from(mc.world.getPlayers()).find(p => p.id === sid);
                        if (shooter && shooter.isValid && !isCreative(shooter)) {
                            const container = shooter.getComponent("minecraft:inventory")?.container;
                            if (container) {
                                for (let i = 0; i < container.size; i++) {
                                    const item = container.getItem(i);
                                    if (item?.typeId === "lw_p1:pistol_mini") {
                                        container.setItem(i, undefined);
                                        break;
                                    }
                                }
                            }
                        }
                    }
                } catch (e) { }
                bullet.remove();
                continue;
            }

            const vx = bullet.getDynamicProperty("lw_p1:vx");
            const vy = bullet.getDynamicProperty("lw_p1:vy");
            const vz = bullet.getDynamicProperty("lw_p1:vz");
            const shooterId = bullet.getDynamicProperty("lw_p1:shooterId");
            const weaponType = bullet.getDynamicProperty("lw_p1:weaponType");

            let hit = null;
            let blockedByBlock = false;

            if (typeof vx === "number" && typeof vy === "number" && typeof vz === "number") {
                const loc = bullet.location;
                const stepLen = Math.sqrt(vx * vx + vy * vy + vz * vz) || 1;
                // 每 tick 位移拆成不超过 0.5 格的子步逐段判定：
                // 近距离俯射时视线向下，整段射线会先打到地面/墙导致子弹在判定玩家前销毁，
                // 子步推进并优先判定玩家可避免这种漏判
                const subCount = Math.max(1, Math.ceil(stepLen / 0.5));
                const sx = vx / subCount;
                const sy = vy / subCount;
                const sz = vz / subCount;
                const subLen = stepLen / subCount;

                let cur = { x: loc.x, y: loc.y, z: loc.z };
                let advanced = false;

                for (let i = 0; i < subCount; i++) {
                    const nx = cur.x + sx, ny = cur.y + sy, nz = cur.z + sz;

                    // 先判玩家：线段（cur→next）到玩家中心的最短距离
                    for (const p of mc.world.getPlayers()) {
                        if (!p.isValid) continue;
                        if (typeof shooterId === "string" && p.id === shooterId) continue;
                        // 旁观（已淘汰）玩家不阻挡弹道，子弹穿过
                        let pIsSpec = false;
                        try { pIsSpec = p.getGameMode() === mc.GameMode.Spectator; } catch (e) { continue; }
                        if (pIsSpec) continue;
                        const cx = p.location.x, cy = p.location.y + 0.9, cz = p.location.z;

                        const abx = nx - cur.x, aby = ny - cur.y, abz = nz - cur.z;
                        const abLen2 = abx * abx + aby * aby + abz * abz;
                        let d2;
                        if (abLen2 > 0) {
                            const tt = Math.max(0, Math.min(1, ((cx - cur.x) * abx + (cy - cur.y) * aby + (cz - cur.z) * abz) / abLen2));
                            d2 = (cx - (cur.x + tt * abx)) ** 2 + (cy - (cur.y + tt * aby)) ** 2 + (cz - (cur.z + tt * abz)) ** 2;
                        } else {
                            d2 = (cx - cur.x) ** 2 + (cy - cur.y) ** 2 + (cz - cur.z) ** 2;
                        }

                        // 0.81 = 0.9²，命中半径 0.9 格（用平方距离比较，省去开方）
                        if (d2 <= 0.81) { hit = p; break; }
                    }
                    if (hit) break;

                    // 再判方块：该子步内的方块碰撞
                    try {
                        const dirLen = subLen || 1;
                        const dir = { x: sx / dirLen, y: sy / dirLen, z: sz / dirLen };
                        const ray = dimension.getBlockFromRay(cur, dir, {
                            maxDistance: subLen,
                            includeLiquidBlocks: false,
                            includePassableBlocks: false
                        });
                        if (ray) { blockedByBlock = true; break; }
                    } catch (e) { }

                    cur = { x: nx, y: ny, z: nz };
                    advanced = true;
                }

                if (!hit && !blockedByBlock && advanced) {
                    try {
                        bullet.teleport(cur, { dimension: bullet.dimension });
                    } catch (e) { }
                }
            }

            // 命中方块销毁（德林杰未命中消失）
            if (blockedByBlock) {
                try {
                    if (weaponType === "lw_p1:pistol_mini" && typeof shooterId === "string") {
                        const shooter = Array.from(mc.world.getPlayers()).find(p => p.id === shooterId);
                        if (shooter && shooter.isValid && !isCreative(shooter)) {
                            const container = shooter.getComponent("minecraft:inventory")?.container;
                            if (container) {
                                for (let i = 0; i < container.size; i++) {
                                    const item = container.getItem(i);
                                    if (item?.typeId === "lw_p1:pistol_mini") {
                                        container.setItem(i, undefined);
                                        break;
                                    }
                                }
                            }
                        }
                    }
                } catch (e) { }
                bullet.remove();
                continue;
            }

            if (hit) {
                getPlayerState(hit).hurt = true;
                bullet.setDynamicProperty("lw_p1:hasHit", true);

                // 左轮手枪误伤平民，掉落手枪实体（仅局内生效，局外测试不受影响）
                const shooterP = Array.from(mc.world.getPlayers()).find(p => p.id === shooterId);
                if (weaponType === "lw_p1:pistol" && !isKiller(hit) && shooterP?.isValid && isInGame(shooterP)) {
                    try {
                        const shooter = shooterP;
                        if (shooter && shooter.isValid && !isCreative(shooter)) {
                            const container = shooter.getComponent("minecraft:inventory")?.container;
                            if (container) {
                                for (let i = 0; i < container.size; i++) {
                                    const item = container.getItem(i);
                                    if (item?.typeId === "lw_p1:pistol") {
                                        container.setItem(i, undefined);
                                        break;
                                    }
                                }
                            }
                            const vd = shooter.getViewDirection();
                            shooter.dimension.spawnEntity("lw_p1:pistol", {
                                x: shooter.location.x + vd.x,
                                y: shooter.location.y + 1.0,
                                z: shooter.location.z + vd.z
                            });
                            getPlayerState(shooter).pistolDisabled = true;
                        }
                    } catch (e) { }
                }

                bullet.remove();
            }
        }
    }
}, 1);

// 手枪实体交互拾取
mc.world.beforeEvents.playerInteractWithEntity.subscribe((event) => {
    const player = event.player;
    const target = event.target;
    if (!player?.isValid || !target?.isValid) return;
    if (target.typeId !== "lw_p1:pistol") return;

    event.cancel = true;

    // 杀手无法拾取
    if (isKiller(player)) {
        try { player.sendMessage(t("lw_p1.prop.pistol.killerBlocked")); } catch (e) { }
        return;
    }
    // 掉落过枪的人无法拾取
    if (getPlayerState(player).pistolDisabled) {
        try { player.sendMessage(t("lw_p1.prop.pistol.lostRight")); } catch (e) { }
        return;
    }

    const targetId = target.id;
    mc.system.run(() => {
        if (!player.isValid) return;
        try {
            const pistolEntity = mc.world.getEntity(targetId);
            if (!pistolEntity?.isValid) return;

            const pistol = new mc.ItemStack("lw_p1:pistol", 1);
            const container = player.getComponent("inventory").container;
            const res = container.addItem(pistol);
            if (res === undefined || res === null) {
                pistolEntity.remove();
                // 防止拾取后走火
                try { player.startItemCooldown("lw_p1_pistol", 20); } catch (e) { }
                try { player.sendMessage(t("lw_p1.prop.pistol.picked")); } catch (e) { }
            } else {
                try { player.sendMessage(t("lw_p1.prop.invFull")); } catch (e) { }
            }
        } catch (e) { }
    });
});


// ===== 球棒 =====
mc.world.afterEvents.entityHurt.subscribe((event) => {
    const hurt = event.hurtEntity;
    if (!hurt?.isValid) return;
    if (hurt.typeId !== "minecraft:player") return;
    const attacker = event.damageSource.damagingEntity;
    if (!attacker?.isValid || attacker.typeId !== "minecraft:player") return;
    const attackerPlayer = Array.from(mc.world.getPlayers()).find(p => p.id === attacker.id);
    if (!attackerPlayer?.isValid) return;
    let hand = null;
    try {
        const c = attackerPlayer.getComponent("inventory").container;
        hand = c.getItem(attackerPlayer.selectedSlotIndex)?.typeId ?? null;
    } catch (e) { }
    if (hand !== "lw_p1:bat") return;
    try {
        if (attackerPlayer.getItemCooldown("lw_p1_bat") > 0) return;
        attackerPlayer.startItemCooldown("lw_p1_bat", 40);
        getPlayerState(hurt).hurt = true;
    } catch (e) { }
});

// 球棒狂暴
const batFrenzy = new Set();

mc.system.runInterval(() => {
    for (const player of mc.world.getPlayers()) {
        if (!player.isValid) continue;
        if (!isKiller(player)) continue;
        if (!isInGame(player)) continue;
        if (batFrenzy.has(player.id)) continue;

        let hasBat = false;
        try {
            const container = player.getComponent('inventory').container;
            for (let i = 0; i < container.size; i++) {
                if (container.getItem(i)?.typeId === 'lw_p1:bat') {
                    hasBat = true;
                    break;
                }
            }
        } catch (e) { }
        if (!hasBat) continue;

        batFrenzy.add(player.id);
        try { player.addEffect('minecraft:speed', 600, { amplifier: 2, showParticles: true }); } catch (e) { }

        for (const p of mc.world.getPlayers()) {
            if (!p.isValid) continue;
            try { p.sendMessage(t("lw_p1.prop.mad.start", player.name)); } catch (e) { }
        }

        // 30 秒后清除球棍并结束狂暴
        mc.system.runTimeout(() => {
            batFrenzy.delete(player.id);
            if (!player.isValid) return;
            try {
                const container = player.getComponent('inventory').container;
                for (let i = 0; i < container.size; i++) {
                    if (container.getItem(i)?.typeId === 'lw_p1:bat') {
                        container.setItem(i, undefined);
                        break;
                    }
                }
            } catch (e) { }
            for (const p of mc.world.getPlayers()) {
                if (!p.isValid) continue;
                try { p.sendMessage(t("lw_p1.prop.mad.end", player.name)); } catch (e) { }
            }
        }, 600);
    }
}, 20);


// ===== 香烟 =====
mc.world.beforeEvents.itemUse.subscribe((event) => {
    const player = event.source;
    const item = event.itemStack;
    if (!player?.isValid || !item) return;
    if (item.typeId !== 'lw_p1:cigarette') return;

    const slot = player.selectedSlotIndex;
    mc.system.run(() => {
        try {
            if (!player.isValid) return;
            player.runCommand('particle minecraft:campfire_smoke_particle ^ ^1.5 ^0.5');
            if (!isCreative(player)) {
                const c = player.getComponent('inventory').container;
                const it = c.getItem(slot);
                if (it && it.typeId === 'lw_p1:cigarette') {
                    if (it.amount > 1) { it.amount -= 1; c.setItem(slot, it); }
                    else { c.setItem(slot, undefined); }
                }
            }
        } catch (e) { }
    });

    if (getPlayerState(player).taskId === 6) {
        setTaskProgress(player, 300);
    }
});


// ===== 矿泉水 =====
mc.world.afterEvents.itemCompleteUse.subscribe((event) => {
    const player = event.source;
    const item = event.itemStack;
    if (!player?.isValid || !item) return;

    if (item.typeId === 'lw_p1:mineral_water') {
        const slot = player.selectedSlotIndex;
        mc.system.run(() => {
            try {
                if (!player.isValid) return;
                const c = player.getComponent('inventory').container;
                const it = c.getItem(slot);
                if (!isCreative(player)) {
                    if (it && it.typeId === 'lw_p1:mineral_water') {
                        if (it.amount > 1) { it.amount -= 1; c.setItem(slot, it); }
                        else { c.setItem(slot, undefined); }
                    }
                };
                const bottle = new mc.ItemStack('lw_p1:mineral_water_bottle', 1);
                c.addItem(bottle);
            } catch (e) { }
        });
        return;
    }
});


// ===== 矿泉水瓶 =====
mc.world.beforeEvents.itemUse.subscribe((event) => {
    const player = event.source;
    const item = event.itemStack;
    if (!player?.isValid || !item) return;
    if (item.typeId !== 'lw_p1:mineral_water_bottle') return;
    if (getPlayerState(player).taskId !== 2) return;

    const slot = player.selectedSlotIndex;
    mc.system.run(() => {
        try {
            if (!player.isValid) return;
            if (!isCreative(player)) {
                const c = player.getComponent('inventory').container;
                const it = c.getItem(slot);
                if (it && it.typeId === 'lw_p1:mineral_water_bottle') {
                    if (it.amount > 1) { it.amount -= 1; c.setItem(slot, it); }
                    else { c.setItem(slot, undefined); }
                }
            };
            // 任务2（蹲坑）为 reset 型：未蹲坑时进度每 tick 被清零，
            // 因此不能只加进度，直接标记完成（后续结算/奖励/清理由 tasks.js 处理）
            const ps = getPlayerState(player);
            ps.taskDone = true;
            ps.taskDoneTick = mc.system.currentTick;
        } catch (e) { }
    });
});


// ===== 饮料 =====
const DRINK_IDS = new Set([
    "lw_p1:royal_jelly",
    "lw_p1:champagne",
    "lw_p1:cosmopolitan",
    "lw_p1:martini",
    "lw_p1:mojito",
    "lw_p1:old_fashioned",
]);

mc.world.afterEvents.itemCompleteUse.subscribe((event) => {
    const player = event.source;
    const item = event.itemStack;
    if (!player?.isValid || !item) return;
    if (!DRINK_IDS.has(item.typeId)) return;

    const slot = player.selectedSlotIndex;
    mc.system.run(() => {
        try {
            if (!player.isValid) return;
            if (!isCreative(player)) {
                const c = player.getComponent('inventory').container;
                const it = c.getItem(slot);
                if (it && it.typeId === item.typeId) {
                    if (it.amount > 1) { it.amount -= 1; c.setItem(slot, it); }
                    else { c.setItem(slot, undefined); }
                }
            };
        } catch (e) { }
    });
});


// ===== 断电装置 =====
mc.world.afterEvents.worldLoad.subscribe(() => {
    mc.world.beforeEvents.itemUse.subscribe((event) => {
        const player = event.source;
        const item = event.itemStack;
        if (!player?.isValid || !item) return;
        if (item.typeId !== 'lw_p1:power_cut') return;
        if (!isKiller(player)) return;
        if (!isInGame(player)) return;

        event.cancel = true;

        mc.system.run(() => {
            try {
                if (!player.isValid) return;

                const container = player.getComponent('inventory').container;
                for (let i = 0; i < container.size; i++) {
                    const it = container.getItem(i);
                    if (it?.typeId === 'lw_p1:power_cut') {
                        container.setItem(i, undefined);
                    }
                }

                // 所有非杀手玩家失明 20 秒，杀手隐身 20 秒
                for (const p of mc.world.getPlayers()) {
                    if (!p.isValid) continue;
                    if (isKiller(p)) {
                        try {
                            p.addEffect('minecraft:invisibility', 400, { amplifier: 0, showParticles: false });
                        } catch (e) { }
                        continue;   // 杀手只隐身，不吃失明
                    }
                    if (!isInGame(p)) continue;
                    try {
                        p.addEffect('minecraft:blindness', 400, { amplifier: 0, showParticles: false });
                    } catch (e) { }
                }
            } catch (e) { }
        });
    });
});


// ===== 手榴弹 =====
function getGrenadeVelocity(player) {
    const view = player.getViewDirection();
    const len = Math.sqrt(view.x * view.x + view.y * view.y + view.z * view.z) || 1;
    return {
        x: (view.x / len) * 1.2,
        y: (view.y / len) * 1.2,
        z: (view.z / len) * 1.2
    };
}

// 手榴弹投掷防抖
const grenadeThrowCooldown = new Map();
const GRENADE_THROW_INTERVAL = 10;

// 使用手榴弹
mc.world.afterEvents.worldLoad.subscribe(() => {
    mc.world.beforeEvents.itemUse.subscribe((event) => {
        const player = event.source;
        const item = event.itemStack;
        if (!player?.isValid || !item) return;
        if (item.typeId !== 'lw_p1:grenade') return;

        // 投掷防抖
        const lastThrow = grenadeThrowCooldown.get(player.id) ?? 0;
        if (mc.system.currentTick - lastThrow < GRENADE_THROW_INTERVAL) return;
        grenadeThrowCooldown.set(player.id, mc.system.currentTick);

        event.cancel = true;

        const slot = player.selectedSlotIndex;
        mc.system.run(() => {
            try {
                if (!player.isValid) return;

                if (!isCreative(player)) {
                    const c = player.getComponent('inventory').container;
                    const it = c.getItem(slot);
                    if (it && it.typeId === 'lw_p1:grenade') {
                        if (it.amount > 1) { it.amount -= 1; c.setItem(slot, it); }
                        else { c.setItem(slot, undefined); }
                    }
                }

                const loc = player.location;
                const headY = (loc.y ?? 0) + 1.62;
                const spawnLoc = { x: loc.x, y: headY, z: loc.z };
                const velocity = getGrenadeVelocity(player);

                let grenade;
                try {
                    grenade = player.dimension.spawnEntity('lw_p1:grenade', spawnLoc);
                } catch (e) {
                    return;
                }

                grenade.setDynamicProperty('lw_p1:spawnTick', mc.system.currentTick);
                grenade.setDynamicProperty('lw_p1:shooterId', player.id);
                grenade.setDynamicProperty('lw_p1:vx', velocity.x);
                grenade.setDynamicProperty('lw_p1:vy', velocity.y);
                grenade.setDynamicProperty('lw_p1:vz', velocity.z);

                try {
                    player.runCommand(`playsound random.bow @a ~ ~ ~ 1 1.5`);
                } catch (e) { }
            } catch (e) { }
        });
    });
});

// 手榴弹运动与爆炸检测
mc.system.runInterval(() => {
    for (const dimName of ['overworld', 'nether', 'the_end']) {
        let dimension;
        try {
            dimension = mc.world.getDimension(dimName);
        } catch { continue; }
        if (!dimension) continue;

        for (const grenade of dimension.getEntities({ type: 'lw_p1:grenade' })) {
            if (!grenade.isValid) continue;

            const spawnTick = grenade.getDynamicProperty('lw_p1:spawnTick');
            if (typeof spawnTick !== 'number') { grenade.remove(); continue; }
            const age = mc.system.currentTick - spawnTick;

            // 超时自动引爆
            if (age >= 60) {
                explodeGrenade(grenade);
                continue;
            }

            const vx = grenade.getDynamicProperty('lw_p1:vx');
            const vy = grenade.getDynamicProperty('lw_p1:vy');
            const vz = grenade.getDynamicProperty('lw_p1:vz');
            if (typeof vx !== 'number' || typeof vy !== 'number' || typeof vz !== 'number') {
                grenade.remove();
                continue;
            }

            // 每 tick 竖直速度递减 0.1（重力）
            const newVy = vy + -0.1;
            grenade.setDynamicProperty('lw_p1:vy', newVy);

            const loc = grenade.location;
            const next = { x: loc.x + vx, y: loc.y + newVy, z: loc.z + vz };

            try {
                const dirLen = Math.sqrt(vx * vx + newVy * newVy + vz * vz) || 1;
                const dir = { x: vx / dirLen, y: newVy / dirLen, z: vz / dirLen };
                const ray = dimension.getBlockFromRay(loc, dir, {
                    maxDistance: dirLen,
                    includeLiquidBlocks: false,
                    includePassableBlocks: false
                });
                if (ray) {
                    explodeGrenade(grenade);
                    continue;
                }
            } catch (e) { }

            try {
                grenade.teleport(next, { dimension: grenade.dimension });
            } catch (e) { }
        }
    }
}, 1);

function explodeGrenade(grenade) {
    if (!grenade.isValid) return;
    const loc = grenade.location;
    const dim = grenade.dimension;

    try {
        // 用命令的 ~ ~ ~ 会以无实体执行者的世界原点为基准，音效位置错误导致听不到；
        // 改用 playSound 明确指定爆炸坐标
        dim.playSound("random.explode", loc, { volume: 10, pitch: 1 });
    } catch (e) { }

    try {
        grenade.runCommand(`particle minecraft:huge_explosion_emitter ~ ~ ~`);
    } catch (e) { }

    try {
        const shooterId = grenade.getDynamicProperty('lw_p1:shooterId');
        for (const player of mc.world.getPlayers()) {
            if (!player.isValid) continue;
            const dx = player.location.x - loc.x;
            const dy = player.location.y - loc.y;
            const dz = player.location.z - loc.z;
            const distSq = dx * dx + dy * dy + dz * dz;
            // 爆炸半径
            const radius = 3.0
            if (distSq <= radius * radius) {
                getPlayerState(player).hurt = true;
            }
        }
    } catch (e) { }

    grenade.remove();
}


// ===== 神奇的海螺 =====
mc.world.beforeEvents.playerInteractWithEntity.subscribe((event) => {
    const player = event.player;
    const target = event.target;
    if (!player?.isValid || !target?.isValid) return;
    if (target.typeId !== "minecraft:player") return;

    let hand = null;
    try {
        const c = player.getComponent("inventory").container;
        hand = c.getItem(player.selectedSlotIndex)?.typeId ?? null;
    } catch (e) { }
    if (hand !== "lw_p1:magic_conch") return;

    event.cancel = true;

    const targetPlayer = Array.from(mc.world.getPlayers()).find(p => p.id === target.id);
    if (!targetPlayer?.isValid) return;

    let role = t("lw_p1.role.passenger");
    if (isKiller(targetPlayer)) role = t("lw_p1.role.killer");
    else if (isOfficer(targetPlayer)) role = t("lw_p1.role.officer");

    try { player.sendMessage(t("lw_p1.prop.conch", targetPlayer.name, role)); } catch (e) { }

    if (!isCreative(player)) {
        const slot = player.selectedSlotIndex;
        mc.system.run(() => {
            try {
                if (!player.isValid) return;
                const c = player.getComponent("inventory").container;
                const item = c.getItem(slot);
                if (item && item.typeId === "lw_p1:magic_conch") {
                    if (item.amount > 1) {
                        item.amount -= 1;
                        c.setItem(slot, item);
                    } else {
                        c.setItem(slot, undefined);
                    }
                }
            } catch (e) { }
        });
    }
});


// ===== 父亲的怀表 =====
const watchCharging = new Set();

function watchRemainText() {
    try {
        const remain = getRemainSeconds();
        const m = Math.floor(remain / 60), s = remain % 60;
        return t("lw_p1.prop.time.remaining", m, String(s).padStart(2, "0"));
    } catch (e) {
        return t("lw_p1.prop.time.none");
    }
}

function endWatchCharge(player) {
    if (!player?.isValid) return;
    watchCharging.delete(player.id);
}

mc.world.afterEvents.worldLoad.subscribe(() => {
    // 开始蓄力
    mc.world.afterEvents.itemStartUse.subscribe((event) => {
        const player = event.source;
        if (!player?.isValid) return;
        const stack = event.itemStack;
        if (!stack || stack.typeId !== "lw_p1:pocke_watch") return;
        watchCharging.add(player.id);
    });
    // 结束蓄力
    const stop = (event) => {
        const player = event.source;
        if (!player?.isValid) return;
        const stack = event.itemStack;
        if (!stack || stack.typeId !== "lw_p1:pocke_watch") return;
        endWatchCharge(player);
    };
    mc.world.afterEvents.itemReleaseUse.subscribe(stop);
    mc.world.afterEvents.itemCompleteUse.subscribe(stop);
    mc.world.afterEvents.itemStopUse.subscribe(stop);
});

// 蓄力期间活动栏显示剩余时间（由本模块注册到活动栏调度器）
export function watchHudText(player) {
    if (!watchCharging.has(player.id)) return undefined;
    return watchRemainText();
}
// 抵挡一次伤害
mc.system.runInterval(() => {
    for (const player of mc.world.getPlayers()) {
        if (!player.isValid) continue;
        if (!getPlayerState(player).hurt) continue;

        // 旁观（已淘汰）玩家不再参与伤害结算：清除标记，避免被子弹/匕首/手榴弹误判生成尸体
        let isSpectator = false;
        try { isSpectator = player.getGameMode() === mc.GameMode.Spectator; } catch (e) { isSpectator = false; }
        if (isSpectator) {
            getPlayerState(player).hurt = false;
            continue;
        }

        let foundSlot = -1;
        try {
            const container = player.getComponent("minecraft:inventory")?.container;
            if (container) {
                for (let i = 0; i < container.size; i++) {
                    const item = container.getItem(i);
                    if (item && item.typeId === "lw_p1:pocke_watch") {
                        foundSlot = i;
                        break;
                    }
                }
            }
        } catch (e) { }

        if (foundSlot >= 0) {
            try {
                const container = player.getComponent("minecraft:inventory")?.container;
                if (container) {
                    container.setItem(foundSlot, undefined);
                }
            } catch (e) { }
            player.sendMessage(t("lw_p1.prop.watch.saved"))
            getPlayerState(player).hurt = false;
        } else {
            poisonKill(player);
            getPlayerState(player).hurt = false;
        }
    }
}, 20);


// ===== 食物托盘，毒药，野生蜂王浆 =====
const FOOD_TRAY_IDS = [
    "lw_p1:food_tray",
    "lw_p1:food_tray_ceramic",
    "lw_p1:food_tray_glass",
    "lw_p1:food_tray_wood"
];

const trayCooldown = new Map();

// 下毒托盘标记
const POISONED_TRAYS = new Map();

function trayKey(block) {
    return `${block.dimension.id}:${block.x},${block.y},${block.z}`;
}

// 记录玩家背包里有从被下毒托盘获取的物品
const POISONED_EATERS = new Map();

// 记录玩家已吃下被下毒食物且毒药生效中
const ACTIVE_POISONS = new Map();

// 食物托盘交互核心逻辑
function handleFoodTrayInteract(player, block) {
    if (!player?.isValid || !block) return;
    if (!FOOD_TRAY_IDS.includes(block.typeId)) return;

    let hand = null;
    try {
        const c = player.getComponent("inventory").container;
        const it = c.getItem(player.selectedSlotIndex);
        hand = it ? it.typeId : null;
    } catch (e) { hand = null; }

    const tKey = trayKey(block);

    // 手持毒药，下毒模式
    if (hand === "lw_p1:poison") {
        const lastTick = trayCooldown.get(player.id) ?? 0;
        if (mc.system.currentTick - lastTick < 20) return;
        trayCooldown.set(player.id, mc.system.currentTick);

        if (POISONED_TRAYS.has(tKey)) {
            try { player.sendMessage(t("lw_p1.prop.tray.alreadyPoisoned")); } catch (e) { }
            return;
        }
        const slot = player.selectedSlotIndex;
        POISONED_TRAYS.set(tKey, { poisonerId: player.id });
        try { player.sendMessage(t("lw_p1.prop.tray.poisoned")); } catch (e) { }

        if (!isCreative(player)) {
            mc.system.run(() => {
                try {
                    if (!player.isValid) return;
                    const c = player.getComponent("inventory").container;
                    const it = c.getItem(slot);
                    if (it && it.typeId === "lw_p1:poison") {
                        if (it.amount > 1) { it.amount -= 1; c.setItem(slot, it); }
                        else { c.setItem(slot, undefined); }
                    }
                } catch (e) { }
            });
        }
        return;
    }

    // 普通获取物品模式
    const lastTick = trayCooldown.get(player.id) ?? 0;
    if (mc.system.currentTick - lastTick < 20) return;
    trayCooldown.set(player.id, mc.system.currentTick);

    const poisonedInfo = POISONED_TRAYS.get(tKey);
    // 下毒者本人无法从该托盘获取物品
    if (poisonedInfo && poisonedInfo.poisonerId === player.id) {
        try { player.sendMessage(t("lw_p1.prop.tray.alreadyPoisoned")); } catch (e) { }
        return;
    }

    const config = getWorldConfig();
    const items = config.foodTrayItems?.[block.typeId];
    if (!Array.isArray(items) || items.length === 0) {
        try { player.sendMessage(t("lw_p1.prop.tray.empty")); } catch (e) { }
        return;
    }

    try {
        const container = player.getComponent("inventory").container;
        for (let i = 0; i < container.size; i++) {
            const it = container.getItem(i);
            if (it && items.includes(it.typeId)) return;
        }
    } catch (e) { }

    const randomItem = items[Math.floor(Math.random() * items.length)];
    const poisonedGive = !!poisonedInfo; // 有下毒标记则这次给的是带毒食物
    if (poisonedGive) {
        // 其他玩家获取物品，下毒标记清除
        POISONED_TRAYS.delete(tKey);
    }

    mc.system.run(() => {
        try {
            if (!player.isValid) return;
            const container = player.getComponent("inventory").container;
            const item = new mc.ItemStack(randomItem, 1);
            container.addItem(item);
            // 给玩家打上刚获得了被下毒的物品标记，直到该物品被吃下/消失
            if (poisonedGive) {
                const existing = POISONED_EATERS.get(player.id);
                if (existing) {
                    existing.items.add(randomItem);
                } else {
                    POISONED_EATERS.set(player.id, { items: new Set([randomItem]) });
                }
            }
        } catch (e) { }
    });
}

mc.world.beforeEvents.playerInteractWithBlock.subscribe((event) => {
    const player = event.player;
    const block = event.block;
    if (!player?.isValid || !block) return;
    if (!FOOD_TRAY_IDS.includes(block.typeId)) return;

    event.cancel = true;

    handleFoodTrayInteract(player, block);
});

mc.world.afterEvents.worldLoad.subscribe(() => {
    mc.world.afterEvents.itemCompleteUse.subscribe((event) => {
        const player = event.source;
        const item = event.itemStack;
        if (!player?.isValid || !item) return;
        const itemId = item.typeId;
        const playerId = player.id;

        // 蜂王浆解除中毒
        if (itemId === "lw_p1:royal_jelly") {
            const active = ACTIVE_POISONS.get(playerId);
            if (active) {
                try { mc.system.clearRun(active.nauseaTimeoutId); } catch (e) { }
                try { mc.system.clearRun(active.deathTimeoutId); } catch (e) { }
                ACTIVE_POISONS.delete(playerId);
                try {
                    // 移除已施加的反胃效果（addEffect 时长 0 无法移除，须用 removeEffect）
                    if (player.isValid) player.removeEffect("minecraft:nausea");
                } catch (e) { }
                try { player.sendMessage(t("lw_p1.prop.royalJelly.cured")); } catch (e) { }
            }
            return;
        }

        // 吃下被下毒的食物
        const info = POISONED_EATERS.get(playerId);
        if (!info || !info.items.has(itemId)) return;
        info.items.delete(itemId);
        if (info.items.size === 0) POISONED_EATERS.delete(playerId);

        if (player.getGameMode() === mc.GameMode.Creative || player.getGameMode() === mc.GameMode.Spectator) return;

        // 5 秒后开始反胃（持续 50 秒，直到毒发）
        const nauseaTimeoutId = mc.system.runTimeout(() => {
            try {
                const p = Array.from(mc.world.getPlayers()).find(pp => pp.id === playerId);
                if (!p?.isValid) return;
                if (p.getGameMode() === mc.GameMode.Creative || p.getGameMode() === mc.GameMode.Spectator) return;
                p.addEffect("minecraft:nausea", 1000, { amplifier: 0, showParticles: true });
            } catch (e) { }
        }, 100);

        // 50 秒后直接中毒死亡（1000 tick）
        const deathTimeoutId = mc.system.runTimeout(() => {
            try {
                ACTIVE_POISONS.delete(playerId);
                const p = Array.from(mc.world.getPlayers()).find(pp => pp.id === playerId);
                if (!p?.isValid) return;
                if (p.getGameMode() === mc.GameMode.Creative || p.getGameMode() === mc.GameMode.Spectator) return;
                poisonKill(p);
            } catch (e) { }
        }, 1000);

        ACTIVE_POISONS.set(playerId, { nauseaTimeoutId, deathTimeoutId });
    });
});


// ===== 便条 =====
const noteEntityInteracted = new Set();
const noteCooldown = new Map();
const NOTE_COOLDOWN_TICKS = 100;

// 右键玩家传递便条
mc.world.beforeEvents.playerInteractWithEntity.subscribe((event) => {
    const player = event.player;
    const target = event.target;
    if (!player?.isValid || !target?.isValid) return;
    if (target.typeId !== "minecraft:player") return;

    let hand = null;
    try {
        const c = player.getComponent("inventory").container;
        hand = c.getItem(player.selectedSlotIndex)?.typeId ?? null;
    } catch (e) { }
    if (hand !== "lw_p1:note") return;

    event.cancel = true;
    noteEntityInteracted.add(player.id);

    const now = mc.system.currentTick;
    const lastTick = noteCooldown.get(player.id) ?? 0;
    if (now - lastTick < NOTE_COOLDOWN_TICKS) return;
    noteCooldown.set(player.id, now);

    const targetPlayer = Array.from(mc.world.getPlayers()).find(p => p.id === target.id);
    if (!targetPlayer?.isValid) return;

    const message = player.getDynamicProperty("lw_p1:noteMessage");
    if (!message || typeof message !== "string" || message.trim() === "") {
        try { player.sendMessage(t("lw_p1.prop.note.empty")); } catch (e) { }
        return;
    }

    try { targetPlayer.sendMessage(t("lw_p1.prop.note.received", player.name, String(message))); } catch (e) { }
    try { player.sendMessage(t("lw_p1.prop.note.sent", targetPlayer.name)); } catch (e) { }
});

// 右键空白处打开便条编辑表单
mc.world.afterEvents.worldLoad.subscribe(() => {
    mc.world.afterEvents.itemUse.subscribe(event => {
        const player = event.source;
        if (!player?.isValid) return;
        if (event.itemStack?.typeId !== "lw_p1:note") return;

        if (noteEntityInteracted.has(player.id)) {
            noteEntityInteracted.delete(player.id);
            return;
        }

        const currentMessage = player.getDynamicProperty("lw_p1:noteMessage") ?? "";
        new ModalFormData()
            .title(t("lw_p1.prop.note.title"))
            .textField(t("lw_p1.prop.note.label"), t("lw_p1.prop.note.ph"), { defaultValue: String(currentMessage) })
            .show(player).then(res => {
                if (res.canceled || !player.isValid) return;
                const text = res.formValues?.[0] ?? "";
                player.setDynamicProperty("lw_p1:noteMessage", text);
            }).catch(() => { });
    });
});

// 尸体名牌交互，获取死亡玩家的便条内容
const corpseNoteCooldown = new Map();
const CORPSE_NOTE_COOLDOWN_TICKS = 100;

mc.world.beforeEvents.playerInteractWithEntity.subscribe((event) => {
    const player = event.player;
    const target = event.target;
    if (!player?.isValid || !target?.isValid) return;
    if (target.typeId !== "lw_p1:player_name") return;

    if (!isCreative(player)) {
        const now = mc.system.currentTick;
        const lastTick = corpseNoteCooldown.get(player.id) ?? 0;
        if (now - lastTick < CORPSE_NOTE_COOLDOWN_TICKS) return;
        corpseNoteCooldown.set(player.id, now);
    }

    event.cancel = true;

    let corpse = null;
    try {
        const corpses = target.dimension.getEntities({ type: "lw_p1:corpes", location: target.location, maxDistance: 3 });
        for (const c of corpses) {
            if (!c.isValid) continue;
            if (typeof c.getDynamicProperty("lw_p1:noteContent") === "string") {
                corpse = c;
                break;
            }
        }
    } catch (e) { }

    if (!corpse) return;

    const noteContent = corpse.getDynamicProperty("lw_p1:noteContent");
    const ownerId = corpse.getDynamicProperty("lw_p1:ownerId");
    const ownerName = typeof ownerId === "string"
        ? (Array.from(mc.world.getPlayers()).find(p => p.id === ownerId)?.name ?? t("lw_p1.common.unknownPlayer"))
        : t("lw_p1.common.unknownPlayer");

    try { player.sendMessage(t("lw_p1.prop.note.corpse", String(noteContent))); } catch (e) { }
});


// 各功能的注册（weight 越大，轮播中停留的份额越多）
registerActionBarProvider("lw_p1:watch", (player) => watchHudText(player), { weight: 4 });