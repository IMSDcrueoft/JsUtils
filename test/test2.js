const { Codec } = require('./Codec.js'); // 引入提供的codec文件

/**
 * 吞吐量测试工具（支持无JIT模式）
 */
class ThroughputTest {
    constructor() {
        this.testDataSizes = [
            1024,       // 1KB
            10240,      // 10KB
            102400,     // 100KB
        ];
        
        this.iterations = 100; // 每个大小重复测试次数
        this.mode = this.getExecutionMode();
    }

    getExecutionMode() {
        const flags = process.execArgv.join(' ');
        if (flags.includes('--jitless') || flags.includes('--no-opt')) {
            return 'No JIT';
        }
        return 'With JIT';
    }

    /**
     * 生成指定大小的随机数据
     */
    generateRandomData(size) {
        const data = new Uint8Array(size);
        for (let i = 0; i < size; i++) {
            data[i] = Math.floor(Math.random() * 256);
        }
        return data;
    }

    /**
     * 测试函数执行时间
     */
    measureTime(fn) {
        const start = performance.now();
        const result = fn();
        const end = performance.now();
        return { result, time: end - start };
    }

    /**
     * B64URL编码测试
     */
    testB64UrlEncode(data) {
        return this.measureTime(() => {
            return Codec.B64URL.encode_u8(data);
        });
    }

    /**
     * B64URL解码测试
     */
    testB64UrlDecode(encodedData) {
        return this.measureTime(() => {
            return Codec.B64URL.decode_u8(encodedData);
        });
    }

    /**
     * Z85编码测试
     */
    testZ85Encode(data) {
        return this.measureTime(() => {
            return Codec.Z85LE.encode_u8(data);
        });
    }

    /**
     * Z85解码测试
     */
    testZ85Decode(encodedData) {
        return this.measureTime(() => {
            return Codec.Z85LE.decode_u8(encodedData);
        });
    }

    /**
     * 字符串转换测试
     */
    testStringConversion(testString) {
        // 测试字符串转Uint8Array
        const u8Result = this.measureTime(() => {
            return Codec.stringToU8(testString);
        });

        // 测试Uint8Array转字符串
        const strResult = this.measureTime(() => {
            return Codec.u8ToString(u8Result.result);
        });

        return {
            encodeTime: u8Result.time,
            decodeTime: strResult.time,
            roundTripCorrect: testString === strResult.result
        };
    }

    /**
     * 运行完整的吞吐量测试
     */
    runAllTests() {
        console.log('=== Codec 吞吐量性能测试 ===');
        console.log(`执行模式: ${this.mode}\n`);

        // 测试不同数据大小的编码/解码性能
        for (const size of this.testDataSizes) {
            console.log(`\n--- 测试数据大小: ${size} bytes (${(size/1024).toFixed(2)} KB) ---`);
            
            // 生成测试数据
            const testData = this.generateRandomData(size);
            
            // B64URL测试
            let b64EncodeTotal = 0;
            let b64DecodeTotal = 0;
            let b64Encoded = null;
            
            for (let i = 0; i < this.iterations; i++) {
                const encodeResult = this.testB64UrlEncode(testData);
                b64EncodeTotal += encodeResult.time;
                
                if (i === 0) { // 第一次获取编码结果用于解码测试
                    b64Encoded = encodeResult.result;
                }
            }
            
            for (let i = 0; i < this.iterations; i++) {
                const decodeResult = this.testB64UrlDecode(b64Encoded);
                b64DecodeTotal += decodeResult.time;
            }
            
            const b64EncodeAvg = b64EncodeTotal / this.iterations;
            const b64DecodeAvg = b64DecodeTotal / this.iterations;
            const b64EncodeThroughput = (size / 1024 / 1024) / (b64EncodeAvg / 1000); // MB/s
            const b64DecodeThroughput = (size / 1024 / 1024) / (b64DecodeAvg / 1000); // MB/s
            
            console.log(`B64URL - 编码: ${b64EncodeAvg.toFixed(4)}ms (平均), 吞吐量: ${b64EncodeThroughput.toFixed(2)} MB/s`);
            console.log(`B64URL - 解码: ${b64DecodeAvg.toFixed(4)}ms (平均), 吞吐量: ${b64DecodeThroughput.toFixed(2)} MB/s`);

            // Z85测试
            let z85EncodeTotal = 0;
            let z85DecodeTotal = 0;
            let z85Encoded = null;
            
            for (let i = 0; i < this.iterations; i++) {
                const encodeResult = this.testZ85Encode(testData);
                z85EncodeTotal += encodeResult.time;
                
                if (i === 0) { // 第一次获取编码结果用于解码测试
                    z85Encoded = encodeResult.result;
                }
            }
            
            for (let i = 0; i < this.iterations; i++) {
                const decodeResult = this.testZ85Decode(z85Encoded);
                z85DecodeTotal += decodeResult.time;
            }
            
            const z85EncodeAvg = z85EncodeTotal / this.iterations;
            const z85DecodeAvg = z85DecodeTotal / this.iterations;
            const z85EncodeThroughput = (size / 1024 / 1024) / (z85EncodeAvg / 1000); // MB/s
            const z85DecodeThroughput = (size / 1024 / 1024) / (z85DecodeAvg / 1000); // MB/s
            
            console.log(`Z85    - 编码: ${z85EncodeAvg.toFixed(4)}ms (平均), 吞吐量: ${z85EncodeThroughput.toFixed(2)} MB/s`);
            console.log(`Z85    - 解码: ${z85DecodeAvg.toFixed(4)}ms (平均), 吞吐量: ${z85DecodeThroughput.toFixed(2)} MB/s`);
            
            // 验证编码解码正确性
            const decodedB64 = Codec.B64URL.decode_u8(b64Encoded);
            const decodedZ85 = Codec.Z85LE.decode_u8(z85Encoded);
            const b64Correct = this.arraysEqual(testData, decodedB64);
            const z85Correct = this.arraysEqual(testData, decodedZ85);
            
            console.log(`验证   - B64URL: ${b64Correct ? '✓ 正确' : '✗ 错误'}, Z85: ${z85Correct ? '✓ 正确' : '✗ 错误'}`);
        }

        // 测试字符串转换
        console.log('\n--- 字符串转换性能测试 ---');
        const testStrings = [
            'Hello, World!',
            '这是一个中文测试字符串',
            'Performance test string with various characters: 12345!@#$%',
            'A'.repeat(1000), // 长字符串测试
            '混合UTF8字符测试：中文English123符号!@#'
        ];

        for (const testStr of testStrings) {
            const result = this.testStringConversion(testStr);
            console.log(`字符串长度: ${testStr.length}, 编码: ${result.encodeTime.toFixed(4)}ms, 解码: ${result.decodeTime.toFixed(4)}ms, 正确性: ${result.roundTripCorrect ? '✓' : '✗'}`);
        }

        // 综合对比测试
        console.log('\n--- 编码效率对比 ---');
        const sampleData = this.generateRandomData(10240); // 10KB样本
        
        const b64Encoded = Codec.B64URL.encode_u8(sampleData);
        const z85Encoded = Codec.Z85LE.encode_u8(sampleData);
        
        console.log(`原始大小: ${sampleData.length} bytes`);
        console.log(`B64URL编码后大小: ${b64Encoded.length} bytes, 增长率: ${(b64Encoded.length/sampleData.length*100-100).toFixed(2)}%`);
        console.log(`Z85编码后大小: ${z85Encoded.length} bytes, 增长率: ${(z85Encoded.length/sampleData.length*100-100).toFixed(2)}%`);
    }

    /**
     * 辅助函数：比较两个数组是否相等
     */
    arraysEqual(a, b) {
        if (a.length !== b.length) return false;
        for (let i = 0; i < a.length; i++) {
            if (a[i] !== b[i]) return false;
        }
        return true;
    }
    
    /**
     * 运行基准测试以模拟热路径（用于对比JIT与非JIT差异）
     */
    runWarmupAndBenchmark() {
        console.log('\n--- 基准测试模式 ---');
        console.log('此模式将先进行热身，然后进行性能测试以观察JIT影响');
        
        const warmupData = this.generateRandomData(1024);
        
        // 热身阶段 - 让JIT有机会优化代码路径
        console.log('正在进行热身...');
        for (let i = 0; i < 1000; i++) {
            const encoded = Codec.B64URL.encode_u8(warmupData);
            Codec.B64URL.decode_u8(encoded);
        }
        console.log('热身完成\n');
        
        // 实际测试
        this.runAllTests();
    }
}

// 提供使用说明
console.log('=== Node.js JIT性能测试说明 ===');
console.log('正常模式运行: node your_test_file.js');
console.log('禁用JIT模式运行: node --jitless your_test_file.js 或 node --no-opt your_test_file.js');
console.log('----------------------------------\n');

// 运行测试
const tester = new ThroughputTest();

// 检查是否需要运行基准测试模式
if (process.argv.includes('--benchmark')) {
    tester.runWarmupAndBenchmark();
} else {
    tester.runAllTests();
}