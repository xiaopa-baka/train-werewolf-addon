// @ts-check
// propSystem.js - 道具系统

import * as mc from "@minecraft/server";
import { ModalFormData } from "@minecraft/server-ui";
import { getWorldConfig } from "./config/worldConfig.js";


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


// 匕首
const chargeStartTick = new Map();
// 获取玩家正前方一格的方块上站着的其他玩家
function getPlayerInFront(player) {
    const yaw = player.getRotation().y * Math.PI / 180;
    const dirX = -Math.sin(yaw);
    const dirZ = Math.cos(yaw);

    const p = player.location;
    const targetX = Math.floor(p.x + dirX);
    const targetY = Math.floor(p.y);
    const targetZ = Math.floor(p.z + dirZ);

    for (const other of mc.world.getPlayers()) {
        if (!other.isValid || other.id === player.id) continue;
        const o = other.location;
        if (Math.floor(o.x) === targetX && Math.floor(o.z) === targetZ && Math.abs(o.y - targetY) < 1.5) {
            return other;
        }
    }
    return null;
}

// 刺杀逻辑
mc.world.afterEvents.worldLoad.subscribe(() => {

    // 开始蓄力
    mc.world.afterEvents.itemStartUse.subscribe((event) => {
        const player = event.source;
        if (!player?.isValid || event.itemStack?.typeId !== "lw_p1:dagger") return;

        // 创造模式跳过冷却检查
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
            target.addTag("lw_p1:受到伤害");
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


// 爆竹
mc.world.afterEvents.entitySpawn.subscribe((event) => {
    const entity = event.entity;
    if (entity.typeId === "lw_p1:firecracker") {
        entity.setDynamicProperty("lw_p1:spawnTick", mc.system.currentTick);
        try {
            // 爆竹生成时火焰粒子
            entity.runCommand(`particle minecraft:basic_flame_particle ^0.1 ^0.1 ^0.06`);
        } catch (e) { }
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
            const age = mc.system.currentTick - spawnTick;

            if (age % 5 === 0) {
                try {
                    // 中间过程烟雾粒子
                    fc.runCommand(`particle minecraft:basic_smoke_particle ^0.1 ^0.1 ^0.06`);
                } catch (e) { }
            }

            if (age >= 300) {
                try {
                    // 爆竹爆炸播放音效，炸裂粒子
                    fc.runCommand(`playsound firecracker @a ~ ~ ~ 4`);
                    fc.runCommand(`particle minecraft:lava_particle ~ ~ ~`);
                    fc.runCommand(`particle minecraft:lava_particle ~ ~ ~`);
                    fc.runCommand(`particle minecraft:lava_particle ~ ~ ~`);
                } catch (e) { }
                fc.remove();
            }
        }
    }
}, 1);


// 手枪
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

        // 创造模式跳过冷却检查
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

        // 开枪音效
        try {
            player.runCommand(`playsound pistol @a ~ ~ ~ 2`);
        } catch (e) { }

        // 生成子弹
        spawnBullet(player, typeId);

        // 开枪粒子
        try {
            player.runCommand(`particle minecraft:campfire_smoke_particle ^-0.5 ^1.5 ^0.2`);
        } catch (e) { }

        // 后坐力
        try {
            player.runCommand(`camerashake add @s 0.4 0.15 positional`);
        } catch (e) { }

        // 启动 10 秒冷却（创造模式跳过）
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

// 子弹
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

            // 子弹拖尾粒子
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
            if (typeof vx === "number" && typeof vy === "number" && typeof vz === "number") {
                const loc = bullet.location;
                const next = { x: loc.x + vx, y: loc.y + vy, z: loc.z + vz };

                // 方块碰撞检测
                try {
                    const dirLen = Math.sqrt(vx * vx + vy * vy + vz * vz) || 1;
                    const dir = { x: vx / dirLen, y: vy / dirLen, z: vz / dirLen };
                    const ray = dimension.getBlockFromRay(loc, dir, {
                        maxDistance: dirLen,
                        includeLiquidBlocks: false,
                        includePassableBlocks: false
                    });
                    if (ray) {
                        // 命中方块销毁（德林杰未命中消失）
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
                } catch (e) { }

                // 保存上一位置用于射线命中判定
                bullet.setDynamicProperty("lw_p1:lastX", loc.x);
                bullet.setDynamicProperty("lw_p1:lastY", loc.y);
                bullet.setDynamicProperty("lw_p1:lastZ", loc.z);

                try {
                    bullet.teleport(next, { dimension: bullet.dimension });
                } catch (e) { }
            }

            // 命中判定
            const shooterId = bullet.getDynamicProperty("lw_p1:shooterId");
            const weaponType = bullet.getDynamicProperty("lw_p1:weaponType");
            const bLoc = bullet.location;
            const lastX = bullet.getDynamicProperty("lw_p1:lastX");
            const lastY = bullet.getDynamicProperty("lw_p1:lastY");
            const lastZ = bullet.getDynamicProperty("lw_p1:lastZ");
            const hasLast = typeof lastX === "number" && typeof lastY === "number" && typeof lastZ === "number";

            let hit = null;
            for (const p of mc.world.getPlayers()) {
                if (!p.isValid) continue;
                if (typeof shooterId === "string" && p.id === shooterId) continue;
                const cx = p.location.x, cy = p.location.y + 0.9, cz = p.location.z;

                let d2;
                if (hasLast) {
                    // 线段 (lastX,lastY,lastZ) - (bLoc) 到玩家中心的最短距离
                    const ax = lastX, ay = lastY, az = lastZ;
                    const bx = bLoc.x, by = bLoc.y, bz = bLoc.z;
                    const abx = bx - ax, aby = by - ay, abz = bz - az;
                    const abLen2 = abx * abx + aby * aby + abz * abz;
                    if (abLen2 > 0) {
                        const t = Math.max(0, Math.min(1, ((cx - ax) * abx + (cy - ay) * aby + (cz - az) * abz) / abLen2));
                        d2 = (cx - (ax + t * abx)) ** 2 + (cy - (ay + t * aby)) ** 2 + (cz - (az + t * abz)) ** 2;
                    } else {
                        d2 = (cx - ax) ** 2 + (cy - ay) ** 2 + (cz - az) ** 2;
                    }
                } else {
                    // 没有上一位置（第一 tick），用点判定
                    d2 = (cx - bLoc.x) ** 2 + (cy - bLoc.y) ** 2 + (cz - bLoc.z) ** 2;
                }

                if (d2 <= 0.81) {
                    hit = p;
                    break;
                }
            }

            if (hit) {
                hit.addTag("lw_p1:受到伤害");
                bullet.setDynamicProperty("lw_p1:hasHit", true);

                // 左轮手枪误伤平民，掉落手枪实体
                if (weaponType === "lw_p1:pistol" && !hit.hasTag("lw_p1:杀手")) {
                    try {
                        const shooter = Array.from(mc.world.getPlayers()).find(p => p.id === shooterId);
                        if (shooter && shooter.isValid && !isCreative(shooter)) {
                            // 清除背包中的左轮手枪
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
                            // 在开枪者前方生成手枪实体
                            const vd = shooter.getViewDirection();
                            shooter.dimension.spawnEntity("lw_p1:pistol", {
                                x: shooter.location.x + vd.x,
                                y: shooter.location.y + 1.0,
                                z: shooter.location.z + vd.z
                            });
                            // 标记禁用手枪
                            shooter.addTag("lw_p1:禁用手枪");
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
    if (player.hasTag("lw_p1:杀手")) {
        try { player.sendMessage("§c杀手无法使用这把枪"); } catch (e) { }
        return;
    }
    // 掉落过枪的人无法拾取
    if (player.hasTag("lw_p1:禁用手枪")) {
        try { player.sendMessage("§c你已失去使用手枪的资格"); } catch (e) { }
        return;
    }

    // 给玩家左轮手枪
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
                try { player.sendMessage("§a你捡起了左轮手枪"); } catch (e) { }
            } else {
                try { player.sendMessage("§c背包已满，无法拾取"); } catch (e) { }
            }
        } catch (e) { }
    });
});


// 球棒
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
        hurt.addTag("lw_p1:受到伤害");
    } catch (e) { }
});

// 球棒狂暴
const batFrenzy = new Set();

mc.system.runInterval(() => {
    for (const player of mc.world.getPlayers()) {
        if (!player.isValid) continue;
        if (!player.hasTag('lw_p1:杀手')) continue;
        if (!player.hasTag('lw_p1:游戏中')) continue;
        if (batFrenzy.has(player.id)) continue;

        // 检测背包中是否有球棍
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

        // 进入狂暴状态
        batFrenzy.add(player.id);
        try { player.addEffect('minecraft:speed', 600, { amplifier: 2, showParticles: true }); } catch (e) { }

        for (const p of mc.world.getPlayers()) {
            if (!p.isValid) continue;
            try { p.sendMessage(`§c§l${player.name} 进入了疯狂状态！`); } catch (e) { }
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
                try { p.sendMessage(`§7${player.name} 的疯狂状态已结束`); } catch (e) { }
            }
        }, 600);
    }
}, 20);


// 香烟
mc.world.beforeEvents.itemUse.subscribe((event) => {
    const player = event.source;
    const item = event.itemStack;
    if (!player?.isValid || !item) return;
    if (item.typeId !== 'lw_p1:cigarette') return;

    // 播放粒子，消耗
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

    if (player.hasTag('lw_p1:任务6')) {
        try {
            mc.world.scoreboard.getObjective('lw_p1:任务中')?.setScore(player, 300);
        } catch (e) { }
    }
});


// 矿泉水
mc.world.afterEvents.itemCompleteUse.subscribe((event) => {
    const player = event.source;
    const item = event.itemStack;
    if (!player?.isValid || !item) return;

    if (item.typeId === 'lw_p1:mineral_water') {
        // 饮用后消耗矿泉水，获得矿泉水瓶
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
                // 给玩家矿泉水瓶
                const bottle = new mc.ItemStack('lw_p1:mineral_water_bottle', 1);
                c.addItem(bottle);
            } catch (e) { }
        });
        return;
    }
});


// 矿泉水瓶
mc.world.beforeEvents.itemUse.subscribe((event) => {
    const player = event.source;
    const item = event.itemStack;
    if (!player?.isValid || !item) return;
    if (item.typeId !== 'lw_p1:mineral_water_bottle') return;
    if (!player.hasTag('lw_p1:任务2')) return;

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
            mc.world.scoreboard.getObjective('lw_p1:任务中')?.setScore(player, 200);
        } catch (e) { }
    });
});


// 断电装置
mc.world.afterEvents.worldLoad.subscribe(() => {
    mc.world.beforeEvents.itemUse.subscribe((event) => {
        const player = event.source;
        const item = event.itemStack;
        if (!player?.isValid || !item) return;
        if (item.typeId !== 'lw_p1:power_cut') return;
        if (!player.hasTag('lw_p1:杀手')) return;
        if (!player.hasTag('lw_p1:游戏中')) return;

        event.cancel = true;

        mc.system.run(() => {
            try {
                if (!player.isValid) return;

                // 清除背包中的断电装置
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
                    if (p.hasTag('lw_p1:杀手')) {
                        try {
                            p.addEffect('minecraft:invisibility', 400, { amplifier: 0, showParticles: false });
                        } catch (e) { }
                    };
                    if (!p.hasTag('lw_p1:游戏中')) continue;
                    try {
                        p.addEffect('minecraft:blindness', 400, { amplifier: 0, showParticles: false });
                    } catch (e) { }
                }
            } catch (e) { }
        });
    });
});


// 手榴弹
function getGrenadeVelocity(player) {
    const view = player.getViewDirection();
    const len = Math.sqrt(view.x * view.x + view.y * view.y + view.z * view.z) || 1;
    return {
        x: (view.x / len) * 1.2,
        y: (view.y / len) * 1.2,
        z: (view.z / len) * 1.2
    };
}

// 使用手榴弹
mc.world.afterEvents.worldLoad.subscribe(() => {
    mc.world.beforeEvents.itemUse.subscribe((event) => {
        const player = event.source;
        const item = event.itemStack;
        if (!player?.isValid || !item) return;
        if (item.typeId !== 'lw_p1:grenade') return;

        event.cancel = true;

        const slot = player.selectedSlotIndex;
        mc.system.run(() => {
            try {
                if (!player.isValid) return;

                // 消耗手榴弹
                if (!isCreative(player)) {
                    const c = player.getComponent('inventory').container;
                    const it = c.getItem(slot);
                    if (it && it.typeId === 'lw_p1:grenade') {
                        if (it.amount > 1) { it.amount -= 1; c.setItem(slot, it); }
                        else { c.setItem(slot, undefined); }
                    }
                }

                // 生成手榴弹实体
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

                // 投掷音效
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

            // 应用重力
            const newVy = vy + -0.1;
            grenade.setDynamicProperty('lw_p1:vy', newVy);

            const loc = grenade.location;
            const next = { x: loc.x + vx, y: loc.y + newVy, z: loc.z + vz };

            // 方块碰撞检测
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

    // 爆炸音效
    try {
        dim.runCommand(`playsound random.explode @a ~ ~ ~ 10 1`);
    } catch (e) { }

    // 爆炸粒子
    try {
        grenade.runCommand(`particle minecraft:huge_explosion_emitter ~ ~ ~`);
    } catch (e) { }

    // 对范围内的玩家造成伤害
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
                player.addTag('lw_p1:受到伤害');
            }
        }
    } catch (e) { }

    grenade.remove();
}


// 神奇的海螺
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

    // 找到目标对应的玩家
    const targetPlayer = Array.from(mc.world.getPlayers()).find(p => p.id === target.id);
    if (!targetPlayer?.isValid) return;

    // 判断目标身份
    let role = "§a平民";
    if (targetPlayer.hasTag("lw_p1:杀手")) role = "§c杀手";
    else if (targetPlayer.hasTag("lw_p1:警员")) role = "§b警员";

    try { player.sendMessage(`§e§l神奇的海螺 §r§f告诉你： ${targetPlayer.name} 的身份是 ${role}`); } catch (e) { }

    // 使用后消失
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


// 父亲的怀表
const watchCharging = new Set();

function watchRemainText() {
    try {
        const gt = mc.world.scoreboard.getObjective("lw_p1:游戏时间");
        const bt = mc.world.scoreboard.getObjective("lw_p1:单局游戏基础时长");
        const ex = mc.world.scoreboard.getObjective("lw_p1:死亡加时");
        if (!gt || !bt) return "§e剩余时间 --:--";
        const elapsed = Math.floor((gt.getScore("lw_p1:全局") ?? 0) / 20);
        const base = bt.getScore("lw_p1:全局") ?? 600;
        const extra = ex?.getScore("lw_p1:全局") ?? 0;
        const remain = Math.max(0, base + extra - elapsed);
        const m = Math.floor(remain / 60), s = remain % 60;
        return `§e剩余时间 ${m}:${String(s).padStart(2, "0")}`;
    } catch (e) {
        return "§e剩余时间 --:--";
    }
}

function endWatchCharge(player) {
    if (!player?.isValid) return;
    watchCharging.delete(player.id);
    try { player.onScreenDisplay.setActionBar(""); } catch (e) { }
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

// 蓄力期间活动栏显示剩余时间
mc.system.runInterval(() => {
    if (mc.system.currentTick % 20 !== 0) return;
    for (const player of mc.world.getPlayers()) {
        if (!player?.isValid) continue;
        if (watchCharging.has(player.id)) {
            player.onScreenDisplay.setActionBar(watchRemainText());
        }
    }
}, 1);
// 抵挡一次伤害
mc.system.runInterval(() => {
    for (const player of mc.world.getPlayers()) {
        if (!player.isValid) continue;
        if (!player.hasTag("lw_p1:受到伤害")) continue;

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
            player.sendMessage("父亲的怀表 帮你免除了一次致命伤害")
            player.removeTag("lw_p1:受到伤害");
        } else {
            poisonKill(player);
            player.removeTag("lw_p1:受到伤害");
        }
    }
}, 20);


// 食物托盘，毒药，野生蜂王浆
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

mc.world.beforeEvents.playerInteractWithBlock.subscribe((event) => {
    const player = event.player;
    const block = event.block;
    if (!player?.isValid || !block) return;
    if (!FOOD_TRAY_IDS.includes(block.typeId)) return;

    event.cancel = true;

    // 获取玩家当前手持物品
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
            try { player.sendMessage("§c这个托盘已经被下毒了"); } catch (e) { }
            return;
        }
        const slot = player.selectedSlotIndex;
        POISONED_TRAYS.set(tKey, { poisonerId: player.id });
        try { player.sendMessage("§a下毒成功"); } catch (e) { }

        // 消耗毒药
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
        try { player.sendMessage("§c这个托盘已经被下毒了"); } catch (e) { }
        return;
    }

    const config = getWorldConfig();
    const items = config.foodTrayItems?.[block.typeId];
    if (!Array.isArray(items) || items.length === 0) {
        try { player.sendMessage("§c这个托盘是空的"); } catch (e) { }
        return;
    }

    // 检测玩家背包是否已有托盘中物品
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
                    // 移除已施加的反胃效果
                    if (player.isValid) player.addEffect("minecraft:nausea", 0, { amplifier: 0, showParticles: false });
                } catch (e) { }
                try { player.sendMessage("§a蜂王浆解除了你的中毒状态"); } catch (e) { }
            }
            return;
        }

        // 吃下被下毒的食物
        const info = POISONED_EATERS.get(playerId);
        if (!info || !info.items.has(itemId)) return;
        info.items.delete(itemId);
        if (info.items.size === 0) POISONED_EATERS.delete(playerId);

        if (player.getGameMode() === mc.GameMode.Creative || player.getGameMode() === mc.GameMode.Spectator) return;

        // 5 秒后反胃 5 秒
        const nauseaTimeoutId = mc.system.runTimeout(() => {
            try {
                const p = Array.from(mc.world.getPlayers()).find(pp => pp.id === playerId);
                if (!p?.isValid) return;
                if (p.getGameMode() === mc.GameMode.Creative || p.getGameMode() === mc.GameMode.Spectator) return;
                p.addEffect("minecraft:nausea", 1000, { amplifier: 0, showParticles: true });
            } catch (e) { }
        }, 100);

        // 60 秒后直接中毒死亡
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


// 便条
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
        try { player.sendMessage("§c便条上还没有内容，请先编辑"); } catch (e) { }
        return;
    }

    try { targetPlayer.sendMessage(`§7${player.name} 的便条§f: ${message}`); } catch (e) { }
    try { player.sendMessage(`§a已向 ${targetPlayer.name} 发送便条`); } catch (e) { }
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
            .title("便条编辑")
            .textField("输入便条内容", "在这里输入...", { defaultValue: String(currentMessage) })
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
        ? (Array.from(mc.world.getPlayers()).find(p => p.id === ownerId)?.name ?? "未知玩家")
        : "未知玩家";

    try { player.sendMessage(`§e[便条] §f${noteContent}`); } catch (e) { }
});