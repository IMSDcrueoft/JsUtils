const { Codec } = require('../Codec.js'); // 引入提供的codec文件

// ==================== 测试辅助函数 ====================
function assert(condition, message) {
    if (!condition) {
        throw new Error(`❌ 断言失败: ${message}`);
    }
}

function arraysEqual(a, b) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
        if (a[i] !== b[i]) return false;
    }
    return true;
}

function logSuccess(message) {
    console.log(`✅ ${message}`);
}

// ==================== Base64URL 测试 ====================
function testB64URL() {
    console.log('\n--- 测试 Base64URL ---');

    // 测试1: 空数据
    (() => {
        const empty = new Uint8Array(0);
        const encoded = Codec.B64URL.encode_u8(empty);
        const decoded = Codec.B64URL.decode_u8(encoded);
        assert(encoded === '', '空数据编码后应为空字符串');
        assert(decoded.length === 0, '空数据解码后应为空数组');
        logSuccess('空数据编解码');
    })();

    // 测试2: 单字节数据
    (() => {
        const data = new Uint8Array([0x41]); // 'A'
        const encoded = Codec.B64URL.encode_u8(data);
        const decoded = Codec.B64URL.decode_u8(encoded);
        assert(encoded === 'QQ', '单字节编码应为 "QQ"');
        assert(arraysEqual(data, decoded), '单字节编解码应一致');
        logSuccess('单字节数据');
    })();

    // 测试3: 双字节数据
    (() => {
        const data = new Uint8Array([0x41, 0x42]); // 'AB'
        const encoded = Codec.B64URL.encode_u8(data);
        const decoded = Codec.B64URL.decode_u8(encoded);
        assert(encoded === 'QUI', '双字节编码应为 "QUI"');
        assert(arraysEqual(data, decoded), '双字节编解码应一致');
        logSuccess('双字节数据');
    })();

    // 测试4: 三字节数据（完整 Base64 块）
    (() => {
        const data = new Uint8Array([0x41, 0x42, 0x43]); // 'ABC'
        const encoded = Codec.B64URL.encode_u8(data);
        const decoded = Codec.B64URL.decode_u8(encoded);
        assert(encoded === 'QUJD', '三字节编码应为 "QUJD"');
        assert(arraysEqual(data, decoded), '三字节编解码应一致');
        logSuccess('三字节数据（完整块）');
    })();

    // 测试5: 长随机数据
    (() => {
        const length = 1024;
        const data = new Uint8Array(length);
        for (let i = 0; i < length; i++) {
            data[i] = Math.floor(Math.random() * 256);
        }
        const encoded = Codec.B64URL.encode_u8(data);
        const decoded = Codec.B64URL.decode_u8(encoded);
        assert(arraysEqual(data, decoded), '1024字节随机数据编解码应一致');
        logSuccess('1024字节随机数据');
    })();

    // 测试6: 带 out 参数的编码
    (() => {
        const data = new Uint8Array([0x41, 0x42, 0x43]);
        const encoded = Codec.B64URL.encode_u8(data, 'Hello-');
        assert(encoded === 'Hello-QUJD', '带 out 参数的编码应正确拼接');
        logSuccess('带 out 参数的编码');
    })();

    // 测试7: 带 offset 参数的解码
    (() => {
        const str = 'Hello-QUJD';
        const decoded = Codec.B64URL.decode_u8(str, 6); // 从索引6开始解码
        const expected = new Uint8Array([0x41, 0x42, 0x43]);
        assert(arraysEqual(decoded, expected), '带 offset 的解码应正确');
        logSuccess('带 offset 参数的解码');
    })();

    // 测试8: URL-safe 特性验证（不应包含 +/=）
    (() => {
        const data = new Uint8Array([0xFF, 0xFF, 0xFF]);
        const encoded = Codec.B64URL.encode_u8(data);
        assert(!encoded.includes('+'), 'URL-safe 编码不应包含 +');
        assert(!encoded.includes('/'), 'URL-safe 编码不应包含 /');
        assert(!encoded.includes('='), 'URL-safe 编码不应包含 =');
        logSuccess('URL-safe 特性验证');
    })();
}

// ==================== Z85 测试 ====================
function testZ85() {
    console.log('\n--- 测试 Z85 ---');

    // 测试1: 空数据
    (() => {
        const empty = new Uint8Array(0);
        const encoded = Codec.Z85LE.encode_u8(empty);
        const decoded = Codec.Z85LE.decode_u8(encoded);
        assert(encoded === '', '空数据编码后应为空字符串');
        assert(decoded.length === 0, '空数据解码后应为空数组');
        logSuccess('空数据编解码');
    })();

    // 测试2: 4字节数据（正好一个 u32）
    (() => {
        const data = new Uint8Array([0x01, 0x02, 0x03, 0x04]);
        const encoded = Codec.Z85LE.encode_u8(data);
        const decoded = Codec.Z85LE.decode_u8(encoded);
        assert(encoded.length === 5, '4字节数据编码后应为5个字符');
        assert(arraysEqual(data, decoded), '4字节数据编解码应一致');
        logSuccess('4字节数据（正好一个 u32）');
    })();

    // 测试3: 5字节数据（需要补齐到8字节）
    (() => {
        const data = new Uint8Array([0x01, 0x02, 0x03, 0x04, 0x05]);
        const encoded = Codec.Z85LE.encode_u8(data);
        const decoded = Codec.Z85LE.decode_u8(encoded);
        // 注意：Z85 编码会对齐到 4 的倍数，解码后末尾会有填充字节
        const originalData = decoded.subarray(0, data.length);
        assert(arraysEqual(data, originalData), '5字节数据编解码应一致（忽略填充）');
        logSuccess('5字节数据（需要补齐）');
    })();

    // 测试4: 8字节数据（正好两个 u32）
    (() => {
        const data = new Uint8Array([0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08]);
        const encoded = Codec.Z85LE.encode_u8(data);
        const decoded = Codec.Z85LE.decode_u8(encoded);
        assert(encoded.length === 10, '8字节数据编码后应为10个字符');
        assert(arraysEqual(data, decoded), '8字节数据编解码应一致');
        logSuccess('8字节数据（正好两个 u32）');
    })();

    // 测试5: Uint32Array 直接编解码
    (() => {
        const u32Data = new Uint32Array([0x12345678, 0x9ABCDEF0, 0x0FEDCBA9]);
        const encoded = Codec.Z85LE.encode_u32(u32Data);
        const decoded = Codec.Z85LE.decode_u32(encoded);
        assert(encoded.length === 15, '3个 u32 编码后应为15个字符');
        assert(arraysEqual(u32Data, decoded), 'Uint32Array 直接编解码应一致');
        logSuccess('Uint32Array 直接编解码');
    })();

    // 测试6: 长随机数据
    (() => {
        const length = 1024;
        const data = new Uint8Array(length);
        for (let i = 0; i < length; i++) {
            data[i] = Math.floor(Math.random() * 256);
        }
        const encoded = Codec.Z85LE.encode_u8(data);
        const decoded = Codec.Z85LE.decode_u8(encoded);
        const originalData = decoded.subarray(0, data.length);
        assert(arraysEqual(data, originalData), '1024字节随机数据编解码应一致');
        logSuccess('1024字节随机数据');
    })();

    // 测试7: 带 out 参数的编码
    (() => {
        const u32Data = new Uint32Array([0x12345678]);
        const encoded = Codec.Z85LE.encode_u32(u32Data, 'Prefix-');
        assert(encoded.startsWith('Prefix-'), '带 out 参数的编码应正确拼接');
        logSuccess('带 out 参数的编码');
    })();

    // 测试8: 带 offset 参数的解码
    (() => {
        const str = 'Prefix-0123456789';
        const u32Data = Codec.Z85LE.decode_u32(str, 7); // 跳过 "Prefix-"
        assert(u32Data.length > 0, '带 offset 的解码应正确');
        logSuccess('带 offset 参数的解码');
    })();

    // 测试9: 无效长度检测
    (() => {
        try {
            Codec.Z85LE.decode_u32('123456'); // 长度不是5的倍数
            assert(false, '无效长度的 Z85 字符串应抛出异常');
        } catch (e) {
            assert(e.message.includes('Invalid Z85 string length'), '应正确检测无效长度');
        }
        logSuccess('无效长度检测');
    })();
}

// ==================== UTF-8 字符串转换测试 ====================
function testStringConversion() {
    console.log('\n--- 测试 UTF-8 字符串转换 ---');

    // 测试1: 空字符串
    (() => {
        const str = '';
        const u8 = Codec.stringToU8(str);
        const result = Codec.u8ToString(u8);
        assert(u8.length === 0, '空字符串应转换为空数组');
        assert(result === str, '空字符串转换应一致');
        logSuccess('空字符串');
    })();

    // 测试2: ASCII 字符串
    (() => {
        const str = 'Hello, World!';
        const u8 = Codec.stringToU8(str);
        const result = Codec.u8ToString(u8);
        assert(result === str, 'ASCII 字符串转换应一致');
        logSuccess('ASCII 字符串');
    })();

    // 测试3: 中文字符串（3字节 UTF-8）
    (() => {
        const str = '你好，世界！';
        const u8 = Codec.stringToU8(str);
        const result = Codec.u8ToString(u8);
        assert(result === str, '中文字符串转换应一致');
        logSuccess('中文字符串（3字节 UTF-8）');
    })();

    // 测试4: Emoji 表情（4字节 UTF-8 / 代理对）
    (() => {
        const str = 'Hello 🌍! 🎉';
        const u8 = Codec.stringToU8(str);
        const result = Codec.u8ToString(u8);
        assert(result === str, 'Emoji 表情字符串转换应一致');
        logSuccess('Emoji 表情（代理对）');
    })();

    // 测试5: 混合字符
    (() => {
        const str = 'ABC中文🌍😀123！';
        const u8 = Codec.stringToU8(str);
        const result = Codec.u8ToString(u8);
        assert(result === str, '混合字符转换应一致');
        logSuccess('混合字符（ASCII + 中文 + Emoji）');
    })();

    // 测试6: 与编码器结合测试
    (() => {
        const str = 'Hello 世界 🌍';
        const u8 = Codec.stringToU8(str);
        
        // Base64URL 编码
        const b64Encoded = Codec.B64URL.encode_u8(u8);
        const b64Decoded = Codec.B64URL.decode_u8(b64Encoded);
        const b64Result = Codec.u8ToString(b64Decoded);
        assert(b64Result === str, 'Base64URL + UTF-8 完整流程');
        
        // Z85 编码
        const z85Encoded = Codec.Z85LE.encode_u8(u8);
        const z85Decoded = Codec.Z85LE.decode_u8(z85Encoded);
        const z85Result = Codec.u8ToString(z85Decoded.subarray(0, u8.length));
        assert(z85Result === str, 'Z85 + UTF-8 完整流程');
        
        logSuccess('编解码器与 UTF-8 转换结合');
    })();
}

// ==================== 跨编码器一致性测试 ====================
function testCrossEncoder() {
    console.log('\n--- 测试跨编码器一致性 ---');

    const testCases = [
        new Uint8Array([0x00, 0x01, 0x02, 0x03]),
        new Uint8Array([0xFF, 0xEE, 0xDD, 0xCC, 0xBB, 0xAA]),
        new Uint8Array(256).map((_, i) => i % 256)
    ];

    testCases.forEach((data, index) => {
        // Base64URL
        const b64Encoded = Codec.B64URL.encode_u8(data);
        const b64Decoded = Codec.B64URL.decode_u8(b64Encoded);
        assert(arraysEqual(data, b64Decoded), `测试用例 ${index + 1} Base64URL 失败`);
        
        // Z85
        const z85Encoded = Codec.Z85LE.encode_u8(data);
        const z85Decoded = Codec.Z85LE.decode_u8(z85Encoded);
        const originalData = z85Decoded.subarray(0, data.length);
        assert(arraysEqual(data, originalData), `测试用例 ${index + 1} Z85 失败`);
    });
    
    logSuccess('所有测试用例在两个编码器中均通过');
}

// ==================== 边界条件测试 ====================
function testEdgeCases() {
    console.log('\n--- 测试边界条件 ---');

    // 测试1: 全零数据
    (() => {
        const data = new Uint8Array(100);
        const encoded = Codec.B64URL.encode_u8(data);
        const decoded = Codec.B64URL.decode_u8(encoded);
        assert(arraysEqual(data, decoded), '全零数据 Base64URL 编解码应一致');
        
        const z85Encoded = Codec.Z85LE.encode_u8(data);
        const z85Decoded = Codec.Z85LE.decode_u8(z85Encoded);
        assert(arraysEqual(data, z85Decoded.subarray(0, 100)), '全零数据 Z85 编解码应一致');
        logSuccess('全零数据');
    })();

    // 测试2: 全 0xFF 数据
    (() => {
        const data = new Uint8Array(100);
        data.fill(0xFF);
        const encoded = Codec.B64URL.encode_u8(data);
        const decoded = Codec.B64URL.decode_u8(encoded);
        assert(arraysEqual(data, decoded), '全 0xFF 数据 Base64URL 编解码应一致');
        logSuccess('全 0xFF 数据');
    })();

    // 测试3: 大端序 vs 小端序验证（Z85）
    (() => {
        const data = new Uint8Array([0x12, 0x34, 0x56, 0x78]);
        const u32Data = new Uint32Array(data.buffer);
        const encoded = Codec.Z85LE.encode_u32(u32Data);
        const decoded = Codec.Z85LE.decode_u32(encoded);
        assert(decoded[0] === u32Data[0], 'Z85 应保持小端序一致性');
        logSuccess('Z85 小端序保持验证');
    })();
}

// ==================== 运行所有测试 ====================
function runAllTests() {
    console.log('========== 开始测试 Codec 模块 ==========\n');
    
    try {
        testB64URL();
        testZ85();
        testStringConversion();
        testCrossEncoder();
        testEdgeCases();
        
        console.log('\n========== 🎉 所有测试通过！ ==========');
    } catch (error) {
        console.error('\n❌ 测试失败:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

runAllTests();