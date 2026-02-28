function djb2(str) {
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) + hash) + str.charCodeAt(i);
        hash |= 0;
    }
    return Math.abs(hash) % 2147483647;
}

function fnv1a(str) {
    let hash = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
        hash ^= str.charCodeAt(i);
        hash = (hash * 0x01000193) >>> 0;
    }
    return hash;
}

const id = 'agent-momentum-01';
console.log(`djb2: ${djb2(id)}`);
console.log(`fnv1a: ${fnv1a(id)}`);
