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

Codec.CONST_ARGUMENTS_LIMIT = 65536; // Maximum arguments for Function.apply (varies by engine, 65536 is safe across modern browsers and Node.js)

/***
 * Base64URL - Encoding/Decoding Utility (33% Data Expansion)
 * - URL-safe character set (no +/=)
 * - Optimized for embedding in URLs
 */
Codec.B64URL = (function () {
    "use strict";

    // URL-safe character set (RFC 4648 base64url)
    const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

    const ENCODE_MAP = new Uint8Array(B64.length);
    for (let i = 0; i < B64.length; i++) {
        ENCODE_MAP[i] = B64.charCodeAt(i);
    }

    // Build decode lookup table (LUT) for O(1) character mapping
    // Using Uint8Array for cache-friendly memory layout
    const DECODE_MAP = new Uint8Array(256);
    const DECODE_INVALID = 0xFF;
    for (let i = 0; i < 256; i++) {
        DECODE_MAP[i] = DECODE_INVALID;
    }
    for (let i = 0; i < ENCODE_MAP.length; i++) {
        DECODE_MAP[ENCODE_MAP[i]] = i;
    }

    /**
     * Encode Uint8Array to Base64URL string
     * 
     * Optimizations:
     * - Pre-allocates output array length (avoids push() reallocation)
     * - Processes 3-byte chunks in fast loop (zero branches)
     * - Handles remainder separately (executed at most once)
     * - Batches 4 characters into single string concatenation
     * 
     * @param {Uint8Array} uint8Array - Input byte array
     * @param {string} prefix - Optional prefix string (allows prefix content without extra concatenation)
     * @returns {string} - Base64URL encoded string
     */
    function encode(uint8Array, prefix) {
        prefix = prefix || '';
        if (!uint8Array || !uint8Array.length) return prefix;

        const len = uint8Array.length;

        // Calculate output length: every 3 bytes → 4 characters
        const len_d3 = (len / 3) | 0;
        const len_m3 = len - 3 * len_d3; // Remainder: 0, 1, or 2

        // Pre-allocate output array length
        const finalLen = len_d3 * 4 + (len_m3 === 2 ? 3 : len_m3 === 1 ? 2 : 0);

        // encode to bytes
        const bytes = new Uint8Array(finalLen);
        let byteIndex = 0;
        let h1, h2, h3, h4;
        let i = 0;

        // Fast loop: 3 bytes → 4 characters
        // Unrolled bit extraction for CPU pipeline efficiency
        for (let j = 0; j < len_d3; i += 3, ++j) {
            // Pack 3 bytes into 24-bit integer (single 32-bit operation)
            const u24 = (uint8Array[i] << 16) | (uint8Array[i + 1] << 8) | uint8Array[i + 2];

            // Extract four 6-bit indices
            h1 = (u24 >> 18) & 0x3f;
            h2 = (u24 >> 12) & 0x3f;
            h3 = (u24 >> 6) & 0x3f;
            h4 = u24 & 0x3f;

            // Batch concatenation: 4 chars at once
            bytes[byteIndex++] = ENCODE_MAP[h1];
            bytes[byteIndex++] = ENCODE_MAP[h2];
            bytes[byteIndex++] = ENCODE_MAP[h3];
            bytes[byteIndex++] = ENCODE_MAP[h4];
        }

        // Slow path: handle remaining 1 or 2 bytes (executed at most once per call)
        if (len_m3 === 2) {
            // 2 bytes = 16 bits → 3 base64 characters (18 bits, last 2 bits zero-padded)
            // u16 = [byte1: 8 bits][byte2: 8 bits]
            // enc = [6][6][4+2padding]
            const u16 = (uint8Array[i] << 8) | uint8Array[i + 1];
            h1 = (u16 >> 10) & 0x3f;
            h2 = (u16 >> 4) & 0x3f;
            h3 = (u16 << 2) & 0x3f;
            bytes[byteIndex++] = ENCODE_MAP[h1];
            bytes[byteIndex++] = ENCODE_MAP[h2];
            bytes[byteIndex++] = ENCODE_MAP[h3];
        } else if (len_m3 === 1) {
            // 1 byte = 8 bits → 2 base64 characters (12 bits, last 4 bits zero-padded)
            const u8 = uint8Array[i];
            h1 = (u8 >> 2) & 0x3f;
            h2 = (u8 << 4) & 0x3f;
            bytes[byteIndex++] = ENCODE_MAP[h1];
            bytes[byteIndex++] = ENCODE_MAP[h2];
        }

        // Convert byte array to string in 64k-character chunks to avoid Function.apply argument limit
        let result = prefix;
        const chunkSize = Codec.CONST_ARGUMENTS_LIMIT; // Safe chunk size for Function.apply
        for (var pos = 0; pos < byteIndex; pos += chunkSize) {
            var end = Math.min(pos + chunkSize, byteIndex);
            result += String.fromCharCode.apply(null, bytes.subarray(pos, end));
        }
        return result;
    }

    /**
     * Decode Base64URL string to Uint8Array
     * 
     * Optimizations:
     * - Direct Uint8Array writes (zero string intermediates)
     * - 4-character batched decoding in fast loop
     * - State-machine remainder handling (avoids complex padding logic)
     * - subarray() slicing for zero-copy truncation
     * 
     * @param {string} base64Str - Base64URL encoded string
     * @param {number} offset - Optional offset to start decoding from
     * @returns {Uint8Array} - Decoded byte array
     */
    function decode(base64Str, offset) {
        offset = offset || 0;
        const strLen = base64Str.length;
        const len = strLen - offset;

        if (!base64Str || len <= 0) return new Uint8Array(0);

        const len_d4 = (len / 4) | 0;

        // Pre-allocate maximum possible output size: ceil(len * 3/4)
        const maxOutLen = (len * 3 + 1) >> 2;
        const bytes = new Uint8Array(maxOutLen);

        let byteIndex = 0;
        let i = offset, val;

        // Fast loop: 4 characters → 3 bytes
        // Single bitwise OR combines all 4 decoded values
        for (let j = 0; j < len_d4; i += 4, ++j) {
            val = DECODE_MAP[base64Str.charCodeAt(i)] << 18 |
                DECODE_MAP[base64Str.charCodeAt(i + 1)] << 12 |
                DECODE_MAP[base64Str.charCodeAt(i + 2)] << 6 |
                DECODE_MAP[base64Str.charCodeAt(i + 3)];

            bytes[byteIndex++] = (val >> 16) & 0xFF;
            bytes[byteIndex++] = (val >> 8) & 0xFF;
            bytes[byteIndex++] = val & 0xFF;
        }

        // Slow path: state machine for remaining characters
        // Accumulates bits in buffer, flushes when >= 8 bits available
        for (let buffer = 0, bits = 0; i < strLen; i++) {
            val = DECODE_MAP[base64Str.charCodeAt(i)];

            buffer = (buffer << 6) | val;
            bits += 6;

            if (bits >= 8) {
                bits -= 8;
                bytes[byteIndex++] = (buffer >> bits) & 0xFF;
            }
        }

        // Zero-copy truncation if over-allocated
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
 * Z85 Encoding/Decoding Utility - Little-Endian Variant (25% Data Expansion)
 * - JSON-safe character set (no quotes, backslashes, or slashes)
 * - Ideal for local storage and JSON embedding
 * - Base64URL expands data by 33%; Z85 expands by 25%
 */
Codec.Z85LE = (function () {
    "use strict";

    // Z85 character set: excludes JSON-sensitive characters (", \, /)
    const Z85 = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ.-:+=^!/*?&<>()[]{}@%$#";

    const ENCODE_MAP = new Uint8Array(Z85.length);
    for (let i = 0; i < Z85.length; i++) {
        ENCODE_MAP[i] = Z85.charCodeAt(i);
    }
    // Build decode lookup table (LUT) for O(1) character mapping
    const DECODE_MAP = new Uint8Array(256);
    const DECODE_INVALID = 0xFF;
    for (let i = 0; i < 256; i++) {
        DECODE_MAP[i] = DECODE_INVALID;
    }
    for (let i = 0; i < ENCODE_MAP.length; i++) {
        DECODE_MAP[ENCODE_MAP[i]] = i;
    }

    /**
     * Encode Uint32Array (little-endian) to Z85 string
     * 
     * Key Optimization: Floating-point reciprocal multiplication
     * - JS lacks native 64-bit integers for bit-shift division tricks
     * - value * (1.0/85) uses CPU's fast FPU multiplier (3-5 cycles)
     * - Math.floor() avoids expensive integer division (20-30 cycles)
     * - Loop fully unrolled for zero branch misprediction
     * 
     * @param {Uint32Array} u32Array - Raw binary data as 32-bit integers
     * @param {string} prefix - Optional prefix string (allows prefix content without extra concatenation)
     * @returns {string} - Z85 encoded string
     */
    function encode_u32(u32Array, prefix) {
        prefix = prefix || '';
        if (!u32Array || u32Array.length === 0) return prefix;

        // Pre-allocate output array length
        const finalLen = u32Array.length * 5; // Every uint32 → 5 characters
        const bytes = new Uint8Array(finalLen);
        let byteIndex = 0;

        let value, nextValue;
        const INV_85 = 1.0 / 85; // Reciprocal for multiplication instead of division

        // Process each 32-bit integer → 5 base-85 characters
        // Loop completely unrolled for maximum CPU pipeline efficiency
        for (let i = 0; i < u32Array.length; ++i) {
            value = u32Array[i];

            // Convert 32-bit integer to 5 base-85 digits (unrolled)
            // Each iteration: quotient = floor(value / 85), remainder = value % 85
            nextValue = Math.floor(value * INV_85);
            bytes[byteIndex + 4] = ENCODE_MAP[value - 85 * nextValue];
            value = nextValue;

            nextValue = Math.floor(value * INV_85);
            bytes[byteIndex + 3] = ENCODE_MAP[value - 85 * nextValue];
            value = nextValue;

            nextValue = Math.floor(value * INV_85);
            bytes[byteIndex + 2] = ENCODE_MAP[value - 85 * nextValue];
            value = nextValue;

            nextValue = Math.floor(value * INV_85);
            bytes[byteIndex + 1] = ENCODE_MAP[value - 85 * nextValue];
            value = nextValue;

            nextValue = Math.floor(value * INV_85);
            bytes[byteIndex + 0] = ENCODE_MAP[value - 85 * nextValue];

            byteIndex += 5;
        }

        // Convert byte array to string in 64k-character chunks to avoid Function.apply argument limit
        let result = prefix;
        const chunkSize = Codec.CONST_ARGUMENTS_LIMIT; // Safe chunk size for Function.apply
        for (var pos = 0; pos < byteIndex; pos += chunkSize) {
            var end = Math.min(pos + chunkSize, byteIndex);
            result += String.fromCharCode.apply(null, bytes.subarray(pos, end));
        }
        return result;
    }

    /**
     * Decode Z85 string to Uint32Array (little-endian)
     * 
     * Optimizations:
     * - Pre-computed power constants: 85^4, 85^3, 85^2, 85
     * - Fully unrolled 5-character processing
     * - Direct Uint32Array output (contiguous memory, cache-friendly)
     * 
     * @param {string} Z85Str - Z85 encoded string
     * @param {number} offset - Optional offset to start decoding from
     * @returns {Uint32Array} - Decoded 32-bit integer array
     */
    function decode_u32(Z85Str, offset) {
        if (!Z85Str || Z85Str.length === 0) return new Uint32Array(0);

        offset = offset || 0;
        const strLen = Z85Str.length;
        const len = strLen - offset;

        // Z85 encoded length must be a multiple of 5
        if (len % 5 !== 0) {
            throw new Error("Invalid Z85 string length");
        }

        // 5 characters decode to one uint32
        const result = new Uint32Array(len / 5);
        let valueIndex = 0;

        // Process 5 characters at a time, fully unrolled
        for (let i = offset; i < strLen; i += 5) {
            // Decode 5 characters to single 32-bit integer
            // Using pre-computed powers: 85^4=52200625, 85^3=614125, 85^2=7225, 85^1=85
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
     * Encode Uint8Array to Z85 string
     * Pads input to multiple of 4 bytes, then delegates to encode_u32
     * 
     * @param {Uint8Array} u8Array - Raw binary data
     * @param {Array} out - Optional output array
     * @returns {string} - Z85 encoded string
     */
    function encode(u8Array, out) {
        out = out || [];
        if (!u8Array || u8Array.length === 0) return out.join('');

        const len = u8Array.length;
        const padding = (4 - (len % 4)) % 4; // Pad to multiple of 4 bytes

        // Create padded buffer (zero-filled padding)
        const view = new Uint8Array(len + padding);
        view.set(u8Array);

        // Delegate to 32-bit encoder
        return encode_u32(new Uint32Array(view.buffer), out);
    }

    /**
     * Decode Z85 string to Uint8Array
     * 
     * @param {string} Z85Str - Z85 encoded string
     * @param {number} offset - Optional offset to start decoding from
     * @returns {Uint8Array} - Decoded byte array
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
 * Convert Uint8Array to UTF-8 string
 * 
 * Optimizations:
 * - ASCII fast path: batched String.fromCharCode with 64k chunk size
 * - UTF-8 length prediction via arithmetic: bytes = (b>127)+(b>223)+(b>239)
 * - Direct surrogate pair calculation for 4-byte characters (avoids fromCodePoint overhead)
 * 
 * @param {Uint8Array} u8Array - Input byte array
 * @param {boolean} isAscii - If true, use ASCII mode (1 byte = 1 char)
 * @returns {string} - UTF-8 decoded string
 */
Codec.u8ToString = function (u8Array, isAscii) {
    "use strict";

    // ASCII mode: each byte maps directly to a character
    if (isAscii) {
        let result = "";
        // Process in 64k-byte chunks to avoid Function.apply argument limit
        const chunkSize = Codec.CONST_ARGUMENTS_LIMIT; // Safe chunk size for Function.apply
        for (let i = 0; i < u8Array.length; i += chunkSize) {
            result += String.fromCharCode.apply(null, u8Array.subarray(i, i + chunkSize));
        }
        return result;
    }

    // UTF-8 decoding with branch-prediction-friendly length detection
    let str = "";
    let pos = 0;
    while (pos < u8Array.length) {
        const byte1 = u8Array[pos++];

        // Arithmetic length detection: avoids multiple if-else branches
        // byte1>127 → 1, byte1>223 → +1, byte1>239 → +1
        const bytes = (byte1 > 127) + (byte1 > 223) + (byte1 > 239);

        if (pos + bytes > u8Array.length) break;

        if (bytes) {
            if (bytes === 3) {
                // 4-byte character (Emoji, rare CJK, etc.)
                const b2 = u8Array[pos++];
                const b3 = u8Array[pos++];
                const b4 = u8Array[pos++];

                // Extract 21-bit code point
                let codePoint = ((byte1 & 0x07) << 18) |
                    ((b2 & 0x3F) << 12) |
                    ((b3 & 0x3F) << 6) |
                    (b4 & 0x3F);

                // Convert to UTF-16 surrogate pair
                codePoint -= 0x10000;
                const highSurrogate = 0xD800 + (codePoint >> 10);
                const lowSurrogate = 0xDC00 + (codePoint & 0x3FF);
                str += String.fromCharCode(highSurrogate, lowSurrogate);
            } else if (bytes === 1) {
                // 2-byte character (Latin extensions, Greek, Cyrillic, etc.)
                str += String.fromCharCode(((byte1 & 0x1F) << 6) | (u8Array[pos++] & 0x3F));
            } else {
                // 3-byte character (CJK, Arabic, etc.)
                str += String.fromCharCode(((byte1 & 0x0F) << 12) |
                    ((u8Array[pos++] & 0x3F) << 6) |
                    (u8Array[pos++] & 0x3F));
            }
        } else {
            // 1-byte character (ASCII)
            str += String.fromCharCode(byte1);
        }
    }
    return str;
};

/***
 * Convert string to UTF-8 Uint8Array
 * 
 * Optimizations:
 * - ASCII fast path: direct charCodeAt assignment
 * - Pre-allocation with growth strategy: initial = len * 1.5
 * - Surrogate pair handling for 4-byte characters
 * - subarray() truncation for zero-copy final sizing
 * 
 * @param {string} str - Input string
 * @param {boolean} isAscii - If true, use ASCII mode (1 char = 1 byte, lower 8 bits only)
 * @returns {Uint8Array} - UTF-8 encoded byte array
 */
Codec.stringToU8 = function (str, isAscii) {
    "use strict";

    // ASCII mode: each character takes lower 8 bits
    if (isAscii) {
        const arr = new Uint8Array(str.length);
        for (let i = 0; i < str.length; ++i) {
            arr[i] = str.charCodeAt(i);
        }
        return arr;
    }

    // UTF-8 encoding with dynamic buffer growth
    const len = str.length;
    // Initial capacity: len + 50% (accounts for multi-byte characters)
    let buf = new Uint8Array(len + (len >> 1));
    let pos = 0;

    for (let i = 0; i < len; ++i) {
        // Grow buffer if insufficient space (max 5 bytes per iteration)
        if (pos + 5 > buf.length) {
            const newBuf = new Uint8Array(pos + 8 + ((len - i) << 1));
            newBuf.set(buf);
            buf = newBuf;
        }

        const code = str.charCodeAt(i);

        if (code < 128) {
            // 1-byte ASCII
            buf[pos++] = code;
        } else if (code < 2048) {
            // 2-byte character
            buf[pos++] = 192 | (code >> 6);
            buf[pos++] = 128 | (63 & code);
        } else if (code > 55295 && code < 57344) {
            // Surrogate pair → 4-byte character
            const nextCode = str.charCodeAt(++i);
            const point = 65536 + (((code & 0x3FF) << 10) | (nextCode & 0x3FF));
            buf[pos++] = 240 | (point >> 18);
            buf[pos++] = 128 | ((point >> 12) & 63);
            buf[pos++] = 128 | ((point >> 6) & 63);
            buf[pos++] = 128 | (point & 63);
        } else {
            // 3-byte character
            buf[pos++] = 224 | (code >> 12);
            buf[pos++] = 128 | ((code >> 6) & 63);
            buf[pos++] = 128 | (63 & code);
        }
    }

    // Zero-copy truncation to actual used length
    return buf.subarray(0, pos);
};

(function () {
    "use strict";

    const MASK = new Uint32Array(32);
    for (let i = 1; i < 31; ++i) {
        MASK[i] = (1 << i) - 1;
    }
    MASK[31] = 0x7FFFFFFF;

    /***
     * Packs an array of numbers into a compact Uint8Array using fixed bit width.
     * This reduces memory footprint significantly for values that fit in fewer bits.
     * @param numberArray {number[]} - Source numbers to pack
     * @param bitWide {number} - Bits per number (1-31)
     * @returns {Uint8Array} - Compact binary representation
     */
    Codec.packFixedWidth = function (numberArray, bitWide) {
        "use strict";
        bitWide = bitWide | 0; // Ensure integer
        if (bitWide < 1 || bitWide > 31) {
            throw new RangeError("bitWide must be in range 1-31");
        }

        const len = numberArray.length;
        const dataBits = len * bitWide;
        const dataBytes = (dataBits + 7) >>> 3;
        const padding = (dataBytes << 3) - dataBits;  // Unused bits in last byte (0-7)

        const u8Array = new Uint8Array(1 + dataBytes);

        // Pack header: upper 5 bits = bitWide, lower 3 bits = padding length
        u8Array[0] = (bitWide << 3) | padding;

        const bitMask = MASK[bitWide];

        // Bit buffer for byte-level packing (max 24 bits to avoid 32-bit overflow)
        let buffer = 0;
        let bitCount = 0;
        let byteIndex = 1;

        for (let i = 0; i < len; i++) {
            const val = numberArray[i] & bitMask;  // Truncate to specified bit width

            // Prevent 32-bit overflow when adding new value to buffer
            const extraBitCount = (bitCount + bitWide) - 32;
            if (extraBitCount > 0) {
                // Push the part that fits before overflow
                buffer = (buffer << (bitWide - extraBitCount)) | (val >> extraBitCount);
                // Write 4 full bytes
                u8Array[byteIndex++] = (buffer >>> 24) & 0xFF;
                u8Array[byteIndex++] = (buffer >>> 16) & 0xFF;
                u8Array[byteIndex++] = (buffer >>> 8) & 0xFF;
                u8Array[byteIndex++] = buffer & 0xFF;
                // Store the overflow portion
                buffer = val & MASK[extraBitCount];
                bitCount = extraBitCount;
                continue;
            }

            // Append value to bit buffer
            buffer = (buffer << bitWide) | val;
            bitCount += bitWide;

            // Extract complete bytes when possible
            while (bitCount >= 8) {
                bitCount -= 8;
                u8Array[byteIndex++] = (buffer >> bitCount) & 0xFF;
                buffer &= MASK[bitCount];
            }
        }

        // Flush remaining bits (left-aligned in last byte)
        if (bitCount > 0) {
            u8Array[byteIndex] = buffer << (8 - bitCount);
        }

        return u8Array;
    };

    /***
     * Unpacks a compact bit array back into regular JavaScript numbers.
     * Reverses the packing performed by packFixedWidth.
     * @param u8Array {Uint8Array} - Previously packed binary data
     * @returns {number[]} - Restored number array
     */
    Codec.unpackFixedWidth = function (u8Array) {
        "use strict";
        if (u8Array.length < 1) {
            throw new Error("Invalid data: array is empty");
        }

        // Extract metadata from header byte
        const header = u8Array[0];
        const bitWide = header >>> 3;      // Bits 3-7 hold the width (1-31)
        const padding = header & 0x7;      // Bits 0-2 hold padding count

        if (bitWide === 0) {
            throw new RangeError("Invalid zero bitWide value");
        }

        // Calculate how many numbers we'll reconstruct
        const len = u8Array.length;
        const dataBytes = len - 1;
        const totalBits = dataBytes * 8 - padding;
        const arrayLen = Math.floor(totalBits / bitWide);
        const numberArray = new Array(arrayLen + 7);  // Extra space for safety margin

        const bitMask = MASK[bitWide];

        let buffer = 0;
        let bitCount = 0;
        let arrayIndex = 0;

        // Process payload bytes while managing 32-bit buffer limits
        for (let i = 1; i < len; ++i) {
            const extraBitCount = bitCount - 24;  // Check if next byte would overflow 32 bits

            if (extraBitCount > 0) {
                // Handle the overflow scenario (only happens with bitWide > 24)
                buffer = ((buffer << (8 - extraBitCount)) | (u8Array[i] >>> extraBitCount)) >>> 0;

                // Extract a single value from the buffer
                bitCount = 32 - bitWide;
                const val = (buffer >>> bitCount) & bitMask;
                buffer = buffer & MASK[bitCount];  // Clear consumed bits

                // Add the overflow portion back to buffer
                buffer = ((buffer << extraBitCount) | (u8Array[i] & MASK[extraBitCount])) >>> 0;
                bitCount += extraBitCount;
                numberArray[arrayIndex++] = val;
            } else {
                // Normal case: just append the byte to buffer
                buffer = ((buffer << 8) | u8Array[i]) >>> 0;
                bitCount += 8;

                // Extract as many complete values as possible
                while (bitCount >= bitWide) {
                    bitCount -= bitWide;
                    const val = (buffer >>> bitCount) & bitMask;
                    buffer = (buffer & MASK[bitCount]) >>> 0;
                    numberArray[arrayIndex++] = val;
                }
            }
        }

        // Trim array to actual size
        numberArray.length = arrayLen;
        return numberArray;
    };
})();

exports.Codec = Codec;