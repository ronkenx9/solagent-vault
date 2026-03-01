import { EventSource } from 'eventsource';
import chalk from 'chalk';

const API_BASE = 'http://localhost:3001';

console.clear();
console.log(chalk.bold.magenta('==================================================='));
console.log(chalk.bold.magenta('⚔️  SOLAGENT VAULT V2 — TERMINAL MISSION CONTROL ⚔️'));
console.log(chalk.bold.magenta('===================================================\n'));

console.log(chalk.gray('Connecting to vault-api stream at ' + API_BASE + '...'));

const events = new EventSource(`${API_BASE}/vault/events`);

events.onopen = () => {
    console.log(chalk.green('✅ Connected to Secure SSE Event Stream. Monitoring Agents...\n'));
};

events.onerror = () => {
    console.log(chalk.red('❌ Connection lost. Retrying... (Is vault-api running on port 3001?)'));
};

events.onmessage = (e: any) => {
    try {
        const event = JSON.parse(e.data);
        const time = new Date(event.timestamp).toLocaleTimeString();
        const prefix = chalk.gray(`[${time}]`) + ' ' + chalk.bold.cyan(event.agentId.padEnd(22));

        switch (event.type) {
            case 'reasoning':
                console.log(`${prefix} ${chalk.blue('🧠 THOUGHT:')}`);
                console.log(`                          ${chalk.italic.gray(event.data.context.marketCtx.priceSignal === 'BULLISH' ? '📈 BULLISH' : '📉 BEARISH')} — ${chalk.italic(event.data.decision.reasoning)}`);
                break;

            case 'decision':
                const isHold = event.data.action === 'HOLD';
                const actionText = isHold ? chalk.yellow('HOLD') : chalk.magenta(event.data.action);
                console.log(`${prefix} ${chalk.yellow('⚖️  DECISION:')} ${actionText} (Confidence: ${event.data.confidence})`);
                break;

            case 'tx_executed':
                console.log(`${prefix} ${chalk.green('✅ SIGNED & MEMOED:')} ${event.data.intent.action}`);
                console.log(`                          ${chalk.greenBright(`Sig: https://explorer.solana.com/tx/${event.data.signature}?cluster=devnet`)}`);
                break;

            case 'tx_blocked':
                const reason = event.data.reason || '';
                if (reason.includes("Rent Upkeep")) {
                    console.log(`${prefix} ${chalk.yellowBright('🔋 RENT SHIELD:')} ${chalk.yellow(reason)}`);
                } else if (reason.includes("Simulation") || reason.includes("static analysis")) {
                    console.log(`${prefix} ${chalk.redBright('🛑 SIMULATION FAILED:')} ${chalk.red(reason)}`);
                } else {
                    console.log(`${prefix} ${chalk.red('🛡️  POLICY BLOCKED:')} ${chalk.red(reason)}`);
                }
                break;

            case 'policy_updated':
                const limit = event.data.policy.maxLamportsPerTx / 1e9;
                console.log(`${prefix} ${chalk.magenta('⚙️  POLICY SCALED:')} New risk cap: ${chalk.bold.white(limit.toFixed(2))} SOL`);
                break;

            case 'tick':
                // Optional: print heartbeat or just ignore to keep terminal uncluttered
                break;

            default:
                break;
        }
    } catch (err) {
        console.error(chalk.red('Failed to parse event:'), e?.data);
    }
};

// Keep alive
setInterval(() => { }, 1000);
