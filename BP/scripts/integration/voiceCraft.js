// @ts-check
// voiceCraft.js - VoiceCraft 语音联动适配（可选功能，独立模块）
//
// 目标（本项目的玩法需求）：
//   1) 活人之间语音保持 32 格距离限制；
//   2) 旁观者（Spectator）之间不限距离、跨维度也能互相听清；
//   3) 活人与旁观者之间彻底静音（互相都听不到）；
//   4) 「绑定只做一次」：玩家退出世界后不再被 VoiceCraft 擦除绑定，
//      下次进来自动恢复，无需再输 /vcbind。
//
// 实现方式：不改 VoiceCraft 的任何代码、也不要求房主改它的服务端配置，
// 只用 VoiceCraft 附加包公开的脚本事件接口下发/截获报文。
//
//   VoiceCraft 服务端在 EventHandlerSystem.OnEntityAudioReceived 里只把音频包
//   转发给 entity.VisibleEntities；而 VisibleEntities 由 VisibilitySystem 依据
//   `from.TalkBitmask & to.ListenBitmask` 与各 IVisible 效果的位共同判定。
//   因此「位掩码」本身就是频道选择器，且「位缺席 = 该判定直接放行」：
//     活人 Talk/Listen/Effect = 0x7FFF（bit0..14，含 bit1 维度、bit2 距离）
//     旁观 Talk/Listen/Effect = 0x8000（仅保留 bit15）
//     · 活↔活 交集 0x7FFF：距离判定生效 → 32 格
//     · 旁↔旁 交集 0x8000：不含 bit1/bit2 → 不限距离、跨维度
//     · 活↔旁 交集为 0 → 不进 VisibleEntities → 音频包根本不发 → 绝对静音
//   注意：旁观者的 EffectBitmask 必须保留 bit15，否则旁↔旁交集也为 0。
//
// 关于「绑定只做一次」（VoiceCraft 的 Basic 包在 BindingSystem.js 里做了一件
// 对我们不利的事：`world.afterEvents.playerLeave` → `UnbindPlayer()`，把玩家与
// 语音实体的绑定表清掉、并给该实体重新随机一个 5 位绑定码。它的两张表都是
// 纯内存态，所以每次重进都要重新 /vcbind）：
//   VoiceCraft 服务端本身**完全没有绑定概念**（服务端源码里不存在 BindingKey /
//   BindPlayer / IsBound 之类的标识），绑定只是世界侧附加包的内存表。对服务端
//   而言，「已绑定」的全部含义就是世界侧在持续下发该实体的
//     name / worldId / position / rotation
//   所以本模块用两层恢复，且都不需要改 VoiceCraft：
//     ① 记下 addon 每次公布的新绑定码（从它的出站 `voicecraft:sendPacket` 流里
//        截获 SetEntityDescriptionRequest 报文），玩家回来时用
//        `player.runCommand("voicecraft:vcbind <key>")` 让 addon 自己恢复原生绑定；
//     ② 不管 ① 成功与否，只要 addon 没在托管这个玩家，本模块就自己按同样的
//        报文把 name / worldId / position / rotation 喂给服务端。
//   ② 是保底路径，因此即便自定义命令无法从脚本触发，绑定也依旧不会丢。
//   绑定表与绑定码写在世界动态属性里（跨会话、跨脚本重载持久）。
//
// 关于「客户端 App 重启」（比上面两层更糟：这次连语音实体都换了新 id）：
//   VoiceCraft 客户端 App 重启后，语音服务端会销毁它旧的实体、为新连接建一个
//   **新 id** 的实体（附加包发 onEntityDestroyed + onPlayerUnbind），旧实体 id 上的
//   绑定记录因此失效。要认回玩家只能靠 VoiceCraft 自己的客户端标识：实体上线报文
//   里的 UserGuid —— 它存在客户端 %APPDATA%\voicecraft\Settings.json 里，重启不变
//   （ServerUserGuid 则由服务端按它分配）。所以本模块：
//     ① 监听 EventRequest / EventType=3（OnNetworkEntityCreated），记下 实体 → UserGuid；
//     ② 玩家 /vcbind 成功（onPlayerBind）时，把 UserGuid → playerId 写进世界属性
//        lw_p1:vc_clients（持久化）；
//     ③ 之后再出现带同一 UserGuid 的新实体，就把绑定记录改指到新实体，并用截获到的
//        新绑定码自动 vcbind —— 玩家什么都不用做。
//   被 /lw_p1:voice_forget 解除过（他本人、或 @a / 指定选择器）的玩家不在此列：解除时连
//   UserGuid 映射一起删掉，之后同一客户端再出现也不会自动恢复（这正是「重进需要重新绑定」的语义）。
//
// 生效条件（「不装 VoiceCraft 就不生效」）：
//   只有世界装载了 VoiceCraft 附加包、且世界侧已连上服务端时，才会收到
//   voicecraft:onConnected / onPlayerBind 等脚本事件。收不到时本模块：
//     · 不启动任何定时任务（system.runInterval 不会注册）；
//     · 不发送任何报文；
//     · 不读写任何项目状态、不注册任何玩法逻辑。
//   即：纯静默，零副作用。
//
// 与配置界面的关系：
//   config/ 下的配置界面**不认识**本模块。本模块只通过 config/configExtensions.js
//   注册一个「语音设置」入口，入口的可见性由 isVoiceCraftActive() 决定：没装
//   VoiceCraft 附加包时按钮根本不出现，配置界面与其它功能完全不受影响。
//   入口内可调「活人语音半径」（世界配置项 voiceRange，默认 32），改完立即下发，
//   不需要房主改服务端的 DefaultAudioEffectsConfig。
//
// 「解除绑定」/「重发并恢复绑定」
//   （/lw_p1:voice_forget [目标]、/lw_p1:voice_resync [目标]）：
//   两条命令的目标参数都是**玩家选择器**（可选，因此 Tab 有补全）：
//     · **省略目标 = 全部绑定记录（含离线玩家）** —— forget 走无参 forgetVoiceBinding()
//       把全部记录清掉，resync 走 restoreAllVoiceBindings() 把全部写回世界属性；
//     · `@a` = 全部在线玩家；`@s` / `@p` / `@r` / 在线玩家名 = 对应玩家。
//   所以要只作用于自己必须显式写 `@s`；选择器指不到离线玩家，除「省略」之外的写法
//   都碰不到离线玩家的记录。
//   本模块只认「世界动态属性里有没有这个玩家的 id」：
//     · 有 → 他进服时会被自动 vcbind 恢复语音（rejoin 无需任何操作）；
//     · 没有 → 绑定退回内存态，重进世界必须自己 /vcbind 一次。
//   所以解除绑定 = ① 把该玩家从世界属性 lw_p1:vc_bindings（以及缓存的他那个绑定码）
//   里删掉；② 只在本会话内存里记一笔 `state.forgotten`（**不持久化**），
//   免得他离场时附加包发来的 onPlayerUnbind 又把记录写回世界属性
//   （旧实现没有这一笔，于是「清了没用、重进又自动绑上」）。
//   解除后**不做任何静音**：本模块从头到尾不发送静音类报文，仍在附加包托管中的
//   玩家在本会话内语音、声道、距离全部照常，只是下次进服要重新绑定。
//   恢复「进服自动绑定」：玩家自己重新 /vcbind <码>（附加包发 onPlayerBind，
//   本模块随即写回世界属性），或管理员 /lw_p1:voice_resync [目标]（目标写法同上）
//   把当前内存绑定写回世界属性。
//
// 兼容性说明：
//   · 报文编号 6/8/14/15/16/19/20/21/22/23 与字段顺序对应 VoiceCraft.Addon 1.7.x。
//     上游若重排编号会「静默失效」（不报错），此时用 /lw_p1:voice_status 里
//     「最后收到的报文类型」配合排查。
//   · 世界没装 Core.McWss / Core.McHttp 时一切静默丢弃，本模块自然处于待机。
//   · 网易版（@minecraft/server 2.3.0）无 /connect 隧道，本功能不适用。

import * as mc from "@minecraft/server";
import { ModalFormData } from "@minecraft/server-ui";
import { t } from "../core/i18n.js";
import { getConfig, getConfigMeta, setConfig } from "../config/worldConfig.js";
import { registerConfigEntry } from "../config/configExtensions.js";


// ============================ 可调参数 ============================

/** 活人之间的语音半径默认值（格）。实际生效值取配置项 voiceRange，见 getVoiceRange()。
 *  运行时经 SetEffect 下发，因此无需房主改服务端配置 */
const LIVING_RANGE = 32;

/** 语音半径对应的世界配置项 key（登记在 config/worldConfig.js 的 CONFIG_SCHEMA 中） */
const VOICE_RANGE_KEY = "voiceRange";

/** 活人频道掩码：bit0..14 全开（含 bit1 可见性/维度、bit2 距离、bit4 回声、bit8 闷音） */
const MASK_LIVING = 0x7FFF;

/** 旁观频道掩码：只留 bit15（bit15 永久保留给旁观声道，不得再分给任何音频效果） */
const MASK_SPECTATOR = 0x8000;

/** 声道校正周期（tick）：每 0.5 秒按玩家游戏模式校正一次 */
const SYNC_INTERVAL_TICKS = 10;

/** 距离参数重申周期（tick）：每 30 秒重发一次，抵消 VoiceCraft 的「Reset Effects」等干扰 */
const EFFECT_REASSERT_TICKS = 600;

/** 报文类型编号（VoiceCraft.Addon 1.7.x；值见其 API/Data/Enums.js） */
const PACKET_EVENT_REQUEST = 6;
const PACKET_SET_EFFECT = 8;
const PACKET_SET_ENTITY_DESCRIPTION = 14;
const PACKET_SET_ENTITY_WORLD_ID = 15;
const PACKET_SET_ENTITY_NAME = 16;
const PACKET_TALK_BITMASK = 19;
const PACKET_LISTEN_BITMASK = 20;
const PACKET_EFFECT_BITMASK = 21;
const PACKET_SET_ENTITY_POSITION = 22;
const PACKET_SET_ENTITY_ROTATION = 23;

/** 事件类型编号（同上，EventType） */
const EVENT_ON_NETWORK_ENTITY_CREATED = 3;
const EVENT_ON_ENTITY_DESTROYED = 4;

/** 字符串字段上限（VoiceCraft 的 Constants.js） */
const MAX_STRING_LENGTH = 100;
const MAX_DESCRIPTION_LENGTH = 500;

/** 效果类型编号（2 = Proximity 距离衰减） */
const EFFECT_TYPE_PROXIMITY = 2;
const PROXIMITY_BITMASK = 2;

/** VoiceCraft 的脚本事件命名空间 */
const VC_NS = "voicecraft:";
/** VoiceCraft 用于「注入原始报文」的脚本事件（官方一等接口，Basic 包自己也用它发包） */
const VC_SEND_PACKET_EVENT = "voicecraft:sendPacket";

/** 绑定表的持久化位置（世界动态属性，JSON） */
const BINDINGS_PROPERTY = "lw_p1:vc_bindings";
/** 绑定码的持久化位置（世界动态属性，JSON：entityId -> 5 位码） */
const KEYS_PROPERTY = "lw_p1:vc_keys";
/** 语音客户端标识的持久化位置（世界动态属性，JSON：UserGuid -> playerId）。
 *  UserGuid 由 VoiceCraft 客户端 App 持久保存（%APPDATA%\voicecraft\Settings.json），
 *  客户端 App 重启不变 —— 语音实体 id 会变新，靠它把新实体认回原玩家。 */
const CLIENTS_PROPERTY = "lw_p1:vc_clients";
/** VoiceCraft 的「空 GUID」（Guid.CreateEmpty）—— 这类实体没有可用的客户端标识，不入账 */
const EMPTY_GUID = "00000000-0000-0000-0000-000000000000";


// ==================== Z85 编解码（ZeroMQ RFC 32/Z85） ====================
// VoiceCraft 的报文载荷 = Z85(报文类型字节 + 报文体)。
// 带填充变体的规则（与官方 Z85.GetStringWithPadding 逐字节对齐）：
//   · 载荷长度是 4 的倍数 → 直接编码，末尾**不**追加数字；
//   · 否则补齐到 4 的倍数后编码，并在末尾追加「补了几个字节」的数字字符（1~3）。
//   例：7 字节报文 → 11 字符；16 字节报文 → 20 字符。
// 这里按公开规范独立实现，不复制 VoiceCraft 代码，避免 GPL-3.0 传染。

const Z85_ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ.-:+=^!/*?&<>()[]{}@%$#";
const Z85_DECODE_MAP = (() => {
    /** @type {Map<string, number>} */
    const map = new Map();
    for (let i = 0; i < Z85_ALPHABET.length; i++) map.set(Z85_ALPHABET[i], i);
    return map;
})();

/**
 * Z85 编码（输入长度必须是 4 的倍数）
 * @param {Uint8Array} data
 * @returns {string}
 */
export function z85Encode(data) {
    if (data.length % 4 !== 0) throw new Error("Z85: 输入长度必须是 4 的倍数");
    let out = "";
    for (let i = 0; i < data.length; i += 4) {
        let value = ((data[i] * 256 + data[i + 1]) * 256 + data[i + 2]) * 256 + data[i + 3];
        let block = "";
        for (let j = 0; j < 5; j++) {
            block = Z85_ALPHABET[value % 85] + block;
            value = Math.floor(value / 85);
        }
        out += block;
    }
    return out;
}

/**
 * Z85 解码（输入长度必须是 5 的倍数）
 * @param {string} str
 * @returns {Uint8Array}
 */
export function z85Decode(str) {
    if (str.length % 5 !== 0) throw new Error("Z85: 输入长度必须是 5 的倍数");
    const out = new Uint8Array((str.length / 5) * 4);
    let o = 0;
    for (let i = 0; i < str.length; i += 5) {
        let value = 0;
        for (let j = 0; j < 5; j++) {
            const digit = Z85_DECODE_MAP.get(str[i + j]);
            if (digit === undefined) throw new Error("Z85: 非法字符 " + str[i + j]);
            value = value * 85 + digit;
        }
        out[o++] = (value >>> 24) & 0xFF;
        out[o++] = (value >>> 16) & 0xFF;
        out[o++] = (value >>> 8) & 0xFF;
        out[o++] = value & 0xFF;
    }
    return out;
}

/**
 * 带填充的 Z85 编码（与 VoiceCraft 的 GetStringWithPadding 完全一致）
 * @param {Uint8Array} data
 * @returns {string}
 */
export function z85EncodeWithPadding(data) {
    const mod = data.length % 4;
    if (mod === 0) return z85Encode(data);          // 已对齐：不追加填充数字
    const pad = 4 - mod;
    const padded = new Uint8Array(data.length + pad);
    padded.set(data);
    return z85Encode(padded) + String(pad);
}

/**
 * 带填充的 Z85 解码（与 VoiceCraft 的 GetBytesWithPadding 完全一致）
 * @param {string} str
 * @returns {Uint8Array}
 */
export function z85DecodeWithPadding(str) {
    if (!str.length) return new Uint8Array(0);
    const mod = str.length % 5;
    if (mod === 0) return z85Decode(str);           // 无填充数字
    if ((str.length - 1) % 5 !== 0) throw new Error("Z85: 带填充输入长度非法");
    const pad = Number.parseInt(str[str.length - 1], 10);
    if (!pad || pad < 1 || pad > 3) throw new Error("Z85: 非法填充位");
    const body = z85Decode(str.slice(0, -1));
    return body.subarray(0, body.length - pad);
}


// ==================== UTF-8 与二进制工具 ====================
// Bedrock 的脚本运行时没有 TextEncoder / TextDecoder（VoiceCraft 官方包也因此
// 自写了一份 UTF8 编码器），这里按标准自行实现最小可用版本。

/**
 * 字符串 → UTF-8 字节
 * @param {string} str
 * @returns {Uint8Array}
 */
function utf8Encode(str) {
    /** @type {number[]} */
    const out = [];
    for (let i = 0; i < str.length; i++) {
        let c = str.charCodeAt(i);
        if (c >= 0xD800 && c <= 0xDBFF && i + 1 < str.length) {
            const d = str.charCodeAt(i + 1);
            if (d >= 0xDC00 && d <= 0xDFFF) { c = 0x10000 + ((c - 0xD800) << 10) + (d - 0xDC00); i++; }
        }
        if (c < 0x80) out.push(c);
        else if (c < 0x800) out.push(0xC0 | (c >> 6), 0x80 | (c & 0x3F));
        else if (c < 0x10000) out.push(0xE0 | (c >> 12), 0x80 | ((c >> 6) & 0x3F), 0x80 | (c & 0x3F));
        else out.push(0xF0 | (c >> 18), 0x80 | ((c >> 12) & 0x3F), 0x80 | ((c >> 6) & 0x3F), 0x80 | (c & 0x3F));
    }
    return Uint8Array.from(out);
}

/**
 * 小端写入器（对应 VoiceCraft 的 NetDataWriter，数值一律小端）
 */
class ByteWriter {
    /** @param {number} size */
    constructor(size) {
        this.buf = new Uint8Array(size);
        this.view = new DataView(this.buf.buffer);
        this.len = 0;
    }
    /** @param {number} v */
    u8(v) { this.view.setUint8(this.len, v & 0xFF); this.len += 1; return this; }
    /** @param {number} v */
    u16(v) { this.view.setUint16(this.len, v & 0xFFFF, true); this.len += 2; return this; }
    /** @param {number} v */
    i32(v) { this.view.setInt32(this.len, v | 0, true); this.len += 4; return this; }
    /** @param {number} v */
    f32(v) { this.view.setFloat32(this.len, v, true); this.len += 4; return this; }
    /** @param {Uint8Array} arr */
    raw(arr) { this.buf.set(arr, this.len); this.len += arr.length; return this; }
    /** @returns {Uint8Array} */
    bytes() { return this.buf.subarray(0, this.len); }
}

/**
 * 小端读取器（对应 VoiceCraft 的 NetDataReader）
 */
class ByteReader {
    /** @param {Uint8Array} bytes */
    constructor(bytes) {
        this.b = bytes;
        this.o = 0;
    }
    /** @returns {number} */
    u8() { return this.b[this.o++] & 0xFF; }
    /**
     * 跳过 n 个字节（用于略过本模块不关心的字段，如 Loudness/LastSpoke）。
     * @param {number} n
     */
    skip(n) { this.o += n; }
    /** @returns {number} */
    u16() {
        const v = (this.b[this.o] & 0xFF) | ((this.b[this.o + 1] & 0xFF) << 8);
        this.o += 2;
        return v;
    }
    /** @returns {number} */
    i32() {
        const b = this.b, o = this.o;
        this.o += 4;
        return (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) | 0;
    }
    /**
     * 读字符串：先读 Uint16 长度（0 = 空串，否则 = UTF-8 字节数 + 1）。
     * 本模块只关心全 ASCII 的描述文本，故按字节逐字还原（等价 Latin-1）。
     * @param {number} maxLen 0 表示不限制
     * @returns {string}
     */
    str(maxLen) {
        const n = this.u16();
        if (n === 0) return "";
        const count = n - 1;
        if (maxLen > 0 && count > maxLen) { this.o += count; return ""; }
        let s = "";
        for (let i = 0; i < count; i++) s += String.fromCharCode(this.b[this.o + i] & 0xFF);
        this.o += count;
        return s;
    }
}


// ==================== 报文构造 ====================
// 线格式（与 VoiceCraft.Addon 1.7.x 的 Serialize 一致，全部小端）：
//   位掩码报文(19/20/21) = Byte(type) + Int32LE(entityId) + Uint16LE(mask)   → 7 字节
//   SetEffect 报文(8)    = Byte(type) + Uint16LE(bitmask) + Byte(EffectType)
//                          + Float32LE(minRange) + Float32LE(maxRange) + Float32LE(wetDry)
//                                                                         → 16 字节
//   字符串报文(14/15/16) = Byte(type) + Int32LE(entityId) + String
//   位置报文(22)         = Byte(type) + Int32LE(entityId) + 3 × Float32LE
//   旋转报文(23)         = Byte(type) + Int32LE(entityId) + 2 × Float32LE

/**
 * 构造「设置实体 Talk/Listen/Effect 位掩码」报文
 * @param {number} packetType 19=Talk / 20=Listen / 21=Effect
 * @param {number} entityId VoiceCraft 语音实体 id
 * @param {number} mask 位掩码
 * @returns {Uint8Array}
 */
export function buildBitmaskPacket(packetType, entityId, mask) {
    return new ByteWriter(7).u8(packetType).i32(entityId).u16(mask).bytes();
}

/**
 * 构造「设置 Proximity 效果」报文（用于运行时设定活人语音半径）
 * @param {number} maxRange 生效半径（格）
 * @returns {Uint8Array}
 */
export function buildProximityEffectPacket(maxRange) {
    return new ByteWriter(16)
        .u8(PACKET_SET_EFFECT)
        .u16(PROXIMITY_BITMASK)
        .u8(EFFECT_TYPE_PROXIMITY)
        .f32(0)              // MinRange
        .f32(maxRange)       // MaxRange
        .f32(1)              // WetDry = 1（完全湿信号，不做干湿混合）
        .bytes();
}

/**
 * 构造「字符串属性」报文（实体名 16 / 世界 id 15 / 描述 14）
 * @param {number} packetType 14 / 15 / 16
 * @param {number} entityId
 * @param {string} value
 * @param {number} [maxLength] 与官方 NetDataWriter.PutString 一致：>0 时按字符数截断
 * @returns {Uint8Array}
 */
export function buildSetEntityStringPacket(packetType, entityId, value, maxLength = 0) {
    let text = String(value ?? "");
    if (maxLength > 0 && text.length > maxLength) text = text.slice(0, maxLength);
    const payload = utf8Encode(text);
    const w = new ByteWriter(1 + 4 + 2 + payload.length).u8(packetType).i32(entityId);
    if (payload.length === 0) w.u16(0);
    else w.u16(payload.length + 1).raw(payload);
    return w.bytes();
}

/**
 * 构造「设置实体位置」报文（服务端按 PositioningType=Server 用它做定位）
 * @param {number} entityId
 * @param {number} x
 * @param {number} y
 * @param {number} z
 * @returns {Uint8Array}
 */
export function buildSetEntityPositionPacket(entityId, x, y, z) {
    return new ByteWriter(17).u8(PACKET_SET_ENTITY_POSITION).i32(entityId).f32(x).f32(y).f32(z).bytes();
}

/**
 * 构造「设置实体朝向」报文（VoiceCraft 传的是 Vector2(pitch, yaw)）
 * @param {number} entityId
 * @param {number} pitch
 * @param {number} yaw
 * @returns {Uint8Array}
 */
export function buildSetEntityRotationPacket(entityId, pitch, yaw) {
    return new ByteWriter(13).u8(PACKET_SET_ENTITY_ROTATION).i32(entityId).f32(pitch).f32(yaw).bytes();
}


// ============================ 运行状态 ============================

const state = {
    /** 当前 @minecraft/server 是否支持发送脚本事件 */
    supported: typeof mc.system.sendScriptEvent === "function",
    /** 世界侧是否已连上 VoiceCraft 服务端 */
    connected: false,
    /** playerId -> VoiceCraft 语音实体 id（持久化；不随玩家离线而遗忘） */
    bindings: /** @type {Map<string, number>} */ (new Map()),
    /**
     * playerId -> entityId：本会话中确实由 VoiceCraft 附加包托管的玩家。
     * 这是附加包的**运行时事实**（由 voicecraft:onPlayerBind/onPlayerUnbind 驱动），
     * 不是本模块的绑定记录，因此 `/lw_p1:voice_forget` 不会清它 ——
     * 否则附加包仍在托管的玩家会失去声道同步（且他们无法再 /vcbind，附加包会回 already bound）。
     */
    addonBound: /** @type {Map<string, number>} */ (new Map()),
    /** entityId -> 附加包最新公布的 5 位绑定码（持久化） */
    keys: /** @type {Map<number, string>} */ (new Map()),
    /**
     * UserGuid -> playerId（持久化）：VoiceCraft **客户端 App** 的标识。
     * 客户端 App 重启后语音实体 id 会变新（旧记录失效），但 UserGuid 不变，
     * 据此把新实体认回原玩家并自动重绑（见 noteEntityClient / tryRecoverForEntity）。
     * 被 /lw_p1:voice_forget 解除绑定的玩家会连同这里的映射一起删掉。
     */
    clients: /** @type {Map<string, string>} */ (new Map()),
    /**
     * entityId -> UserGuid（**纯内存**，不持久化）：由入站 EventType=3
     * （OnNetworkEntityCreated）报文建立；实体销毁时随之删除。
     */
    entityUser: /** @type {Map<number, string>} */ (new Map()),
    /**
     * 本会话内被 /lw_p1:voice_forget 清掉**世界属性记录**的玩家（playerId，**纯内存、不持久化**）。
     *
     * 作用只有一个：他们离场时附加包会发 `voicecraft:onPlayerUnbind`，默认实现会借这条
     * 事件把 `playerId -> entityId` 写回世界属性（为的是下次进服自动 vcbind）；对已被
     * 解除的玩家，这一笔必须拦住，否则「清除记录」形同虚设。
     *
     * 注意：它不代表「静音」或「禁用语音」—— 解除后本模块不做任何静音，附加包仍在
     * 托管的玩家在本会话内语音、声道、距离全部照常（见 syncChannels / entityIdFor）。
     * 玩家本人重新 /vcbind（onPlayerBind）或管理员 /voice_resync 写回记录后即移出。
     */
    forgotten: new Set(),
    /** playerId -> 已用过的 "entityId:key"（避免对同一个码反复尝试） */
    triedKey: /** @type {Map<string, string>} */ (new Map()),
    /** 已给实体下发过名字的玩家（省包） */
    named: new Set(),
    /** playerId -> 当前已下发的掩码 */
    applied: new Map(),
    /** 轮询任务 id（仅在连接期间存在） */
    intervalId: /** @type {number | undefined} */ (undefined),
    /** 是否已从世界动态属性读入持久化数据 */
    loaded: false,
    /** 已累计的 tick（用于周期判定） */
    ticks: 0,
    /** 上一次下发距离参数的 tick */
    lastRangeAssertTick: -Infinity,
    /** 上一次实际下发给服务端的语音半径（用于「配置改了立刻重发」） */
    lastAppliedRange: -1,
    /** 累计发送的报文数 */
    packetsSent: 0,
    /** 自动 vcbind 尝试次数 */
    autoBindTried: 0,
    /** 自动 vcbind 失败次数 */
    autoBindFailed: 0,
    /** 最后收到的报文类型（诊断用） */
    lastPacketType: -1,
    /** 最后收到的 voicecraft 事件 id（诊断用） */
    lastEventId: "",
    /** 最后一次异常文本（诊断用） */
    lastError: "",
};


// ==================== 绑定的持久化与恢复 ====================

function ensureLoaded() {
    if (state.loaded) return;
    state.loaded = true;
    try {
        const rawBindings = mc.world.getDynamicProperty(BINDINGS_PROPERTY);
        if (typeof rawBindings === "string" && rawBindings.length > 0) {
            const obj = JSON.parse(rawBindings);
            for (const playerId in obj) {
                const entityId = Number(obj[playerId]);
                if (Number.isFinite(entityId)) state.bindings.set(playerId, entityId);
            }
        }
        const rawKeys = mc.world.getDynamicProperty(KEYS_PROPERTY);
        if (typeof rawKeys === "string" && rawKeys.length > 0) {
            const obj = JSON.parse(rawKeys);
            for (const rawId in obj) {
                const entityId = Number(rawId);
                if (Number.isFinite(entityId) && typeof obj[rawId] === "string") state.keys.set(entityId, obj[rawId]);
            }
        }
        const rawClients = mc.world.getDynamicProperty(CLIENTS_PROPERTY);
        if (typeof rawClients === "string" && rawClients.length > 0) {
            const obj = JSON.parse(rawClients);
            for (const userGuid in obj) {
                if (typeof obj[userGuid] === "string" && obj[userGuid].length > 0) state.clients.set(userGuid, obj[userGuid]);
            }
        }
    } catch (err) {
        state.lastError = "读取绑定记录失败：" + String(err);
    }
}

function persistBindings() {
    const obj = {};
    for (const [playerId, entityId] of state.bindings) obj[playerId] = entityId;
    try { mc.world.setDynamicProperty(BINDINGS_PROPERTY, JSON.stringify(obj)); }
    catch (err) { state.lastError = "写入绑定记录失败：" + String(err); }
}

function persistKeys() {
    const obj = {};
    for (const [entityId, key] of state.keys) obj[String(entityId)] = key;
    try { mc.world.setDynamicProperty(KEYS_PROPERTY, JSON.stringify(obj)); }
    catch (err) { state.lastError = "写入绑定码失败：" + String(err); }
}

function persistClients() {
    const obj = {};
    for (const [userGuid, playerId] of state.clients) obj[userGuid] = playerId;
    try { mc.world.setDynamicProperty(CLIENTS_PROPERTY, JSON.stringify(obj)); }
    catch (err) { state.lastError = "写入语音客户端记录失败：" + String(err); }
}

/**
 * 语音实体被服务端销毁（玩家客户端 App 断开 / 客户端 App 重启）时清理失效记录
 * @param {number} entityId
 */
function forgetEntity(entityId) {
    state.keys.delete(entityId);
    state.entityUser.delete(entityId);
    let changed = false;
    for (const [playerId, id] of state.bindings) {
        if (id !== entityId) continue;
        state.bindings.delete(playerId);
        state.applied.delete(playerId);
        state.named.delete(playerId);
        state.triedKey.delete(playerId);
        changed = true;
    }
    // 实体已被服务端销毁 ⇒ 附加包那边的托管关系同样不复存在
    for (const [playerId, id] of state.addonBound) {
        if (id === entityId) state.addonBound.delete(playerId);
    }
    persistKeys();
    if (changed) persistBindings();
}

/**
 * 自己按附加包的方式喂 name / worldId / position / rotation。
 * 这是「绑定只做一次」的保底路径：服务端只认这些数据，不认绑定表。
 * @param {mc.Player} player
 * @param {number} entityId
 * @returns {boolean} 是否真的发了包
 */
function selfMaintain(player, entityId) {
    if (!player.isValid) return false;
    if (!state.named.has(player.id)) {
        sendPacket(buildSetEntityStringPacket(PACKET_SET_ENTITY_NAME, entityId, player.name, MAX_STRING_LENGTH));
        state.named.add(player.id);
    }
    try {
        const loc = player.location;
        const rot = player.getRotation();
        sendPacket(buildSetEntityStringPacket(PACKET_SET_ENTITY_WORLD_ID, entityId, player.dimension.id, MAX_STRING_LENGTH));
        sendPacket(buildSetEntityPositionPacket(entityId, loc.x, loc.y, loc.z));
        sendPacket(buildSetEntityRotationPacket(entityId, rot.x, rot.y));
        return true;
    } catch (err) {
        state.lastError = "同步语音位置失败：" + String(err);
        return false;
    }
}

/**
 * 尝试用截获到的绑定码让附加包自己恢复绑定（成功后会收到 onPlayerBind，
 * 之后由附加包托管，本模块就不再自己喂位置了）。
 * 每个 (实体, 绑定码) 组合只尝试一次；命令不可用时静默退化为 selfMaintain。
 * @param {mc.Player} player
 * @param {number} entityId
 */
function tryAutoBind(player, entityId) {
    const key = state.keys.get(entityId);
    if (!key) return;
    const tag = entityId + ":" + key;
    if (state.triedKey.get(player.id) === tag) return;
    state.triedKey.set(player.id, tag);
    if (!player.isValid) return;
    try {
        player.runCommand(`voicecraft:vcbind ${key}`);
        state.autoBindTried += 1;
    } catch (err) {
        state.autoBindFailed += 1;
        state.lastError = "自动 vcbind 失败：" + String(err);
    }
}

/**
 * 记下「这个语音实体属于哪个 VoiceCraft 客户端」，并尝试把它认回原玩家。
 * 触发点：入站 EventType=3（OnNetworkEntityCreated）报文。
 * @param {number} entityId
 * @param {string} userGuid
 */
function noteEntityClient(entityId, userGuid) {
    if (!Number.isFinite(entityId) || !userGuid || userGuid === EMPTY_GUID) return;
    state.entityUser.set(entityId, userGuid);
    tryRecoverForEntity(entityId);
}

/**
 * 客户端 App 重启后，语音服务端会销毁旧实体、为同一个客户端建一个**新 id** 的实体，
 * 于是旧的 `playerId -> entityId` 记录失效。这里凭 UserGuid（客户端 App 持久保存，
 * 重启不变）把新实体认回原玩家：改写绑定记录，并用截获到的新绑定码自动 vcbind。
 *
 * 不做任何猜测：认不出来（没绑过 / 玩家不在线 / 已被解除 / 附加包仍托管着）就什么都不做，
 * 一切退回到「玩家自己 /vcbind」的老路径。
 * @param {number} entityId
 */
function tryRecoverForEntity(entityId) {
    const userGuid = state.entityUser.get(entityId);
    if (userGuid === undefined) return;
    const playerId = state.clients.get(userGuid);
    if (playerId === undefined) return;                  // 这个客户端没绑过玩家：等玩家自己 /vcbind
    if (state.forgotten.has(playerId)) return;           // 已被 /lw_p1:voice_forget 解除：不自动恢复
    if (state.addonBound.has(playerId)) return;          // 附加包仍托管着（例如只是重进世界）：别插嘴
    const player = mc.world.getPlayers().find((p) => p.id === playerId);
    if (!player) return;                                 // 玩家不在线：等他进服再走 restoreBindings
    if (state.bindings.get(playerId) !== entityId) {
        state.bindings.set(playerId, entityId);
        state.applied.delete(playerId);
        state.named.delete(playerId);
        persistBindings();
    }
    if (state.keys.has(entityId)) tryAutoBind(player, entityId);
}

/**
 * 每个 tick 检查：附加包没在托管、但我们记得其语音实体的玩家，
 * 由本模块继续喂位置，并顺手尝试让附加包恢复原生绑定。
 */
function restoreBindings() {
    if (state.bindings.size === 0) return;
    for (const player of mc.world.getPlayers()) {
        if (state.forgotten.has(player.id)) continue;     // 已被 /lw_p1:voice_forget 解除：不再自动恢复
        const entityId = state.bindings.get(player.id);
        if (entityId === undefined) continue;
        if (state.addonBound.has(player.id)) continue;   // 附加包在管，别插嘴
        selfMaintain(player, entityId);
        tryAutoBind(player, entityId);
    }
}


// ============================ 报文发送 ============================

/**
 * 把原始报文经 VoiceCraft 官方接口注入（未连接时被对方静默丢弃）
 * @param {Uint8Array} payload
 * @returns {boolean}
 */
function sendPacket(payload) {
    if (!state.supported) return false;
    mc.system.sendScriptEvent(VC_SEND_PACKET_EVENT, z85EncodeWithPadding(payload));
    state.packetsSent += 1;
    return true;
}

/**
 * 玩家的期望声道掩码：旁观（Spectator）走独立声道，其余（含大厅/局内活人）走活人声道
 * @param {mc.Player} player
 * @returns {number}
 */
function desiredMaskFor(player) {
    try {
        return player.getGameMode() === mc.GameMode.Spectator ? MASK_SPECTATOR : MASK_LIVING;
    } catch {
        return MASK_LIVING;
    }
}

/**
 * 给某个语音实体下发 Talk / Listen / Effect 三个掩码
 * @param {string} playerId
 * @param {number} entityId
 * @param {number} mask
 * @param {boolean} force 忽略缓存强制重发
 */
function applyMask(playerId, entityId, mask, force) {
    if (!force && state.applied.get(playerId) === mask) return;
    sendPacket(buildBitmaskPacket(PACKET_TALK_BITMASK, entityId, mask));
    sendPacket(buildBitmaskPacket(PACKET_LISTEN_BITMASK, entityId, mask));
    sendPacket(buildBitmaskPacket(PACKET_EFFECT_BITMASK, entityId, mask));
    state.applied.set(playerId, mask);
}

/**
 * 取某个玩家当前对应的语音实体 id：优先用附加包正在托管的那一个。
 * @param {string} playerId
 * @returns {number | undefined}
 */
function entityIdFor(playerId) {
    const hosted = state.addonBound.get(playerId);
    if (hosted !== undefined) return hosted;
    return state.bindings.get(playerId);
}

/**
 * 当前生效的活人语音半径（格）：读世界配置项 voiceRange；非法/缺失时回退默认 32。
 * 配置界面改完这项后，轮询会在 0.5 秒内发现变化并立即重发（见 maybeAssertRange）。
 * @returns {number}
 */
export function getVoiceRange() {
    try {
        const value = getConfig(VOICE_RANGE_KEY);
        return Number.isFinite(value) && value > 0 ? value : LIVING_RANGE;
    } catch {
        return LIVING_RANGE;
    }
}

/**
 * 重申活人语音半径：配置值一变就立即重发，否则每 EFFECT_REASSERT_TICKS 重申一次。
 * 只在「确认 VoiceCraft 的 Basic 包在场」（至少有一条记录或附加包正在托管玩家）时才改动
 * 服务端全局效果，避免影响与本玩法无关的纯传输部署。
 * @param {boolean} force
 */
function maybeAssertRange(force) {
    if (state.bindings.size === 0 && state.addonBound.size === 0) return;
    const range = getVoiceRange();
    const changed = range !== state.lastAppliedRange;
    if (!force && !changed && state.ticks - state.lastRangeAssertTick < EFFECT_REASSERT_TICKS) return;
    sendPacket(buildProximityEffectPacket(range));
    state.lastRangeAssertTick = state.ticks;
    state.lastAppliedRange = range;
}

/** 校正所有在线玩家的声道（解除绑定不影响本会话语音：这里只按游戏模式下发掩码） */
function syncChannels() {
    if (!state.connected) return;
    for (const player of mc.world.getPlayers()) {
        const entityId = entityIdFor(player.id);
        if (entityId === undefined) continue;
        applyMask(player.id, entityId, desiredMaskFor(player), false);
    }
}


// ============================ 轮询任务 ============================

function tick() {
    state.ticks += 1;
    try {
        if (!state.connected) return;
        if (state.ticks % SYNC_INTERVAL_TICKS === 0) {
            syncChannels();
            maybeAssertRange(false);
        }
        restoreBindings();
    } catch (err) {
        state.lastError = String(err);
    }
}

function startTicking() {
    if (state.intervalId !== undefined) return;
    state.intervalId = mc.system.runInterval(tick, 1);
}

function stopTicking() {
    if (state.intervalId === undefined) return;
    try { mc.system.clearRun(state.intervalId); } catch { /* 忽略 */ }
    state.intervalId = undefined;
}


// ============================ 事件处理 ============================

function onConnected() {
    if (!state.supported) return;
    ensureLoaded();
    state.connected = true;
    state.applied.clear();              // 重连后强制重发全部声道位
    state.named.clear();
    state.lastRangeAssertTick = -Infinity;
    state.lastAppliedRange = -1;
    startTicking();
    syncChannels();
    maybeAssertRange(true);
}

function onDisconnected() {
    state.connected = false;
    state.applied.clear();
    state.named.clear();
    state.addonBound.clear();           // 附加包的绑定表在断线时会被清空
    state.triedKey.clear();
    state.lastRangeAssertTick = -Infinity;
    state.lastAppliedRange = -1;
    stopTicking();
}

/**
 * `voicecraft:onPlayerBind` 载荷为 `${playerId}:${entityId}`
 * @param {string} message
 */
function onPlayerBind(message) {
    const parts = String(message).split(":");
    if (parts.length < 2) return;
    const playerId = parts[0];
    const entityId = Number.parseInt(parts[1], 10);
    if (!playerId || !Number.isFinite(entityId)) return;

    ensureLoaded();
    state.bindings.set(playerId, entityId);
    state.addonBound.set(playerId, entityId);
    state.triedKey.delete(playerId);
    state.named.delete(playerId);
    persistBindings();

    // 玩家主动重新 /vcbind（附加包发来本事件）＝ 恢复「进服自动绑定」：
    // 记录上面刚写回世界属性，这里只需把他移出「本会话已清除」集合。
    state.forgotten.delete(playerId);

    // 顺便记住「哪个 VoiceCraft 客户端绑给了哪个玩家」：客户端 App 重启后实体 id 会变新，
    // 但 UserGuid 不变，据此自动恢复绑定（见 tryRecoverForEntity）。
    const userGuid = state.entityUser.get(entityId);
    if (userGuid !== undefined && state.clients.get(userGuid) !== playerId) {
        state.clients.set(userGuid, playerId);
        persistClients();
    }

    if (!state.connected) return;

    const player = mc.world.getPlayers().find(p => p.id === playerId);
    if (player) applyMask(playerId, entityId, desiredMaskFor(player), true);
    else state.applied.delete(playerId);       // 暂时取不到玩家：交给轮询补发

    maybeAssertRange(false);
}

/**
 * `voicecraft:onPlayerUnbind` 载荷为 `${playerId}:${entityId}`
 * 附加包在玩家离场时会解除绑定并重新分配绑定码；这里**故意不遗忘**记录，
 * 只标记「改由本模块托管」，玩家回来时再自动恢复。
 * 例外：`state.forgotten` 里的玩家（本会话内被 /lw_p1:voice_forget 清过世界属性记录）
 * 不能借这条事件复活 —— 否则刚清掉的记录又被写回去，下次进服依旧自动 vcbind，
 * 用户看到的现象就是「清了没用、重进还是绑上」。
 * @param {string} message
 */
function onPlayerUnbind(message) {
    const parts = String(message).split(":");
    const playerId = parts[0];
    if (!playerId) return;
    ensureLoaded();
    state.addonBound.delete(playerId);
    state.named.delete(playerId);
    const entityId = Number.parseInt(parts[1], 10);
    if (state.forgotten.has(playerId)) {
        state.bindings.delete(playerId);
        state.applied.delete(playerId);
        state.triedKey.delete(playerId);
        if (Number.isFinite(entityId)) {
            state.keys.delete(entityId);
            persistKeys();
        }
        persistBindings();
        return;
    }
    if (Number.isFinite(entityId)) {
        state.bindings.set(playerId, entityId);
        persistBindings();
    }
}

/**
 * 入站报文 `voicecraft:onPacket`（诊断 + 实体销毁清理）
 * @param {string} message
 */
function onPacketSeen(message) {
    const bytes = z85DecodeWithPadding(String(message));
    if (bytes.length === 0) return;
    state.lastPacketType = bytes[0];
    // 事件报文线序 = Byte(6 EventRequest) + Byte(EventType) + 事件体
    if (bytes[0] === PACKET_EVENT_REQUEST && bytes.length >= 2 && bytes[1] === EVENT_ON_ENTITY_DESTROYED && bytes.length >= 6) {
        ensureLoaded();
        const reader = new ByteReader(bytes);
        reader.u8();                                    // PACKET_EVENT_REQUEST
        reader.u8();                                    // EVENT_ON_ENTITY_DESTROYED
        forgetEntity(reader.i32());
    }
    // EventType = 3：新语音实体上线，报文里带客户端的 UserGuid（客户端 App 重启后不变），
    // 据此把新实体认回原玩家（见 tryRecoverForEntity）。
    // 事件体 = Int32 id + Float32 loudness + Int64 lastSpoke + String userGuid(+serverUserGuid/locale) + Byte
    if (bytes[0] === PACKET_EVENT_REQUEST && bytes.length >= 22 && bytes[1] === EVENT_ON_NETWORK_ENTITY_CREATED) {
        ensureLoaded();
        const reader = new ByteReader(bytes);
        reader.u8();                                        // PACKET_EVENT_REQUEST
        reader.u8();                                        // EVENT_ON_NETWORK_ENTITY_CREATED
        const entityId = reader.i32();
        reader.skip(4);                                     // Loudness
        reader.skip(8);                                     // LastSpoke
        noteEntityClient(entityId, reader.str(MAX_STRING_LENGTH));
    }
}

/**
 * 出站报文 `voicecraft:sendPacket`：附加包公布新绑定码时把它记下来。
 * 报文 14 = SetEntityDescriptionRequest(entityId, "Welcome! Your binding key is XXXXX")
 * @param {string} message
 */
function onOutboundPacket(message) {
    let bytes;
    try { bytes = z85DecodeWithPadding(String(message)); } catch { return; }
    if (bytes.length < 7 || bytes[0] !== PACKET_SET_ENTITY_DESCRIPTION) return;
    const reader = new ByteReader(bytes);
    reader.u8();
    const entityId = reader.i32();
    const description = reader.str(MAX_DESCRIPTION_LENGTH);
    const matched = /binding key is ([0-9A-Za-z]{5})/.exec(description);
    if (!matched) return;
    ensureLoaded();
    if (state.keys.get(entityId) !== matched[1]) {
        state.keys.set(entityId, matched[1]);
        persistKeys();
    }
    // 这个实体的主人已知时（客户端 App 重启后的新实体），立刻用新码自动 vcbind
    tryRecoverForEntity(entityId);
}

mc.system.afterEvents.scriptEventReceive.subscribe((ev) => {
    try {
        const id = ev.id;
        if (!id || !id.startsWith(VC_NS)) return;
        state.lastEventId = id;
        switch (id) {
            case "voicecraft:onConnected": onConnected(); break;
            case "voicecraft:onDisconnected": onDisconnected(); break;
            case "voicecraft:onPlayerBind": onPlayerBind(ev.message); break;
            case "voicecraft:onPlayerUnbind": onPlayerUnbind(ev.message); break;
            case "voicecraft:onPacket": onPacketSeen(ev.message); break;
            case VC_SEND_PACKET_EVENT: onOutboundPacket(ev.message); break;
            default: break;
        }
    } catch (err) {
        state.lastError = String(err);
    }
});


// ============================ 诊断命令 ============================
//   /lw_p1:voice_status              查看连接、绑定记录、本会话已清除记录数、每个玩家的声道与托管方
//   /lw_p1:voice_resync [目标]       强制重发全部声道位与距离参数，并把「当前内存绑定」写回世界属性
//   /lw_p1:voice_forget [目标]       解除语音绑定（从世界属性删掉记录；不静音）
//   目标写法（参数类型为「玩家选择器」，Tab 有补全）：
//     省略                 → **全部**绑定记录（含离线玩家）：forget 清掉全部，resync 全部写回
//     @a                   → 全部在线玩家
//     @s / @p / @r / 玩家名 → 对应玩家
//   要只作用于自己请显式写 `@s`；选择器指不到离线玩家，所以除「省略」之外的写法都碰不到
//   离线玩家的记录。
// 均为 GameDirectors 权限。它们只动本模块的记录（世界属性 lw_p1:vc_bindings /
// lw_p1:vc_keys / lw_p1:vc_clients），
// 不碰附加包内存里的绑定表，也**不做任何静音**：解除后的玩家在本会话内语音照常，
// 只是重进世界需要重新 /vcbind（或由管理员 /voice_resync 把当前绑定写回）。

/** @returns {import("@minecraft/server").RawMessage[]} 状态文本（供命令输出；已本地化） */
export function getVoiceCraftStatusLines() {
    const lines = [];
    if (!state.supported) {
        lines.push(t("lw_p1.voice.status.unsupported"));
        return lines;
    }
    lines.push(t(state.connected ? "lw_p1.voice.status.connected" : "lw_p1.voice.status.idle"));
    lines.push(t("lw_p1.voice.status.channels",
        `0x${MASK_LIVING.toString(16)}`, getVoiceRange(), `0x${MASK_SPECTATOR.toString(16)}`));
    lines.push(t("lw_p1.voice.status.records", state.bindings.size, state.addonBound.size, state.keys.size));
    lines.push(t("lw_p1.voice.status.cleared", state.forgotten.size));
    lines.push(t("lw_p1.voice.status.clients", state.clients.size));
    lines.push(t("lw_p1.voice.status.stats",
        state.autoBindTried, state.autoBindFailed, state.packetsSent, state.lastPacketType));

    const players = mc.world.getPlayers();
    // 列出「世界属性里有记录」∪「附加包正在托管」的玩家：解除绑定后记录没了、
    // 但附加包仍在托管（本会话语音照常），这些人的声道同样要能看到。
    for (const playerId of new Set([...state.bindings.keys(), ...state.addonBound.keys()])) {
        const entityId = entityIdFor(playerId);
        if (entityId === undefined) continue;
        const player = players.find(p => p.id === playerId);
        const name = player ? player.name : t("lw_p1.voice.status.offline");
        const mask = state.applied.get(playerId);
        const channel = mask === MASK_SPECTATOR
            ? t("lw_p1.voice.status.channel.spectator")
            : mask === MASK_LIVING
                ? t("lw_p1.voice.status.channel.living")
                : t("lw_p1.voice.status.channel.none");
        const owner = state.addonBound.has(playerId)
            ? t("lw_p1.voice.status.owner.addon")
            : t("lw_p1.voice.status.owner.local");
        lines.push(t("lw_p1.voice.status.player", name, channel, owner, entityId));
    }
    if (!state.connected && state.lastEventId === "") {
        lines.push(t("lw_p1.voice.status.noEvent"));
    } else if (state.lastEventId !== "") {
        lines.push(t("lw_p1.voice.status.lastEvent", state.lastEventId));
    }
    if (state.lastError) lines.push(t("lw_p1.voice.status.lastError", state.lastError));
    return lines;
}

/** 立即强制重发所有声道位与距离参数（诊断用） */
export function resyncVoiceChannels() {
    if (!state.supported || !state.connected) return false;
    state.applied.clear();
    state.named.clear();
    syncChannels();
    maybeAssertRange(true);
    return true;
}

/**
 * 把若干玩家的「当前内存绑定」写回世界属性（= 恢复「进服自动绑定」，
 * /lw_p1:voice_resync 的恢复路径）。
 * 与旧实现的区别：不再依赖任何持久化的「解除名单」，因为解除绑定本身就是把世界属性里的
 * 那条记录删掉；这里做的事就是把 `entityIdFor(playerId)` 重新写进 lw_p1:vc_bindings。
 * @param {Iterable<string>} playerIds
 * @returns {number} 实际写回世界属性的条目数
 */
function restoreVoiceBindings(playerIds) {
    let count = 0;
    for (const playerId of playerIds) {
        const entityId = entityIdFor(playerId);
        if (entityId === undefined) {
            state.forgotten.delete(playerId);           // 没有实体可写：只清掉本会话的「已清除」标记
            continue;
        }
        const wasForgotten = state.forgotten.delete(playerId);
        // 顺手补回「客户端 -> 玩家」映射：没有它，客户端 App 重启后就认不回这个玩家了
        const userGuid = state.entityUser.get(entityId);
        if (userGuid !== undefined && state.clients.get(userGuid) !== playerId) {
            state.clients.set(userGuid, playerId);
            persistClients();
        }
        if (state.bindings.get(playerId) === entityId && !wasForgotten) continue;
        state.bindings.set(playerId, entityId);
        count++;
    }
    if (count > 0) persistBindings();
    return count;
}

/**
 * 恢复一个玩家的「进服自动绑定」（/lw_p1:voice_resync 的单人路径）。
 * @param {string} [playerId]
 * @returns {boolean} 是否真的写回了世界属性（false = 没记录可写 / 本来就在属性里）
 */
export function restoreVoiceBinding(playerId) {
    ensureLoaded();
    if (!playerId) return false;
    return restoreVoiceBindings([playerId]) > 0;
}

/**
 * 恢复「所有本模块知道的人」的进服自动绑定（`/lw_p1:voice_resync` 省略目标时走的就是它）。
 * 覆盖 `bindings ∪ 附加包托管` 的玩家（含离线；命令里 `@a` 只能逐个处理在线玩家，
 * 这里才是真正的「全部」——`/lw_p1:voice_forget` 省略目标也是同一条「全部」语义）。
 * @returns {number} 实际写回的条目数
 */
export function restoreAllVoiceBindings() {
    ensureLoaded();
    return restoreVoiceBindings(new Set([...state.bindings.keys(), ...state.addonBound.keys()]));
}

/**
 * 解除绑定：把玩家从世界属性 lw_p1:vc_bindings（及其绑定码缓存）里删掉，
 * 让他的绑定状态退回**内存态** —— 本会话继续由附加包托管、语音照常，
 * 但重进世界不会被自动 vcbind，必须自己再绑一次。
 *
 * 为什么不碰附加包：它的两张绑定表都是纯内存态（够不着，也没有 unbind 命令），
 * 而玩家离场时附加包会发 `voicecraft:onPlayerUnbind`；若不做任何标记，本模块会把
 * 记录写回世界属性、下次进服又自动 /vcbind —— 用户看到的就是「清了没用，重进还是绑上」。
 * 所以这里把玩家记进 `state.forgotten`（**纯内存，不持久化**，见 state 注释）。
 * 本函数**不发送任何报文**：解除绑定不等于静音，也不会打断正在进行的语音/声道同步。
 *
 * 恢复「进服自动绑定」：玩家自己重新 /vcbind <绑定码>（附加包会发 onPlayerBind，
 * 本模块随即把记录写回世界属性），或管理员执行 /lw_p1:voice_resync。
 *
 * 同时会删掉这个玩家的「语音客户端」映射（lw_p1:vc_clients 里 UserGuid -> playerId 那条）：
 * 否则他重启客户端 App 后，新实体会带着同一个 UserGuid 自动绑回来，解除就没意义了。
 *
 * @param {string} [playerId] 省略则解除全部（bindings ∪ 附加包正在托管的玩家）
 * @returns {number} 清除的绑定记录条目数
 */
export function forgetVoiceBinding(playerId) {
    ensureLoaded();
    let removed = 0;
    if (playerId === undefined) {
        removed = state.bindings.size;
        for (const id of new Set([...state.bindings.keys(), ...state.addonBound.keys()])) state.forgotten.add(id);
        state.bindings.clear();
        state.keys.clear();
        state.clients.clear();
        state.entityUser.clear();
        persistKeys();
        persistClients();
    } else {
        const entityId = entityIdFor(playerId);
        if (entityId !== undefined) state.keys.delete(entityId);
        if (state.bindings.delete(playerId)) removed = 1;
        state.forgotten.add(playerId);
        for (const [userGuid, owner] of state.clients) {
            if (owner !== playerId) continue;
            state.clients.delete(userGuid);
            for (const [id, guid] of state.entityUser) {
                if (guid === userGuid) state.entityUser.delete(id);
            }
        }
        persistKeys();
        persistClients();
    }
    persistBindings();
    return removed;
}

/**
 * 解析 `/lw_p1:voice_forget [目标]` / `/lw_p1:voice_resync [目标]` 的目标参数。
 * 参数类型是 `CustomCommandParamType.PlayerSelector`（可选），所以引擎传进来的是
 * `Player[]`（`@s` / `@a` / `@p` / `@r` 或在线玩家名，自带 Tab 补全），省略时为 `undefined`：
 *   · 省略      → `{ kind: "self" }`：由命令执行者本人充当目标
 *                 （**两条命令的回调里都用不上** —— 省略时它们直接当成 `everything`，
 *                 这条只给脚本层直接调用留的默认值）
 *   · 空玩家集  → `{ kind: "empty" }`（例如 `@a` 时服务器上一个人都没有）
 *   · 一个玩家  → `{ kind: "one", playerId, label }`
 *   · 多个玩家  → `{ kind: "many", players: [{playerId,label}, …] }`
 * 选择器只认**在线**玩家，所以省略目标之外的写法都碰不到离线玩家的记录。
 * 另外兼容两种非选择器写法（脚本直接调用时才会出现）：单个玩家对象、以及字符串
 * （`all` = 全部在线玩家；玩家名 / 玩家 id / 语音实体 id = 单个玩家，认不出来返回
 * `{ kind: "unknown", arg }`）。
 * @param {import("@minecraft/server").Player[]|import("@minecraft/server").Player|string|undefined} target
 * @returns {{kind:"self"}|{kind:"empty"}|{kind:"one",playerId:string,label:string}
 *          |{kind:"many",players:{playerId:string,label:string}[]}|{kind:"unknown",arg:string}}
 */
function resolveVoiceTarget(target) {
    if (target === undefined || target === null) return { kind: "self" };

    /** @param {import("@minecraft/server").Player} player */
    const entryOf = (player) => ({ playerId: player.id, label: player.name || player.id });

    if (Array.isArray(target)) {
        const players = [];
        for (const entry of target) {
            if (entry && typeof entry.id === "string") players.push(entryOf(entry));
        }
        if (players.length === 0) return { kind: "empty" };
        if (players.length === 1) return { kind: "one", ...players[0] };
        return { kind: "many", players };
    }

    if (typeof target === "object" && typeof target.id === "string") {
        return { kind: "one", ...entryOf(target) };
    }

    // —— 以下只为「脚本直接传字符串」这种非命令场景保留，命令里用不了字面量（选择器语法）
    const arg = String(target).trim();
    if (arg === "") return { kind: "self" };
    ensureLoaded();
    const online = mc.world.getPlayers();
    if (arg.toLowerCase() === "all") {
        if (online.length === 0) return { kind: "empty" };
        const players = online.map(entryOf);
        return players.length === 1 ? { kind: "one", ...players[0] } : { kind: "many", players };
    }
    const byName = online.find(p => p.name.toLowerCase() === arg.toLowerCase());
    if (byName) return { kind: "one", ...entryOf(byName) };
    const labelOf = (playerId) => online.find(p => p.id === playerId)?.name ?? playerId;
    const known = new Set([...state.bindings.keys(), ...state.addonBound.keys()]);
    if (known.has(arg)) return { kind: "one", playerId: arg, label: labelOf(arg) };
    const numeric = Number(arg);
    if (Number.isFinite(numeric)) {
        for (const playerId of known) {
            if (entityIdFor(playerId) === numeric) {
                return { kind: "one", playerId, label: labelOf(playerId) };
            }
        }
    }
    return { kind: "unknown", arg };
}

/** 便捷导出：世界侧是否已连上 VoiceCraft */
export function isVoiceCraftConnected() {
    return state.connected;
}

/**
 * 本模块当前是否**正在生效**（配置界面据此决定要不要显示「语音设置」入口）：
 *   · 运行环境支持发送脚本事件（sendScriptEvent 存在），且
 *   · 收到过任何 voicecraft:* 事件（= VoiceCraft 附加包在场），或已连上服务端。
 * 没装 VoiceCraft 附加包时恒为 false：本模块保持静默，也不对外暴露任何入口。
 * @returns {boolean}
 */
export function isVoiceCraftActive() {
    return state.supported && (state.connected || state.lastEventId !== "");
}


// ============================ 配置界面入口 ============================
// 经由 config/configExtensions.js 注册。configUI.js 并不认识本模块，
// 按钮是否出现完全由 isVoiceCraftActive() 决定 —— 没装 VoiceCraft 就没有这个按钮，
// 配置界面与其它功能的行为一点不变。

/**
 * 「语音设置」表单：目前只暴露活人语音半径一项（旁观者/静音规则不是可调项）。
 * 版式与「游戏相关配置」「任务相关配置」一致：`.header(...)` 分组 + 滑块说明
 * 「说明\n默认 %s\n中文标签（单位）」（%s 传默认值，当前值走 defaultValue），
 * 保存/取消后都经 `back` 回到上级界面。
 * @param {import("@minecraft/server").Player} player
 * @param {(player: import("@minecraft/server").Player) => void} [back] 返回上级界面
 */
function showVoiceCraftForm(player, back) {
    if (!player?.isValid) return;
    const meta = getConfigMeta(VOICE_RANGE_KEY);
    const min = meta && Number.isFinite(meta.min) ? meta.min : 4;
    const max = meta && Number.isFinite(meta.max) ? meta.max : 128;
    const step = meta && Number.isFinite(meta.step) ? meta.step : 4;
    const preset = meta && Number.isFinite(meta.default) ? meta.default : LIVING_RANGE;
    const current = getVoiceRange();

    new ModalFormData()
        .title(t("lw_p1.voice.ui.title"))
        .header(t("lw_p1.voice.ui.rangeHeader"))
        .slider(t("lw_p1.voice.ui.rangeDesc", preset), min, max, { valueStep: step, defaultValue: current })
        .show(player).then(res => {
            if (!player.isValid) return;
            if (res.canceled) { if (typeof back === "function") back(player); return; }
            try {
                const values = res.formValues.filter(v => v !== null && v !== undefined);
                const value = Number(values[0]);
                if (Number.isFinite(value)) {
                    setConfig(VOICE_RANGE_KEY, value);
                    player.sendMessage(t("lw_p1.voice.ui.saved", getVoiceRange()));
                    maybeAssertRange(true);     // 已连接则立即下发新半径；未连接则等连上后再下发
                }
            } catch (err) {
                player.sendMessage(t("lw_p1.ui.saveFail", String(err)));
            }
            if (typeof back === "function") back(player);
        }).catch(() => { });
}

registerConfigEntry({
    id: "lw_p1.voice",
    label: t("lw_p1.voice.ui.entry"),
    isVisible: () => isVoiceCraftActive(),
    open: showVoiceCraftForm,
});

/** 向命令执行者反馈文本（Entity 无 sendMessage，需按 id 找回 Player） */
function replyTo(origin, lines) {
    const source = origin?.sourceEntity;
    const executor = mc.world.getPlayers().find(p => p.id === source?.id);
    if (!executor?.isValid) return;
    for (const line of lines) {
        try { executor.sendMessage(line); } catch { /* 忽略 */ }
    }
}

/**
 * 把命令来源实体（origin.sourceEntity）折算成玩家 id：
 * 命令方块 / 服务器控制台执行时来源不是 Player，返回 undefined（此时需显式写出目标）。
 * @param {import("@minecraft/server").Entity} [source]
 * @returns {string|undefined}
 */
function playerIdOfSource(source) {
    const sourceId = source?.id;
    if (sourceId === undefined) return undefined;
    return mc.world.getPlayers().some(p => p.id === sourceId) ? sourceId : undefined;
}

/**
 * 命令返回值：只有 `self`（**脚本层直接调用** `resolveVoiceTarget(undefined)` 才会出现的 kind）
 * 又拿不到执行者（命令方块 / 服务器控制台）时为 Failure，由原版把「命令执行失败」反馈到
 * 命令方块 / 控制台——此时玩家侧没有对象可收提示。
 * 命令本身省略目标时走的是 `everything`（全部记录），不依赖执行者，因此控制台照样返回 Success。
 * @param {{ kind: string }} resolved
 * @param {string|undefined} sourceId
 * @returns {{ status: import("@minecraft/server").CustomCommandStatus }}
 */
function commandStatusFor(resolved, sourceId) {
    if (resolved.kind === "self" && sourceId === undefined) {
        return { status: mc.CustomCommandStatus.Failure };
    }
    return { status: mc.CustomCommandStatus.Success };
}

/** 目标参数（可选，玩家选择器）：省略时两条命令都是「全部绑定记录（含离线玩家）」 */
const TARGET_PARAMETER = [{ name: "target", type: mc.CustomCommandParamType.PlayerSelector }];

/** `/lw_p1:voice_forget` / `/lw_p1:voice_resync` 不写目标时的等价目标：全部绑定记录（含离线玩家） */
const EVERYTHING_TARGET = /** @type {{kind:"everything"}} */ ({ kind: "everything" });

/** `many` 目标在「一条记录都没写/没删」时用于回报的合并标签 */
function labelsOf(players) {
    return players.map(p => p.label).join("、");
}

mc.system.beforeEvents.startup.subscribe((init) => {
    try {
        init.customCommandRegistry.registerCommand({
            name: "lw_p1:voice_status",
            description: "Show VoiceCraft voice-channel adapter status",
            permissionLevel: mc.CommandPermissionLevel.GameDirectors,
        }, (origin) => {
            mc.system.run(() => replyTo(origin, getVoiceCraftStatusLines()));
            return { status: mc.CustomCommandStatus.Success };
        });
    } catch (err) {
        state.lastError = String(err);
    }

    try {
        init.customCommandRegistry.registerCommand({
            name: "lw_p1:voice_resync",
            description: "Resend voice bitmasks/range and write binding(s) back (no arg = ALL records incl. offline, @a = everyone online, <player>)",
            permissionLevel: mc.CommandPermissionLevel.GameDirectors,
            optionalParameters: TARGET_PARAMETER,
        }, (origin, target) => {
            const sourceId = playerIdOfSource(origin?.sourceEntity);
            // 与 forget 一致：不给目标 = 全部绑定记录（含离线玩家），要恢复自己请显式写 @s。
            const resolved = target === undefined ? EVERYTHING_TARGET : resolveVoiceTarget(target);
            mc.system.run(() => {
                const lines = [resyncVoiceChannels()
                    ? t("lw_p1.voice.cmd.resync.ok")
                    : t("lw_p1.voice.cmd.resync.idle")];
                if (resolved.kind === "unknown") {
                    lines.push(t("lw_p1.voice.cmd.target.unknown", resolved.arg));
                } else if (resolved.kind === "empty") {
                    lines.push(t("lw_p1.voice.cmd.target.empty"));
                } else if (resolved.kind === "everything") {
                    const restored = restoreAllVoiceBindings();
                    lines.push(restored > 0
                        ? t("lw_p1.voice.cmd.resync.all", restored)
                        : t("lw_p1.voice.cmd.resync.none.all"));
                } else if (resolved.kind === "many") {
                    let restored = 0;
                    for (const entry of resolved.players) {
                        if (restoreVoiceBinding(entry.playerId)) restored++;
                    }
                    lines.push(restored > 0
                        ? t("lw_p1.voice.cmd.resync.all", restored)
                        : t("lw_p1.voice.cmd.resync.none", labelsOf(resolved.players)));
                } else {
                    const playerId = resolved.kind === "self" ? sourceId : resolved.playerId;
                    if (playerId) {
                        const restored = restoreVoiceBinding(playerId);
                        if (resolved.kind === "self") {
                            if (restored) lines.push(t("lw_p1.voice.cmd.resync.restored"));
                        } else {
                            lines.push(restored
                                ? t("lw_p1.voice.cmd.resync.target", resolved.label)
                                : t("lw_p1.voice.cmd.resync.none", resolved.label));
                        }
                    }
                }
                replyTo(origin, lines);
            });
            return commandStatusFor(resolved, sourceId);
        });
    } catch (err) {
        state.lastError = String(err);
    }

    try {
        init.customCommandRegistry.registerCommand({
            name: "lw_p1:voice_forget",
            description: "Clear voice binding(s) (no arg = ALL records incl. offline, @a = everyone online, <player>); rejoin needs /vcbind again",
            permissionLevel: mc.CommandPermissionLevel.GameDirectors,
            optionalParameters: TARGET_PARAMETER,
        }, (origin, target) => {
            const sourceId = playerIdOfSource(origin?.sourceEntity);
            // 与 resync 不同：forget 不给目标时是「清掉所有记录（含离线玩家）」，
            // 不是「执行者自己」——所以要清自己请显式写 @s。
            const resolved = target === undefined ? EVERYTHING_TARGET : resolveVoiceTarget(target);
            mc.system.run(() => {
                const lines = [];
                if (resolved.kind === "unknown") {
                    lines.push(t("lw_p1.voice.cmd.target.unknown", resolved.arg));
                    lines.push(t("lw_p1.voice.cmd.forget.hint"));
                } else if (resolved.kind === "empty") {
                    lines.push(t("lw_p1.voice.cmd.target.empty"));
                } else if (resolved.kind === "everything") {
                    const removed = forgetVoiceBinding();
                    lines.push(removed > 0
                        ? t("lw_p1.voice.cmd.forget.all", removed)
                        : t("lw_p1.voice.cmd.forget.none"));
                    if (removed > 0) lines.push(t("lw_p1.voice.cmd.forget.hint"));
                } else if (resolved.kind === "many") {
                    let removed = 0;
                    for (const entry of resolved.players) {
                        if (forgetVoiceBinding(entry.playerId) > 0) removed++;
                    }
                    lines.push(removed > 0
                        ? t("lw_p1.voice.cmd.forget.all", removed)
                        : t("lw_p1.voice.cmd.forget.none"));
                    if (removed > 0) lines.push(t("lw_p1.voice.cmd.forget.hint"));
                } else {
                    const playerId = resolved.kind === "self" ? sourceId : resolved.playerId;
                    if (playerId) {
                        const removed = forgetVoiceBinding(playerId);
                        if (resolved.kind === "self") {
                            lines.push(removed > 0
                                ? t("lw_p1.voice.cmd.forget.ok")
                                : t("lw_p1.voice.cmd.forget.none"));
                        } else {
                            lines.push(removed > 0
                                ? t("lw_p1.voice.cmd.forget.target", resolved.label)
                                : t("lw_p1.voice.cmd.forget.none"));
                        }
                        lines.push(t("lw_p1.voice.cmd.forget.hint"));
                    }
                }
                replyTo(origin, lines);
            });
            return commandStatusFor(resolved, sourceId);
        });
    } catch (err) {
        state.lastError = String(err);
    }
});
