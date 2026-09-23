import typescript from "@rollup/plugin-typescript";
import resolve from "@rollup/plugin-node-resolve";
import terser from "@rollup/plugin-terser";

export default {
    input: "src/index.ts",
    output: [
        {
            file: "dist/index.js",
            format: "iife",
            name: "BidirectionalTyping",
        },
        {
            file: "dist/index.mjs",
            format: "es",
        },
        {
            file: "dist/index.cjs",
            format: "cjs",
        },
    ],
    plugins: [
        resolve(),
        typescript(),
        terser(),
    ],
};