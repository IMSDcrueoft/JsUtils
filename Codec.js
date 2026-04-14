/*
 * MIT License
 * Copyright (c) 2026 IMSDcrueoft (https://github.com/IMSDcrueoft)
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 * 
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */
const Codec = Object.create(null);

/***
 * Base64URL - 编码/解码工具 数据膨胀33%
 * - URL-safe 字符集 (无 +/=)
 * 适合嵌入URL进行传输
 */
Codec.B64URL = (function () {
    "use strict";

    // URL-safe 字符集（无 +/=）
    const ENCODE_MAP = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

    // 构建解码查找表 (Lookup Table) - 性能优化
    const DECODE_MAP = new Uint8Array(256);
    const DECODE_INVALID = 0xFF;
    for (let i = 0; i < 256; i++) {
        DECODE_MAP[i] = DECODE_INVALID;
    }
    for (let i = 0; i < ENCODE_MAP.length; i++) {
        DECODE_MAP[ENCODE_MAP.charCodeAt(i)] = i;
    }

    /**
     * 直接 Base64 编码（无动态 push，预分配长度）
     * @param {Uint8Array} uint8Array - 输入的字节数组
     * @param {Array} out - 输入的数组,可在头部追加需要拼接的内容,避免多次拼接字符串
     * @returns {string} - Base64URL 编码后的字符串
     */
    function encode(uint8Array, out) {
        out = out || [];
        if (!uint8Array || !uint8Array.length) return out.join('');

        const baseLen = out.length;
        const len = uint8Array.length;
        // 计算 Base64 输出长度：每 3 个字节变成 4 个字符
        const len_d3 = (len / 3) | 0;
        const len_m3 = len - 3 * len_d3; // 余数 0, 1, 或 2
        // 快速循环 + 慢速循环
        const finalLen = len_d3 + (len_m3 ? 1 : 0);
        out.length = finalLen + baseLen; // 预分配输出数组长度

        let outIndex = baseLen; // 输出索引从 baseLen 开始，保留前面预填充的内容
        let h1, h2, h3, h4;
        let i = 0;

        // fast loop: 3 bytes => 4 chars
        for (let j = 0; j < len_d3; i += 3, ++j) {
            const u24 = (uint8Array[i] << 16) | (uint8Array[i + 1] << 8) | uint8Array[i + 2];

            h1 = (u24 >> 18) & 0x3f;
            h2 = (u24 >> 12) & 0x3f;
            h3 = (u24 >> 6) & 0x3f;
            h4 = u24 & 0x3f;

            out[outIndex++] = ENCODE_MAP[h1] + ENCODE_MAP[h2] + ENCODE_MAP[h3] + ENCODE_MAP[h4];
        }

        // slow loop: handle remaining 1 or 2 bytes
        if (len_m3 === 2) {
            // 2 bytes = 16 bits, need 3 chars (18 bits, last 2 bits are 0)
            // u16 = [byte1: 8 bits][byte2: 8 bits]
            // enc = [6][6][4+2padding]
            const u16 = (uint8Array[i] << 8) | uint8Array[i + 1];
            h1 = (u16 >> 10) & 0x3f;
            h2 = (u16 >> 4) & 0x3f;
            h3 = (u16 << 2) & 0x3f;
            out[outIndex++] = ENCODE_MAP[h1] + ENCODE_MAP[h2] + ENCODE_MAP[h3];
        } else if (len_m3 === 1) {
            // 1 byte = 8 bits, need 2 chars (12 bits, last 4 bits are 0)
            // enc = [6][2+4padding]
            const u8 = uint8Array[i];
            h1 = (u8 >> 2) & 0x3f;
            h2 = (u8 << 4) & 0x3f;
            out[outIndex++] = ENCODE_MAP[h1] + ENCODE_MAP[h2];
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

        // 计算 Base64 输出长度：每 4 个字符变成 3 个字节
        const len_d4 = (len / 4) | 0;

        // Base64 解码后长度约为输入的 3/4。
        // 我们预分配最大可能长度 (len * 3 / 4 + 1)，最后截取。
        const maxOutLen = (len * 3 + 1) >> 2;
        const bytes = new Uint8Array(maxOutLen);

        let byteIndex = 0;
        let i = offset, val;

        // fast loop: 4 chars => 3 bytes
        for (let j = 0; j < len_d4; i += 4, ++j) {
            val = DECODE_MAP[base64Str.charCodeAt(i)] << 18 |
                DECODE_MAP[base64Str.charCodeAt(i + 1)] << 12 |
                DECODE_MAP[base64Str.charCodeAt(i + 2)] << 6 |
                DECODE_MAP[base64Str.charCodeAt(i + 3)];

            bytes[byteIndex++] = (val >> 16) & 0xFF;
            bytes[byteIndex++] = (val >> 8) & 0xFF;
            bytes[byteIndex++] = val & 0xFF;
        }

        // slow loop: handle remaining chars
        for (let buffer = 0, bits = 0; i < strLen; i++) {
            val = DECODE_MAP[base64Str.charCodeAt(i)]; // 使用 charCodeAt 查表通常比字符串索引更快

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
        decode_u8: decode
    };
})();

/**
 * Z85 编码/解码工具(小端序变体) 数据膨胀25%
 * JSON安全但URL不安全,适合本地存储
 *
 * B64URL 数据膨胀33%
 */
Codec.Z85LE = (function () {
    "use strict";
    // Z85 字符集：去掉了 ", \, / 等 JSON 敏感字符
    const ENCODE_MAP = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ.-:+=^!/*?&<>()[]{}@%$#";

    // 构建解码查找表 (Lookup Table) - 性能优化
    const DECODE_MAP = new Uint8Array(256);
    const DECODE_INVALID = 0xFF;
    for (let i = 0; i < 256; i++) {
        DECODE_MAP[i] = DECODE_INVALID;
    }
    for (let i = 0; i < ENCODE_MAP.length; i++) {
        DECODE_MAP[ENCODE_MAP.charCodeAt(i)] = i;
    }

    /**
     * 编码：将小端整型数组 (Uint32Array) 转换为 Z85 字符串
     * @param {Uint32Array} u32Array - 原始二进制数据
     * @param {Array} out - 输入的数组,可在头部追加需要拼接的内容,避免多次拼接字符串
     * @returns {string} - Z85 编码后的字符串
     */
    function encode_u32(u32Array, out) {
        out = out || [];
        if (!u32Array || u32Array.length === 0) return out.join('');

        const baseLen = out.length;
        out.length = baseLen + u32Array.length; // 预分配输出数组长度

        let outIndex = baseLen;

        let value, nextValue;
        const INV_85 = 1.0 / 85;
        // 每 4 个整数处理一次
        for (let i = 0; i < u32Array.length; ++i) {
            value = u32Array[i];

            // 将 32 位整数转换为 5 个 85 进制的字符, 展开循环
            nextValue = Math.floor(value * INV_85);
            const char4 = ENCODE_MAP[value - 85 * nextValue];
            value = nextValue;
            nextValue = Math.floor(value * INV_85);
            const char3 = ENCODE_MAP[value - 85 * nextValue];
            value = nextValue;
            nextValue = Math.floor(value * INV_85);
            const char2 = ENCODE_MAP[value - 85 * nextValue];
            value = nextValue;
            nextValue = Math.floor(value * INV_85);
            const char1 = ENCODE_MAP[value - 85 * nextValue];
            value = nextValue;
            nextValue = Math.floor(value * INV_85);
            const char0 = ENCODE_MAP[value - 85 * nextValue];

            out[outIndex++] = (char0 + char1 + char2 + char3 + char4);
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

        // 每 5 个字符处理一次，展开循环减少循环开销
        for (let i = offset; i < strLen; i += 5) {
            // 将 5 个字符还原为一个 32 位整数
            // 使用 charCodeAt 查表，展开循环
            const value = DECODE_MAP[Z85Str.charCodeAt(i)] * 52200625 +     // * 85^4
                DECODE_MAP[Z85Str.charCodeAt(i + 1)] * 614125 +   // * 85^3
                DECODE_MAP[Z85Str.charCodeAt(i + 2)] * 7225 +     // * 85^2
                DECODE_MAP[Z85Str.charCodeAt(i + 3)] * 85 +       // * 85^1
                DECODE_MAP[Z85Str.charCodeAt(i + 4)];             // * 85^0

            result[valueIndex] = value;
            ++valueIndex;
        }

        return result;
    }

    /**
     * 编码：将字节数组 (Array/Uint8Array) 转换为 Z85 字符串
     * @param {Uint8Array} u8Array - 原始二进制数据
     * @param {Array} out - 输入的数组,可在头部追加需要拼接的内容,避免多次拼接字符串
     * @returns {string} - Z85 编码后的字符串
     */
    function encode(u8Array, out) {
        out = out || [];
        if (!u8Array || u8Array.length === 0) return out.join('');

        const len = u8Array.length;
        const padding = (4 - (len % 4)) % 4; // 补齐到 4 的倍数

        // 创建一个带填充的临时缓冲区
        const view = new Uint8Array(len + padding);
        view.set(u8Array);
        return encode_u32(new Uint32Array(view.buffer), out);
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
 * 将 Uint8Array 转换为 UTF-8 字符串
 * @param u8Array {Uint8Array}
 * @param {boolean} isAscii - 如果为true，使用isAscii模式(每个字节一个字符)
 * @returns {string} UTF-8 字符串
 */
Codec.u8ToString = function (u8Array, isAscii) {
    "use strict";
    // isAscii 模式: 每个字节直接转为一个字符
    if (isAscii) {
        let result = "";
        for (let i = 0; i < u8Array.length; i += 16384) {
            result += String.fromCharCode.apply(null, u8Array.subarray(i, i + 16384));
        }
        return result;
    }
    // UTF-8 解码
    let str = "";
    let pos = 0;
    while (pos < u8Array.length) {
        const byte1 = u8Array[pos++];
        const bytes = (byte1 > 127) + (byte1 > 223) + (byte1 > 239);
        if (pos + bytes > u8Array.length) break;
        if (bytes) {
            if (bytes === 3) {
                // 四字节字符 (Emoji等)
                const b2 = u8Array[pos++];
                const b3 = u8Array[pos++];
                const b4 = u8Array[pos++];
                let codePoint = ((byte1 & 0x07) << 18) | ((b2 & 0x3F) << 12) | ((b3 & 0x3F) << 6) | (b4 & 0x3F);
                codePoint -= 0x10000;
                const highSurrogate = 0xD800 + (codePoint >> 10);
                const lowSurrogate = 0xDC00 + (codePoint & 0x3FF);
                str += String.fromCharCode(highSurrogate, lowSurrogate);
            } else if (bytes === 1) {
                // 双字节字符
                str += String.fromCharCode(((byte1 & 0x1F) << 6) | (u8Array[pos++] & 0x3F));
            } else {
                // 三字节字符
                str += String.fromCharCode(((byte1 & 0x0F) << 12) | ((u8Array[pos++] & 0x3F) << 6) | (u8Array[pos++] & 0x3F));
            }
        } else {
            // 单字节 (ASCII)
            str += String.fromCharCode(byte1);
        }
    }
    return str;
};

/***
 * 将字符串转换为 Uint8Array
 * @param str {string} - 输入字符串
 * @param {boolean} isAscii - 如果为true，使用isAscii模式(每个字符一个字节)
 * @returns {Uint8Array} UTF-8 字节数组
 */
Codec.stringToU8 = function (str, isAscii) {
    "use strict";
    // isAscii 模式: 每个字符取低8位
    if (isAscii) {
        const arr = new Uint8Array(str.length);
        for (let i = 0; i < str.length; ++i) {
            arr[i] = str.charCodeAt(i);
        }
        return arr;
    }
    // UTF-8 编码
    const len = str.length;
    let buf = new Uint8Array(len + (len >> 1));
    let pos = 0;
    for (let i = 0; i < len; ++i) {
        // 扩容检查
        if (pos + 5 > buf.length) {
            const newBuf = new Uint8Array(pos + 8 + ((len - i) << 1));
            newBuf.set(buf);
            buf = newBuf;
        }
        const code = str.charCodeAt(i);
        if (code < 128) {
            // 单字节 ASCII
            buf[pos++] = code;
        } else if (code < 2048) {
            // 双字节
            buf[pos++] = 192 | code >> 6;
            buf[pos++] = 128 | (63 & code);
        } else if (code > 55295 && code < 57344) {
            // 代理对 (四字节)
            const nextCode = str.charCodeAt(++i);
            const point = 65536 + (((code & 0x3FF) << 10) | (nextCode & 0x3FF));
            buf[pos++] = 240 | (point >> 18);
            buf[pos++] = 128 | ((point >> 12) & 63);
            buf[pos++] = 128 | ((point >> 6) & 63);
            buf[pos++] = 128 | (point & 63);
        } else {
            // 三字节
            buf[pos++] = 224 | code >> 12;
            buf[pos++] = 128 | (code >> 6 & 63);
            buf[pos++] = 128 | (63 & code);
        }
    }
    // 截取实际使用的长度
    return buf.subarray(0, pos);
};

exports.Codec = Codec;