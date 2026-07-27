// services/aiScreeningService.js
const db = require('../config/db');

// Jaro-Winkler similarity implementation
function jaroWinklerSimilarity(s1, s2) {
    if (!s1 || !s2) return 0;
    if (s1 === s2) return 1.0;

    s1 = s1.toLowerCase().trim();
    s2 = s2.toLowerCase().trim();

    const len1 = s1.length;
    const len2 = s2.length;

    const matchWindow = Math.floor(Math.max(len1, len2) / 2) - 1;

    const matches1 = new Array(len1).fill(false);
    const matches2 = new Array(len2).fill(false);

    let matches = 0;
    let transpositions = 0;

    for (let i = 0; i < len1; i++) {
        const start = Math.max(0, i - matchWindow);
        const end = Math.min(len2, i + matchWindow + 1);

        for (let j = start; j < end; j++) {
            if (!matches2[j] && s1[i] === s2[j]) {
                matches1[i] = true;
                matches2[j] = true;
                matches++;
                break;
            }
        }
    }

    if (matches === 0) return 0.0;

    let k = 0;
    for (let i = 0; i < len1; i++) {
        if (matches1[i]) {
            while (!matches2[k]) k++;
            if (s1[i] !== s2[k]) transpositions++;
            k++;
        }
    }

    const jaro = (matches / len1 + matches / len2 + (matches - transpositions / 2) / matches) / 3.0;

    const prefixThreshold = 4;
    const scalingFactor = 0.1;
    let prefixLen = 0;

    for (let i = 0; i < Math.min(prefixThreshold, len1, len2); i++) {
        if (s1[i] === s2[i]) {
            prefixLen++;
        } else {
            break;
        }
    }

    return jaro + prefixLen * scalingFactor * (1.0 - jaro);
}

exports.screenVisitorDetails = async (name, email, contactNumber) => {
    // 1. Check if matching details exist for blocked accounts
    const [blockedMatches] = await db.execute(
        `SELECT id, blocked_reason FROM visitors 
         WHERE (email = ? OR (contact_number = ? AND contact_number IS NOT NULL AND contact_number != '')) AND is_blocked = 1`,
        [email, contactNumber || '']
    );

    if (blockedMatches.length > 0) {
        return { duplicateDetected: true, reason: 'blocked', blockedReason: blockedMatches[0].blocked_reason };
    }

    // 2. Fuzzy name check against blocked accounts
    const [blockedVisitors] = await db.execute('SELECT full_name, blocked_reason FROM visitors WHERE is_blocked = 1');
    const threshold = parseFloat(process.env.DUPLICATE_THRESHOLD || '0.85');

    for (const visitor of blockedVisitors) {
        const similarity = jaroWinklerSimilarity(name, visitor.full_name);
        if (similarity >= threshold) {
            return { duplicateDetected: true, reason: 'blocked', blockedReason: visitor.blocked_reason };
        }
    }

    // 3. Normal duplicate checks
    const [exactMatches] = await db.execute(
        `SELECT id, full_name, email FROM visitors 
         WHERE email = ? OR (contact_number = ? AND contact_number IS NOT NULL AND contact_number != '')`,
        [email, contactNumber || '']
    );

    if (exactMatches.length > 0) {
        return { duplicateDetected: true, reason: 'exact' };
    }

    const [allVisitors] = await db.execute('SELECT full_name FROM visitors');
    for (const visitor of allVisitors) {
        const similarity = jaroWinklerSimilarity(name, visitor.full_name);
        if (similarity >= threshold) {
            return { duplicateDetected: true, reason: 'fuzzy', matchedName: visitor.full_name };
        }
    }

    return { duplicateDetected: false };
};
