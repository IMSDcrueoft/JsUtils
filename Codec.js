const Codec = Object.create(null);

Codec.EncodeTypeEnum = Object.freeze({
    Z85: "Z85",
    B64URL: "B64URL"
});

/***
 * Base64URL - 编码/解码工具 数据膨胀33%
 * - URL-safe 字符集 (无 +/=)
 * 适合嵌入URL进行传输
 */
Codec.B64URL = (function () {
    "use strict";

    // URL-safe 字符集（无 +/=）
    const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

    // 构建解码查找表 (Lookup Table) - 性能优化
    const DECODE_MAP = []; // 数组比hash表更快，直接使用字符的 charCode 作为索引
    for (let i = 0; i < B64.length; i++) {
        DECODE_MAP[B64.charCodeAt(i)] = i;
    }

    /**
     * 直接 Base64 编码（无动态 push，预分配长度）
     * @param {Uint8Array} uint8Array - 输入的字节数组
     * @param {Array} out - 输入的数组,可在头部追加需要拼接的内容,避免多次拼接字符串
     * @returns {string} - Base64URL 编码后的字符串
     */
    function encode(uint8Array, out) {
        if (!uint8Array || !uint8Array.length) return '';

        out = out || [];
        const baseLen = out.length;
        const len = uint8Array.length;
        // 计算 Base64 输出长度：每 3 个字节变成 4 个字符
        const finalLen = (len * 4 + 2) / 3 | 0;
        out.length = finalLen + baseLen; // 预分配输出数组长度

        let buffer = 0;
        let bits = 0;
        let outIndex = baseLen; // 输出索引从 baseLen 开始，保留前面预填充的内容
        let i;

        for (i = 0; i < len; i++) {
            buffer = (buffer << 8) | uint8Array[i];
            bits += 8;

            while (bits >= 6) {
                bits -= 6;
                // 直接通过索引赋值，避免 push 的扩容检查
                out[outIndex++] = B64[(buffer >> bits) & 0x3F];
            }
        }

        // 处理剩余位
        if (bits > 0) {
            out[outIndex] = B64[(buffer << (6 - bits)) & 0x3F];
        }

        return out.join('');
    }

    /**
     * 从 Base64 解码回 Uint8Array（无动态 push，预分配长度）
     * @param {string} base64Str - Base64URL 编码的字符串
     * @param {number} offset - 可选，从偏移位置开始解码
     * @returns {Uint8Array} - 解码后的字节数组
     */
    function decode(base64Str, offset) {
        offset = offset || 0;
        const strLen = base64Str.length;
        const len = strLen - offset;

        if (!base64Str || len <= 0) return new Uint8Array(0);

        // Base64 解码后长度约为输入的 3/4。
        // 我们预分配最大可能长度 (len * 3 / 4 + 1)，最后截取。
        const maxOutLen = (len * 3 + 1) >> 2;
        const bytes = new Uint8Array(maxOutLen);

        let buffer = 0;
        let bits = 0;
        let byteIndex = 0;
        let i, val;

        for (i = offset; i < strLen; i++) {
            val = DECODE_MAP[base64Str.charCodeAt(i)]; // 使用 charCodeAt 查表通常比字符串索引更快
            if (val === undefined) continue;

            buffer = (buffer << 6) | val;
            bits += 6;

            if (bits >= 8) {
                bits -= 8;
                // 直接通过索引赋值
                bytes[byteIndex++] = (buffer >> bits) & 0xFF;
            }
        }

        // 如果预分配多了，截取实际使用的部分（这一步非常快，不涉及数据拷贝，只是视图切片）
        if (byteIndex !== maxOutLen) {
            return bytes.subarray(0, byteIndex);
        }

        return bytes;
    }

    return {
        encode_u8: encode,
        decode_u8: decode,
    };
})();

/**
 * Z85 编码/解码工具(小端序处理) 数据膨胀25%
 * - URL-safe 字符集 (无 +/=)
 * JSON安全但URL不安全,适合本地存储
 */
Codec.Z85 = (function () {
    "use strict";
    // Z85 字符集：去掉了 ", \, / 等 JSON 敏感字符
    const ENCODE_MAP = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ.-:+=^!/*?&<>()[]{}@%$#";

    // 解码映射表 (字符 -> 数值)
    const DECODE_MAP = [];// 数组比hash表更快，直接使用字符的 charCode 作为索引
    for (let i = 0; i < ENCODE_MAP.length; i++) {
        DECODE_MAP[ENCODE_MAP.charAt(i)] = i;
    }

    /**
     * 编码：将小端整型数组 (Uint32Array) 转换为 Z85 字符串
     * @param {Uint32Array} u32Array - 原始二进制数据
     * @param {Array} out - 输入的数组,可在头部追加需要拼接的内容,避免多次拼接字符串
     * @returns {string} - Z85 编码后的字符串
     */
    function encode_u32(u32Array, out) {
        if (!u32Array || u32Array.length === 0) return "";

        out = out || [];
        let baseLen = out.length;
        out.length = baseLen + u32Array.length * 5; // 预分配输出数组长度

        let outIndex = baseLen;

        // 每 4 个整数处理一次
        for (let i = 0; i < u32Array.length; ++i) {
            let value = u32Array[i];

            // 将 32 位整数转换为 5 个 85 进制的字符, 展开循环
            const char4 = ENCODE_MAP.charAt(value % 85);
            value = Math.floor(value / 85);
            const char3 = ENCODE_MAP.charAt(value % 85);
            value = Math.floor(value / 85);
            const char2 = ENCODE_MAP.charAt(value % 85);
            value = Math.floor(value / 85);
            const char1 = ENCODE_MAP.charAt(value % 85);
            value = Math.floor(value / 85);
            const char0 = ENCODE_MAP.charAt(value % 85);

            out[outIndex++] = char0;
            out[outIndex++] = char1;
            out[outIndex++] = char2;
            out[outIndex++] = char3;
            out[outIndex++] = char4;
        }

        return out.join('');
    }

    /**
     * 解码：将 Z85 字符串还原为小端序整型数组
     * @param {string} Z85Str - Z85 编码的字符串
     * @param {number} offset - 可选，从偏移位置开始解码
     * @returns {Uint32Array} - 还原后的二进制数据
     */
    function decode_u32(Z85Str, offset) {
        if (!Z85Str || Z85Str.length === 0) return new Uint32Array(0);

        offset = offset || 0;
        const strLen = Z85Str.length;
        const len = strLen - offset;

        // Z85 字符串长度必须是 5 的倍数
        if (len % 5 !== 0) {
            throw new Error("Invalid Z85 string length");
        }

        // 5个字符转一个u32
        const result = new Uint32Array(len / 5);
        let valueIndex = 0;

        // 每 5 个字符处理一次
        for (let i = offset; i < strLen; i += 5) {
            let value = 0;
            // 将 5 个字符还原为一个 32 位整数
            for (let j = 0; j < 5; j++) {
                const char = Z85Str.charAt(i + j);
                const digit = DECODE_MAP[char];
                value = value * 85 + digit;
            }

            result[valueIndex] = value;
            ++valueIndex;
        }

        return result;
    }

    /**
     * 编码：将字节数组 (Array/Uint8Array) 转换为 Z85 字符串
     * @param {Uint8Array} u8Array - 原始二进制数据
     * @returns {string} - Z85 编码后的字符串
     */
    function encode(u8Array) {
        if (!u8Array || u8Array.length === 0) return "";

        const len = u8Array.length;
        const padding = (4 - (len % 4)) % 4; // 补齐到 4 的倍数

        // 创建一个带填充的临时视图
        const view = new Uint8Array(len + padding);
        view.set(u8Array);
        return encode_u32(new Uint32Array(view.buffer));
    }

    /**
     * 解码：将 Z85 字符串还原为小端字节数组
     * @param {string} Z85Str - Z85 编码的字符串
     * @param {number} offset - 从偏移位置开始解码
     * @returns {Uint8Array} - 还原后的二进制数据
     */
    function decode(Z85Str, offset) {
        if (!Z85Str || Z85Str.length === 0) return new Uint8Array(0);
        const u32Array = decode_u32(Z85Str, offset);
        return new Uint8Array(u32Array.buffer);
    }

    return {
        encode_u8: encode,
        decode_u8: decode,
        encode_u32: encode_u32,
        decode_u32: decode_u32
    };
})();

/***
 * 将 UTF-8 字符串转换为 Uint8Array
 * @param str {string} UTF-8 字符串
 * @returns {Uint8Array}
 */
Codec.stringToU8 = function (str) {
    "use strict";
    const bytes = [];
    for (let i = 0; i < str.length; i++) {
        let code = str.charCodeAt(i);
        if (code < 0x80) {
            // 单字节 (ASCII)
            bytes.push(code);
        } else if (code < 0x800) {
            // 双字节
            bytes.push(0xC0 | (code >> 6));
            bytes.push(0x80 | (code & 0x3F));
        } else if (code < 0xD800 || code >= 0xE000) {
            // 三字节 (基本多文种平面，排除代理对区域)
            bytes.push(0xE0 | (code >> 12));
            bytes.push(0x80 | ((code >> 6) & 0x3F));
            bytes.push(0x80 | (code & 0x3F));
        } else {
            // 四字节 (代理对，处理 Unicode 码点 > 0xFFFF 的字符)
            i++;
            const low = str.charCodeAt(i);
            const codePoint = 0x10000 + (((code & 0x3FF) << 10) | (low & 0x3FF));
            bytes.push(0xF0 | (codePoint >> 18));
            bytes.push(0x80 | ((codePoint >> 12) & 0x3F));
            bytes.push(0x80 | ((codePoint >> 6) & 0x3F));
            bytes.push(0x80 | (codePoint & 0x3F));
        }
    }
    return new Uint8Array(bytes);
};

/***
 * 将 Uint8Array 转换为 UTF-8 字符串
 * @param u8Array {Uint8Array}
 * @returns {string} UTF-8 字符串
 */
Codec.u8ToString = function (u8Array) {
    "use strict";
    const chars = [];
    let i = 0;
    while (i < u8Array.length) {
        const byte1 = u8Array[i];
        if (byte1 < 0x80) {
            // 单字节 (ASCII)
            chars.push(String.fromCharCode(byte1));
            i++;
        } else if ((byte1 & 0xE0) === 0xC0) {
            // 双字节
            const byte2 = u8Array[i + 1];
            const code = ((byte1 & 0x1F) << 6) | (byte2 & 0x3F);
            chars.push(String.fromCharCode(code));
            i += 2;
        } else if ((byte1 & 0xF0) === 0xE0) {
            // 三字节
            const byte2 = u8Array[i + 1];
            const byte3 = u8Array[i + 2];
            const code = ((byte1 & 0x0F) << 12) | ((byte2 & 0x3F) << 6) | (byte3 & 0x3F);
            chars.push(String.fromCharCode(code));
            i += 3;
        } else if ((byte1 & 0xF8) === 0xF0) {
            // 四字节 (需要转换为代理对)
            const byte2 = u8Array[i + 1];
            const byte3 = u8Array[i + 2];
            const byte4 = u8Array[i + 3];
            let codePoint = ((byte1 & 0x07) << 18) | ((byte2 & 0x3F) << 12) | ((byte3 & 0x3F) << 6) | (byte4 & 0x3F);
            codePoint -= 0x10000;
            chars.push(String.fromCharCode(0xD800 + (codePoint >> 10)));
            chars.push(String.fromCharCode(0xDC00 + (codePoint & 0x3FF)));
            i += 4;
        } else {
            // 非法字节，跳过
            i++;
        }
    }
    return chars.join('');
};

exports.Codec = Codec;