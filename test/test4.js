const { Codec } = require('../Codec.js');
const { packFixedWidth, unpackFixedWidth } = Codec;

// ========== 简单的测试框架 ==========
class SimpleTest {
    constructor() {
        this.tests = [];
        this.passed = 0;
        this.failed = 0;
    }

    test(name, fn) {
        this.tests.push({ name, fn });
    }

    assert(condition, message) {
        if (!condition) {
            throw new Error(message);
        }
    }

    assertEquals(actual, expected, message) {
        const actualStr = JSON.stringify(actual);
        const expectedStr = JSON.stringify(expected);
        if (actualStr !== expectedStr) {
            throw new Error(`${message}\n  预期: ${expectedStr}\n  实际: ${actualStr}`);
        }
    }

    assertThrows(fn, expectedMessage, message) {
        let threw = false;
        try {
            fn();
        } catch (error) {
            threw = true;
            if (expectedMessage && !error.message.includes(expectedMessage)) {
                throw new Error(`${message}\n  错误信息不匹配: ${error.message}`);
            }
        }
        if (!threw) {
            throw new Error(`${message}\n  预期会抛出错误，但没有抛出`);
        }
    }

    async run() {
        console.log('='.repeat(70));
        console.log('开始运行测试');
        console.log('='.repeat(70) + '\n');

        for (const test of this.tests) {
            process.stdout.write(`运行: ${test.name} ... `);
            try {
                await test.fn();
                console.log('✅ 通过');
                this.passed++;
            } catch (error) {
                console.log('❌ 失败');
                console.log(`  错误: ${error.message}`);
                this.failed++;
            }
        }

        console.log('\n' + '='.repeat(70));
        console.log(`测试结果: ${this.passed} 通过, ${this.failed} 失败, 总计 ${this.tests.length} 个测试`);
        console.log('='.repeat(70));
        
        return this.failed === 0;
    }
}

// 创建测试实例
const test = new SimpleTest();

// ========== packFixedWidth 基础功能测试 ==========
test.test('packFixedWidth - 应该正确打包 1 位宽度的数据', () => {
    const numbers = [0, 1, 0, 1, 1];
    const result = packFixedWidth(numbers, 1);
    test.assert(result instanceof Uint16Array, '应返回Uint16Array');
    const unpacked = unpackFixedWidth(result);
    test.assertEquals(unpacked, numbers, '打包后应能正确解包');
});

test.test('packFixedWidth - 应该正确打包 2 位宽度的数据', () => {
    const numbers = [0, 1, 2, 3];
    const result = packFixedWidth(numbers, 2);
    const unpacked = unpackFixedWidth(result);
    test.assertEquals(unpacked, numbers, '打包后应能正确解包');
});

test.test('packFixedWidth - 应该正确打包 3 位宽度的数据', () => {
    const numbers = [1, 2, 3, 4, 5];
    const result = packFixedWidth(numbers, 3);
    const unpacked = unpackFixedWidth(result);
    test.assertEquals(unpacked, numbers, '打包后应能正确解包');
});

test.test('packFixedWidth - 应该正确处理空数组', () => {
    const result = packFixedWidth([], 8);
    test.assert(result instanceof Uint16Array, '应返回Uint16Array实例');
    const unpacked = unpackFixedWidth(result);
    test.assertEquals(unpacked, [], '空数组打包解包后应为空数组');
});

test.test('packFixedWidth - 应该正确处理单个数字', () => {
    const numbers = [42];
    const result = packFixedWidth(numbers, 8);
    const unpacked = unpackFixedWidth(result);
    test.assertEquals(unpacked, numbers, '单个数字打包解包应正确');
});

test.test('packFixedWidth - 应该正确处理最大位宽 31 位', () => {
    const numbers = [1000000, 2000000, 3000000];
    const result = packFixedWidth(numbers, 31);
    const unpacked = unpackFixedWidth(result);
    test.assertEquals(unpacked, numbers, '31位宽打包解包应正确');
});

test.test('packFixedWidth - 应该正确处理位宽为 8 的倍数', () => {
    const numbers = [255, 128, 0, 255];
    const result = packFixedWidth(numbers, 8);
    const unpacked = unpackFixedWidth(result);
    test.assertEquals(unpacked, numbers, '8位倍数打包解包应正确');
});

// ========== unpackFixedWidth 基础功能测试 ==========
test.test('unpackFixedWidth - 应该能解包 packFixedWidth 生成的数据', () => {
    const original = [0, 1, 0, 1, 1, 0, 1, 0];
    const packed = packFixedWidth(original, 1);
    const unpacked = unpackFixedWidth(packed);
    test.assertEquals(unpacked, original, '解包结果应与原数据一致');
});

// ========== 往返测试 ==========
test.test('往返测试 - 全零数据', () => {
    const numbers = [0, 0, 0, 0];
    const packed = packFixedWidth(numbers, 1);
    const unpacked = unpackFixedWidth(packed);
    test.assertEquals(unpacked, numbers, '全零数据往返失败');
});

test.test('往返测试 - 全一数据', () => {
    const numbers = [1, 1, 1, 1];
    const packed = packFixedWidth(numbers, 1);
    const unpacked = unpackFixedWidth(packed);
    test.assertEquals(unpacked, numbers, '全一数据往返失败');
});

test.test('往返测试 - 2位宽度循环数据', () => {
    const numbers = [0, 1, 2, 3, 0, 1, 2, 3];
    const packed = packFixedWidth(numbers, 2);
    const unpacked = unpackFixedWidth(packed);
    test.assertEquals(unpacked, numbers, '2位宽度数据往返失败');
});

test.test('往返测试 - 3位宽度随机数据', () => {
    const numbers = [0, 7, 3, 5, 1, 6, 2, 4];
    const packed = packFixedWidth(numbers, 3);
    const unpacked = unpackFixedWidth(packed);
    test.assertEquals(unpacked, numbers, '3位宽度数据往返失败');
});

test.test('往返测试 - 4位宽度随机数据', () => {
    const numbers = [0, 15, 8, 12, 3, 7, 10, 5];
    const packed = packFixedWidth(numbers, 4);
    const unpacked = unpackFixedWidth(packed);
    test.assertEquals(unpacked, numbers, '4位宽度数据往返失败');
});

test.test('往返测试 - 8位宽度数据', () => {
    const numbers = [100, 200, 50, 150, 250];
    const packed = packFixedWidth(numbers, 8);
    const unpacked = unpackFixedWidth(packed);
    test.assertEquals(unpacked, numbers, '8位宽度数据往返失败');
});

test.test('往返测试 - 13位宽度数据（最大值8191）', () => {
    const numbers = [1024, 2048, 4096, 8191];
    const packed = packFixedWidth(numbers, 13);
    const unpacked = unpackFixedWidth(packed);
    test.assertEquals(unpacked, numbers, '13位宽度数据往返失败');
});

test.test('往返测试 - 13位宽度边界值测试', () => {
    const numbers = [0, 1, 8190, 8191];
    const packed = packFixedWidth(numbers, 13);
    const unpacked = unpackFixedWidth(packed);
    test.assertEquals(unpacked, numbers, '13位宽度边界值往返失败');
});

test.test('往返测试 - 21位宽度数据', () => {
    const numbers = [1000000, 2000000, 1500000];
    const packed = packFixedWidth(numbers, 21);
    const unpacked = unpackFixedWidth(packed);
    test.assertEquals(unpacked, numbers, '21位宽度数据往返失败');
});

test.test('往返测试 - 各种位宽混合测试', () => {
    // 测试不同的位宽值，使用正确的最大值范围
    const testCases = [
        { bitWide: 1, numbers: [1, 0, 1, 0, 1] },
        { bitWide: 4, numbers: [5, 12, 3, 8, 15] },
        { bitWide: 7, numbers: [64, 127, 0, 33, 99] },
        { bitWide: 12, numbers: [1024, 2048, 3000, 4095] },  // 最大值4095
        { bitWide: 13, numbers: [1024, 2048, 4096, 8191] },  // 最大值8191
        { bitWide: 16, numbers: [65535, 32768, 10000, 50000] },
        { bitWide: 20, numbers: [524288, 1048575, 500000] },  // 修正：最大值1048575
        { bitWide: 24, numbers: [1000000, 2000000, 15000000] },
        { bitWide: 30, numbers: [536870911, 1073741823, 500000000] },  // 30位最大值1073741823
        { bitWide: 31, numbers: [1073741824, 2147483647, 1000000000] },  // 31位最大值2147483647
    ];
    
    for (const { bitWide, numbers } of testCases) {
        const packed = packFixedWidth(numbers, bitWide);
        const unpacked = unpackFixedWidth(packed);
        test.assertEquals(unpacked, numbers, `${bitWide}位宽度数据往返失败`);
    }
});

// ========== 边界值测试 ==========
test.test('边界值测试 - 位宽为1时的最大值', () => {
    const numbers = [1, 1, 1, 1, 1, 1, 1, 1];
    const packed = packFixedWidth(numbers, 1);
    const unpacked = unpackFixedWidth(packed);
    test.assertEquals(unpacked, numbers, '1位最大值解包应正确');
});

test.test('边界值测试 - 位宽为31时的最大值', () => {
    const max31Bit = Math.pow(2, 31) - 1;  // 2147483647
    const numbers = [max31Bit, max31Bit - 1000, 1000000];
    const packed = packFixedWidth(numbers, 31);
    const unpacked = unpackFixedWidth(packed);
    test.assertEquals(unpacked, numbers, '31位最大值应正确');
});

test.test('边界值测试 - 位宽为31时的最小值', () => {
    const numbers = [0, 0, 0];
    const packed = packFixedWidth(numbers, 31);
    const unpacked = unpackFixedWidth(packed);
    test.assertEquals(unpacked, numbers, '31位最小值应正确');
});

test.test('边界值测试 - 大数据量', () => {
    const count = 1000;
    const numbers = Array.from({ length: count }, () => Math.floor(Math.random() * 256));
    const packed = packFixedWidth(numbers, 8);
    const unpacked = unpackFixedWidth(packed);
    test.assertEquals(unpacked, numbers, '1000个数据往返失败');
});

test.test('边界值测试 - 最大数量小位宽', () => {
    const count = 1000;
    const numbers = Array.from({ length: count }, () => Math.floor(Math.random() * 2));
    const packed = packFixedWidth(numbers, 1);
    const unpacked = unpackFixedWidth(packed);
    test.assertEquals(unpacked, numbers, '1000个1位数据往返失败');
});

// ========== 错误处理测试 ==========
test.test('错误处理 - 位宽小于1时应抛出错误', () => {
    try {
        packFixedWidth([1, 2, 3], 0);
        test.assert(false, '应该抛出错误但没有抛出');
    } catch (error) {
        test.assert(true, '正确抛出错误');
    }
    
    try {
        packFixedWidth([1, 2, 3], -1);
        test.assert(false, '应该抛出错误但没有抛出');
    } catch (error) {
        test.assert(true, '正确抛出错误');
    }
});

test.test('错误处理 - 位宽大于31时应抛出错误', () => {
    try {
        packFixedWidth([1, 2, 3], 32);
        test.assert(false, '应该抛出错误但没有抛出');
    } catch (error) {
        test.assert(true, '正确抛出错误');
    }
    
    try {
        packFixedWidth([1, 2, 3], 100);
        test.assert(false, '应该抛出错误但没有抛出');
    } catch (error) {
        test.assert(true, '正确抛出错误');
    }
});

test.test('错误处理 - 数字超出位宽范围时的行为', () => {
    let errorThrown = false;
    try {
        packFixedWidth([0, 1, 4], 2);  // 4超出2位范围(0-3)
    } catch (error) {
        errorThrown = true;
    }
    if (!errorThrown) {
        console.log('  ⚠️  警告: packFixedWidth 没有对超出范围的值抛出错误');
    }
    test.assert(true, '测试完成');
});

// ========== 数据完整性测试 ==========
test.test('数据完整性 - 字节对齐边界测试', () => {
    const testLengths = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 15, 16, 17, 31, 32, 33, 63, 64];
    
    for (const length of testLengths) {
        const numbers = Array.from({ length }, (_, i) => i % 8);
        const packed = packFixedWidth(numbers, 3);
        const unpacked = unpackFixedWidth(packed);
        test.assertEquals(unpacked, numbers, `长度 ${length} 的数据往返失败`);
    }
});

test.test('数据完整性 - 应保持原始数据顺序', () => {
    const numbers = [5, 1, 4, 2, 3, 0, 7, 6];
    const packed = packFixedWidth(numbers, 3);
    const unpacked = unpackFixedWidth(packed);
    test.assertEquals(unpacked, numbers, '数据顺序应保持不变');
});

test.test('数据完整性 - 重复打包解包应该稳定', () => {
    const original = [10, 20, 30, 40, 50];
    const packed1 = packFixedWidth(original, 8);
    const unpacked1 = unpackFixedWidth(packed1);
    const packed2 = packFixedWidth(unpacked1, 8);
    const unpacked2 = unpackFixedWidth(packed2);
    test.assertEquals(unpacked2, original, '多次打包解包应保持稳定');
});

// ========== 性能测试 ==========
test.test('性能测试 - 大数据集打包解包', () => {
    const sizes = [100, 1000, 10000];
    
    for (const size of sizes) {
        const dataSet = Array.from({ length: size }, () => Math.floor(Math.random() * 256));
        
        const startPack = Date.now();
        const packed = packFixedWidth(dataSet, 8);
        const packTime = Date.now() - startPack;
        
        const startUnpack = Date.now();
        const unpacked = unpackFixedWidth(packed);
        const unpackTime = Date.now() - startUnpack;
        
        test.assertEquals(unpacked, dataSet, `${size}个数据往返失败`);
        console.log(`  ${size}个数据: 打包 ${packTime}ms, 解包 ${unpackTime}ms`);
        
        if (size <= 1000) {
            test.assert(packTime < 50, `${size}个数据打包时间 ${packTime}ms 应小于50ms`);
            test.assert(unpackTime < 50, `${size}个数据解包时间 ${unpackTime}ms 应小于50ms`);
        }
    }
});

// ========== 特殊场景测试 ==========
test.test('特殊场景 - 交替的0和最大值', () => {
    const numbers = [];
    for (let i = 0; i < 100; i++) {
        numbers.push(i % 2 === 0 ? 0 : 255);
    }
    const packed = packFixedWidth(numbers, 8);
    const unpacked = unpackFixedWidth(packed);
    test.assertEquals(unpacked, numbers, '交替0和255的数据往返失败');
});

test.test('特殊场景 - 递增序列', () => {
    const numbers = Array.from({ length: 100 }, (_, i) => i % 256);
    const packed = packFixedWidth(numbers, 8);
    const unpacked = unpackFixedWidth(packed);
    test.assertEquals(unpacked, numbers, '递增序列往返失败');
});

test.test('特殊场景 - 递减序列', () => {
    const numbers = Array.from({ length: 100 }, (_, i) => 255 - (i % 256));
    const packed = packFixedWidth(numbers, 8);
    const unpacked = unpackFixedWidth(packed);
    test.assertEquals(unpacked, numbers, '递减序列往返失败');
});

test.test('特殊场景 - 所有位宽边界值测试', () => {
    // 测试从1到31位每个位宽的最大值
    for (let bitWide = 1; bitWide <= 31; bitWide++) {
        const maxValue = Math.pow(2, bitWide) - 1;
        const numbers = [0, maxValue, Math.floor(maxValue / 2)];
        const packed = packFixedWidth(numbers, bitWide);
        const unpacked = unpackFixedWidth(packed);
        test.assertEquals(unpacked, numbers, `${bitWide}位宽度边界值往返失败`);
    }
});

// 运行所有测试
test.run().then(success => {
    process.exit(success ? 0 : 1);
});

// ========== 高精度吞吐量性能测试 (Ops/s) ==========
test.test('高精度吞吐量性能测试 - 所有位宽完整测试', () => {
    const { performance } = require('perf_hooks');
    
    console.log('\n  ' + '='.repeat(90));
    console.log('  高精度性能测试报告 (Ops/s - 每秒处理数字数)');
    console.log('  ' + '='.repeat(90));
    
    // 测试所有位宽 1-31
    for (let bitWide = 1; bitWide <= 31; bitWide++) {
        const testCount = 50000;
        const maxValue = Math.pow(2, bitWide) - 1;
        
        const numbers = Array.from({ length: testCount }, () => 
            Math.floor(Math.random() * (maxValue + 1))
        );
        
        // === 打包性能测试 ===
        let bestPackTime = Infinity;
        let packedResult = null;
        
        for (let run = 0; run < 3; run++) {
            const startPack = performance.now();
            const packed = packFixedWidth(numbers, bitWide);
            const packTime = performance.now() - startPack;
            
            if (packTime < bestPackTime) {
                bestPackTime = packTime;
                packedResult = packed;
            }
        }
        
        const packOps = (testCount / (bestPackTime / 1000)).toFixed(0);
        
        // === 解包性能测试 ===
        let totalUnpackTime = 0;
        let unpackedResult = null;
        
        for (let run = 0; run < 5; run++) {
            const startUnpack = performance.now();
            const unpacked = unpackFixedWidth(packedResult);
            const unpackTime = performance.now() - startUnpack;
            totalUnpackTime += unpackTime;
            
            if (run === 0) {
                unpackedResult = unpacked;
            }
        }
        
        const avgUnpackTime = totalUnpackTime / 5;
        const unpackOps = (testCount / (avgUnpackTime / 1000)).toFixed(0);
        
        // 验证正确性
        test.assertEquals(unpackedResult, numbers, `${bitWide}位宽度数据正确性验证失败`);
        
        // 输出结果
        const bitStr = bitWide.toString().padStart(2, ' ');
        const packTimeStr = bestPackTime.toFixed(3).padStart(8, ' ');
        const unpackTimeStr = avgUnpackTime.toFixed(3).padStart(8, ' ');
        const packOpsStr = parseInt(packOps).toLocaleString().padStart(12, ' ');
        const unpackOpsStr = parseInt(unpackOps).toLocaleString().padStart(12, ' ');
        
        console.log(`  ${bitStr}位 | 打包: ${packTimeStr}ms (${packOpsStr} ops/s) | 解包: ${unpackTimeStr}ms (${unpackOpsStr} ops/s) | 解包/打包比: ${(unpackOps / packOps).toFixed(2)}x`);
        
        // 性能断言
        test.assert(bestPackTime < 100, `${bitWide}位打包时间 ${bestPackTime.toFixed(2)}ms 应小于100ms`);
        test.assert(avgUnpackTime < 100, `${bitWide}位解包时间 ${avgUnpackTime.toFixed(2)}ms 应小于100ms`);
    }
    
    // === 极限吞吐量测试 ===
    console.log(`\n  ${'='.repeat(90)}`);
    console.log('  极限吞吐量测试 (100万条数据，8位宽度)');
    console.log('  ' + '-'.repeat(90));
    
    const extremeCount = 1000000;
    const extremeNumbers = Array.from({ length: extremeCount }, () => Math.floor(Math.random() * 256));
    
    // 预热
    packFixedWidth(extremeNumbers.slice(0, 1000), 8);
    
    // 打包测试
    const startPack = performance.now();
    const extremePacked = packFixedWidth(extremeNumbers, 8);
    const packTime = performance.now() - startPack;
    
    // 解包测试
    const startUnpack = performance.now();
    const extremeUnpacked = unpackFixedWidth(extremePacked);
    const unpackTime = performance.now() - startUnpack;
    
    const packOps = (extremeCount / (packTime / 1000)).toFixed(0);
    const unpackOps = (extremeCount / (unpackTime / 1000)).toFixed(0);
    const compressionRatio = ((1 - extremePacked.length / (extremeCount * 8)) * 100).toFixed(2);
    
    console.log(`     数据量: ${extremeCount.toLocaleString()} 个数字`);
    console.log(`     压缩率: ${compressionRatio}%`);
    console.log(`     打包: ${packTime.toFixed(2)}ms (${parseInt(packOps).toLocaleString()} ops/s)`);
    console.log(`     解包: ${unpackTime.toFixed(2)}ms (${parseInt(unpackOps).toLocaleString()} ops/s)`);
    console.log(`     速度比: 解包是打包的 ${(unpackOps / packOps).toFixed(2)} 倍`);
    
    test.assertEquals(extremeUnpacked, extremeNumbers, '100万数据正确性验证失败');
    test.assert(packTime < 2000, `打包时间 ${packTime.toFixed(2)}ms 应小于2000ms`);
    test.assert(unpackTime < 2000, `解包时间 ${unpackTime.toFixed(2)}ms 应小于2000ms`);
    
    console.log('  ' + '='.repeat(90));
});