// @ts-check
// corpse.js - 尸体名牌系统

import * as mc from "@minecraft/server";


// 尸体名牌系统，为每个尸体绑定最近玩家，生成显示玩家名字的 player_name 实体
function distanceSq(a, b) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    const dz = a.z - b.z;
    return dx * dx + dy * dy + dz * dz;
}

function findNearestPlayer(entityLocation, allPlayers) {
    let nearest = null;
    let nearestDist = Infinity;
    for (const player of allPlayers) {
        if (!player.isValid) continue;
        const d = distanceSq(entityLocation, player.location);
        if (d < nearestDist) {
            nearestDist = d;
            nearest = player;
        }
    }
    return nearest;
}

mc.system.runInterval(() => {
    try {
        const allPlayers = Array.from(mc.world.getPlayers());

        for (const dimName of ["overworld", "nether", "the_end"]) {
            let dimension;
            try {
                dimension = mc.world.getDimension(dimName);
            } catch { continue; }
            if (!dimension) continue;

            const corpses = dimension.getEntities({ type: "lw_p1:corpes" });
            if (corpses.length === 0) continue;

            for (const corpse of corpses) {
                if (!corpse.isValid) continue;
                if (corpse.getDynamicProperty("lw_p1:hasNameTag")) continue;

                let nameTagLoc;
                try {
                    const vd = corpse.getViewDirection();
                    nameTagLoc = {
                        x: corpse.location.x + vd.x,
                        y: corpse.location.y + vd.y,
                        z: corpse.location.z + vd.z
                    };
                } catch {
                    nameTagLoc = {
                        x: corpse.location.x,
                        y: corpse.location.y,
                        z: corpse.location.z + 1
                    };
                }

                const ownerId = corpse.getDynamicProperty("lw_p1:ownerId");
                const targetPlayer = typeof ownerId === "string" ? allPlayers.find(p => p.id === ownerId) : null;
                const nearestPlayer = targetPlayer || findNearestPlayer(corpse.location, allPlayers);
                if (!nearestPlayer) continue;

                try {
                    const nameEntity = dimension.spawnEntity("lw_p1:player_name", nameTagLoc);
                    if (nameEntity && nameEntity.isValid) {
                        nameEntity.nameTag = nearestPlayer.name;
                        corpse.setDynamicProperty("lw_p1:hasNameTag", true);
                    }
                } catch (spawnErr) { }
            }
        }
    } catch (err) { }
}, 10);   // 每 10 tick（0.5 秒）轮询一次