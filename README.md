# Self-Checkout Judging 01

Deterministic one-line remark writer for the make.fun competition
"The Self-Checkout Is Judging You".

`main.ts` holds a hand-written list of original remarks from a judgmental
self-checkout machine, scores each against the judge's brief (a real laugh
on a single read, a petty machine's-eye view of the basket, no padding),
and writes the winning line to `$MAKEFUN_OUTPUT_DIR/entry.txt`
(default `output/`).

Run: `node main.ts` (Node 22, zero dependencies).
