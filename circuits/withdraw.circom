pragma circom 2.0.5;

// Adapted from hideyour-cash/hideyour-cash packages/circuits/circom/withdraw.circom
// at commit 6f27e38ec543bc392c00c9201c19f783a485b655 (MIT), which follows
// tornadocash/tornado-core circuits/withdraw.circom. Changes: the allowlist tree and the
// originDepositor input are removed, so the commitment is MiMC(secret, nullifier).
// Nothing else is changed.

include "circomlib/circuits/bitify.circom";
include "merkleTree.circom";

// commitment = MiMCSponge(secret, nullifier), nullifierHash = MiMCSponge(nullifier)
template CommitmentHasher() {
    signal input nullifier;
    signal input secret;
    signal output commitment;
    signal output nullifierHash;

    component commitmentHasher = MiMCSponge(2, 220, 1);
    component nullifierHasher = MiMCSponge(1, 220, 1);

    nullifierHasher.ins[0] <== nullifier;
    nullifierHasher.k <== 0;

    commitmentHasher.ins[0] <== secret;
    commitmentHasher.ins[1] <== nullifier;
    commitmentHasher.k <== 0;

    commitment <== commitmentHasher.outs[0];
    nullifierHash <== nullifierHasher.outs[0];
}

// Proves that a commitment made from this secret and nullifier is in the deposit tree
template Withdraw(levels) {
    signal input root;
    signal input nullifierHash;
    signal input recipient; // not taking part in any computations
    signal input relayer;  // not taking part in any computations
    signal input fee;      // not taking part in any computations
    signal input refund;   // not taking part in any computations
    signal input nullifier;
    signal input secret;
    signal input pathElements[levels];
    signal input pathIndices[levels];

    component hasher = CommitmentHasher();
    hasher.nullifier <== nullifier;
    hasher.secret <== secret;
    hasher.nullifierHash === nullifierHash;

    component tree = MerkleTreeChecker(levels);
    tree.leaf <== hasher.commitment;
    tree.root <== root;
    for (var i = 0; i < levels; i++) {
        tree.pathElements[i] <== pathElements[i];
        tree.pathIndices[i] <== pathIndices[i];
    }

    // Bind recipient, relayer, fee and refund to the proof (as in tornado-core)
    signal recipientSquare;
    signal feeSquare;
    signal relayerSquare;
    signal refundSquare;
    recipientSquare <== recipient * recipient;
    feeSquare <== fee * fee;
    relayerSquare <== relayer * relayer;
    refundSquare <== refund * refund;
}

component main {public [root, nullifierHash, recipient, relayer, fee, refund]} = Withdraw(20);
