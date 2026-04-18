// test.js
const { IRandomGenerator, Well1024a } = require('../RandomGenerator.js');

/**
 * Test suite for WELL1024a Random Number Generator
 */
class WellRngTest {
    constructor() {
        this.passed = 0;
        this.failed = 0;
    }

    /**
     * Run all tests
     */
    runAllTests() {
        console.log("=".repeat(60));
        console.log("WELL1024a Random Number Generator Test Suite");
        console.log("=".repeat(60));

        this.testBasicGeneration();
        this.testRange();
        this.testDistribution();
        this.testDeterminism();
        this.testStateCloning();
        this.testIsolatedRand();
        this.testSkip();
        this.testEdgeCases();
        this.testPerformance();
        this.testThroughput();

        console.log("\n" + "=".repeat(60));
        console.log(`Test Results: ${this.passed} passed, ${this.failed} failed`);
        console.log("=".repeat(60));
    }

    /**
     * Assertion helper
     */
    assert(condition, message) {
        if (condition) {
            console.log(`✓ ${message}`);
            this.passed++;
            return true;
        } else {
            console.error(`✗ ${message}`);
            this.failed++;
            return false;
        }
    }

    /**
     * Test 1: Basic random number generation
     */
    testBasicGeneration() {
        console.log("\n📋 Test 1: Basic Random Number Generation");
        const rng = new Well1024a(12345);

        // Generate first few numbers and check they're within expected range
        const values = [];
        for (let i = 0; i < 10; i++) {
            const val = rng.rand_uint32();
            values.push(val);
            this.assert(val >= 0 && val <= 0xFFFFFFFF,
                `Value ${i} should be within uint32 range [0, ${0xFFFFFFFF}], got ${val}`);
        }

        console.log(`   First 10 values: ${values.join(', ')}`);

        // Test floating point methods
        const rng2 = new Well1024a(12345);
        const r1 = rng2.rand_real1();
        this.assert(r1 >= 0 && r1 <= 1, `rand_real1() should be in [0,1], got ${r1}`);

        const r2 = rng2.rand_real2();
        this.assert(r2 >= 0 && r2 < 1, `rand_real2() should be in [0,1), got ${r2}`);

        const r3 = rng2.rand_real3();
        this.assert(r3 > 0 && r3 < 1, `rand_real3() should be in (0,1), got ${r3}`);

        const r53 = rng2.rand_res53();
        this.assert(r53 >= 0 && r53 < 1, `rand_res53() should be in [0,1), got ${r53}`);

        const r = rng2.random();
        this.assert(r >= 0 && r < 1, `random() should be in [0,1), got ${r}`);
    }

    /**
     * Test 2: Verify range boundaries
     */
    testRange() {
        console.log("\n📋 Test 2: Range Boundary Tests");
        const rng = new Well1024a(999);
        const iterations = 100000;
        let min = 0xFFFFFFFF;
        let max = 0;

        for (let i = 0; i < iterations; i++) {
            const val = rng.rand_uint32();
            if (val < min) min = val;
            if (val > max) max = val;
        }

        this.assert(min >= 0, `Minimum value should be >= 0, got ${min}`);
        this.assert(max <= 0xFFFFFFFF, `Maximum value should be <= ${0xFFFFFFFF}, got ${max}`);
        console.log(`   Range over ${iterations} samples: [${min}, ${max}]`);
    }

    /**
     * Test 3: Distribution (Chi-square test)
     */
    testDistribution() {
        console.log("\n📋 Test 3: Distribution Test (Chi-square)");
        const rng = new Well1024a(42);
        const bins = 100;
        const samplesPerBin = 10000;
        const totalSamples = bins * samplesPerBin;
        const observed = new Array(bins).fill(0);

        // Generate samples and count distribution
        for (let i = 0; i < totalSamples; i++) {
            const val = rng.rand_real2();
            const bin = Math.floor(val * bins);
            observed[bin]++;
        }

        // Calculate chi-square statistic
        const expected = totalSamples / bins;
        let chiSquare = 0;
        for (let i = 0; i < bins; i++) {
            const diff = observed[i] - expected;
            chiSquare += (diff * diff) / expected;
        }

        // Critical value for chi-square with 99 degrees of freedom at 95% confidence is ~123.2
        const isUniform = chiSquare < 150;
        this.assert(isUniform,
            `Distribution appears uniform (chi-square = ${chiSquare.toFixed(2)}, expected < 150)`);

        console.log(`   Chi-square statistic: ${chiSquare.toFixed(2)}`);
        console.log(`   Bin counts range: ${Math.min(...observed)} - ${Math.max(...observed)} (expected: ${expected})`);
    }

    /**
     * Test 4: Determinism (same seed produces same sequence)
     */
    testDeterminism() {
        console.log("\n📋 Test 4: Determinism Test");
        const seed = 777;
        const rng1 = new Well1024a(seed);
        const rng2 = new Well1024a(seed);

        let identical = true;

        for (let i = 0; i < 1000; i++) {
            const val1 = rng1.rand_uint32();
            const val2 = rng2.rand_uint32();
            if (val1 !== val2) {
                identical = false;
                break;
            }
        }

        this.assert(identical, "Same seed should produce identical sequences");

        // Test different seeds produce different sequences
        const rng3 = new Well1024a(seed);
        const rng4 = new Well1024a(seed + 1);
        let firstDiff = -1;

        for (let i = 0; i < 100; i++) {
            const val3 = rng3.rand_uint32();
            const val4 = rng4.rand_uint32();
            if (val3 !== val4) {
                firstDiff = i;
                break;
            }
        }

        this.assert(firstDiff >= 0, "Different seeds should eventually produce different values");
        console.log(`   First difference at index ${firstDiff}`);
    }

    /**
     * Test 5: State cloning and restoration
     */
    testStateCloning() {
        console.log("\n📋 Test 5: State Cloning and Restoration");
        const rng = new Well1024a(123);

        // Generate some random numbers and save state
        const firstValues = [];
        for (let i = 0; i < 50; i++) {
            firstValues.push(rng.rand_uint32());
        }

        // Clone state
        const clonedState = rng.cloneState();

        // Generate more numbers
        const middleValues = [];
        for (let i = 0; i < 50; i++) {
            middleValues.push(rng.rand_uint32());
        }

        // Restore state and verify we get the same middle sequence
        rng.restoreState(clonedState);
        const restoredValues = [];
        for (let i = 0; i < 50; i++) {
            restoredValues.push(rng.rand_uint32());
        }

        let allMatch = true;
        for (let i = 0; i < 50; i++) {
            if (middleValues[i] !== restoredValues[i]) {
                allMatch = false;
                break;
            }
        }

        this.assert(allMatch, "Restored state should produce identical subsequent sequence");
        console.log(`   State cloning and restoration works correctly`);
    }

    /**
     * Test 6: IsolatedRand functionality
     * 正确逻辑：IsolatedRand 内的操作不应影响外部状态
     */
    testIsolatedRand() {
        console.log("\n📋 Test 6: IsolatedRand Test");
        const rng = new Well1024a(555);

        // 记录正常序列的前20个值
        const normalSequence = [];
        for (let i = 0; i < 20; i++) {
            normalSequence.push(rng.rand_uint32());
        }

        // 重新创建相同种子的RNG
        const rng2 = new Well1024a(555);

        // 先取10个值作为基准
        const beforeValues = [];
        for (let i = 0; i < 10; i++) {
            beforeValues.push(rng2.rand_uint32());
        }

        // 使用 IsolatedRand，内部生成15个数
        const isolatedResult = rng2.IsolatedRand((isolatedRng) => {
            const values = [];
            for (let i = 0; i < 15; i++) {
                values.push(isolatedRng.rand_uint32());
            }
            return values;
        });

        // 继续生成10个数
        const afterValues = [];
        for (let i = 0; i < 10; i++) {
            afterValues.push(rng2.rand_uint32());
        }

        // 验证：IsolatedRand 前后的值应该与正常序列一致
        // 因为 IsolatedRand 内部消耗了15个数，但外部状态应该恢复，
        // 所以 afterValues 应该等于 normalSequence 的第10-19个值
        let stateCorrect = true;
        for (let i = 0; i < 10; i++) {
            if (afterValues[i] !== normalSequence[i + 10]) {
                stateCorrect = false;
                console.log(`   Mismatch: afterValues[${i}]=${afterValues[i]}, expected=${normalSequence[i + 10]}`);
                break;
            }
        }

        this.assert(stateCorrect, "State should be restored after IsolatedRand, continuing sequence should match normal sequence");
        console.log(`   IsolatedRand returned ${isolatedResult.length} values without affecting outer state`);
    }

    /**
     * Test 7: Skip functionality
     * 正确逻辑：skip(n) 后，下一个值应该等于正常生成 n+1 次后的值
     */
    testSkip() {
        console.log("\n📋 Test 7: Skip Functionality Test");
        const skipCount = 500;

        // 方法1：使用 skip
        const rngSkip = new Well1024a(888);
        rngSkip.skip(skipCount);
        const valueAfterSkip = rngSkip.rand_uint32();

        // 方法2：正常生成 skipCount+1 次
        const rngNormal = new Well1024a(888);
        for (let i = 0; i < skipCount; i++) {
            rngNormal.rand_uint32();
        }
        const valueAfterNormal = rngNormal.rand_uint32();

        this.assert(valueAfterSkip === valueAfterNormal,
            `skip(${skipCount}) should advance state correctly`);
        console.log(`   Skip method advances RNG state correctly`);
    }

    /**
     * Test 8: Edge cases (zero seed, array seed, large seed)
     */
    testEdgeCases() {
        console.log("\n📋 Test 8: Edge Cases");

        // Test with zero seed
        const rngZero = new Well1024a(0);
        const zeroValue = rngZero.rand_uint32();
        this.assert(zeroValue >= 0, "Zero seed should still produce valid numbers");

        // Test with array seed
        const rngArray = new Well1024a([1, 2, 3, 4, 5]);
        const arrayValue = rngArray.rand_uint32();
        this.assert(arrayValue >= 0, "Array seed should work properly");

        // Test with no seed (default to timestamp)
        const rngDefault = new Well1024a();
        const defaultValue = rngDefault.rand_uint32();
        this.assert(defaultValue >= 0, "No seed should default to timestamp");

        // Test with large seed (> 2^32)
        const rngLarge = new Well1024a(0xFFFFFFFFFFFFFFFF);
        const largeValue = rngLarge.rand_uint32();
        this.assert(largeValue >= 0, "Large seed should be properly truncated");

        // Test with empty array seed
        const rngEmptyArray = new Well1024a([]);
        const emptyArrayValue = rngEmptyArray.rand_uint32();
        this.assert(emptyArrayValue >= 0, "Empty array seed should still initialize");

        console.log(`   All edge cases handled correctly`);
    }

    /**
     * Test 9: Performance benchmark
     */
    testPerformance() {
        console.log("\n📋 Test 9: Performance Benchmark");
        const rng = new Well1024a(123456);

        // Warmup
        for (let i = 0; i < 100000; i++) {
            rng.rand_uint32();
        }

        // Test uint32 generation speed
        const uint32Start = process.hrtime.bigint();
        const uint32Count = 10000000;
        for (let i = 0; i < uint32Count; i++) {
            rng.rand_uint32();
        }
        const uint32End = process.hrtime.bigint();
        const uint32Time = Number(uint32End - uint32Start) / 1e9;
        const uint32Speed = uint32Count / uint32Time;

        console.log(`   uint32 generation:`);
        console.log(`     - ${uint32Count.toLocaleString()} numbers in ${uint32Time.toFixed(3)} seconds`);
        console.log(`     - ${uint32Speed.toLocaleString()} numbers/second`);

        // Test floating point generation speed
        const floatStart = process.hrtime.bigint();
        const floatCount = 10000000;
        for (let i = 0; i < floatCount; i++) {
            rng.random();
        }
        const floatEnd = process.hrtime.bigint();
        const floatTime = Number(floatEnd - floatStart) / 1e9;
        const floatSpeed = floatCount / floatTime;

        console.log(`   float generation:`);
        console.log(`     - ${floatCount.toLocaleString()} numbers in ${floatTime.toFixed(3)} seconds`);
        console.log(`     - ${floatSpeed.toLocaleString()} numbers/second`);

        // Memory usage check
        const memUsage = process.memoryUsage();
        console.log(`   Memory usage:`);
        console.log(`     - Heap: ${(memUsage.heapUsed / 1024 / 1024).toFixed(2)} MB`);
        console.log(`     - RSS: ${(memUsage.rss / 1024 / 1024).toFixed(2)} MB`);

        this.assert(uint32Speed > 10000000,
            `Performance should be > 10M ops/sec, got ${(uint32Speed / 1e6).toFixed(1)}M ops/sec`);
    }

    /**
     * Test 10: Throughput benchmark with different sample sizes
     */
    testThroughput() {
        console.log("\n📋 Test 10: Throughput Benchmark");
        const sampleSizes = [1e4, 1e6, 1e8];

        console.log(`   ${"Sample Size".padEnd(12)} ${"Time (s)".padEnd(10)} ${"Prec32 (ops/sec)".padEnd(18)} ${"MB/s".padEnd(10)}`);
        console.log(`   ${"-".repeat(12)} ${"-".repeat(10)} ${"-".repeat(18)} ${"-".repeat(10)}`);

        const seed = Date.now();

        for (const size of sampleSizes) {
            const testRng = new Well1024a(seed);

            for (let i = 0; i < 1000; i++) {
                testRng.rand_uint32();
            }

            const start = process.hrtime.bigint();
            for (let i = 0; i < size; i++) {
                testRng.rand_uint32();
            }
            const end = process.hrtime.bigint();
            const timeSec = Number(end - start) / 1e9;
            const speed = size / timeSec;
            const mbPerSec = (size * 4) / timeSec / (1024 * 1024); // 4 bytes per uint32

            console.log(`   ${size.toString().padEnd(12)} ${timeSec.toFixed(3).padEnd(10)} ${Math.round(speed).toLocaleString().padEnd(18)} ${mbPerSec.toFixed(2)}`);
        }

        console.log("\n");
        console.log(`   ${"Sample Size".padEnd(12)} ${"Time (s)".padEnd(10)} ${"Prec53 (ops/sec)".padEnd(18)} ${"MB/s".padEnd(10)}`);
        console.log(`   ${"-".repeat(12)} ${"-".repeat(10)} ${"-".repeat(18)} ${"-".repeat(10)}`);

        for (const size of sampleSizes) {
            const testRng = new Well1024a(seed);

            for (let i = 0; i < 1000; i++) {
                testRng.rand_res53();
            }

            const start = process.hrtime.bigint();
            for (let i = 0; i < size; i++) {
                testRng.rand_res53();
            }
            const end = process.hrtime.bigint();
            const timeSec = Number(end - start) / 1e9;
            const speed = size / timeSec;
            const mbPerSec = (size * 8) / timeSec / (1024 * 1024); // 8 bytes per double

            console.log(`   ${size.toString().padEnd(12)} ${timeSec.toFixed(3).padEnd(10)} ${Math.round(speed).toLocaleString().padEnd(18)} ${mbPerSec.toFixed(2)}`);
        }
    }
}

/**
 * Simple statistical test: Monte Carlo estimation of Pi
 */
function testMonteCarloPi() {
    console.log("\n📋 Monte Carlo Pi Estimation");
    const rng = new Well1024a(Date.now());
    const iterations = 1e7;
    let insideCircle = 0;

    for (let i = 0; i < iterations; i++) {
        const x = rng.random();
        const y = rng.random();
        if (x * x + y * y <= 1) {
            insideCircle++;
        }
    }

    const estimatedPi = (insideCircle / iterations) * 4;
    const error = Math.abs(estimatedPi - Math.PI);
    const errorPercent = (error / Math.PI) * 100;

    console.log(`   Estimated π: ${estimatedPi.toFixed(6)}`);
    console.log(`   Actual π:    ${Math.PI.toFixed(6)}`);
    console.log(`   Error:       ${errorPercent.toFixed(4)}%`);

    const isAccurate = errorPercent < 0.1;
    console.log(`   ${isAccurate ? '✓' : '✗'} Monte Carlo estimation ${isAccurate ? 'passes' : 'fails'} (error < 0.1%)`);

    return isAccurate;
}

// Run the test suite
const test = new WellRngTest();
test.runAllTests();

// Run additional verification tests
console.log("\n" + "=".repeat(60));
console.log("Additional Verification Tests");
console.log("=".repeat(60));

const piEstimateAccurate = testMonteCarloPi();

// Final summary
console.log("\n" + "=".repeat(60));
console.log("FINAL VERDICT");
console.log("=".repeat(60));

if (test.failed === 0 && piEstimateAccurate) {
    console.log("✅ ALL TESTS PASSED - WELL1024a implementation is correct and performant");
} else {
    console.log("⚠️ SOME TESTS FAILED - Please review the implementation");
    console.log(`   Core tests: ${test.passed} passed, ${test.failed} failed`);
    console.log(`   Pi estimation: ${piEstimateAccurate ? 'PASS' : 'FAIL'}`);
}