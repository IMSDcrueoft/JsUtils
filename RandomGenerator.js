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


/**
 * Base class for random number generators.
 * Provides utility methods for generating random numbers in various ranges.
 * @class
 */
class IRandomGenerator {
    constructor() {}

    /**
     * Generates a random 32-bit unsigned integer.
     * Must be overridden by subclasses.
     * @returns {number} A random integer in [0, 0xffffffff]
     */
    rand_uint32(){}

    /**
     * Generates a random number on [0, 1] interval (inclusive both ends).
     * @returns {number} A random number in [0, 1]
     */
    rand_real1() {
        return this.rand_uint32() * (1.0 / 4294967295.0); // divided by 2^32 - 1
    }

    /**
     * Generates a random number on [0, 1) interval (inclusive 0, exclusive 1).
     * @returns {number} A random number in [0, 1)
     */
    rand_real2() {
        return this.rand_uint32() * (1.0 / 4294967296.0); // divided by 2^32
    }

    /**
     * Generates a random number on (0, 1) interval (exclusive both ends).
     * @returns {number} A random number in (0, 1)
     */
    rand_real3() {
        return (this.rand_uint32() + 0.5) * (1.0 / 4294967296.0); // divided by 2^32
    }

    /**
     * Generates a random number on [0, 1) with 53-bit resolution.
     * Combines two 32-bit values to achieve double precision.
     * @returns {number} A random number in [0, 1) with 53-bit resolution
     */
    rand_res53() {
        let a = this.rand_uint32() >>> 5;  // 27 bits
        let b = this.rand_uint32() >>> 6;  // 26 bits
        return (a * 67108864.0 + b) * (1.0 / 9007199254740992.0); // divided by 2^53
    }

    /**
     * Alias for rand_real2(). Generates a random number on [0, 1).
     * @returns {number} A random number in [0, 1)
     */
    random() {
        return this.rand_uint32() * (1.0 / 4294967296.0); // divided by 2^32
    }

    /**
     * Skip forward in the state of the RNG by count steps.
     * @param {number} count - Number of random numbers to skip
     */
    skip(count) {
        for (let i = 0; i < count; ++i) {
            this.rand_uint32();
        }
    }

    /**
     * Initializes the internal state. Must be overridden.
     */
    init_generateRand(s){}

    /**
     * Initializes state from an array. Must be overridden.
     * @param {number[]} init_key - Array of seed values
     */
    init_by_array(init_key) {}

    /**
     * Clones the current state of the RNG.
     * @returns {Object} A shallow copy of the RNG state
     */
    cloneState() {
        const state = Object.create(null);
        for (let key in this) {
            state[key] = this[key];
        }
        return state;
    }

    /**
     * Restores the RNG state from a previously cloned state object.
     * @param {Object} stateObj - The state object to restore
     */
    restoreState(stateObj) {
        const keys = Object.keys(Object(stateObj));
        for (let i = 0, len = keys.length; i < len; ++i) {
            const key = keys[i];
            this[key] = stateObj[key];
        }
    }

    /**
     * Executes a callback in an isolated context, restoring RNG state afterward.
     * Useful for ensuring the RNG state is unchanged after specific operations.
     * @param {Function} callback - Function that receives this RNG instance
     * @returns {*} The return value of the callback
     */
    IsolatedRand(callback) {
        const stateObj = this.cloneState(); // save current state
        try {
            return callback(this); // execute the callback
        } finally {
            this.restoreState(stateObj); // restore state regardless of errors
        }
    }
}

/**
 * WELL1024a Random Number Generator (32-bit implementation).
 * WELL (Well Equidistributed Long-period Linear) is a family of RNGs
 * with better equidistribution properties than Mersenne Twister.
 * 
 * This implementation uses 1024 bits of state (32 x 32-bit words).
 * @class
 * @extends IRandomGenerator
 */
class Well1024a extends IRandomGenerator {
    /**
     * Creates a new WELL1024a RNG instance.
     * @param {number|Array} seed - Optional seed value or array. Defaults to current timestamp.
     * @throws {TypeError} If called without 'new' operator
     */
    constructor(seed) {
        super(); // call parent constructor

        if (!(this instanceof Well1024a)) {
            throw new TypeError("Class constructor cannot be invoked without 'new'");
        }

        if (seed == null) {
            seed = Date.now();
        }

        /** @type {Uint32Array} State array of 32 32-bit words (1024 bits total) */
        this.state = new Uint32Array(32);
        
        /** @type {number} Current index into the state array (0-31) */
        this.index = 0;

        this.init_generateRand(seed);
    }

    /**
     * Initializes the generator with a single integer seed.
     * @param {number} s - Seed value (converted to unsigned 32-bit)
     */
    init_generateRand(s) {
        this.init_by_array([s >>> 0]);
    }

    /**
     * Initializes the state array using a seed array.
     * @param {number[]} init_key - Array of seed values
     */
    init_by_array(init_key) {
        const state = this.state;

        // Standard linear feedback initialization.
        // Formula: v[i] = 1812433253 * (v[i-1] ^ (v[i-1] >> 30)) + i
        // This is identical to MT19937 initialization.
        state[0] = init_key[0];

        for (let i = 1; i < 32; i++) {
            let prev = state[i - 1];
            state[i] = 1812433253 * (prev ^ (prev >> 30)) + i;
        }

        // If multiple seeds are provided, XOR additional seeds into the state.
        // This is the standard approach used in AbstractWell.
        const len = Math.min(init_key.length, 32);
        if (len > 1) {
            for (let i = 0; i < len; i++) {
                state[i] ^= init_key[i];
            }
        }

        // Defensive check: ensure the state is not all zeros.
        // The linear recurrence above is extremely unlikely to produce an
        // all-zero state, but we check anyway for robustness.
        if (state.every(value => value === 0)) {
            state[0] = 0xffffffff;  // Force a non-zero value
        }

        // Reset index to start of state array
        this.index = 0;
    }

    /**
     * Clones the current RNG state for later restoration.
     * @returns {{state: Uint32Array, index: number}} A copy of the state and index
     */
    cloneState() {
        return {
            state: new Uint32Array(this.state),
            index: this.index
        };
    }

    /**
     * Restores the RNG state from a previously cloned state object.
     * @param {{state: Uint32Array, index: number}} stateObj - The state to restore
     */
    restoreState(stateObj) {
        this.state = stateObj.state;
        this.index = stateObj.index;
    }

    /**
     * Generates the next 32-bit random number using the WELL1024a algorithm.
     * 
     * Algorithm steps from the original paper:
     * - z0 = rot_p(v_r-2, v_r-1)
     * - z1 = T0(v_0) ^ T1(v_m1)
     * - z2 = T2(v_m2) ^ T3(v_m3)
     * - z3 = z1 ^ z2
     * - z4 = T4(z0) ^ T5(z1) ^ T6(z2) ^ T7(z3)
     * - v_next(r-1) = v_(r-2) & m_p
     * - For j = r-2 down to 2: v_next(j) = v_(j-1)
     * - v_next(1) = z3
     * - v_next(0) = z4
     * - Output = v_1 or v_0
     * 
     * @returns {number} A random 32-bit unsigned integer
     */
    rand_uint32() {
        const state = this.state;
        let index = this.index;
        
        // Retrieve state values at specific offsets (the "WELL" indices)
        const v_m1 = state[(index + 3) & 31];   // offset 3
        const v_m2 = state[(index + 24) & 31];  // offset 24
        const v_m3 = state[(index + 10) & 31];  // offset 10
        
        // z0 = rotated combination of v_r-2 and v_r-1
        const nextIndex = (index + 31) & 31;
        let z0 = state[nextIndex];
        
        // z1 = T0(v_0) ^ T1(v_m1) with tempering
        let z1 = z0 ^ (v_m1 ^ (v_m1 >>> 8));
        
        // z2 = T2(v_m2) ^ T3(v_m3) with tempering
        let z2 = v_m2 ^ (v_m2 << 19) ^ v_m3 ^ (v_m3 << 14);
        
        // z3 = combination
        const z3 = (z1 ^ z2) >>> 0;
        
        // Store z3 in current index position
        state[index] = z3;
        
        // Advance index and compute output with additional tempering
        this.index = nextIndex;
        const output = (z0 ^ (z0 << 11) ^ z1 ^ (z1 << 7) ^ z2 ^ (z2 << 13)) >>> 0;
        state[nextIndex] = output;
        
        return output;
    }
}

exports.IRandomGenerator = IRandomGenerator;
exports.Well1024a = Well1024a;