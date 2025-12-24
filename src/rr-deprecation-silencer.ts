// Silences specific React Router future-flag deprecation warnings that
// currently appear in development consoles. This file is intentionally
// tiny and only filters messages that mention the v7_startTransition
// future-flag advisory. Keep changes minimal to avoid hiding other
// important warnings.

const _origWarn = console.warn.bind(console);

console.warn = (...args: any[]) => {
    try {
        if (args && args.length > 0) {
            const first = String(args[0]);
            if (first.includes('React Router Future Flag Warning') && first.includes('v7_startTransition')) {
                // ignore this specific advisory
                return;
            }
            // Some messages log the full text as the second arg (object); check that too
            if (args.length > 1 && typeof args[1] === 'string' && args[1].includes('v7_startTransition')) {
                return;
            }
        }
    } catch (e) {
        // If anything goes wrong, fall back to original warn to avoid hiding messages
        return _origWarn(...args);
    }
    return _origWarn(...args);
};

export {};
